import JSZip from "jszip";
import { isCanvasMostlyBlank } from "@/scripts/pdf-render";

export type OfdProgressReporter = (percent: number, stageKey: string) => void;

const PARSE_TIMEOUT_MS = 90_000;
const RASTERIZE_TIMEOUT_MS = 45_000;
const FONT_FACE_TIMEOUT_MS = 6_000;
const FONTS_READY_TIMEOUT_MS = 2_000;
const FONT_BATCH_TIMEOUT_MS = 12_000;

const loadedFontFileKeys = new Set<string>();

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
const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
const PAGE_CONTENT_RE = /^Doc_\d+\/Pages\/Page_\d+\/Content\.xml$/i;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]+>/g, "")
    .trim();
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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let count = 0;
  for (const path of Object.keys(zip.files)) {
    if (PAGE_CONTENT_RE.test(path)) count++;
  }
  return count;
}

async function loadOfdEmbeddedFonts(file: File): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return;

  const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
  if (loadedFontFileKeys.has(cacheKey)) return;

  try {
    await withTimeout(loadOfdEmbeddedFontsInner(file), FONT_BATCH_TIMEOUT_MS, "font-batch-timeout");
    loadedFontFileKeys.add(cacheKey);
  } catch {
    /* continue without embedded fonts */
  }
}

async function loadOfdEmbeddedFontsInner(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const loads: Promise<void>[] = [];
  const registeredFamilies = new Set<string>(
    [...document.fonts].map(face => face.family.replace(/^"|"$/g, ""))
  );

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !FONT_EXT.test(path)) continue;
    const family =
      path
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") ?? "ofd-font";
    if (registeredFamilies.has(family)) continue;

    loads.push(
      withTimeout(
        (async () => {
          try {
            const face = new FontFace(family, await entry.async("arraybuffer"));
            await face.load();
            document.fonts.add(face);
            registeredFamilies.add(family);
          } catch {
            /* skip broken font */
          }
        })(),
        FONT_FACE_TIMEOUT_MS,
        "font-face-timeout"
      ).catch(() => undefined)
    );
  }

  await Promise.all(loads);

  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONTS_READY_TIMEOUT_MS, "fonts-ready-timeout").catch(
      () => undefined
    );
  }
}

async function rasterizePageDivWithHtml2Canvas(
  pageDiv: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  return withTimeout(
    html2canvas(pageDiv, {
      scale: Math.max(1, window.devicePixelRatio || 1),
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

/** Only use raw zip images when the document is a single-page scan with one asset. */
async function trySingleImageFallback(file: File): Promise<HTMLCanvasElement[] | null> {
  const pageCount = await getOfdPageCount(file);
  const images = await extractOfdImages(file);
  if (pageCount !== 1 || images.length !== 1) return null;
  try {
    const canvas = await blobToCanvas(images[0]);
    return isCanvasMostlyBlank(canvas) ? null : [canvas];
  } catch {
    return null;
  }
}

async function canvasesFromRenderedPages(
  pages: HTMLElement[],
  width = DEFAULT_RENDER_WIDTH,
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
      /* page may lack raster output */
    }
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

  try {
    const domRaster = await rasterizePageDivWithHtml2Canvas(pageDiv, w, h);
    if (!isCanvasMostlyBlank(domRaster)) return domRaster;
  } catch {
    /* try canvas/svg next */
  }

  const existing = pageDiv.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement && existing.width > 0 && existing.height > 0) {
    const cloned = cloneCanvas(existing);
    if (!isCanvasMostlyBlank(cloned)) return cloned;
  }

  const svg = pageDiv.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    const rasterized = await rasterizeSvgToCanvas(svg, w, h);
    if (!isCanvasMostlyBlank(rasterized)) return rasterized;
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
  const { pages, canvases } = await loadOfdPreview(file, DEFAULT_RENDER_WIDTH, onProgress, {
    skipFonts: true,
  });

  if (pages.length === 0) {
    onProgress?.(85, "progressExporting");
    const valid = canvases.filter(c => !isCanvasMostlyBlank(c));
    if (valid.length > 0) return valid.map(cloneCanvas);
    const singleImage = await trySingleImageFallback(file);
    if (singleImage) return singleImage;
    throw new Error("no-visual");
  }

  return withPagesMounted(pages, async () => {
    const fresh = await canvasesFromRenderedPages(pages, DEFAULT_RENDER_WIDTH, onProgress);
    if (fresh.length > 0 && !fresh.every(isCanvasMostlyBlank)) {
      onProgress?.(92, "progressExporting");
      return fresh.map(cloneCanvas);
    }
    const valid = canvases.filter(c => !isCanvasMostlyBlank(c));
    if (valid.length > 0) return valid.map(cloneCanvas);
    const singleImage = await trySingleImageFallback(file);
    if (singleImage) return singleImage;
    throw new Error("no-visual");
  });
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
  return withPagesMounted(pages, () => exportPagesToSvgZip(pages, baseName));
}

async function withPagesMounted<T>(pages: HTMLElement[], fn: () => Promise<T>): Promise<T> {
  if (pages.length === 0) return fn();

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;opacity:0;";
  for (const page of pages) host.appendChild(page);
  document.body.appendChild(host);

  try {
    return await fn();
  } finally {
    host.remove();
  }
}

function parseOfdDocRoot(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?DocRoot[^>]*>([^<]+)<\/(?:[\w-]+:)?DocRoot>/i);
  return match?.[1]?.trim() ?? null;
}

function parseOfdSignatures(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?Signatures[^>]*>([^<]+)<\/(?:[\w-]+:)?Signatures>/i);
  return match?.[1]?.trim() ?? null;
}

function docPrefixFromRoot(docRoot: string): string | null {
  const match = docRoot.match(/^(Doc_\d+)\//i);
  return match ? `${match[1]}/` : null;
}

function discoverPrimaryDocPrefix(zip: JSZip, ofdXml: string | undefined): string {
  const docRoot = ofdXml ? parseOfdDocRoot(ofdXml) : null;
  if (docRoot) {
    const prefix = docPrefixFromRoot(docRoot);
    if (prefix) return prefix;
  }

  const prefixes = new Set<string>();
  for (const path of Object.keys(zip.files)) {
    const match = path.match(/^(Doc_\d+)\//i);
    if (match) prefixes.add(`${match[1]}/`);
  }

  const sorted = [...prefixes].sort(naturalSort);
  return sorted[0] ?? "Doc_0/";
}

function zipPathStartsWith(path: string, prefix: string): boolean {
  return path.toLowerCase().startsWith(prefix.toLowerCase());
}

function remapZipPath(path: string, sourcePrefix: string, targetPrefix: string): string {
  if (!zipPathStartsWith(path, sourcePrefix)) return path;
  return targetPrefix + path.slice(sourcePrefix.length);
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
    onProgress?.(48, "progressRasterizing");
    const canvases = await canvasesFromRenderedPages(pages, width, onProgress);
    if (canvases.length > 0 && !canvases.every(isCanvasMostlyBlank)) {
      return { pages, canvases, docs, usedImageFallback: false };
    }

    const singleImage = await trySingleImageFallback(file);
    if (singleImage) {
      return { pages: [], canvases: singleImage, docs, usedImageFallback: true };
    }

    if (canvases.length > 0) {
      return { pages, canvases, docs, usedImageFallback: false };
    }
    throw new Error("no-visual");
  } catch {
    const singleImage = await trySingleImageFallback(file);
    if (singleImage) {
      return { pages: [], canvases: singleImage, docs: [], usedImageFallback: true };
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

  const width = Math.max(...canvases.map(c => c.width));
  const gap = 12;
  const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  let y = 0;
  for (const page of canvases) {
    const x = Math.floor((width - page.width) / 2);
    ctx.drawImage(page, x, y);
    y += page.height + gap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("png-failed"))), "image/png");
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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const lines: string[] = [];

  for (const path of Object.keys(zip.files).sort(naturalSort)) {
    if (!path.endsWith("Content.xml") && !path.endsWith("Annotations.xml")) continue;
    const entry = zip.files[path];
    if (!entry || entry.dir) continue;
    const xml = await entry.async("string");
    for (const match of xml.matchAll(/<(?:[\w-]+:)?TextCode[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/g)) {
      const text = decodeXmlText(match[1] ?? "");
      if (text) lines.push(text);
    }
    for (const match of xml.matchAll(/<(?:[\w-]+:)?TextObject[^>]*>[\s\S]*?<\/(?:[\w-]+:)?TextObject>/g)) {
      const chunk = match[0];
      const inner = chunk.match(/<(?:[\w-]+:)?TextCode[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/);
      if (inner) {
        const text = decodeXmlText(inner[1] ?? "");
        if (text) lines.push(text);
      }
    }
  }

  return [...new Set(lines)].join("\n");
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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

function randomDocId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function appendDocBody(ofdXml: string, docRoot: string, signatures?: string): string {
  const sigXml = signatures ? `<ofd:Signatures>${signatures}</ofd:Signatures>` : "";
  const body = `<ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomDocId()}</ofd:DocID></ofd:DocInfo><ofd:DocRoot>${docRoot}</ofd:DocRoot>${sigXml}</ofd:DocBody>`;
  return ofdXml.replace("</ofd:OFD>", `${body}</ofd:OFD>`);
}

export async function mergeOfdFiles(
  files: File[],
  onProgress?: OfdProgressReporter
): Promise<Blob> {
  if (files.length < 2) throw new Error("need-multiple");

  onProgress?.(15, "progressMerging");
  const outZip = await JSZip.loadAsync(await files[0].arrayBuffer());
  let ofdXml = await outZip.file("OFD.xml")?.async("string");
  if (!ofdXml) throw new Error("invalid-ofd");

  let nextDocIndex = 0;
  for (const path of Object.keys(outZip.files)) {
    const match = path.match(/^Doc_(\d+)\//i);
    if (match) nextDocIndex = Math.max(nextDocIndex, Number(match[1]) + 1);
  }

  for (let i = 1; i < files.length; i++) {
    onProgress?.(15 + Math.round((i / files.length) * 70), "progressMerging");
    const srcZip = await JSZip.loadAsync(await files[i].arrayBuffer());
    const srcOfdXml = await srcZip.file("OFD.xml")?.async("string");
    if (!srcOfdXml) throw new Error("invalid-ofd");

    const sourcePrefix = discoverPrimaryDocPrefix(srcZip, srcOfdXml);
    const targetPrefix = `Doc_${nextDocIndex}/`;
    let copied = 0;

    for (const [path, entry] of Object.entries(srcZip.files)) {
      if (entry.dir || !zipPathStartsWith(path, sourcePrefix)) continue;
      outZip.file(remapZipPath(path, sourcePrefix, targetPrefix), await entry.async("uint8array"));
      copied++;
    }

    if (copied === 0) throw new Error("merge-copy-failed");

    const docRoot = parseOfdDocRoot(srcOfdXml) ?? `${sourcePrefix}Document.xml`;
    const remappedDocRoot = remapZipPath(docRoot, sourcePrefix, targetPrefix);
    const signatures = parseOfdSignatures(srcOfdXml);
    const remappedSignatures = signatures
      ? remapZipPath(signatures, sourcePrefix, targetPrefix)
      : undefined;

    ofdXml = appendDocBody(ofdXml, remappedDocRoot, remappedSignatures);
    nextDocIndex += 1;
  }

  outZip.file("OFD.xml", ofdXml);
  onProgress?.(92, "progressExporting");
  return outZip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

async function rasterizeFirstPageQuick(
  pageDiv: HTMLElement,
  width: number
): Promise<HTMLCanvasElement | null> {
  await waitForPageResources(pageDiv);

  const existing = pageDiv.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement && existing.width > 0 && existing.height > 0) {
    const cloned = cloneCanvas(existing);
    if (!isCanvasMostlyBlank(cloned)) return cloned;
  }

  const svg = pageDiv.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    const { w, h } = parsePageSize(pageDiv, width);
    try {
      const rasterized = await rasterizeSvgToCanvas(svg, w, h);
      if (!isCanvasMostlyBlank(rasterized)) return rasterized;
    } catch {
      /* try html2canvas next */
    }
  }

  try {
    const { w, h } = parsePageSize(pageDiv, width);
    return await rasterizePageDivWithHtml2Canvas(pageDiv, w, h);
  } catch {
    return null;
  }
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

async function renderOfdThumbnailInner(file: File, width: number): Promise<string> {
  try {
    const images = await extractOfdImages(file);
    if (images.length > 0) {
      const canvas = await blobToCanvas(images[0]);
      if (!isCanvasMostlyBlank(canvas)) return scaleCanvasToDataUrl(canvas, width);
    }
  } catch {
    /* continue with OFD render */
  }

  await loadOfdModule();
  await loadOfdEmbeddedFonts(file);

  const { pages } = await withTimeout(
    parseAndRenderOfd(file, width, undefined, { skipFonts: true }),
    20_000,
    "timeout"
  );
  if (pages.length === 0) {
    const singleImage = await trySingleImageFallback(file);
    const canvas = singleImage?.[0];
    if (canvas && !isCanvasMostlyBlank(canvas)) return scaleCanvasToDataUrl(canvas, width);
    return "";
  }

  return withPagesMounted([pages[0]], async () => {
    const canvas = await rasterizeFirstPageQuick(pages[0], width);
    if (!canvas || isCanvasMostlyBlank(canvas)) return "";
    return scaleCanvasToDataUrl(canvas, width);
  });
}

export { DEFAULT_RENDER_WIDTH };
