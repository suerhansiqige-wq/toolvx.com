import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { loadPdfBytes, type PdfDocumentProxy } from "@/scripts/pdf-worker";
import {
  canvasToJpegBlob,
  HD_JPG_RENDER,
  isPdfRenderBlankError,
  releaseCanvasMemory,
  renderPdfPageToCanvas,
  ZIP_JPG_RENDER,
} from "@/scripts/pdf-render";
import JSZip from "jszip";
import {
  pageImageFilename,
  zipImageFilename,
  zipPageFilename,
} from "@/scripts/export-filename";

export type CompressionMode =
  | { kind: "default" }
  | { kind: "limit"; maxBytes: number };

const SIZE_TIER_PRESETS: { scale: number; quality: number }[] = [
  { scale: 1.65, quality: 0.78 },
  { scale: 1.4, quality: 0.68 },
  { scale: 1.2, quality: 0.58 },
  { scale: 1.0, quality: 0.48 },
  { scale: 0.85, quality: 0.38 },
  { scale: 0.72, quality: 0.3 },
  { scale: 0.6, quality: 0.22 },
];

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob = await canvasToJpegBlob(canvas, quality);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function readPdfBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

async function rasterizePdfToBytes(
  pdf: PdfDocumentProxy,
  scale: number,
  quality: number
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const pageSize = page.getViewport({ scale: 1 });
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await renderPdfPageToCanvas(page, scale);
      const jpegBytes = await canvasToJpegBytes(canvas, quality);
      const image = await outDoc.embedJpg(jpegBytes);
      const outPage = outDoc.addPage([pageSize.width, pageSize.height]);
      outPage.drawImage(image, {
        x: 0,
        y: 0,
        width: pageSize.width,
        height: pageSize.height,
      });
    } finally {
      releaseCanvasMemory(canvas);
    }
  }

  return outDoc.save({ useObjectStreams: true });
}

/** Re-save without rasterizing when canvas render is unavailable on legacy browsers. */
async function optimizePdfWithoutRaster(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
  return doc.save({ useObjectStreams: true });
}

async function rasterizePdfBytes(
  bytes: Uint8Array,
  scale: number,
  quality: number
): Promise<Uint8Array> {
  const pdf = await loadPdfBytes(bytes.slice());
  try {
    return await rasterizePdfToBytes(pdf, scale, quality);
  } catch (err) {
    if (isPdfRenderBlankError(err)) {
      return optimizePdfWithoutRaster(bytes);
    }
    throw err;
  }
}

async function compressToByteLimit(
  bytes: Uint8Array,
  maxBytes: number
): Promise<Uint8Array> {
  const sourceSize = bytes.byteLength;
  if (maxBytes >= sourceSize) {
    return compressDefault(bytes);
  }

  let best: Uint8Array | null = null;

  const consider = (candidate: Uint8Array) => {
    if (candidate.byteLength > sourceSize) return;
    if (!best || candidate.byteLength < best.byteLength) best = candidate;
  };

  for (const preset of SIZE_TIER_PRESETS) {
    const result = await rasterizePdfBytes(bytes, preset.scale, preset.quality);
    consider(result);
    if (result.byteLength <= maxBytes) return result;
  }

  return best ?? compressDefault(bytes);
}

/** Smart compress: never return a file larger than the source. */
async function compressDefault(bytes: Uint8Array): Promise<Uint8Array> {
  const sourceSize = bytes.byteLength;
  let best: Uint8Array | null = null;

  const consider = (candidate: Uint8Array) => {
    if (candidate.byteLength > sourceSize) return;
    if (!best || candidate.byteLength < best.byteLength) best = candidate;
  };

  try {
    consider(await optimizePdfWithoutRaster(bytes));
  } catch {
    /* ignore */
  }

  for (const preset of SIZE_TIER_PRESETS) {
    try {
      const result = await rasterizePdfBytes(bytes, preset.scale, preset.quality);
      consider(result);
    } catch {
      /* try next preset */
    }
  }

  return best ?? bytes;
}

export async function compressPdfFile(
  file: File,
  mode: CompressionMode
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  return compressPdfBytes(bytes, mode);
}

export async function compressPdfBytes(
  bytes: Uint8Array,
  mode: CompressionMode
): Promise<Uint8Array> {
  if (mode.kind === "limit") {
    return compressToByteLimit(bytes, Math.max(1024, mode.maxBytes));
  }
  return compressDefault(bytes);
}

export async function compressPdfFilesToZip(
  files: File[],
  mode: CompressionMode
): Promise<JSZip> {
  const zip = new JSZip();
  for (const file of files) {
    const bytes = await compressPdfFile(file, mode);
    zip.file(compressedPdfFilename(file.name), bytes);
  }
  return zip;
}

function compressedPdfFilename(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "document";
  return `${base}-compressed.pdf`;
}

export async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error("Need at least 2 PDF files to merge");

  const merged = await PDFDocument.create();
  for (const file of files) {
    try {
      const bytes = await readPdfBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read "${file.name}": ${message}`);
    }
  }
  return merged.save();
}

export async function mergePdfBytes(
  entries: { name: string; bytes: Uint8Array }[]
): Promise<Uint8Array> {
  if (entries.length < 2) throw new Error("Need at least 2 PDF files to merge");

  const merged = await PDFDocument.create();
  for (const entry of entries) {
    try {
      const doc = await PDFDocument.load(entry.bytes.slice(), {
        ignoreEncryption: true,
      });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read "${entry.name}": ${message}`);
    }
  }
  return merged.save();
}

export async function splitPdfAllPages(file: File): Promise<JSZip> {
  const bytes = await readPdfBytes(file);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const zip = new JSZip();

  for (let i = 0; i < src.getPageCount(); i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    const saved = await out.save();
    zip.file(zipPageFilename(file.name, i + 1), saved);
  }
  return zip;
}

export async function splitPdfAtPage(
  file: File,
  atPage: number
): Promise<{ part1: Uint8Array; part2: Uint8Array }> {
  const bytes = await readPdfBytes(file);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const split = Math.min(Math.max(1, atPage), total - 1);

  const doc1 = await PDFDocument.create();
  const doc2 = await PDFDocument.create();
  const idx1 = Array.from({ length: split }, (_, i) => i);
  const idx2 = Array.from({ length: total - split }, (_, i) => i + split);

  const pages1 = await doc1.copyPages(src, idx1);
  pages1.forEach(p => doc1.addPage(p));
  const pages2 = await doc2.copyPages(src, idx2);
  pages2.forEach(p => doc2.addPage(p));

  return { part1: await doc1.save(), part2: await doc2.save() };
}

export async function splitPdfExtractPages(
  file: File,
  pageSpec: string
): Promise<{ single?: Uint8Array; zip?: JSZip; pageNumbers: number[] }> {
  const bytes = await readPdfBytes(file);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const pageIndices = parsePageList(pageSpec, total);
  if (pageIndices.length === 0) throw new Error("No valid pages specified");

  if (pageIndices.length === 1) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [pageIndices[0]!]);
    out.addPage(page);
    return { single: await out.save(), pageNumbers: [pageIndices[0]! + 1] };
  }

  const zip = new JSZip();
  for (const idx of pageIndices) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [idx]);
    out.addPage(page);
    zip.file(zipPageFilename(file.name, idx + 1), await out.save());
  }
  return { zip, pageNumbers: pageIndices.map(i => i + 1) };
}

export async function rotatePdf(
  file: File,
  angle: 90 | 180 | 270
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const rotation = degrees(angle);
  pdfDoc.getPages().forEach(page => {
    page.setRotation(rotation);
  });
  return pdfDoc.save();
}

function parsePageList(input: string, total: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(",").map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(n => parseInt(n.trim(), 10));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= total) pages.add(i - 1);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= total) pages.add(n - 1);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export async function deletePdfPages(
  file: File,
  pageSpec: string
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const toDelete = new Set(parsePageList(pageSpec, total));
  if (toDelete.size === 0) throw new Error("No valid pages specified");
  if (toDelete.size >= total) throw new Error("Cannot delete all pages");

  const out = await PDFDocument.create();
  const keep = src.getPageIndices().filter(i => !toDelete.has(i));
  const pages = await out.copyPages(src, keep);
  pages.forEach(p => out.addPage(p));
  return out.save();
}

export async function editPdfMetadata(
  file: File,
  meta: { title?: string; author?: string; subject?: string }
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  if (meta.title) pdfDoc.setTitle(meta.title);
  if (meta.author) pdfDoc.setAuthor(meta.author);
  if (meta.subject) pdfDoc.setSubject(meta.subject);
  return pdfDoc.save();
}

export type NumberPdfPagesOptions = {
  /** 1-based PDF page index where numbering begins. */
  startAtPage?: number;
  /** Display value for the first numbered page. */
  startNumber?: number;
};

export async function numberPdfPages(
  file: File,
  options: NumberPdfPagesOptions = {}
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const total = pages.length;
  const margin = 24;
  const size = 10;
  const startAtPage = Math.min(
    Math.max(1, Math.floor(options.startAtPage ?? 1)),
    total
  );
  const startNumber = Math.max(1, Math.floor(options.startNumber ?? 1));

  pages.forEach((page, i) => {
    const pageIndex = i + 1;
    if (pageIndex < startAtPage) return;

    const displayNum = startNumber + (pageIndex - startAtPage);
    const { width } = page.getSize();
    const text = `${displayNum} / ${total}`;
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: margin,
      size,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });
  return pdfDoc.save();
}

export async function cropPdf(file: File, marginPct: number): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pct = Math.min(Math.max(marginPct, 0), 40) / 100;

  pdfDoc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const mx = width * pct;
    const my = height * pct;
    page.setCropBox(mx, my, width - mx * 2, height - my * 2);
    page.setMediaBox(mx, my, width - mx * 2, height - my * 2);
  });
  return pdfDoc.save();
}

export async function watermarkPdf(
  file: File,
  text: string
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const size = 36;

  pdfDoc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.35,
      rotate: degrees(45),
    });
  });
  return pdfDoc.save();
}

async function embedWatermarkImage(
  pdfDoc: PDFDocument,
  imageFile: File
): Promise<Awaited<ReturnType<PDFDocument["embedPng"]>>> {
  const bytes = await readPdfBytes(imageFile);
  const name = imageFile.name.toLowerCase();
  const isPng = imageFile.type === "image/png" || name.endsWith(".png");
  return isPng ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

export async function watermarkPdfWithImage(
  file: File,
  imageFile: File,
  opacity = 0.35
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const image = await embedWatermarkImage(pdfDoc, imageFile);
  const { width: imgW, height: imgH } = image.scale(1);

  pdfDoc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const maxW = width * 0.55;
    const maxH = height * 0.55;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    const w = imgW * scale;
    const h = imgH * scale;
    page.drawImage(image, {
      x: (width - w) / 2,
      y: (height - h) / 2,
      width: w,
      height: h,
      opacity,
    });
  });
  return pdfDoc.save();
}

async function signatureTextToPng(text: string): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  await document.fonts.ready;
  const fontSize = 28;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const font = `italic ${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padX = 12;
  const padY = 8;
  canvas.width = Math.max(1, Math.ceil(metrics.width) + padX * 2);
  canvas.height = Math.max(1, Math.ceil(fontSize * 1.35) + padY * 2);

  ctx.font = font;
  ctx.fillStyle = "rgb(25, 25, 127)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, canvas.height / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png"
    );
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

function canDrawWithStandardFont(text: string): boolean {
  for (const char of text) {
    if (char.charCodeAt(0) > 255) return false;
  }
  return true;
}

export async function signPdf(file: File, signature: string): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const marginX = 40;
  const marginY = 36;
  const size = 14;

  if (canDrawWithStandardFont(signature)) {
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    pdfDoc.getPages().forEach(page => {
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(signature, size);
      page.drawText(signature, {
        x: width - textWidth - marginX,
        y: marginY,
        size,
        font,
        color: rgb(0.1, 0.1, 0.5),
      });
    });
  } else {
    const { bytes: pngBytes, height: imgH } = await signatureTextToPng(signature);
    const image = await pdfDoc.embedPng(pngBytes);
    const { width: imgW } = image.scale(1);
    const targetHeight = size * 1.25;
    const scale = targetHeight / imgH;

    pdfDoc.getPages().forEach(page => {
      const { width } = page.getSize();
      const w = imgW * scale;
      const h = imgH * scale;
      page.drawImage(image, {
        x: width - w - marginX,
        y: marginY,
        width: w,
        height: h,
      });
    });
  }

  return pdfDoc.save();
}

export async function protectPdf(
  file: File,
  password: string
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdfDoc.save({
    userPassword: password,
    ownerPassword: password,
  } as Parameters<typeof pdfDoc.save>[0]);
}

export async function unlockPdf(
  file: File,
  password: string
): Promise<Uint8Array> {
  const bytes = await readPdfBytes(file);
  const pdfDoc = await PDFDocument.load(bytes, {
    password,
  } as Parameters<typeof PDFDocument.load>[1]);
  return pdfDoc.save();
}

/** Uniform page width for image → PDF export (A4 width in PDF points). */
const IMAGE_PDF_PAGE_WIDTH = 595.28;

export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const bytes = await readPdfBytes(file);
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const image = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const { width: imgW, height: imgH } = image.scale(1);
    const scale = IMAGE_PDF_PAGE_WIDTH / imgW;
    const pageWidth = IMAGE_PDF_PAGE_WIDTH;
    const pageHeight = imgH * scale;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }
  return pdfDoc.save();
}

export async function textToPdf(text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * 1.4;

  const words = text.replace(/\r\n/g, "\n").split(/\s+/);
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let line = "";

  const flushLine = () => {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line.trim(), { x: margin, y, size: fontSize, font });
    y -= lineHeight;
    line = "";
  };

  for (const word of words) {
    if (word.includes("\n")) {
      const segments = word.split("\n");
      segments.forEach((seg, idx) => {
        const test = line ? `${line} ${seg}` : seg;
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) flushLine();
        line = line ? `${line} ${seg}` : seg;
        if (idx < segments.length - 1) flushLine();
      });
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) flushLine();
    line = test;
  }
  if (line.trim()) flushLine();

  return pdfDoc.save();
}

export async function csvToPdf(csv: string): Promise<Uint8Array> {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map(row => row.split(",").map(c => c.trim()));
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 9;
  const cellPad = 4;
  const colCount = Math.max(...rows.map(r => r.length), 1);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 40;
  const colWidth = (pageWidth - margin * 2) / colCount;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const row of rows) {
    if (y < margin + fontSize + cellPad) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    row.forEach((cell, col) => {
      const text = cell.slice(0, 24);
      page.drawText(text, {
        x: margin + col * colWidth + cellPad,
        y,
        size: fontSize,
        font,
      });
    });
    y -= fontSize + cellPad * 2;
  }
  return pdfDoc.save();
}

async function loadPdfJs(file: File, password?: string) {
  const data = await readPdfBytes(file);
  return loadPdfBytes(data, { password });
}

export async function extractPdfText(file: File, password?: string): Promise<string> {
  const pdf = await loadPdfJs(file, password);
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(`--- Page ${i} ---\n${text}`);
  }
  return parts.join("\n\n");
}

export async function pdfToCsv(file: File): Promise<string> {
  const text = await extractPdfText(file);
  return text
    .split(/\r?\n/)
    .map(line => `"${line.replace(/"/g, '""')}"`)
    .join("\n");
}

export const PDF_TO_JPG_PAGE_THRESHOLD = 10;

export type PdfPageImage = {
  pageIndex: number;
  blob: Blob;
  filename: string;
};

export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdfJs(file);
  return pdf.numPages;
}

export function pdfPageImagesToZip(images: PdfPageImage[]): JSZip {
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.filename, img.blob);
  }
  return zip;
}

export async function pdfPagesToJpegs(file: File): Promise<PdfPageImage[]> {
  const pdf = await loadPdfJs(file);
  const total = pdf.numPages;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await renderPdfPageToCanvas(page, HD_JPG_RENDER.scale);
      const blob = await canvasToJpegBlob(canvas, HD_JPG_RENDER.quality);
      images.push({
        pageIndex: i,
        blob,
        filename: pageImageFilename(file.name, i, total, "jpg"),
      });
    } finally {
      releaseCanvasMemory(canvas);
    }
  }
  return images;
}

export async function pdfPagesToImages(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  render: { scale?: number; quality?: number } = ZIP_JPG_RENDER
): Promise<JSZip> {
  const pdf = await loadPdfJs(file);
  const zip = new JSZip();
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = format === "jpeg" ? "jpg" : "png";
  const scale = render.scale ?? ZIP_JPG_RENDER.scale;
  const quality = render.quality ?? ZIP_JPG_RENDER.quality;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await renderPdfPageToCanvas(page, scale);
      const blob =
        format === "jpeg"
          ? await canvasToJpegBlob(canvas, quality)
          : await new Promise<Blob>((resolve, reject) => {
              canvas!.toBlob(
                b => (b ? resolve(b) : reject(new Error("Render failed"))),
                mime,
                quality
              );
            });
      zip.file(zipImageFilename(file.name, i, ext), blob);
    } finally {
      releaseCanvasMemory(canvas);
    }
  }
  return zip;
}

export async function zipToBlob(zip: JSZip): Promise<Blob> {
  return zip.generateAsync({ type: "blob" });
}

export type ReaderState = {
  pdf: PdfDocumentProxy;
  currentPage: number;
};

export async function openPdfReader(file: File): Promise<ReaderState> {
  const pdf = await loadPdfJs(file);
  return { pdf, currentPage: 1 };
}

export async function renderReaderPage(
  state: ReaderState,
  canvas: HTMLCanvasElement,
  options?: {
    scale?: number;
    fitTo?: { width: number; height: number };
    hd?: boolean;
  }
): Promise<void> {
  const page = await state.pdf.getPage(state.currentPage);
  const base = page.getViewport({ scale: 1 });
  let renderScale = options?.scale ?? 1.2;

  if (options?.fitTo) {
    const displayScale = Math.min(
      options.fitTo.width / base.width,
      options.fitTo.height / base.height
    );

    if (options.hd) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderScale = displayScale * dpr;
      const displayViewport = page.getViewport({ scale: displayScale });
      canvas.style.width = `${Math.floor(displayViewport.width)}px`;
      canvas.style.height = `${Math.floor(displayViewport.height)}px`;
    } else {
      renderScale = Math.min(displayScale, 2.5);
      canvas.style.width = "";
      canvas.style.height = "";
    }
  } else {
    canvas.style.width = "";
    canvas.style.height = "";
  }

  let rendered: HTMLCanvasElement | null = null;
  try {
    rendered = await renderPdfPageToCanvas(page, renderScale);
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(rendered, 0, 0);
  } finally {
    releaseCanvasMemory(rendered);
  }
}
