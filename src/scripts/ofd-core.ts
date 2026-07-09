import JSZip from "jszip";
import { isCanvasMostlyBlank } from "@/scripts/pdf-render";

const OFD_ACCEPT = ".ofd,application/ofd,application/octet-stream";
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
  await waitForPaint();

  const existing = pageDiv.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement && existing.width > 0 && existing.height > 0) {
    const cloned = cloneCanvas(existing);
    if (!isCanvasMostlyBlank(cloned)) return cloned;
  }

  const svg = pageDiv.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    const { w, h } = parsePageSize(pageDiv, fallbackWidth);
    const rasterized = await rasterizeSvgToCanvas(svg, w, h);
    if (!isCanvasMostlyBlank(rasterized)) return rasterized;
  }

  throw new Error("no-renderable-page");
}

/** Fresh canvases for export — re-rasterize pages or fall back to embedded images. */
export async function resolveExportCanvases(
  file: File,
  pages: HTMLElement[],
  cached: HTMLCanvasElement[]
): Promise<HTMLCanvasElement[]> {
  if (pages.length > 0) {
    const fresh: HTMLCanvasElement[] = [];
    for (const page of pages) {
      try {
        fresh.push(await pageDivToCanvas(page));
      } catch {
        // try next page
      }
    }
    if (fresh.length > 0 && !fresh.every(isCanvasMostlyBlank)) return fresh;
  }

  const validCached = cached.filter(c => c.width > 0 && c.height > 0 && !isCanvasMostlyBlank(c));
  if (validCached.length > 0) return validCached.map(cloneCanvas);

  const { canvases } = await loadOfdPreview(file);
  const validReloaded = canvases.filter(c => !isCanvasMostlyBlank(c));
  if (validReloaded.length > 0) return validReloaded.map(cloneCanvas);

  const imageCanvases = await canvasesFromOfdImages(file);
  if (imageCanvases.length > 0) return imageCanvases;

  throw new Error("no-visual");
}

export async function parseAndRenderOfd(
  file: File | ArrayBuffer,
  width = DEFAULT_RENDER_WIDTH
): Promise<{ pages: HTMLElement[]; docs: OfdParsedDocument[] }> {
  const ofd = await loadOfdModule();

  return new Promise((resolve, reject) => {
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
  });
}

export async function loadOfdPreview(
  file: File,
  width = DEFAULT_RENDER_WIDTH
): Promise<OfdPreviewResult> {
  if (!isOfdFile(file)) {
    throw new Error("invalid-ofd");
  }

  try {
    const { pages, docs } = await parseAndRenderOfd(file, width);
    const canvases: HTMLCanvasElement[] = [];
    for (const page of pages) {
      try {
        canvases.push(await pageDivToCanvas(page, width));
      } catch {
        // page may lack raster output
      }
    }
    if (canvases.length > 0 && !canvases.every(isCanvasMostlyBlank)) {
      return { pages, canvases, docs, usedImageFallback: false };
    }
    const fallback = await canvasesFromOfdImages(file);
    if (fallback.length > 0) {
      return { pages, canvases: fallback, docs, usedImageFallback: true };
    }
    if (canvases.length > 0) {
      return { pages, canvases, docs, usedImageFallback: false };
    }
    throw new Error("no-visual");
  } catch {
    const canvases = await canvasesFromOfdImages(file);
    if (canvases.length === 0) throw new Error("no-visual");
    return { pages: [], canvases, docs: [], usedImageFallback: true };
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

export async function mergeOfdFiles(files: File[]): Promise<Blob> {
  if (files.length < 2) throw new Error("need-multiple");

  const outZip = await JSZip.loadAsync(await files[0].arrayBuffer());
  let ofdXml = await outZip.file("OFD.xml")?.async("string");
  if (!ofdXml) throw new Error("invalid-ofd");

  let nextDocIndex = 0;
  for (const path of Object.keys(outZip.files)) {
    const match = path.match(/^Doc_(\d+)\//);
    if (match) nextDocIndex = Math.max(nextDocIndex, Number(match[1]) + 1);
  }

  for (let i = 1; i < files.length; i++) {
    const srcZip = await JSZip.loadAsync(await files[i].arrayBuffer());
    const targetPrefix = `Doc_${nextDocIndex}/`;
    const sourcePrefix = "Doc_0/";

    for (const [path, entry] of Object.entries(srcZip.files)) {
      if (entry.dir || !path.startsWith(sourcePrefix)) continue;
      outZip.file(path.replace(sourcePrefix, targetPrefix), await entry.async("uint8array"));
    }

    const srcOfdXml = await srcZip.file("OFD.xml")?.async("string");
    if (!srcOfdXml) throw new Error("invalid-ofd");

    const docRootMatch = srcOfdXml.match(/<ofd:DocRoot>([^<]+)<\/ofd:DocRoot>/);
    const sigMatch = srcOfdXml.match(/<ofd:Signatures>([^<]+)<\/ofd:Signatures>/);
    const docRoot = (docRootMatch?.[1] ?? "Doc_0/Document.xml").replace(sourcePrefix, targetPrefix);
    const signatures = sigMatch?.[1]?.replace(sourcePrefix, targetPrefix);

    ofdXml = appendDocBody(ofdXml, docRoot, signatures);
    nextDocIndex += 1;
  }

  outZip.file("OFD.xml", ofdXml);
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

export { OFD_ACCEPT, DEFAULT_RENDER_WIDTH };
