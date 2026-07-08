import { isLegacyPdfEnvironment } from "@/scripts/pdf-worker";
import type { pdfjsLib } from "@/scripts/pdf-worker";

const LEGACY = isLegacyPdfEnvironment();

export const HD_JPG_RENDER = {
  scale: LEGACY ? 2 : 4,
  quality: LEGACY ? 0.92 : 1,
};

export const ZIP_JPG_RENDER = HD_JPG_RENDER;

export function getPdfRenderScale(modernScale = 1.5): number {
  return LEGACY ? Math.min(modernScale, 1) : modernScale;
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
  const scales = LEGACY
    ? [...new Set([scale, scale * 0.9, 1, 0.85, 0.72].map(s => Math.round(s * 100) / 100))]
    : [scale];

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
    const response = await fetch(dataUrl);
    return await response.blob();
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
