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
  resolveOfdMediaPath,
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
      /<(?:[\w-]+:)?MultiMedia\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?MultiMedia>/gi
    )) {
      const tag = block[0];
      if (!/Type\s*=\s*"Image"/i.test(tag)) continue;
      const id = Number(attr(tag, "ID"));
      const mediaFile =
        tag.match(/<(?:[\w-]+:)?MediaFile[^>]*>([^<]+)<\/(?:[\w-]+:)?MediaFile>/i)?.[1] ??
        attr(tag, "MediaFile");
      if (!Number.isFinite(id) || !mediaFile) continue;
      const fullPath = resolveOfdMediaPath(path, xml, mediaFile.trim());
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

async function resolvePageContentXml(zip: JSZip, pagePath: string): Promise<string | null> {
  const raw = await readText(zip, pagePath);
  if (!raw) return null;

  const hasObjects =
    /<(?:[\w-]+:)?TextObject\b/i.test(raw) || /<(?:[\w-]+:)?ImageObject\b/i.test(raw);
  if (hasObjects) return raw;

  // BaseLoc often points to Page.xml while dynamic content lives in sibling Content.xml.
  if (/Page\.xml$/i.test(pagePath)) {
    const sibling = pagePath.replace(/Page\.xml$/i, "Content.xml");
    const siblingXml = await readText(zip, sibling);
    if (siblingXml) return siblingXml;
  }

  const contentLoc =
    raw.match(/\bContentLoc\s*=\s*"([^"]+)"/i)?.[1] ??
    raw.match(/<(?:[\w-]+:)?ContentLoc[^>]*>([^<]+)</i)?.[1];
  if (contentLoc) {
    const resolved = resolveRelativePath(pagePath, contentLoc.trim());
    const located = await readText(zip, resolved);
    if (located) return located;
  }

  const dir = pagePath.replace(/[^/]+$/, "");
  const byConvention = `${dir}Content.xml`;
  const conventional = await readText(zip, byConvention);
  if (conventional) return conventional;

  return raw;
}

async function loadPageAnnotationXml(zip: JSZip, docRoot: string, pageIndex: number): Promise<string> {
  const prefix = docRoot.replace(/[^/]+$/, "");
  const candidates = [
    `${prefix}Annots/Page_${pageIndex}/Annotation.xml`,
    `${prefix}Annots/Page_${pageIndex}/Annotations.xml`,
  ];
  const chunks: string[] = [];
  for (const path of candidates) {
    const xml = await readText(zip, path);
    if (xml) chunks.push(xml);
  }
  return chunks.join("\n");
}

export async function loadPageContentMeta(file: File): Promise<PageContentMeta[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const ofdXml = await readText(zip, "OFD.xml");
  const metas: PageContentMeta[] = [];

  let documentXml = "";
  let docRoot = "";
  if (ofdXml) {
    docRoot = parseOfdDocRoot(ofdXml) ?? "";
    if (docRoot) documentXml = (await readText(zip, docRoot)) ?? "";
  }

  const pagePaths: string[] = [];
  if (documentXml) {
    const pages = parseDocumentPages(documentXml);
    for (const page of pages) {
      if (docRoot) pagePaths.push(resolveRelativePath(docRoot, page.baseLoc));
    }
  }

  if (pagePaths.length === 0) {
    for (const path of Object.keys(zip.files).sort(naturalSort)) {
      if (/\/Pages\/Page_\d+\/(?:Content|Page)\.xml$/i.test(path)) pagePaths.push(path);
    }
  }

  for (let i = 0; i < pagePaths.length; i++) {
    const contentPath = pagePaths[i];
    let contentXml = await resolvePageContentXml(zip, contentPath);
    if (!contentXml) continue;

    const annotXml = docRoot ? await loadPageAnnotationXml(zip, docRoot, i) : "";
    if (annotXml && !contentXml.includes(annotXml)) {
      contentXml = `${contentXml}\n${annotXml}`;
    }

    const [pageWidthMm, pageHeightMm] = parsePageAreaMm(documentXml, contentXml);
    metas.push({ contentXml, pageWidthMm, pageHeightMm });
  }

  return metas;
}

/** Count fillable values in page Content.xml (excludes static labels). */
export function countDynamicContentItems(contentXml: string): number {
  let count = 0;
  for (const match of contentXml.matchAll(
    /<(?:[\w-]+:)?TextObject\b[^>]*>[\s\S]*?<(?:[\w-]+:)?TextCode[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/gi
  )) {
    if (isDynamicText(decodeXmlText(match[1] ?? ""))) count++;
  }
  count += [...contentXml.matchAll(/<(?:[\w-]+:)?ImageObject\b/gi)].length;
  return count;
}

export async function preparePagePaintContexts(
  file: File,
  registry: BlobUrlRegistry
): Promise<PagePaintContext[]> {
  const [metas, fontIdMap, mediaPack] = await Promise.all([
    loadPageContentMeta(file),
    buildOfdFontIdMap(file),
    buildOfdMediaIdMap(file, registry),
  ]);
  return metas.map(meta => ({
    meta,
    fontIdMap,
    mediaIdMap: mediaPack.map,
    portraitAssets: mediaPack.portraitAssets,
  }));
}

function resolvePageScale(
  meta: PageContentMeta,
  pageWidthPx: number,
  pageHeightPx: number
): { scaleX: number; scaleY: number } {
  const metaW = meta.pageWidthMm;
  const metaH = meta.pageHeightMm;
  const renderLandscape = pageWidthPx >= pageHeightPx;
  const metaLandscape = metaW >= metaH;

  if (renderLandscape === metaLandscape) {
    return { scaleX: pageWidthPx / metaW, scaleY: pageHeightPx / metaH };
  }

  // Page DOM orientation differs from PhysicalBox — swap axis mapping.
  return { scaleX: pageWidthPx / metaH, scaleY: pageHeightPx / metaW };
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
  scaleX: number,
  scaleY: number,
  portraitIdx: { value: number }
): Promise<boolean> {
  const resourceId = Number(attr(attrs, "ResourceID"));
  const boundary = parseOfdBox(attr(attrs, "Boundary"));
  if (!boundary) return false;

  const left = boundary[0] * scaleX;
  const top = boundary[1] * scaleY;
  const width = boundary[2] * scaleX;
  const height = boundary[3] * scaleY;
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
    mmScale: scaleX,
  });
  return true;
}

export async function paintMissingPageContentOntoCanvas(
  canvas: HTMLCanvasElement,
  ctx: PagePaintContext,
  pageHeightPx?: number
): Promise<number> {
  const style = canvas.style.width ? Number(canvas.style.width.replace("px", "")) : 0;
  const cssWidth = style || canvas.width;
  const cssHeight =
    pageHeightPx ||
    (canvas.style.height ? Number(canvas.style.height.replace("px", "")) : 0) ||
    canvas.height;
  const { scaleX: mmScaleX, scaleY: mmScaleY } = resolvePageScale(ctx.meta, cssWidth, cssHeight);
  if (!mmScaleX || !mmScaleY || !Number.isFinite(mmScaleX) || !Number.isFinite(mmScaleY)) return 0;

  const g = canvas.getContext("2d");
  if (!g) return 0;

  const pixelScaleX = canvas.width / cssWidth;
  const pixelScaleY = canvas.height / cssHeight;
  g.save();
  g.setTransform(pixelScaleX, 0, 0, pixelScaleY, 0, 0);

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

    const left = (boundary[0] + codeX) * mmScaleX;
    const top = (boundary[1] + codeY) * mmScaleY;
    const fontSize = Math.max(9, sizeMm * Math.min(mmScaleX, mmScaleY) * 0.96);

    // Always paint page-layer values — template underlines must not block text.
    g.font = `${fontSize}px ${fontFamilyForId(fontId, ctx.fontIdMap)}`;
    g.fillStyle = "#000000";
    g.textBaseline = "alphabetic";
    g.fillText(rawText, left, top + fontSize * 0.88);
    painted++;
  }

  const portraitIdx = { value: 0 };
  for (const match of ctx.meta.contentXml.matchAll(
    /<(?:[\w-]+:)?ImageObject\b([^>]*)(?:\/>|>[\s\S]*?<\/(?:[\w-]+:)?ImageObject>)/gi
  )) {
    if (await paintImageObject(g, canvas, ctx, match[1] ?? "", mmScaleX, mmScaleY, portraitIdx)) {
      painted++;
    }
  }

  // Stamp annotations often only expose Appearance Boundary without ImageObject.
  for (const match of ctx.meta.contentXml.matchAll(
    /<(?:[\w-]+:)?Annot\b[^>]*Type\s*=\s*"Stamp"[^>]*>[\s\S]*?<(?:[\w-]+:)?Appearance\b[^>]*Boundary\s*=\s*"([^"]+)"/gi
  )) {
    const boundary = parseOfdBox(match[1]);
    if (!boundary) continue;

    const stampAsset = [...ctx.mediaIdMap.values()].find(a => /stamp|seal|章|印/i.test(a.pathHint));
    if (!stampAsset) continue;

    const left = boundary[0] * mmScaleX;
    const top = boundary[1] * mmScaleY;
    const width = boundary[2] * mmScaleX;
    const height = boundary[3] * mmScaleY;
    const ink = measureRegionInkRatio(canvas, left, top, width, height);
    if (ink > 0.25) continue;

    try {
      const img = await loadImage(stampAsset.url);
      drawOfdImageInBoundary(g, img, left, top, width, height, null, {
        stamp: true,
        forceContain: true,
      });
      painted++;
    } catch {
      /* skip */
    }
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
  const hMatch = style.match(/height:\s*(\d+(?:\.\d+)?)px/);
  const pageWidthPx = wMatch ? Number(wMatch[1]) : pageDiv.clientWidth || 794;
  const pageHeightPx = hMatch ? Number(hMatch[1]) : pageDiv.clientHeight || Math.round(pageWidthPx * 0.707);
  if (!pageWidthPx) return 0;

  const { scaleX, scaleY } = resolvePageScale(meta, pageWidthPx, pageHeightPx);
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
  const fontScale = Math.min(scaleX, scaleY);

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

    const left = (boundary[0] + codeX) * scaleX;
    const top = (boundary[1] + codeY) * scaleY;
    const fontSize = Math.max(9, sizeMm * fontScale * 0.96);

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

  for (const match of meta.contentXml.matchAll(
    /<(?:[\w-]+:)?ImageObject\b([^>]*)(?:\/>|>[\s\S]*?<\/(?:[\w-]+:)?ImageObject>)/gi
  )) {
    const attrs = match[1] ?? "";
    const resourceId = Number(attr(attrs, "ResourceID"));
    const boundary = parseOfdBox(attr(attrs, "Boundary"));
    if (!boundary) continue;

    const asset = resolveImageAsset(paintCtx, resourceId, boundary, portraitIdx);
    if (!asset) continue;

    const left = boundary[0] * scaleX;
    const top = boundary[1] * scaleY;
    const width = boundary[2] * scaleX;
    const height = boundary[3] * scaleY;

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
): Promise<PagePaintContext[]> {
  if (pages.length === 0) return [];

  const contexts = await preparePagePaintContexts(file, registry);

  for (let i = 0; i < pages.length; i++) {
    const paintCtx = contexts[i];
    if (!paintCtx) continue;
    pagePaintCache.set(pages[i], paintCtx);
    overlayMissingPageContentDom(pages[i], paintCtx.meta, paintCtx.fontIdMap, {
      map: paintCtx.mediaIdMap,
      portraitAssets: paintCtx.portraitAssets,
    });
  }

  return contexts;
}
