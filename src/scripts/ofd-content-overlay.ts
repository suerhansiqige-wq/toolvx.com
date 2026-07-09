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
import { BlobUrlRegistry, measureRegionInkRatio } from "@/scripts/ofd-render-utils";

export type PageContentMeta = {
  contentXml: string;
  pageWidthMm: number;
  pageHeightMm: number;
};

export type PagePaintContext = {
  meta: PageContentMeta;
  fontIdMap: Map<number, string>;
  mediaIdMap: Map<number, string>;
  portraitUrls: string[];
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

/** Font ID → display name from PublicRes / DocumentRes. */
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

/** MultiMedia ID → blob URL; collects portrait photo candidates from the package. */
export async function buildOfdMediaIdMap(
  file: File,
  registry: BlobUrlRegistry
): Promise<{ map: Map<number, string>; portraitUrls: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<number, string>();
  const portraitUrls: string[] = [];
  const imageExt = /\.(jpe?g|png|bmp|gif|webp|tif{1,2})$/i;

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
      const entry = zip.file(fullPath) ?? zip.file(mediaFile.trim());
      if (!entry || entry.dir) continue;

      const blob = await entry.async("blob");
      const typed =
        blob.type && blob.type.startsWith("image/")
          ? blob
          : new Blob([await entry.async("arraybuffer")], { type: mimeFromPath(fullPath) });
      const url = registry.create(typed);
      map.set(id, url);

      try {
        const probe = await loadImage(url);
        if (probe.naturalHeight >= probe.naturalWidth * 0.85 && probe.naturalWidth >= 40) {
          portraitUrls.push(url);
        }
      } catch {
        /* skip */
      }
    }
  }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !imageExt.test(path)) continue;
    if (/qr\.png$/i.test(path) || /logo|stamp|seal|sign/i.test(path)) continue;
    const blob = await entry.async("blob");
    const typed =
      blob.type && blob.type.startsWith("image/")
        ? blob
        : new Blob([await entry.async("arraybuffer")], { type: mimeFromPath(path) });
    const url = registry.create(typed);
    try {
      const probe = await loadImage(url);
      if (probe.naturalHeight >= probe.naturalWidth * 0.85 && probe.naturalWidth >= 40) {
        if (!portraitUrls.includes(url)) portraitUrls.push(url);
      }
    } catch {
      /* skip */
    }
  }

  return { map, portraitUrls };
}

/** Load per-page Content.xml and page dimensions. */
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

/**
 * Draw TextObject / ImageObject from page Content.xml onto a rendered canvas
 * when the target region is still blank (template-only render).
 */
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

  let portraitIdx = 0;
  for (const match of ctx.meta.contentXml.matchAll(/<(?:[\w-]+:)?ImageObject\b([^/>]*)\/?>/gi)) {
    const attrs = match[1] ?? "";
    const resourceId = Number(attr(attrs, "ResourceID"));
    const boundary = parseOfdBox(attr(attrs, "Boundary"));
    if (!boundary) continue;

    const left = boundary[0] * scale;
    const top = boundary[1] * scale;
    const width = boundary[2] * scale;
    const height = boundary[3] * scale;

    const ink = measureRegionInkRatio(canvas, left, top, width, height);
    if (ink > 0.08) continue;

    let url = Number.isFinite(resourceId) ? ctx.mediaIdMap.get(resourceId) : undefined;
    if (!url && ctx.portraitUrls[portraitIdx]) {
      url = ctx.portraitUrls[portraitIdx];
      portraitIdx++;
    }
    if (!url) continue;

    try {
      const img = await loadImage(url);
      g.drawImage(img, left, top, width, height);
      painted++;
    } catch {
      /* skip broken asset */
    }
  }

  g.restore();
  return painted;
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

/** DOM overlay fallback — used together with html2canvas path. */
function overlayMissingPageContentDom(
  pageDiv: HTMLElement,
  meta: PageContentMeta,
  fontIdMap: Map<number, string>,
  mediaIdMap: Map<number, string>
): number {
  const style = pageDiv.getAttribute("style") ?? "";
  const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
  const pageWidthPx = wMatch ? Number(wMatch[1]) : pageDiv.clientWidth || 794;
  if (!pageWidthPx) return 0;

  const scale = pageWidthPx / meta.pageWidthMm;
  const overlay = ensureOverlayRoot(pageDiv);
  let added = 0;

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
    if (!Number.isFinite(resourceId) || !boundary) continue;

    const url = mediaIdMap.get(resourceId);
    if (!url) continue;

    const left = boundary[0] * scale;
    const top = boundary[1] * scale;
    const width = boundary[2] * scale;
    const height = boundary[3] * scale;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.dataset.ofdOverlayImage = String(resourceId);
    img.style.cssText = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `width:${width}px`,
      `height:${height}px`,
      "object-fit:fill",
      "pointer-events:none",
    ].join(";");
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
  const { map: mediaIdMap, portraitUrls } = mediaPack;

  for (let i = 0; i < pages.length; i++) {
    const meta = metas[i];
    if (!meta) continue;

    const paintCtx: PagePaintContext = { meta, fontIdMap, mediaIdMap, portraitUrls };
    pagePaintCache.set(pages[i], paintCtx);
    overlayMissingPageContentDom(pages[i], meta, fontIdMap, mediaIdMap);
  }
}
