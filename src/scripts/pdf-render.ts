import { getPdfjsEngineVersion, isLegacyPdfEnvironment } from "@/scripts/pdf-worker";
import type { PdfPageProxy } from "@/scripts/pdf-engine-types";

const LEGACY_MAX_CANVAS_DIM = 6144;

function legacyEnv(): boolean {
  return isLegacyPdfEnvironment();
}

export const HD_JPG_RENDER = {
  get scale() {
    return legacyEnv() ? 2 : 4;
  },
  get quality() {
    return legacyEnv() ? 0.92 : 1;
  },
};

export const ZIP_JPG_RENDER = HD_JPG_RENDER;

export type PdfRenderOptions = {
  /** When false, return a blank canvas instead of throwing (preview thumbnails). */
  throwOnBlank?: boolean;
  /** Lower scales and legacy flags for dropzone previews. */
  preview?: boolean;
};

export function isPdfRenderBlankError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("PDF render blank");
}

export function getPdfRenderScale(modernScale = 1.5): number {
  return legacyEnv() ? Math.min(modernScale, 0.85) : modernScale;
}

export function clampPdfRenderScale(
  page: PdfPageProxy,
  scale: number
): number {
  const maxDim = legacyEnv() ? LEGACY_MAX_CANVAS_DIM : 8192;
  let s = scale;
  for (let i = 0; i < 16; i++) {
    const { width, height } = page.getViewport({ scale: s });
    if (width <= maxDim && height <= maxDim) {
      return Math.round(s * 100) / 100;
    }
    s *= 0.85;
  }
  return 0.25;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Release canvas backing store on memory-constrained legacy browsers. */
export function releaseCanvasMemory(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* ignore */
  }
}

/**
 * Obtain a 2D context with fallbacks for older engines (no alpha / willReadFrequently hints).
 */
export function getCanvas2dContext(
  canvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D | null;
  } catch {
    /* older browsers may reject context attributes */
  }
  if (!ctx) {
    ctx = canvas.getContext("2d");
  }
  if (!ctx) throw new Error("Canvas not supported");
  return ctx;
}

/** Detect renders that finished but drew no visible content (common when wasm is off). */
export function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 2 || canvas.height < 2) return true;

  const grid = 8;
  let contentPixels = 0;
  const cellW = Math.max(1, Math.floor(canvas.width / grid));
  const cellH = Math.max(1, Math.floor(canvas.height / grid));
  const sampleW = Math.min(24, cellW);
  const sampleH = Math.min(24, cellH);

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.min(gx * cellW, Math.max(0, canvas.width - sampleW));
      const y = Math.min(gy * cellH, Math.max(0, canvas.height - sampleH));
      let data: ImageData;
      try {
        data = ctx.getImageData(x, y, sampleW, sampleH);
      } catch {
        return true;
      }
      for (let i = 0; i < data.data.length; i += 4) {
        const alpha = data.data[i + 3];
        if (alpha < 8) continue;
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        if (r < 248 || g < 248 || b < 248) contentPixels++;
      }
    }
  }

  return contentPixels < 12;
}

export function copyCanvasTo(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement
): void {
  target.width = source.width;
  target.height = source.height;
  const ctx = getCanvas2dContext(target);
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

function legacyPdfRenderFlags(): Record<string, unknown> {
  return {
    // Always force classic 2D canvas — ImageBitmap/WebGL crash on legacy GPUs.
    disableCreateImageBitmap: true,
    enableWebGL: false,
  };
}

function buildRenderParams(
  _page: PdfPageProxy,
  ctx: CanvasRenderingContext2D,
  viewport: { width: number; height: number },
  canvas: HTMLCanvasElement
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    canvasContext: ctx,
    viewport,
    background: "#ffffff",
    intent: "display",
    annotationMode: 0,
    ...legacyPdfRenderFlags(),
  };
  if (getPdfjsEngineVersion() === 6) {
    params.canvas = canvas;
  }
  return params;
}

export function drawPdfPreviewPlaceholder(
  canvas: HTMLCanvasElement,
  pageWidthPt: number,
  pageHeightPt: number,
  message: string,
  displayScale?: number
): void {
  const scale =
    displayScale ?? (legacyEnv() ? getPdfRenderScale(0.75) : getPdfRenderScale(1.1));
  const w = Math.max(1, Math.floor(pageWidthPt * scale));
  const h = Math.max(1, Math.floor(pageHeightPt * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = getCanvas2dContext(canvas);
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  ctx.fillStyle = "#6b7280";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.max(12, Math.min(16, Math.floor(w / 24)));
  ctx.font = `${fontSize}px sans-serif`;

  const lines = message.split("\n");
  const lineHeight = fontSize * 1.35;
  const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, startY + i * lineHeight);
  });
}

export async function renderPdfPageToCanvas(
  page: PdfPageProxy,
  scale: number,
  opts?: PdfRenderOptions
): Promise<HTMLCanvasElement> {
  const throwOnBlank = opts?.throwOnBlank ?? !opts?.preview;
  const baseScale = clampPdfRenderScale(page, scale);
  const scaleSteps = opts?.preview
    ? legacyEnv()
      ? [baseScale, baseScale * 0.85, 0.6, 0.45, 0.35, 0.28]
      : [baseScale, baseScale * 0.85, 0.75, 0.6, 0.5]
    : legacyEnv()
      ? [baseScale, baseScale * 0.9, 0.72, 0.6, 0.5, 0.4, 0.32]
      : [baseScale, baseScale * 0.85, 1.0, 0.75, 0.6];
  const scales = [
    ...new Set(scaleSteps.map(s => Math.round(s * 100) / 100)),
  ].filter(s => s >= 0.2);

  let lastError: unknown;
  for (const attemptScale of scales) {
    try {
      return await renderPdfPageToCanvasOnce(page, attemptScale, throwOnBlank);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Preview-safe render: never throws on blank canvas; returns null when unusable.
 */
export async function tryRenderPdfPagePreview(
  page: PdfPageProxy,
  scale: number
): Promise<HTMLCanvasElement | null> {
  try {
    const canvas = await renderPdfPageToCanvas(page, scale, {
      preview: true,
      throwOnBlank: false,
    });
    if (isCanvasMostlyBlank(canvas)) {
      releaseCanvasMemory(canvas);
      return null;
    }
    return canvas;
  } catch {
    return null;
  }
}

async function renderPdfPageToCanvasOnce(
  page: PdfPageProxy,
  scale: number,
  throwOnBlank: boolean
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = getCanvas2dContext(canvas);

  ctx.imageSmoothingEnabled = true;
  try {
    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingQuality = "low";
    }
  } catch {
    /* unsupported on very old canvas implementations */
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderParams = buildRenderParams(page, ctx, viewport, canvas);
  const renderTask = page.render(
    renderParams as Parameters<PdfPageProxy["render"]>[0]
  );

  const timeoutMs = legacyEnv() ? 240_000 : 180_000;
  try {
    await promiseWithTimeout(renderTask.promise, timeoutMs, "PDF render timeout");
  } catch (err) {
    try {
      renderTask.cancel?.();
    } catch {
      /* ignore */
    }
    releaseCanvasMemory(canvas);
    throw err;
  }

  if (isCanvasMostlyBlank(canvas)) {
    if (throwOnBlank) {
      releaseCanvasMemory(canvas);
      throw new Error("PDF render blank");
    }
    return canvas;
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
  const blob = await tryCanvasToBlob(canvas, quality, legacyEnv() ? 12_000 : 30_000);
  if (blob) return blob;

  const pixels = canvas.width * canvas.height;
  const maxDataUrlPixels = legacyEnv() ? 6_000_000 : 16_000_000;
  if (pixels > maxDataUrlPixels) {
    throw new Error("JPEG encode failed");
  }

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrlToBlob(dataUrl);
  } catch {
    throw new Error("JPEG encode failed");
  }
}

export async function renderPdfPageToDataUrl(
  page: PdfPageProxy,
  scale: number,
  quality = 0.85
): Promise<string> {
  const canvas = await renderPdfPageToCanvas(page, scale, { preview: true });
  try {
    const blob = await canvasToJpegBlob(canvas, quality);
    return URL.createObjectURL(blob);
  } catch {
    return canvas.toDataURL("image/jpeg", quality);
  }
}
