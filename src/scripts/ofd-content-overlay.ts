/**
 * Paint page-layer OFD content (dynamic text + photos) when ofd.js only renders
 * the template background. Parses Content.xml and draws missing regions onto canvas.
 */
import JSZip from "jszip";
import {
  decodeXmlText,
  naturalSort,
  parseDocumentPages,
  parseOfdBox,
  parseOfdDocRoot,
  resolveRelativePath,
} from "@/scripts/ofd-xml-utils";
import {
  applyDomImageFit,
  drawOfdImageInBoundary,
  isLikelyStampResource,
  isPortraitImage,
  isPortraitSlot,
  needsAspectCorrection,
  parseOfdCtm,
} from "@/scripts/ofd-image-draw";
import { BlobUrlRegistry, measureRegionInkRatio } from "@/scripts/ofd-render-utils";

export type PageContentMeta = {
  contentXml: string;
  pageWidthMm: number;
  pageHeightMm: number;
};

export type MediaAsset = {
  url: string;
  pathHint: string;
};

export type PagePaintContext = {
  meta: PageContentMeta;
  fontIdMap: Map<number, string>;
  mediaIdMap: Map<number, MediaAsset>;
  portraitAssets: MediaAsset[];
};

const pagePaintCache = new WeakMap<HTMLElement, PagePaintContext>();

const PAGE_CONTENT_RE = /\/Pages\/Page_\d+\/Content\.xml$/i;
const STATIC_LABEL_RE =
  /^(姓名|性别|年龄|单位名称|发证日期|照片|照|片|NO[:：]?|食品及公共场所|健康体检|合格证|从业人员|中国卫生监督)$/;

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i");
  return tag.match(re)?.[1] ?? null;
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path) ?? zip.file(path.replace(/^\//, ""));
  if (!entry || entry.dir) return null;
  return entry.async("string");
}

function parsePageAreaMm(documentXml: string, pageContentXml: string): [number, number] {
  const areaMatch =
    pageContentXml.match(/<(?:[\w-]+:)?PhysicalBox[^>]*>([^<]+)</i) ??
    documentXml.match(/<(?:[\w-]+:)?PageArea[\s\S]*?<(?:[\w-]+:)?PhysicalBox[^>]*>([^<]+)</i);
  const box = parseOfdBox(areaMatch?.[1]);
  if (!box) return [210, 297];
  return [box[2] || 210, box[3] || 297];
}

function isDynamicText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 1) return false;
  if (STATIC_LABEL_RE.test(trimmed)) return false;
  return true;
}

function fontFamilyForId(fontId: string, fontIdMap: Map<number, string>): string {
  const name = fontIdMap.get(Number(fontId));
  if (!name) return '"SimSun", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  if (/courier/i.test(name)) return '"Courier New", Courier, monospace';
  if (/宋|song/i.test(name)) return '"SimSun", "NSimSun", "Microsoft YaHei", sans-serif';
  if (/楷|kai/i.test(name)) return '"KaiTi", "STKaiti", "Microsoft YaHei", sans-serif';
  if (/黑|hei/i.test(name)) return '"SimHei", "Microsoft YaHei", sans-serif';
  return `"${name}", "Microsoft YaHei", "SimSun", sans-serif`;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = url;
  });
}

export async function buildOfdFontIdMap(file: File): Promise<Map<number, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<number, string>();

  for (const path of Object.keys(zip.files).sort(naturalSort)) {
    if (!path.endsWith("DocumentRes.xml") && !path.endsWith("PublicRes.xml")) continue;
    const xml = await readText(zip, path);
    if (!xml) continue;

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?Font\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w-]+:)?Font>)/gi
    )) {
      const tag = block[0];
      const id = Number(attr(tag, "ID"));
      const fontName = attr(tag, "FontName") ?? attr(tag, "FamilyName");
      if (!Number.isFinite(id) || !fontName) continue;
      map.set(id, fontName);
    }
  }

  return map;
}

export async function buildOfdMediaIdMap(
  file: File,
  registry: BlobUrlRegistry
): Promise<{ map: Map<number, MediaAsset>; portraitAssets: MediaAsset[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<number, MediaAsset>();
  const portraitAssets: MediaAsset[] = [];
  const imageExt = /\.(jpe?g|png|bmp|gif|webp|tif{1,2})$/i;

  async function registerImage(path: string, id?: number): Promise<MediaAsset | null> {
    const entry = zip.file(path) ?? zip.file(path.replace(/^\//, ""));
    if (!entry || entry.dir) return null;
    const blob = await entry.async("blob");
    const typed =
      blob.type && blob.type.startsWith("image/")
        ? blob
        : new Blob([await entry.async("arraybuffer")], { type: mimeFromPath(path) });
    const url = registry.create(typed);
    const asset: MediaAsset = { url, pathHint: path };
    if (Number.isFinite(id)) map.set(id as number, asset);
    return asset;
  }

  for (const path of Object.keys(zip.files).sort(naturalSort)) {
    if (!path.endsWith("DocumentRes.xml") && !path.endsWith("PublicRes.xml")) continue;
    const xml = await readText(zip, path);
    if (!xml) continue;

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?(?:MultiMedia|Res)\b[^>]*(?:Type="Image"|Type\s*=\s*"Image")[^>]*>[\s\S]*?(?:\/>|<\/(?:[\w-]+:)?(?:MultiMedia|Res)>)/gi
    )) {
      const tag = block[0];
      const id = Number(attr(tag, "ID"));
      const mediaFile =
        tag.match(/<(?:[\w-]+:)?MediaFile[^>]*>([^<]+)<\/(?:[\w-]+:)?MediaFile>/i)?.[1] ??
        attr(tag, "MediaFile");
      if (!Number.isFinite(id) || !mediaFile) continue;
      const fullPath = resolveRelativePath(path, mediaFile.trim());
      await registerImage(fullPath, id);
    }
  }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !imageExt.test(path)) continue;
    if (/qr\.png$/i.test(path)) continue;
    const asset = await registerImage(path);
    if (!asset) continue;
    try {
      const probe = await loadImage(asset.url);
      if (isPortraitImage(probe) && probe.naturalWidth >= 40) {
        if (!portraitAssets.some(a => a.url === asset.url)) portraitAssets.push(asset);
      }
    } catch {
      /* skip */
    }
  }

  return { map, portraitAssets };
}

export async function loadPageContentMeta(file: File): Promise<PageContentMeta[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const ofdXml = await readText(zip, "OFD.xml");
  const metas: PageContentMeta[] = [];

  let documentXml = "";
  if (ofdXml) {
    const docRoot = parseOfdDocRoot(ofdXml);
    if (docRoot) documentXml = (await readText(zip, docRoot)) ?? "";
  }

  const pagePaths: string[] = [];
  if (documentXml) {
    const pages = parseDocumentPages(documentXml);
    const docRoot = parseOfdDocRoot(ofdXml ?? "");
    for (const page of pages) {
      if (docRoot) pagePaths.push(resolveRelativePath(docRoot, page.baseLoc));
    }
  }

  if (pagePaths.length === 0) {
    for (const path of Object.keys(zip.files).sort(naturalSort)) {
      if (PAGE_CONTENT_RE.test(path)) pagePaths.push(path);
    }
  }

  for (const contentPath of pagePaths) {
    const contentXml = await readText(zip, contentPath);
    if (!contentXml) continue;
    const [pageWidthMm, pageHeightMm] = parsePageAreaMm(documentXml, contentXml);
    metas.push({ contentXml, pageWidthMm, pageHeightMm });
  }

  return metas;
}

export function getPagePaintContext(pageDiv: HTMLElement): PagePaintContext | undefined {
  return pagePaintCache.get(pageDiv);
}

function resolveImageAsset(
  ctx: PagePaintContext,
  resourceId: number,
  boundary: [number, number, number, number],
  portraitIdx: { value: number }
): MediaAsset | undefined {
  if (Number.isFinite(resourceId)) {
    const hit = ctx.mediaIdMap.get(resourceId);
    if (hit) return hit;
  }

  const boxW = boundary[2];
  const boxH = boundary[3];
  if (!isPortraitSlot(boxW, boxH)) return undefined;

  const asset = ctx.portraitAssets[portraitIdx.value];
  if (asset) portraitIdx.value++;
  return asset;
}

async function paintImageObject(
  g: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ctx: PagePaintContext,
  attrs: string,
  scale: number,
  portraitIdx: { value: number }
): Promise<boolean> {
  const resourceId = Number(attr(attrs, "ResourceID"));
  const boundary = parseOfdBox(attr(attrs, "Boundary"));
  if (!boundary) return false;

  const left = boundary[0] * scale;
  const top = boundary[1] * scale;
  const width = boundary[2] * scale;
  const height = boundary[3] * scale;
  const ctm = parseOfdCtm(attr(attrs, "CTM"));

  const asset = resolveImageAsset(ctx, resourceId, boundary, portraitIdx);
  if (!asset) return false;

  let img: HTMLImageElement;
  try {
    img = await loadImage(asset.url);
  } catch {
    return false;
  }

  const ink = measureRegionInkRatio(canvas, left, top, width, height);
  const stamp = isLikelyStampResource(asset.pathHint, img);
  const forceRepaint =
    needsAspectCorrection(width, height, img) || (stamp && ink < 0.5);
  if (!forceRepaint && ink > 0.08) return false;

  if (forceRepaint || ink > 0.02) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const styleW = Number(canvas.style.width?.replace("px", "")) || canvas.width;
    const styleH = Number(canvas.style.height?.replace("px", "")) || canvas.height;
    const scaleX = canvas.width / styleW;
    const scaleY = canvas.height / styleH;
    g.fillStyle = "#ffffff";
    g.fillRect(left * scaleX, top * scaleY, width * scaleX, height * scaleY);
    g.restore();
  }

  drawOfdImageInBoundary(g, img, left, top, width, height, ctm, {
    stamp,
    forceContain: forceRepaint || isPortraitImage(img),
  });
  return true;
}

export async function paintMissingPageContentOntoCanvas(
  canvas: HTMLCanvasElement,
  ctx: PagePaintContext
): Promise<number> {
  const style = canvas.style.width ? Number(canvas.style.width.replace("px", "")) : 0;
  const cssWidth = style || canvas.width;
  const scale = cssWidth / ctx.meta.pageWidthMm;
  if (!scale || !Number.isFinite(scale)) return 0;

  const g = canvas.getContext("2d");
  if (!g) return 0;

  const styleH = canvas.style.height ? Number(canvas.style.height.replace("px", "")) : 0;
  const cssHeight = styleH || canvas.height;
  const scaleY = canvas.height / cssHeight;
  const scaleX = canvas.width / cssWidth;
  g.save();
  g.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  let painted = 0;

  for (const match of ctx.meta.contentXml.matchAll(
    /<(?:[\w-]+:)?TextObject\b([^>]*)>[\s\S]*?<(?:[\w-]+:)?TextCode([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/gi
  )) {
    const objAttrs = match[1] ?? "";
    const codeAttrs = match[2] ?? "";
    const rawText = decodeXmlText(match[3] ?? "");
    if (!isDynamicText(rawText)) continue;

    const boundary = parseOfdBox(attr(objAttrs, "Boundary"));
    if (!boundary) continue;

    const codeX = Number(attr(codeAttrs, "X") ?? "0");
    const codeY = Number(attr(codeAttrs, "Y") ?? "0");
    const fontId = attr(objAttrs, "Font") ?? "0";
    const sizeMm = Number(attr(objAttrs, "Size") ?? "3.5");

    const left = (boundary[0] + codeX) * scale;
    const top = (boundary[1] + codeY) * scale;
    const regionW = Math.max(boundary[2] * scale, 12);
    const regionH = Math.max(boundary[3] * scale, 8);
    const fontSize = Math.max(9, sizeMm * scale * 0.96);

    const ink = measureRegionInkRatio(canvas, left, top, regionW, regionH);
    if (ink > 0.035) continue;

    g.font = `${fontSize}px ${fontFamilyForId(fontId, ctx.fontIdMap)}`;
    g.fillStyle = "#000000";
    g.textBaseline = "alphabetic";
    g.fillText(rawText, left, top + fontSize * 0.88);
    painted++;
  }

  const portraitIdx = { value: 0 };
  for (const match of ctx.meta.contentXml.matchAll(/<(?:[\w-]+:)?ImageObject\b([^/>]*)\/?>/gi)) {
    if (await paintImageObject(g, canvas, ctx, match[1] ?? "", scale, portraitIdx)) painted++;
  }

  g.restore();
  return painted;
}

function fixExistingPageImages(pageDiv: HTMLElement): void {
  pageDiv.querySelectorAll("img").forEach(img => {
    const w = img.offsetWidth || Number(img.style.width?.replace("px", "") || 0);
    const h = img.offsetHeight || Number(img.style.height?.replace("px", "") || 0);
    if (w > 0 && h > 0 && img.complete && img.naturalWidth > 0) {
      const stamp = /stamp|seal|章|印/i.test(img.src);
      applyDomImageFit(img, w, h, stamp);
      if (needsAspectCorrection(w, h, img)) {
        img.style.visibility = "hidden";
        img.style.opacity = "0";
      }
    }
  });
}

function ensureOverlayRoot(pageDiv: HTMLElement): HTMLElement {
  let root = pageDiv.querySelector<HTMLElement>("[data-ofd-content-overlay]");
  if (root) return root;

  root = document.createElement("div");
  root.dataset.ofdContentOverlay = "";
  root.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "width:100%",
    "height:100%",
    "pointer-events:none",
    "z-index:9999",
    "overflow:visible",
  ].join(";");
  pageDiv.style.position = pageDiv.style.position || "relative";
  pageDiv.appendChild(root);
  return root;
}

function overlayMissingPageContentDom(
  pageDiv: HTMLElement,
  meta: PageContentMeta,
  fontIdMap: Map<number, string>,
  mediaPack: { map: Map<number, MediaAsset>; portraitAssets: MediaAsset[] }
): number {
  const style = pageDiv.getAttribute("style") ?? "";
  const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
  const pageWidthPx = wMatch ? Number(wMatch[1]) : pageDiv.clientWidth || 794;
  if (!pageWidthPx) return 0;

  const scale = pageWidthPx / meta.pageWidthMm;
  fixExistingPageImages(pageDiv);
  const overlay = ensureOverlayRoot(pageDiv);
  let added = 0;

  const paintCtx: PagePaintContext = {
    meta,
    fontIdMap,
    mediaIdMap: mediaPack.map,
    portraitAssets: mediaPack.portraitAssets,
  };
  const portraitIdx = { value: 0 };

  for (const match of meta.contentXml.matchAll(
    /<(?:[\w-]+:)?TextObject\b([^>]*)>[\s\S]*?<(?:[\w-]+:)?TextCode([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/gi
  )) {
    const objAttrs = match[1] ?? "";
    const codeAttrs = match[2] ?? "";
    const rawText = decodeXmlText(match[3] ?? "");
    if (!isDynamicText(rawText)) continue;

    const boundary = parseOfdBox(attr(objAttrs, "Boundary"));
    if (!boundary) continue;

    const codeX = Number(attr(codeAttrs, "X") ?? "0");
    const codeY = Number(attr(codeAttrs, "Y") ?? "0");
    const fontId = attr(objAttrs, "Font") ?? "0";
    const sizeMm = Number(attr(objAttrs, "Size") ?? "3.5");

    const left = (boundary[0] + codeX) * scale;
    const top = (boundary[1] + codeY) * scale;
    const fontSize = Math.max(9, sizeMm * scale * 0.96);

    const span = document.createElement("span");
    span.textContent = rawText;
    span.dataset.ofdOverlayText = "1";
    span.style.cssText = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `font-size:${fontSize}px`,
      `font-family:${fontFamilyForId(fontId, fontIdMap)}`,
      "color:#000000",
      "line-height:1.1",
      "white-space:pre",
    ].join(";");
    overlay.appendChild(span);
    added++;
  }

  for (const match of meta.contentXml.matchAll(/<(?:[\w-]+:)?ImageObject\b([^/>]*)\/?>/gi)) {
    const attrs = match[1] ?? "";
    const resourceId = Number(attr(attrs, "ResourceID"));
    const boundary = parseOfdBox(attr(attrs, "Boundary"));
    if (!boundary) continue;

    const asset = resolveImageAsset(paintCtx, resourceId, boundary, portraitIdx);
    if (!asset) continue;

    const left = boundary[0] * scale;
    const top = boundary[1] * scale;
    const width = boundary[2] * scale;
    const height = boundary[3] * scale;

    const img = document.createElement("img");
    img.src = asset.url;
    img.alt = "";
    img.dataset.ofdOverlayImage = String(resourceId);
    img.style.cssText = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `width:${width}px`,
      `height:${height}px`,
      "pointer-events:none",
    ].join(";");
    img.onload = () => applyDomImageFit(img, width, height, isLikelyStampResource(asset.pathHint, img));
    applyDomImageFit(img, width, height, /stamp|seal|章|印/i.test(asset.pathHint));
    overlay.appendChild(img);
    added++;
  }

  if (added === 0 && overlay.childElementCount === 0) overlay.remove();
  return added;
}

export async function overlayPagesContent(
  file: File,
  pages: HTMLElement[],
  registry: BlobUrlRegistry
): Promise<void> {
  if (pages.length === 0) return;

  const [metas, fontIdMap, mediaPack] = await Promise.all([
    loadPageContentMeta(file),
    buildOfdFontIdMap(file),
    buildOfdMediaIdMap(file, registry),
  ]);

  for (let i = 0; i < pages.length; i++) {
    const meta = metas[i];
    if (!meta) continue;

    const paintCtx: PagePaintContext = {
      meta,
      fontIdMap,
      mediaIdMap: mediaPack.map,
      portraitAssets: mediaPack.portraitAssets,
    };
    pagePaintCache.set(pages[i], paintCtx);
    overlayMissingPageContentDom(pages[i], meta, fontIdMap, mediaPack);
  }
}
