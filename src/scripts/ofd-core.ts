const OFD_ACCEPT = ".ofd,application/ofd,application/octet-stream";
const DEFAULT_RENDER_WIDTH = 794;

export type OfdProgressReporter = (percent: number, stageKey: string) => void;

export function isOfdFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".ofd") || file.type === "application/ofd";
}

async function loadOfdModule() {
  const mod = await import("ofd.js");
  return mod;
}

export async function parseOfdFile(file: File): Promise<void> {
  const { parseOfdDocument } = await loadOfdModule();
  await new Promise<void>((resolve, reject) => {
    parseOfdDocument({
      ofd: file,
      success() {
        resolve();
      },
      fail(error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
}

function normalizePageDivs(result: HTMLElement | HTMLElement[]): HTMLElement[] {
  return Array.isArray(result) ? result : [result];
}

export async function renderOfdPages(width = DEFAULT_RENDER_WIDTH): Promise<HTMLElement[]> {
  const { renderOfd } = await loadOfdModule();
  const result = await renderOfd(0, width);
  return normalizePageDivs(result);
}

export function extractCanvasesFromPages(pages: HTMLElement[]): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = [];
  for (const page of pages) {
    const canvas = page.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      canvases.push(canvas);
    }
  }
  return canvases;
}

export async function loadOfdPreview(
  file: File,
  width = DEFAULT_RENDER_WIDTH
): Promise<{ pages: HTMLElement[]; canvases: HTMLCanvasElement[] }> {
  if (!isOfdFile(file)) {
    throw new Error("invalid-ofd");
  }
  await parseOfdFile(file);
  const pages = await renderOfdPages(width);
  const canvases = extractCanvasesFromPages(pages);
  return { pages, canvases };
}

export async function exportCanvasesToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (canvases.length === 0) {
    throw new Error("no-pages");
  }

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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function pdfFilenameFromOfd(sourceName: string): string {
  return `${baseNameFromOfd(sourceName)}.pdf`;
}

export function baseNameFromOfd(sourceName: string): string {
  return sourceName.replace(/\.ofd$/i, "") || "document";
}

export function outputFilename(sourceName: string, ext: string): string {
  return `${baseNameFromOfd(sourceName)}.${ext}`;
}

function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx?.drawImage(canvas, 0, 0);
  return copy;
}

export async function resolveExportCanvases(
  file: File,
  onProgress?: OfdProgressReporter
): Promise<HTMLCanvasElement[]> {
  onProgress?.(20, "progressParsing");
  const { canvases } = await loadOfdPreview(file);
  onProgress?.(90, "progressExporting");
  if (canvases.length === 0) throw new Error("no-visual");
  return canvases.map(cloneCanvas);
}

export async function renderOfdThumbnail(
  file: File,
  width = Math.round(DEFAULT_RENDER_WIDTH * 0.35)
): Promise<string> {
  if (!isOfdFile(file)) return "";
  try {
    const { canvases } = await loadOfdPreview(file, width);
    const canvas = canvases[0];
    if (!canvas) return "";
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return "";
  }
}

export function disposeOfdSession(_canvases: HTMLCanvasElement[] = []): void {
  /* simplified core — no persistent session resources */
}

export async function exportCanvasesToPngZip(
  canvases: HTMLCanvasElement[],
  baseName: string
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
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
  const totalHeight =
    canvases.reduce((sum, c) => sum + c.height, 0) + gap * Math.max(0, canvases.length - 1);
  const width = Math.max(...canvases.map(c => c.width));

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
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("long-image-failed"))), "image/png");
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export async function exportFileToSvgZip(
  _file: File,
  _baseName: string,
  _onProgress?: OfdProgressReporter
): Promise<Blob> {
  throw new Error("no-svg");
}

export async function extractOfdText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const chunks: string[] = [];

  for (const path of Object.keys(zip.files).sort()) {
    if (!/\.xml$/i.test(path) || zip.files[path].dir) continue;
    const xml = await zip.file(path)!.async("string");
    for (const match of xml.matchAll(/<(?:[\w-]+:)?TextCode[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/gi)) {
      const raw = match[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (raw) chunks.push(raw);
    }
  }

  const text = chunks.join("\n").trim();
  if (!text) throw new Error("no-text");
  return text;
}

export async function compressOfdFile(_file: File): Promise<Blob> {
  throw new Error("compress-failed");
}

export async function mergeOfdFiles(files: File[], _onProgress?: OfdProgressReporter): Promise<Blob> {
  if (files.length < 2) throw new Error("need-multiple");
  throw new Error("merge-failed");
}

export { OFD_ACCEPT, DEFAULT_RENDER_WIDTH };
