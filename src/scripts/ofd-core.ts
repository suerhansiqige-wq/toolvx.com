import JSZip from "jszip";
import { isCanvasMostlyBlank } from "@/scripts/pdf-render";
import { loadOfdEmbeddedFonts } from "@/scripts/ofd-font-loader";
import { hydratePagesMedia } from "@/scripts/ofd-image-hydrator";
import {
  BlobUrlRegistry,
  getAdaptiveCanvasScale,
  getAdaptiveRenderWidth,
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

export type OfdProgressReporter = (percent: number, stageKey: string) => void;

const PARSE_TIMEOUT_MS = 90_000;
const RASTERIZE_TIMEOUT_MS = 45_000;

/** 会话级 Blob URL 注册表，页面卸载时统一释放 */
const mediaUrlRegistry = new BlobUrlRegistry();

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
const DEFAULT_RENDER_WIDTH = 794;
const OFD_SCRIPT = "/vendor/ofd.umd.min.js";

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

    if (!win.ofd?.parseOfdDocument) {
      throw new Error("ofd-global-missing");
    }
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

async function rasterizeSvgToCanvas(svg: SVGElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context");

  const serialized = new XMLSerializer().serializeToString(svg);
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

export type OfdPreviewResult = {
  pages: HTMLElement[];
  canvases: HTMLCanvasElement[];
  docs: OfdParsedDocument[];
  usedImageFallback: boolean;
};

const IMAGE_EXT = /\.(jpe?g|png|bmp|gif|webp|tif{1,2})$/i;
const FONTS_READY_TIMEOUT_MS = 2_000;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
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

async function waitForPaint(): Promise<void> {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForPageResources(pageDiv: HTMLElement): Promise<void> {
  await waitForPaint();
  const images = Array.from(pageDiv.querySelectorAll("img"));
  await Promise.all(
    images.map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete) {
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
    /* ignore */
  }
  await waitForPaint();
}

async function getOfdPageCount(file: File): Promise<number> {
  return getOfdPageCountFromBuffer(await file.arrayBuffer());
}

async function rasterizePageDivWithHtml2Canvas(
  pageDiv: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
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
    }),
    RASTERIZE_TIMEOUT_MS,
    "timeout"
  );
}

/** Use embedded page images when DOM render is unavailable. */
async function tryEmbeddedImagesFallback(file: File): Promise<HTMLCanvasElement[] | null> {
  const [pageCount, images] = await Promise.all([getOfdPageCount(file), extractOfdImages(file)]);
  if (images.length === 0) return null;

  const canvases: HTMLCanvasElement[] = [];
  for (const blob of images) {
    try {
      const canvas = await blobToCanvas(blob);
      if (!isCanvasMostlyBlank(canvas)) canvases.push(canvas);
    } catch {
      /* skip broken asset */
    }
  }
  if (canvases.length === 0) return null;

  canvases.sort((a, b) => b.width * b.height - a.width * a.height);

  if (pageCount <= 1) return [canvases[0]];
  if (canvases.length === pageCount) return canvases;
  if (canvases.length > pageCount) return canvases.slice(0, pageCount);
  return canvases;
}

async function canvasesFromRenderedPages(
  pages: HTMLElement[],
  width = renderWidth(),
  onProgress?: OfdProgressReporter
): Promise<HTMLCanvasElement[]> {
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(
      55 + Math.round(((i + 1) / pages.length) * 30),
      "progressRasterizing"
    );
    try {
      canvases.push(await pageDivToCanvas(pages[i], width));
    } catch {
      /* 单页失败可跳过 */
    }
    // 每页渲染后让出主线程，避免低配设备假死
    await yieldToMain();
  }
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
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractOfdImages(file: File): Promise<Blob[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const images: { path: string; blob: Blob }[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !IMAGE_EXT.test(path)) continue;
    const lower = path.toLowerCase();
    if (lower.includes("/stamp") || lower.includes("/seal")) continue;
    const mime = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".gif")
        ? "image/gif"
        : lower.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
    images.push({ path, blob: await entry.async("blob") });
    void mime;
  }

  images.sort((a, b) => naturalSort(a.path, b.path));
  return images.map(item => item.blob);
}

export async function canvasesFromOfdImages(file: File): Promise<HTMLCanvasElement[]> {
  const blobs = await extractOfdImages(file);
  if (blobs.length === 0) return [];
  const canvases: HTMLCanvasElement[] = [];
  for (const blob of blobs) {
    try {
      canvases.push(await blobToCanvas(blob));
    } catch {
      // skip broken assets
    }
  }
  return canvases;
}

export async function pageDivToCanvas(
  pageDiv: HTMLElement,
  fallbackWidth = DEFAULT_RENDER_WIDTH
): Promise<HTMLCanvasElement> {
  await waitForPageResources(pageDiv);
  const { w, h } = parsePageSize(pageDiv, fallbackWidth);

  const existing = pageDiv.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement && existing.width > 0 && existing.height > 0) {
    const cloned = cloneCanvas(existing);
    if (!isCanvasMostlyBlank(cloned)) return cloned;
  }

  const svg = pageDiv.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    try {
      const rasterized = await rasterizeSvgToCanvas(svg, w, h);
      if (!isCanvasMostlyBlank(rasterized)) return rasterized;
    } catch {
      /* try html2canvas next */
    }
  }

  try {
    const domRaster = await rasterizePageDivWithHtml2Canvas(pageDiv, w, h);
    if (!isCanvasMostlyBlank(domRaster)) return domRaster;
  } catch {
    /* no renderable output */
  }

  throw new Error("no-renderable-page");
}

/** Fresh canvases for export — render off-screen without a visible preview. */
export async function resolveExportCanvases(
  file: File,
  onProgress?: OfdProgressReporter
): Promise<HTMLCanvasElement[]> {
  onProgress?.(8, "progressLoadingLib");
  await withTimeout(loadOfdModule(), 30_000, "ofd-script-load-failed");

  onProgress?.(18, "progressFonts");
  await loadOfdEmbeddedFonts(file);

  onProgress?.(28, "progressParsing");
  const width = renderWidth();
  const { pages } = await parseAndRenderOfd(file, width, onProgress, {
    skipFonts: true,
  });

  if (pages.length > 0) {
    onProgress?.(48, "progressRasterizing");
    const fresh = await withPagesMounted(file, pages, () =>
      canvasesFromRenderedPages(pages, width, onProgress)
    );
    const valid = fresh.filter(c => !isCanvasMostlyBlank(c));
    if (valid.length > 0) {
      onProgress?.(92, "progressExporting");
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

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  // visibility:hidden 比 opacity:0 更利于 html2canvas / 字体测量
  host.style.cssText =
    "position:fixed;left:0;top:0;z-index:-1;visibility:hidden;pointer-events:none;overflow:hidden;width:1px;height:1px;";
  for (const page of pages) host.appendChild(page);
  document.body.appendChild(host);

  try {
    if (file) await hydratePagesMedia(file, pages, mediaUrlRegistry);
    await waitForPageResources(pages[0]);
    return await fn();
  } finally {
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
  if (!isOfdFile(file)) {
    throw new Error("invalid-ofd");
  }

  try {
    const { pages, docs } = await parseAndRenderOfd(file, width, onProgress, options);

    if (pages.length > 0) {
      onProgress?.(48, "progressRasterizing");
      const canvases = await withPagesMounted(file, pages, () =>
        canvasesFromRenderedPages(pages, width, onProgress)
      );
      if (canvases.length > 0 && !canvases.every(isCanvasMostlyBlank)) {
        return { pages, canvases, docs, usedImageFallback: false };
      }
    }

    const embedded = await tryEmbeddedImagesFallback(file);
    if (embedded?.length) {
      return { pages: [], canvases: embedded, docs, usedImageFallback: true };
    }

    throw new Error("no-visual");
  } catch {
    const embedded = await tryEmbeddedImagesFallback(file);
    if (embedded?.length) {
      return { pages: [], canvases: embedded, docs: [], usedImageFallback: true };
    }
    throw new Error("no-visual");
  }
}

export async function loadMultipleOfdPreviews(
  files: File[],
  width = DEFAULT_RENDER_WIDTH
): Promise<{ pages: HTMLElement[]; canvases: HTMLCanvasElement[]; usedImageFallback: boolean }> {
  const allPages: HTMLElement[] = [];
  const allCanvases: HTMLCanvasElement[] = [];
  let usedImageFallback = false;

  for (const file of files) {
    if (!isOfdFile(file)) continue;
    const { pages, canvases, usedImageFallback: fallback } = await loadOfdPreview(file, width);
    allPages.push(...pages);
    allCanvases.push(...canvases);
    usedImageFallback ||= fallback;
  }

  if (allCanvases.length === 0) throw new Error("no-visual");
  return { pages: allPages, canvases: allCanvases, usedImageFallback };
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
  }

  return pdf!.output("blob") as Blob;
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
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function exportCanvasesToLongImage(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (canvases.length === 0) throw new Error("no-pages");

  const gap = 12;
  let width = Math.max(...canvases.map(c => c.width));
  let totalHeight = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1);

  // 多数浏览器单轴 Canvas 上限约 16384px，超出时等比缩小避免空白导出
  const MAX_DIM = 16384;
  const scale = Math.min(1, MAX_DIM / width, MAX_DIM / totalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(totalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  for (const page of canvases) {
    const drawW = Math.floor(page.width * scale);
    const drawH = Math.floor(page.height * scale);
    const x = Math.floor((canvas.width - drawW) / 2);
    ctx.drawImage(page, x, y, drawW, drawH);
    y += drawH + Math.floor(gap * scale);
    await yieldToMain();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      releaseCanvas(canvas);
      if (b) resolve(b);
      else reject(new Error("png-failed"));
    }, "image/png");
  });
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
  pages: HTMLElement[],
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
  return extractOfdTextInWorker(await file.arrayBuffer());
}

export async function exportTextToDocx(text: string, title: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = text
    .split(/\n+/)
    .filter(Boolean)
    .map(line => new Paragraph({ children: [new TextRun(line)] }));

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
    title,
  });

  return Packer.toBlob(doc);
}

export async function compressOfdFile(file: File): Promise<Blob> {
  const buffer = await compressOfdInWorker(await file.arrayBuffer());
  return new Blob([buffer], { type: "application/ofd" });
}

export async function mergeOfdFiles(
  files: File[],
  onProgress?: OfdProgressReporter
): Promise<Blob> {
  if (files.length < 2) throw new Error("need-multiple");
  onProgress?.(15, "progressMerging");
  const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
  onProgress?.(60, "progressMerging");
  const merged = await mergeOfdInWorker(buffers);
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

/** 释放 OFD 会话占用的 Blob URL 与 Canvas 缓存 */
export function disposeOfdSession(canvases: HTMLCanvasElement[] = []): void {
  releaseCanvases(canvases);
  mediaUrlRegistry.revokeAll();
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
    return thumb.toDataURL("image/jpeg", 0.85);
  } catch {
    return "";
  }
}

async function renderOfdThumbnailInner(file: File, width: number): Promise<string> {
  const embedded = await tryEmbeddedImagesFallback(file);
  if (embedded?.[0] && !isCanvasMostlyBlank(embedded[0])) {
    return scaleCanvasToDataUrl(embedded[0], width);
  }

  await loadOfdModule();
  await loadOfdEmbeddedFonts(file);

  const { pages } = await withTimeout(
    parseAndRenderOfd(file, width, undefined, { skipFonts: true }),
    20_000,
    "timeout"
  );
  if (pages.length === 0) return "";

  return withPagesMounted(file, [pages[0]], async () => {
    try {
      const canvas = await pageDivToCanvas(pages[0], width);
      if (!isCanvasMostlyBlank(canvas)) return scaleCanvasToDataUrl(canvas, width);
    } catch {
      /* fall through */
    }
    return "";
  });
}

/** Low-resolution first-page preview for dropzone thumbnails. */
export async function renderOfdThumbnail(
  file: File,
  width = Math.round(DEFAULT_RENDER_WIDTH * 0.35)
): Promise<string> {
  if (!isOfdFile(file)) return "";

  const THUMB_TIMEOUT_MS = 25_000;

  try {
    return await withTimeout(renderOfdThumbnailInner(file, width), THUMB_TIMEOUT_MS, "timeout");
  } catch {
    return "";
  }
}

export { DEFAULT_RENDER_WIDTH };
