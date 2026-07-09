/**
 * OFD core engine — parse, render, rasterize, and export.
 *
 * Rendering pipeline guarantees:
 *  - Hi-DPI canvas sizing (devicePixelRatio-aware, budget-clamped)
 *  - Z-index layer ordering and blend-mode mapping before rasterization
 *  - Embedded font loading with system-font fallback
 *  - Image/stamp hydration for transparent overlay layers
 *  - Aggressive GC: Blob URL revocation, canvas release, buffer nullification
 */
import JSZip from "jszip";
import { isCanvasMostlyBlank } from "@/scripts/pdf-render";
import { loadOfdEmbeddedFonts } from "@/scripts/ofd-font-loader";
import { hydratePagesMedia } from "@/scripts/ofd-image-hydrator";
import {
  overlayPagesContent,
  getPagePaintContext,
  paintMissingPageContentOntoCanvas,
  countDynamicContentItems,
  loadPageContentMeta,
} from "@/scripts/ofd-content-overlay";
import { stitchLongImageInWorker, terminateOfdRasterWorker } from "@/scripts/ofd-raster-client";
import {
  BlobUrlRegistry,
  createHiDpiCanvas,
  enforcePageLayerOrder,
  getAdaptiveCanvasScale,
  getAdaptiveRenderWidth,
  getLongImageMaxDim,
  isCanvasRenderable,
  measureCanvasInkRatio,
  releaseBuffer,
  releaseCanvas,
  releaseCanvases,
  triggerBlobDownload,
  yieldToMain,
} from "@/scripts/ofd-render-utils";
import {
  compressOfdInWorker,
  extractOfdTextInWorker,
  mergeOfdInWorker,
} from "@/scripts/ofd-zip-client";
import { getOfdPageCountFromBuffer } from "@/scripts/ofd-zip-ops";
import { renderOfdToCanvasesNative } from "@/scripts/ofd-native-renderer";

export type OfdProgressReporter = (percent: number, stageKey: string) => void;

const PARSE_TIMEOUT_MS = 90_000;
const RASTERIZE_TIMEOUT_MS = 45_000;
const DEFAULT_RENDER_WIDTH = 794;
const OFD_SCRIPT = "/vendor/ofd.umd.min.js";

const mediaUrlRegistry = new BlobUrlRegistry();
let activePaintContexts: import("@/scripts/ofd-content-overlay").PagePaintContext[] = [];

function withTimeout<T>(promise: Promise<T>, ms: number, errorCode: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorCode)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function renderWidth(): number {
  return getAdaptiveRenderWidth(DEFAULT_RENDER_WIDTH);
}

export type OfdParsedDocument = {
  pages: unknown[];
  document?: unknown;
  tpls?: unknown;
  fontResObj?: unknown;
  drawParamResObj?: unknown;
  multiMediaResObj?: unknown;
};

type OfdApi = {
  parseOfdDocument: (options: {
    ofd: File | Blob | ArrayBuffer;
    success?: (res: OfdParsedDocument[] | OfdParsedDocument) => void;
    fail?: (error: unknown) => void;
  }) => void;
  renderOfd: (width: number, ofd: OfdParsedDocument) => HTMLElement[] | HTMLElement;
};

type OfdWindow = Window & { ofd?: OfdApi };

let ofdLoadPromise: Promise<OfdApi> | null = null;

export function isOfdFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".ofd") || file.type === "application/ofd";
}

async function loadOfdModule(): Promise<OfdApi> {
  if (ofdLoadPromise) return ofdLoadPromise;

  ofdLoadPromise = (async () => {
    const win = window as OfdWindow;
    if (win.ofd?.parseOfdDocument) return win.ofd;

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-ofd-lib]");
      if (existing) {
        if (win.ofd) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("ofd-script-load-failed")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = OFD_SCRIPT;
      script.dataset.ofdLib = "";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("ofd-script-load-failed"));
      document.head.appendChild(script);
    });

    if (!win.ofd?.parseOfdDocument) throw new Error("ofd-global-missing");
    return win.ofd;
  })();

  return ofdLoadPromise;
}

function normalizeDocs(result: OfdParsedDocument[] | OfdParsedDocument): OfdParsedDocument[] {
  return Array.isArray(result) ? result : [result];
}

function normalizePageDivs(result: HTMLElement | HTMLElement[]): HTMLElement[] {
  return Array.isArray(result) ? result : [result];
}

function parsePageSize(pageDiv: HTMLElement, fallbackWidth: number): { w: number; h: number } {
  const style = pageDiv.getAttribute("style") ?? "";
  const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
  const hMatch = style.match(/height:\s*(\d+(?:\.\d+)?)px/);
  const w = wMatch ? Math.round(Number(wMatch[1])) : fallbackWidth;
  const h = hMatch ? Math.round(Number(hMatch[1])) : Math.round(fallbackWidth * 1.414);
  return { w: w || fallbackWidth, h: h || Math.round(fallbackWidth * 1.414) };
}

const FONTS_READY_TIMEOUT_MS = 2_500;
const IMAGE_EXT = /\.(jpe?g|png|bmp|gif|webp|tif{1,2})$/i;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForPageResources(pageDiv: HTMLElement): Promise<void> {
  await waitForPaint();
  enforcePageLayerOrder(pageDiv);

  const images = Array.from(pageDiv.querySelectorAll("img"));
  await Promise.all(
    images.map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );

  try {
    if (document.fonts?.ready) {
      await withTimeout(document.fonts.ready, FONTS_READY_TIMEOUT_MS, "fonts-ready-timeout").catch(
        () => undefined
      );
    }
  } catch {
    /* non-fatal */
  }
  await waitForPaint();
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const clone = document.createElement("canvas");
  clone.width = source.width;
  clone.height = source.height;
  const ctx = clone.getContext("2d");
  if (!ctx) throw new Error("canvas-context");
  ctx.drawImage(source, 0, 0);
  return clone;
}

/** Rasterize SVG with Hi-DPI backing store; inlines blob/data image refs first. */
async function rasterizeSvgToCanvas(svg: SVGElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const prepared = await prepareSvgForRaster(svg);
  const { canvas, ctx } = createHiDpiCanvas(width, height);

  prepared.setAttribute("width", String(width));
  prepared.setAttribute("height", String(height));
  if (!prepared.getAttribute("xmlns")) {
    prepared.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const serialized = new XMLSerializer().serializeToString(prepared);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve();
      };
      img.onerror = () => reject(new Error("svg-rasterize-failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  return canvas;
}

const XLINK_NS = "http://www.w3.org/1999/xlink";

async function blobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then(r => r.blob());
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("dataurl-failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Clone SVG and inline blob/http image refs so rasterization keeps photos and stamps. */
async function prepareSvgForRaster(svg: SVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const images = clone.querySelectorAll("image");

  await Promise.all(
    Array.from(images).map(async node => {
      const href =
        node.getAttribute("href") ??
        node.getAttributeNS(XLINK_NS, "href") ??
        node.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;

      let dataUrl: string | null = null;
      if (href.startsWith("blob:")) {
        dataUrl = await blobUrlToDataUrl(href);
      } else if (href.startsWith("http") || href.startsWith("/")) {
        try {
          dataUrl = await blobUrlToDataUrl(href);
        } catch {
          /* ignore */
        }
      }

      if (!dataUrl) return;
      node.setAttribute("href", dataUrl);
      node.setAttributeNS(XLINK_NS, "href", dataUrl);
    })
  );

  return clone;
}

function acceptCanvas(canvas: HTMLCanvasElement, minInk = 0.004): HTMLCanvasElement | null {
  return isCanvasRenderable(canvas, minInk) ? canvas : null;
}

async function rasterizePageDivWithHtml2Canvas(
  pageDiv: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  enforcePageLayerOrder(pageDiv);
  const { default: html2canvas } = await import("html2canvas");
  return withTimeout(
    html2canvas(pageDiv, {
      scale: getAdaptiveCanvasScale(),
      width,
      height,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (doc: Document) => {
        const host = doc.querySelector("[data-ofd-offscreen-host]");
        const cloned =
          host?.querySelector("[data-ofd-page-clone]") ??
          doc.body.querySelector("[data-ofd-page-clone]") ??
          doc.body.firstElementChild;
        if (cloned instanceof HTMLElement) {
          cloned.style.transform = "none";
          cloned.style.opacity = "1";
          cloned.style.visibility = "visible";
          enforcePageLayerOrder(cloned);
        }
      },
    }),
    RASTERIZE_TIMEOUT_MS,
    "timeout"
  );
}

/**
 * Layer-aware compositing: paint child layers in z-index order onto a Hi-DPI canvas.
 * Used when native canvas / SVG paths produce blank or clipped output.
 */
async function compositePageLayers(
  pageDiv: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement | null> {
  enforcePageLayerOrder(pageDiv);
  const { canvas, ctx } = createHiDpiCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const layers = Array.from(pageDiv.children) as HTMLElement[];
  if (layers.length === 0) return null;

  let painted = false;
  for (const layer of layers) {
    const tag = layer.tagName.toLowerCase();
    if (tag === "canvas" && layer instanceof HTMLCanvasElement && layer.width > 0) {
      ctx.drawImage(layer, 0, 0, width, height);
      painted = true;
      continue;
    }
    if (tag === "svg" && layer instanceof SVGSVGElement) {
      try {
        const sub = await rasterizeSvgToCanvas(layer, width, height);
        ctx.drawImage(sub, 0, 0, width, height);
        releaseCanvas(sub);
        painted = true;
      } catch {
        /* try next layer */
      }
    }
  }

  return painted && isCanvasRenderable(canvas) ? canvas : null;
}

export type OfdPreviewResult = {
  pages: HTMLElement[];
  canvases: HTMLCanvasElement[];
  docs: OfdParsedDocument[];
  usedImageFallback: boolean;
  partialRaster: boolean;
};

async function getOfdPageCount(file: File): Promise<number> {
  return getOfdPageCountFromBuffer(await file.arrayBuffer());
}

async function tryEmbeddedImagesFallback(file: File): Promise<HTMLCanvasElement[] | null> {
  const [pageCount, images] = await Promise.all([getOfdPageCount(file), extractOfdImages(file)]);
  if (images.length === 0) return null;

  const canvases: HTMLCanvasElement[] = [];
  for (const blob of images) {
    try {
      const canvas = await blobToCanvas(blob);
      if (isCanvasRenderable(canvas)) canvases.push(canvas);
      else releaseCanvas(canvas);
    } catch {
      /* skip broken asset */
    }
  }
  if (canvases.length === 0) return null;

  canvases.sort(
    (a, b) =>
      measureCanvasInkRatio(b) * b.width * b.height -
      measureCanvasInkRatio(a) * a.width * a.height
  );
  if (pageCount <= 1) return canvases[0] ? [canvases[0]] : null;
  if (canvases.length === pageCount) return canvases;
  if (canvases.length > pageCount) return canvases.slice(0, pageCount);
  return canvases;
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image-load-failed"));
      image.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const { canvas, ctx } = createHiDpiCanvas(w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractOfdImages(file: File): Promise<Blob[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  releaseBuffer(buf);
  const images: { path: string; blob: Blob }[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !IMAGE_EXT.test(path)) continue;
    images.push({ path, blob: await entry.async("blob") });
  }

  images.sort((a, b) => naturalSort(a.path, b.path));
  return images.map(item => item.blob);
}

export async function pageDivToCanvas(
  pageDiv: HTMLElement,
  fallbackWidth = DEFAULT_RENDER_WIDTH
): Promise<HTMLCanvasElement> {
  await waitForPageResources(pageDiv);
  const { w, h } = parsePageSize(pageDiv, fallbackWidth);
  const hasOverlayDom = Boolean(
    pageDiv.querySelector("[data-ofd-content-overlay]")?.childElementCount
  );
  const minInk = pageDiv.querySelector("img, image") ? 0.008 : 0.004;
  const mustDomRaster = hasOverlayDom || activePaintContexts.length > 0;

  const attempts: HTMLCanvasElement[] = [];

  async function finalizeCanvas(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    let ctx = getPagePaintContext(pageDiv);
    if (!ctx) {
      const idx = Array.from(
        pageDiv.parentElement?.querySelectorAll("[data-ofd-page-clone]") ?? []
      ).indexOf(pageDiv);
      ctx = activePaintContexts[idx >= 0 ? idx : 0];
    }
    if (ctx) {
      const expected = countDynamicContentItems(ctx.meta.contentXml);
      const painted = await paintMissingPageContentOntoCanvas(canvas, ctx, h);
      if (expected > 0 && painted === 0) {
        canvas.dataset.ofdNeedsRepaint = "1";
      } else {
        delete canvas.dataset.ofdNeedsRepaint;
      }
    }
    return canvas;
  }

  if (mustDomRaster) {
    try {
      const domRaster = await finalizeCanvas(await rasterizePageDivWithHtml2Canvas(pageDiv, w, h));
      const accepted = acceptCanvas(domRaster, minInk);
      if (accepted) return domRaster;
      attempts.push(domRaster);
    } catch {
      /* fall through */
    }
  }

  const existing = pageDiv.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement && existing.width > 0 && existing.height > 0) {
    const cloned = await finalizeCanvas(cloneCanvas(existing));
    const needsRepaint = cloned.dataset.ofdNeedsRepaint === "1";
    const accepted = !needsRepaint ? acceptCanvas(cloned, minInk) : null;
    if (accepted) return cloned;
    attempts.push(cloned);
  }

  if (!mustDomRaster) {
    try {
      const domRaster = await finalizeCanvas(await rasterizePageDivWithHtml2Canvas(pageDiv, w, h));
      const accepted = acceptCanvas(domRaster, minInk);
      if (accepted) return domRaster;
      attempts.push(domRaster);
    } catch {
      /* fall through */
    }
  }

  const svg = pageDiv.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    try {
      const rasterized = await finalizeCanvas(await rasterizeSvgToCanvas(svg, w, h));
      const accepted = acceptCanvas(rasterized, minInk);
      if (accepted) return rasterized;
      attempts.push(rasterized);
    } catch {
      /* fall through */
    }
  }

  const composited = await compositePageLayers(pageDiv, w, h);
  if (composited) {
    const finalized = await finalizeCanvas(composited);
    const accepted = acceptCanvas(finalized, minInk);
    if (accepted) return finalized;
    attempts.push(finalized);
  }

  for (const canvas of attempts) releaseCanvas(canvas);
  throw new Error("no-renderable-page");
}

async function canvasesFromRenderedPages(
  pages: HTMLElement[],
  width = renderWidth(),
  onProgress?: OfdProgressReporter
): Promise<{ canvases: HTMLCanvasElement[]; partial: boolean }> {
  const canvases: HTMLCanvasElement[] = [];
  let failures = 0;

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(55 + Math.round(((i + 1) / pages.length) * 30), "progressRasterizing");
    try {
      canvases.push(await pageDivToCanvas(pages[i], width));
    } catch {
      failures += 1;
    }
    await yieldToMain();
  }

  return { canvases, partial: failures > 0 && canvases.length > 0 };
}

async function tryNativeExportCanvases(
  file: File,
  width: number,
  onProgress?: OfdProgressReporter
): Promise<HTMLCanvasElement[] | null> {
  try {
    const canvases = await renderOfdToCanvasesNative(file, mediaUrlRegistry, {
      targetWidthPx: width,
      onProgress: pct => onProgress?.(pct, "progressRasterizing"),
    });
    const valid = canvases.filter(c => isCanvasRenderable(c));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export async function resolveExportCanvases(
  file: File,
  onProgress?: OfdProgressReporter
): Promise<HTMLCanvasElement[]> {
  onProgress?.(12, "progressFonts");
  await loadOfdEmbeddedFonts(file);

  onProgress?.(22, "progressParsing");
  const width = renderWidth();

  const native = await tryNativeExportCanvases(file, width, onProgress);
  if (native?.length) {
    onProgress?.(92, "progressExporting");
    return native.map(cloneCanvas);
  }

  onProgress?.(28, "progressLoadingLib");
  await withTimeout(loadOfdModule(), 30_000, "ofd-script-load-failed");

  const { pages } = await parseAndRenderOfd(file, width, onProgress, { skipFonts: true });

  if (pages.length > 0) {
    onProgress?.(48, "progressRasterizing");
    const { canvases: fresh, partial } = await withPagesMounted(file, pages, () =>
      canvasesFromRenderedPages(pages, width, onProgress)
    );
    const valid = fresh.filter(c => isCanvasRenderable(c));
    if (valid.length > 0) {
      const metas = await loadPageContentMeta(file);
      const dynamicItems = metas.reduce((n, m) => n + countDynamicContentItems(m.contentXml), 0);
      if (dynamicItems === 0) {
        const embedded = await tryEmbeddedImagesFallback(file);
        if (embedded?.length) {
          const domInk = Math.max(...valid.map(measureCanvasInkRatio));
          const embInk = Math.max(...embedded.map(measureCanvasInkRatio));
          if (embInk > domInk * 1.25) {
            onProgress?.(92, "progressExporting");
            for (const c of valid) releaseCanvas(c);
            return embedded.filter(c => isCanvasRenderable(c)).map(cloneCanvas);
          }
          for (const c of embedded) releaseCanvas(c);
        }
      }
      onProgress?.(92, "progressExporting");
      if (partial) onProgress?.(90, "progressPartialRaster");
      return valid.map(cloneCanvas);
    }
  }

  onProgress?.(80, "progressExporting");
  const embedded = await tryEmbeddedImagesFallback(file);
  if (embedded?.length) return embedded.map(cloneCanvas);

  throw new Error("no-visual");
}

export async function exportFileToSvgZip(
  file: File,
  baseName: string,
  onProgress?: OfdProgressReporter
): Promise<Blob> {
  onProgress?.(10, "progressLoadingLib");
  await withTimeout(loadOfdModule(), 30_000, "ofd-script-load-failed");
  onProgress?.(25, "progressFonts");
  await loadOfdEmbeddedFonts(file);
  onProgress?.(40, "progressParsing");
  const { pages } = await loadOfdPreview(file, DEFAULT_RENDER_WIDTH, onProgress, {
    skipFonts: true,
  });
  if (pages.length === 0) throw new Error("no-svg");
  onProgress?.(75, "progressExporting");
  return withPagesMounted(file, pages, () => exportPagesToSvgZip(pages, baseName));
}

async function withPagesMounted<T>(
  file: File | null,
  pages: HTMLElement[],
  fn: () => Promise<T>
): Promise<T> {
  if (pages.length === 0) return fn();

  let mountWidth = DEFAULT_RENDER_WIDTH;
  let mountHeight = 0;
  for (const page of pages) {
    const { w, h } = parsePageSize(page, DEFAULT_RENDER_WIDTH);
    mountWidth = Math.max(mountWidth, w);
    mountHeight += h;
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.ofdOffscreenHost = "";
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${mountWidth}px`,
    `min-height:${mountHeight}px`,
    "transform:translateX(-100vw)",
    "z-index:-1",
    "opacity:1",
    "visibility:visible",
    "pointer-events:none",
    "overflow:visible",
    "background:#ffffff",
  ].join(";");

  for (const page of pages) {
    page.dataset.ofdPageClone = "";
    host.appendChild(page);
  }
  document.body.appendChild(host);

  try {
    if (file) {
      await hydratePagesMedia(file, pages, mediaUrlRegistry);
      activePaintContexts = await overlayPagesContent(file, pages, mediaUrlRegistry);
    }
    for (const page of pages) await waitForPageResources(page);
    return await fn();
  } finally {
    activePaintContexts = [];
    host.remove();
  }
}

export async function parseAndRenderOfd(
  file: File | ArrayBuffer,
  width = DEFAULT_RENDER_WIDTH,
  onProgress?: OfdProgressReporter,
  options?: { skipFonts?: boolean }
): Promise<{ pages: HTMLElement[]; docs: OfdParsedDocument[] }> {
  if (file instanceof File && !options?.skipFonts) {
    await loadOfdEmbeddedFonts(file);
  }

  const ofd = await loadOfdModule();
  onProgress?.(38, "progressRendering");

  return withTimeout(
    new Promise<{ pages: HTMLElement[]; docs: OfdParsedDocument[] }>((resolve, reject) => {
      ofd.parseOfdDocument({
        ofd: file,
        success(res) {
          try {
            const docs = normalizeDocs(res);
            const pages: HTMLElement[] = [];
            for (const doc of docs) {
              const rendered = normalizePageDivs(ofd.renderOfd(width, doc));
              pages.push(...rendered);
            }
            if (pages.length === 0) throw new Error("no-pages");
            resolve({ pages, docs });
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
        fail(error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      });
    }),
    PARSE_TIMEOUT_MS,
    "timeout"
  );
}

export async function loadOfdPreview(
  file: File,
  width = DEFAULT_RENDER_WIDTH,
  onProgress?: OfdProgressReporter,
  options?: { skipFonts?: boolean }
): Promise<OfdPreviewResult> {
  if (!isOfdFile(file)) throw new Error("invalid-ofd");

  if (!options?.skipFonts) {
    onProgress?.(12, "progressFonts");
    await loadOfdEmbeddedFonts(file);
  }

  const metas = await loadPageContentMeta(file);
  const dynamicItems = metas.reduce((n, m) => n + countDynamicContentItems(m.contentXml), 0);

  const native = await tryNativeExportCanvases(file, width, onProgress);
  if (native?.length) {
    return {
      pages: [],
      canvases: native.map(cloneCanvas),
      docs: [],
      usedImageFallback: false,
      partialRaster: false,
    };
  }

  try {
    const { pages, docs } = await parseAndRenderOfd(file, width, onProgress, options);

    if (pages.length > 0) {
      onProgress?.(48, "progressRasterizing");
      const { canvases, partial } = await withPagesMounted(file, pages, () =>
        canvasesFromRenderedPages(pages, width, onProgress)
      );
      if (canvases.length > 0 && !canvases.every(isCanvasMostlyBlank)) {
        return { pages, canvases, docs, usedImageFallback: false, partialRaster: partial };
      }
    }

    if (dynamicItems === 0) {
      const embedded = await tryEmbeddedImagesFallback(file);
      if (embedded?.length) {
        return { pages: [], canvases: embedded, docs, usedImageFallback: true, partialRaster: false };
      }
    }

    throw new Error("no-visual");
  } catch {
    if (dynamicItems === 0) {
      const embedded = await tryEmbeddedImagesFallback(file);
      if (embedded?.length) {
        return { pages: [], canvases: embedded, docs: [], usedImageFallback: true, partialRaster: false };
      }
    }
    throw new Error("no-visual");
  }
}

export async function exportCanvasesToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (canvases.length === 0) throw new Error("no-pages");

  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const w = canvas.width;
    const h = canvas.height;

    if (i === 0) {
      pdf = new jsPDF({
        orientation: w >= h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
      });
    } else {
      pdf!.addPage([w, h], w >= h ? "landscape" : "portrait");
    }

    pdf!.addImage(imgData, "JPEG", 0, 0, w, h, undefined, "FAST");
    await yieldToMain();
  }

  const blob = pdf!.output("blob") as Blob;
  return blob;
}

export async function exportCanvasesToPngZip(
  canvases: HTMLCanvasElement[],
  baseName: string
): Promise<Blob> {
  const zip = new JSZip();
  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvases[i].toBlob(b => (b ? resolve(b) : reject(new Error("png-failed"))), "image/png");
    });
    zip.file(`${baseName}-page-${i + 1}.png`, blob);
    await yieldToMain();
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function exportCanvasesToLongImage(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (canvases.length === 0) throw new Error("no-pages");

  const gap = 12;
  const maxDim = getLongImageMaxDim();

  try {
    const blob = await stitchLongImageInWorker(canvases, gap, maxDim);
    return blob;
  } finally {
    for (const c of canvases) releaseCanvas(c);
  }
}

export async function exportPagesToSvgZip(pages: HTMLElement[], baseName: string): Promise<Blob> {
  const zip = new JSZip();
  let index = 0;

  for (const page of pages) {
    const svg = page.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) continue;
    index += 1;
    const serialized = new XMLSerializer().serializeToString(svg);
    zip.file(`${baseName}-page-${index}.svg`, serialized);
  }

  if (index === 0) throw new Error("no-svg");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function exportPagesToHtml(
  _pages: HTMLElement[],
  title: string,
  canvases: HTMLCanvasElement[]
): Promise<Blob> {
  const sections = canvases
    .map((canvas, i) => {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      return `<section style="margin:0 auto 24px;max-width:${canvas.width}px"><img src="${dataUrl}" alt="Page ${i + 1}" width="${canvas.width}" height="${canvas.height}" style="display:block;width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px"/></section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:24px;background:#f8fafc;font-family:system-ui,sans-serif}main{max-width:960px;margin:0 auto}h1{font-size:1.25rem;color:#0f172a}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${sections}
</main>
</body>
</html>`;

  return new Blob([html], { type: "text/html;charset=utf-8" });
}

export async function extractOfdText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const text = await extractOfdTextInWorker(buf);
  releaseBuffer(buf);
  return text;
}

export async function compressOfdFile(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const compressed = await compressOfdInWorker(buffer);
  releaseBuffer(buffer);
  return new Blob([compressed], { type: "application/ofd" });
}

export async function mergeOfdFiles(
  files: File[],
  onProgress?: OfdProgressReporter
): Promise<Blob> {
  if (files.length < 2) throw new Error("need-multiple");
  onProgress?.(15, "progressMerging");

  const buffers: ArrayBuffer[] = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    buffers.push(buf);
    await yieldToMain();
  }

  onProgress?.(60, "progressMerging");
  const merged = await mergeOfdInWorker(buffers);
  for (const buf of buffers) releaseBuffer(buf);

  onProgress?.(92, "progressExporting");
  return new Blob([merged], { type: "application/ofd" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadBlob(blob: Blob, filename: string) {
  triggerBlobDownload(blob, filename);
}

export function disposeOfdSession(canvases: HTMLCanvasElement[] = []): void {
  releaseCanvases(canvases);
  mediaUrlRegistry.revokeAll();
  terminateOfdRasterWorker();
}

export function baseNameFromOfd(sourceName: string): string {
  return sourceName.replace(/\.ofd$/i, "") || "document";
}

export function pdfFilenameFromOfd(sourceName: string): string {
  return `${baseNameFromOfd(sourceName)}.pdf`;
}

export function outputFilename(sourceName: string, ext: string): string {
  return `${baseNameFromOfd(sourceName)}.${ext}`;
}

function scaleCanvasToDataUrl(canvas: HTMLCanvasElement, maxWidth: number): string {
  if (canvas.width <= 0 || canvas.height <= 0) return "";
  try {
    if (canvas.width <= maxWidth) return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return "";
  }

  const scale = maxWidth / canvas.width;
  const thumb = document.createElement("canvas");
  thumb.width = maxWidth;
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = thumb.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, thumb.width, thumb.height);
  ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  try {
    const url = thumb.toDataURL("image/jpeg", 0.85);
    releaseCanvas(thumb);
    return url;
  } catch {
    releaseCanvas(thumb);
    return "";
  }
}

async function renderOfdThumbnailInner(file: File, width: number): Promise<string> {
  await loadOfdEmbeddedFonts(file);

  const native = await tryNativeExportCanvases(file, width);
  if (native?.[0]) {
    const dataUrl = scaleCanvasToDataUrl(native[0], width);
    for (const c of native) releaseCanvas(c);
    if (dataUrl) return dataUrl;
  }

  await loadOfdModule();
  const { pages } = await withTimeout(
    parseAndRenderOfd(file, width, undefined, { skipFonts: true }),
    20_000,
    "timeout"
  );
  if (pages.length > 0) {
    const url = await withPagesMounted(file, [pages[0]], async () => {
      try {
        const canvas = await pageDivToCanvas(pages[0], width);
        if (isCanvasRenderable(canvas)) {
          const dataUrl = scaleCanvasToDataUrl(canvas, width);
          releaseCanvas(canvas);
          return dataUrl;
        }
        releaseCanvas(canvas);
      } catch {
        /* fall through */
      }
      return "";
    });
    if (url) return url;
  }

  return "";
}

export async function renderOfdThumbnail(
  file: File,
  width = Math.round(DEFAULT_RENDER_WIDTH * 0.35)
): Promise<string> {
  if (!isOfdFile(file)) return "";

  try {
    return await withTimeout(renderOfdThumbnailInner(file, width), 25_000, "timeout");
  } catch {
    return "";
  }
}

export { DEFAULT_RENDER_WIDTH };
