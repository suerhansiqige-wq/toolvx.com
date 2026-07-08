import { isLegacyPdfEnvironment } from "@/scripts/pdf-worker";

const LEGACY = isLegacyPdfEnvironment();

/** Max width/height per canvas edge — avoids GPU/RAM exhaustion on old systems. */
export const MAX_CANVAS_DIM = LEGACY ? 4096 : 8192;

/** Max total pixels (~12 MP legacy, ~48 MP modern). */
export const MAX_CANVAS_PIXELS = LEGACY ? 12_000_000 : 48_000_000;

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

  if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
    const ratio = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h);
    w = Math.max(1, Math.floor(w * ratio));
    h = Math.max(1, Math.floor(h * ratio));
    scale = ratio;
  }

  const pixels = w * h;
  if (pixels > MAX_CANVAS_PIXELS) {
    const ratio = Math.sqrt(MAX_CANVAS_PIXELS / pixels);
    w = Math.max(1, Math.floor(w * ratio));
    h = Math.max(1, Math.floor(h * ratio));
    scale *= ratio;
  }

  return { width: w, height: h, scale };
}

/** Default JPEG quality for thumbs/exports on legacy vs modern browsers. */
export function legacyAwareJpegQuality(modern = 0.85): number {
  return LEGACY ? Math.min(modern, 0.72) : modern;
}
