import { isLegacyPdfEnvironment } from "@/scripts/pdf-worker";

function legacyEnv(): boolean {
  return isLegacyPdfEnvironment();
}

/** Max width/height per canvas edge — avoids GPU/RAM exhaustion on old systems. */
export function getMaxCanvasDim(): number {
  return legacyEnv() ? 6144 : 8192;
}

/** Max total pixels (~24 MP legacy, ~48 MP modern). */
export function getMaxCanvasPixels(): number {
  return legacyEnv() ? 24_000_000 : 48_000_000;
}

export type ClampedDimensions = {
  width: number;
  height: number;
  /** Combined scale factor applied (1 = no change). */
  scale: number;
};

/**
 * Proportionally clamp image/canvas dimensions for legacy hardware budgets.
 */
export function clampImageDimensions(
  width: number,
  height: number
): ClampedDimensions {
  let w = Math.max(1, Math.floor(width));
  let h = Math.max(1, Math.floor(height));
  let scale = 1;

  const maxDim = getMaxCanvasDim();
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.max(1, Math.floor(w * ratio));
    h = Math.max(1, Math.floor(h * ratio));
    scale = ratio;
  }

  const pixels = w * h;
  const maxPixels = getMaxCanvasPixels();
  if (pixels > maxPixels) {
    const ratio = Math.sqrt(maxPixels / pixels);
    w = Math.max(1, Math.floor(w * ratio));
    h = Math.max(1, Math.floor(h * ratio));
    scale *= ratio;
  }

  return { width: w, height: h, scale };
}

/** Default JPEG quality for thumbnails on legacy vs modern browsers. */
export function legacyAwareJpegQuality(modern = 0.85): number {
  return legacyEnv() ? Math.min(modern, 0.72) : modern;
}

/** High JPEG quality for final exports — keeps clarity on legacy browsers. */
export function legacyAwareExportJpegQuality(modern = 0.96): number {
  return legacyEnv() ? Math.min(modern, 0.92) : modern;
}
