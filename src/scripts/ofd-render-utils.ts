/**
 * Performance, memory, and rendering helpers for the OFD pipeline.
 * Includes Hi-DPI canvas setup, z-index layer ordering, blend-mode mapping,
 * and aggressive GC hooks for low-end hardware.
 */
import { clampImageDimensions, getMaxCanvasDim } from "@/utils/canvas-budget";
import { isCanvasMostlyBlank } from "@/scripts/pdf-render";

/** Yield to the main thread — prevents UI freezes on legacy Chromium / 360 Browser. */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 32 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Adaptive render width based on hardware concurrency and device memory. */
export function getAdaptiveRenderWidth(base = 794): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return Math.min(base, 560);
  if (cores <= 4 || mem <= 4) return Math.min(base, 680);
  return base;
}

/**
 * Effective DPR capped for memory safety.
 * Prevents 4K canvases from exhausting GPU RAM on low-end machines.
 */
export function getEffectiveDevicePixelRatio(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const dpr = window.devicePixelRatio || 1;
  if (cores <= 2 || mem <= 2) return Math.min(dpr, 1);
  if (cores <= 4 || mem <= 4) return Math.min(dpr, 1.25);
  return Math.min(dpr, 2);
}

/** html2canvas scale — legacy engines stay at 1× to avoid OOM. */
export function getAdaptiveCanvasScale(): number {
  return getEffectiveDevicePixelRatio();
}

export type HiDpiCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
};

/**
 * Create a canvas whose backing store matches devicePixelRatio while
 * respecting global canvas budget limits (prevents clipping on Hi-DPI).
 */
export function createHiDpiCanvas(cssWidth: number, cssHeight: number): HiDpiCanvas {
  const dpr = getEffectiveDevicePixelRatio();
  let pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  let pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

  const clamped = clampImageDimensions(pixelWidth, pixelHeight);
  pixelWidth = clamped.width;
  pixelHeight = clamped.height;

  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas-context");

  const scaleX = pixelWidth / cssWidth;
  const scaleY = pixelHeight / cssHeight;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return {
    canvas,
    ctx,
    cssWidth,
    cssHeight,
    pixelWidth,
    pixelHeight,
    dpr: scaleX,
  };
}

/** Map OFD / SVG blend mode strings to CSS mix-blend-mode values. */
const BLEND_MODE_MAP: Record<string, string> = {
  Normal: "normal",
  Multiply: "multiply",
  Screen: "screen",
  Overlay: "overlay",
  Darken: "darken",
  Lighten: "lighten",
  ColorDodge: "color-dodge",
  ColorBurn: "color-burn",
  HardLight: "hard-light",
  SoftLight: "soft-light",
  Difference: "difference",
  Exclusion: "exclusion",
  Hue: "hue",
  Saturation: "saturation",
  Color: "color",
  Luminosity: "luminosity",
};

export function mapBlendMode(raw: string | null | undefined): string {
  if (!raw) return "normal";
  const key = raw.replace(/[^a-z]/gi, "");
  for (const [ofdMode, cssMode] of Object.entries(BLEND_MODE_MAP)) {
    if (ofdMode.toLowerCase() === key.toLowerCase()) return cssMode;
  }
  return "normal";
}

function parseZIndex(el: HTMLElement): number {
  const style = window.getComputedStyle(el);
  const z = parseInt(style.zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

/**
 * Re-order absolutely positioned children by z-index so transparent stamps
 * and vector borders paint in the correct stacking order before rasterization.
 */
export function enforcePageLayerOrder(pageDiv: HTMLElement): void {
  const positioned = Array.from(pageDiv.querySelectorAll<HTMLElement>("*")).filter(el => {
    const pos = window.getComputedStyle(el).position;
    return pos === "absolute" || pos === "fixed" || pos === "relative";
  });

  for (const el of positioned) {
    const blend =
      el.getAttribute("data-blend-mode") ??
      el.getAttribute("blend-mode") ??
      el.style.mixBlendMode;
    if (blend) {
      el.style.mixBlendMode = mapBlendMode(blend);
    }

    const zOrder = el.getAttribute("data-zorder") ?? el.getAttribute("zorder");
    if (zOrder && !el.style.zIndex) {
      const zMap: Record<string, number> = {
        Background: 0,
        Body: 10,
        Foreground: 20,
        Top: 30,
      };
      if (zOrder in zMap) el.style.zIndex = String(zMap[zOrder]);
    }
  }

  const children = Array.from(pageDiv.children) as HTMLElement[];
  if (children.length <= 1) return;

  const sorted = [...children].sort((a, b) => parseZIndex(a) - parseZIndex(b));
  const changed = sorted.some((el, i) => el !== children[i]);
  if (!changed) return;

  const fragment = document.createDocumentFragment();
  for (const el of sorted) fragment.appendChild(el);
  pageDiv.appendChild(fragment);
}

/**
 * Inject fallback font CSS so text remains visible when embedded OFD fonts fail.
 * Uses system-ui stack with similar metrics to common Chinese document fonts.
 */
const CJK_FONT_STACK =
  '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimSun", "Source Han Sans SC", system-ui, sans-serif';

const FONT_NAME_STACK: Record<string, string> = {
  宋体: '"SimSun", "NSimSun", ' + CJK_FONT_STACK,
  楷体: '"KaiTi", "STKaiti", "AR PL UKai CN", ' + CJK_FONT_STACK,
  黑体: '"SimHei", "Heiti SC", ' + CJK_FONT_STACK,
  仿宋: '"FangSong", "STFangsong", ' + CJK_FONT_STACK,
  "Courier New": '"Courier New", Courier, monospace',
};

function stackForFontName(name: string): string {
  const hit = FONT_NAME_STACK[name];
  if (hit) return hit;
  if (/courier/i.test(name)) return FONT_NAME_STACK["Courier New"];
  if (/宋|song|sun/i.test(name)) return FONT_NAME_STACK["宋体"];
  if (/楷|kai/i.test(name)) return FONT_NAME_STACK["楷体"];
  if (/黑|hei/i.test(name)) return FONT_NAME_STACK["黑体"];
  if (/仿|fang/i.test(name)) return FONT_NAME_STACK["仿宋"];
  return `"${name}", ${CJK_FONT_STACK}`;
}

export function injectFontFallbackStyle(fontFamilies: string[]): void {
  if (fontFamilies.length === 0) return;
  const id = "ofd-font-fallback-style";
  document.getElementById(id)?.remove();

  const rules = fontFamilies
    .map(
      family =>
        `[style*="${family}"], [data-font="${family}"], .ofd-text-${CSS.escape(family)} { font-family: ${stackForFontName(family)} !important; }`
    )
    .join("\n");

  const style = document.createElement("style");
  style.id = id;
  style.textContent = rules;
  document.head.appendChild(style);
}

/** Map numeric OFD Font IDs (e.g. Font="85") to usable CSS font stacks. */
export function injectFontIdAliasStyle(fontIdMap: Map<number, string>): void {
  if (fontIdMap.size === 0) return;
  const id = "ofd-font-id-alias-style";
  document.getElementById(id)?.remove();

  const rules = [...fontIdMap.entries()]
    .map(([fontId, fontName]) => {
      const stack = stackForFontName(fontName);
      const idStr = String(fontId);
      return [
        `[data-font-id="${idStr}"]`,
        `[data-font="${idStr}"]`,
        `.ofd-font-${idStr}`,
        `[style*="font-family: ${idStr}"]`,
        `[style*="font-family:${idStr}"]`,
        `[font-family="${idStr}"]`,
      ]
        .map(sel => `${sel}{font-family:${stack}!important}`)
        .join("");
    })
    .join("\n");

  const style = document.createElement("style");
  style.id = id;
  style.textContent = rules;
  document.head.appendChild(style);
}

/** Release canvas GPU/memory buffers immediately after export. */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* ignore — canvas may already be detached */
  }
}

export function releaseCanvases(canvases: HTMLCanvasElement[]): void {
  for (const canvas of canvases) releaseCanvas(canvas);
}

/** Revoke a Uint8Array backing store reference for GC on legacy engines. */
export function releaseBuffer(buf: ArrayBuffer | Uint8Array | null | undefined): void {
  void buf;
}

/** Unified Blob URL registry — prevents leaks across preview / export cycles. */
export class BlobUrlRegistry {
  private readonly urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  revoke(url: string | null | undefined): void {
    if (!url || !this.urls.has(url)) return;
    URL.revokeObjectURL(url);
    this.urls.delete(url);
  }

  revokeAll(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

/**
 * Cross-browser download trigger.
 * Revokes the object URL after 60 s to free memory.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const registry = new BlobUrlRegistry();
  const url = registry.create(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean;
  };
  if (!anchor.download && nav.msSaveOrOpenBlob) {
    nav.msSaveOrOpenBlob(blob, filename);
  }

  setTimeout(() => registry.revoke(url), 60_000);
}

/** Max dimension for stitched long images — respects canvas-budget. */
export function getLongImageMaxDim(): number {
  return Math.min(16384, getMaxCanvasDim() * 2);
}

/**
 * Estimate non-white ink coverage (0–1) via grid sampling.
 * Used to reject sparse renders that pass isCanvasMostlyBlank but lack real content.
 */
export function measureCanvasInkRatio(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 2 || canvas.height < 2) return 0;

  const grid = 16;
  let contentPixels = 0;
  let totalPixels = 0;
  const cellW = Math.max(1, Math.floor(canvas.width / grid));
  const cellH = Math.max(1, Math.floor(canvas.height / grid));
  const sampleW = Math.min(32, cellW);
  const sampleH = Math.min(32, cellH);

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.min(gx * cellW, Math.max(0, canvas.width - sampleW));
      const y = Math.min(gy * cellH, Math.max(0, canvas.height - sampleH));
      let data: ImageData;
      try {
        data = ctx.getImageData(x, y, sampleW, sampleH);
      } catch {
        return 0;
      }
      for (let i = 0; i < data.data.length; i += 4) {
        totalPixels++;
        const alpha = data.data[i + 3];
        if (alpha < 8) continue;
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        if (r < 248 || g < 248 || b < 248) contentPixels++;
      }
    }
  }

  return totalPixels > 0 ? contentPixels / totalPixels : 0;
}

/** Sample ink density inside a CSS-pixel rectangle on a Hi-DPI canvas. */
export function measureRegionInkRatio(
  canvas: HTMLCanvasElement,
  cssLeft: number,
  cssTop: number,
  cssWidth: number,
  cssHeight: number
): number {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 2 || canvas.height < 2) return 0;

  const styleW = Number(canvas.style.width?.replace("px", "")) || canvas.width;
  const scaleX = canvas.width / styleW;
  const scaleY = canvas.height / (Number(canvas.style.height?.replace("px", "")) || canvas.height);
  const sx = Math.max(0, Math.floor(cssLeft * scaleX));
  const sy = Math.max(0, Math.floor(cssTop * scaleY));
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(cssWidth * scaleX)));
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(cssHeight * scaleY)));

  let data: ImageData;
  try {
    data = ctx.getImageData(sx, sy, sw, sh);
  } catch {
    return 0;
  }

  let contentPixels = 0;
  let totalPixels = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    totalPixels++;
    const alpha = data.data[i + 3];
    if (alpha < 12) continue;
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    if (r < 245 || g < 245 || b < 245) contentPixels++;
  }

  return totalPixels > 0 ? contentPixels / totalPixels : 0;
}

/** True when the canvas has enough visible ink to be a meaningful page export. */
export function isCanvasRenderable(
  canvas: HTMLCanvasElement,
  minInkRatio = 0.004
): boolean {
  if (isCanvasMostlyBlank(canvas)) return false;
  return measureCanvasInkRatio(canvas) >= minInkRatio;
}

/** Pick the canvas with the highest ink coverage (most complete render). */
export function pickBestCanvas(canvases: HTMLCanvasElement[]): HTMLCanvasElement | null {
  let best: HTMLCanvasElement | null = null;
  let bestInk = 0;
  for (const canvas of canvases) {
    if (isCanvasMostlyBlank(canvas)) continue;
    const ink = measureCanvasInkRatio(canvas);
    if (ink > bestInk) {
      bestInk = ink;
      best = canvas;
    }
  }
  return best;
}
