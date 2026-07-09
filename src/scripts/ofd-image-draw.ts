/**
 * OFD ImageObject drawing — preserves aspect ratio and applies CTM transforms.
 */

export type OfdCtm = [number, number, number, number, number, number];

export function parseOfdCtm(raw: string | null | undefined): OfdCtm | null {
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 6 || parts.some(n => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];
}

export function isPortraitSlot(boxW: number, boxH: number): boolean {
  if (boxW <= 0 || boxH <= 0) return false;
  return boxH >= boxW * 0.75;
}

export function isPortraitImage(img: HTMLImageElement): boolean {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) return false;
  return h >= w * 0.85;
}

/** True when boundary aspect conflicts with image — prior render is likely stretched. */
export function needsAspectCorrection(
  boxW: number,
  boxH: number,
  img: HTMLImageElement
): boolean {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0 || boxW <= 0 || boxH <= 0) return false;
  const boxAspect = boxW / boxH;
  const imgAspect = iw / ih;
  if (isPortraitImage(img) && boxAspect > 1.15) return true;
  if (imgAspect > 1.2 && boxAspect < 0.85) return true;
  return Math.abs(boxAspect - imgAspect) / Math.max(imgAspect, 0.01) > 0.35;
}

export function fitImageContain(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
): { x: number; y: number; w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { x: 0, y: 0, w: boxW, h: boxH };
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export function isLikelyStampResource(pathHint: string, img: HTMLImageElement): boolean {
  if (/stamp|seal|sign|章|印/i.test(pathHint)) return true;
  if (!pathHint.toLowerCase().endsWith(".png")) return false;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return w > 0 && h > 0 && Math.abs(w - h) / Math.max(w, h) < 0.35;
}

/**
 * Draw an OFD ImageObject into a boundary box (CSS pixels), preserving aspect ratio.
 */
export function drawOfdImageInBoundary(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  left: number,
  top: number,
  boxW: number,
  boxH: number,
  ctm: OfdCtm | null,
  options?: { stamp?: boolean; forceContain?: boolean }
): void {
  const forceContain = options?.forceContain ?? needsAspectCorrection(boxW, boxH, img);
  const stamp = options?.stamp ?? false;

  g.save();
  g.translate(left, top);

  if (stamp) g.globalCompositeOperation = "multiply";

  if (forceContain || !ctm) {
    const fit = fitImageContain(img.naturalWidth, img.naturalHeight, boxW, boxH);
    g.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  } else {
    g.transform(ctm[0], ctm[1], ctm[2], ctm[3], ctm[4], ctm[5]);
    g.drawImage(img, 0, 0, boxW, boxH);
  }

  g.restore();
}

export function applyDomImageFit(
  img: HTMLImageElement,
  boxW: number,
  boxH: number,
  stamp = false
): void {
  img.style.objectFit = "contain";
  img.style.objectPosition = "center";
  if (stamp) {
    img.style.mixBlendMode = "multiply";
    img.style.zIndex = "30";
  }
  if (needsAspectCorrection(boxW, boxH, img) || isPortraitImage(img)) {
    img.style.objectFit = "contain";
  }
}
