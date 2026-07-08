import { isLegacyPdfEnvironment } from "@/scripts/pdf-worker";
import type { pdfjsLib } from "@/scripts/pdf-worker";

const LEGACY = isLegacyPdfEnvironment();
const LEGACY_MAX_CANVAS_DIM = 4096;

export const HD_JPG_RENDER = {
  scale: LEGACY ? 2 : 4,
  quality: LEGACY ? 0.92 : 1,
};

export const ZIP_JPG_RENDER = HD_JPG_RENDER;

export function getPdfRenderScale(modernScale = 1.5): number {
  return LEGACY ? Math.min(modernScale, 0.85) : modernScale;
}

export function clampPdfRenderScale(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): number {
  if (!LEGACY) return scale;
  let s = scale;
  for (let i = 0; i < 12; i++) {
    const { width, height } = page.getViewport({ scale: s });
    if (width <= LEGACY_MAX_CANVAS_DIM && height <= LEGACY_MAX_CANVAS_DIM) {
      return Math.round(s * 100) / 100;
    }
    s *= 0.85;
  }
  return 0.25;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Detect renders that finished but drew no visible content (common when wasm is off). */
export function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 2 || canvas.height < 2) return true;

  const w = Math.min(64, canvas.width);
  const h = Math.min(64, canvas.height);
  const { data } = ctx.getImageData(0, 0, w, h);
  let contentPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 248 || g < 248 || b < 248) contentPixels++;
  }

  return contentPixels < 8;
}

export function copyCanvasTo(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement
): void {
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0);
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function renderPdfPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<HTMLCanvasElement> {
  const baseScale = clampPdfRenderScale(page, scale);
  const scales = LEGACY
    ? [...new Set([baseScale, baseScale * 0.9, 0.72, 0.6, 0.5].map(s => Math.round(s * 100) / 100))]
    : [baseScale];

  let lastError: unknown;
  for (const attemptScale of scales) {
    try {
      return await renderPdfPageToCanvasOnce(page, attemptScale);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function renderPdfPageToCanvasOnce(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });

  const timeoutMs = LEGACY ? 240_000 : 180_000;
  await promiseWithTimeout(renderTask.promise, timeoutMs, "PDF render timeout");

  if (LEGACY && isCanvasMostlyBlank(canvas)) {
    throw new Error("PDF render blank");
  }

  return canvas;
}

function tryCanvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  timeoutMs: number
): Promise<Blob | null> {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      canvas.toBlob(
        blob => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  const blob = await tryCanvasToBlob(canvas, quality, LEGACY ? 45_000 : 90_000);
  if (blob) return blob;

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrlToBlob(dataUrl);
  } catch {
    throw new Error("JPEG encode failed");
  }
}

export async function renderPdfPageToDataUrl(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
  quality = 0.85
): Promise<string> {
  const canvas = await renderPdfPageToCanvas(page, scale);
  try {
    const blob = await canvasToJpegBlob(canvas, quality);
    return URL.createObjectURL(blob);
  } catch {
    return canvas.toDataURL("image/jpeg", quality);
  }
}
