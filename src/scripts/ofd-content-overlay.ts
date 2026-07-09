/**
 * Overlay page-layer OFD content (dynamic text + photos) when ofd.js renders
 * only the template background. Parses Content.xml and injects missing DOM nodes.
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
import { BlobUrlRegistry } from "@/scripts/ofd-render-utils";

export type PageContentMeta = {
  contentXml: string;
  pageWidthMm: number;
  pageHeightMm: number;
};

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

/** MultiMedia ID → blob URL for ImageObject ResourceID lookup. */
export async function buildOfdMediaIdMap(
  file: File,
  registry: BlobUrlRegistry
): Promise<Map<number, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<number, string>();

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
      map.set(id, registry.create(typed));
    }
  }

  return map;
}

/** Load per-page Content.xml and page dimensions for overlay. */
export async function loadPageContentMeta(file: File): Promise<PageContentMeta[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const ofdXml = await readText(zip, "OFD.xml");
  if (!ofdXml) return [];

  const docRoot = parseOfdDocRoot(ofdXml);
  if (!docRoot) return [];

  const documentXml = await readText(zip, docRoot);
  if (!documentXml) return [];

  const pages = parseDocumentPages(documentXml);
  const metas: PageContentMeta[] = [];

  for (const page of pages) {
    const contentPath = resolveRelativePath(docRoot, page.baseLoc);
    const contentXml = await readText(zip, contentPath);
    if (!contentXml) continue;

    const [pageWidthMm, pageHeightMm] = parsePageAreaMm(documentXml, contentXml);
    metas.push({ contentXml, pageWidthMm, pageHeightMm });
  }

  return metas;
}

function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

function isTextRendered(pageDiv: HTMLElement, text: string): boolean {
  const needle = normalizeVisibleText(text);
  if (!needle || needle.length < 2) return true;
  const hay = normalizeVisibleText(pageDiv.innerText || "");
  if (hay.includes(needle)) return true;
  if (needle.length > 6) return hay.includes(needle.slice(0, Math.min(needle.length, 8)));
  return false;
}

function isImageRendered(pageDiv: HTMLElement, leftPx: number, topPx: number): boolean {
  const imgs = Array.from(pageDiv.querySelectorAll("img"));
  for (const img of imgs) {
    if (!img.complete || img.naturalWidth < 8) continue;
    const rect = img.getBoundingClientRect();
    const pageRect = pageDiv.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - pageRect.left;
    const cy = rect.top + rect.height / 2 - pageRect.top;
    if (Math.abs(cx - leftPx) < 40 && Math.abs(cy - topPx) < 40) return true;
  }
  return false;
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

function fontStackForId(fontId: string, fontIdMap: Map<number, string>): string {
  const name = fontIdMap.get(Number(fontId));
  if (!name) return '"Noto Sans SC", "Microsoft YaHei", "SimSun", sans-serif';
  if (/courier/i.test(name)) return '"Courier New", Courier, monospace';
  if (/宋|song/i.test(name)) return '"SimSun", "NSimSun", "Noto Sans SC", "Microsoft YaHei", sans-serif';
  if (/楷|kai/i.test(name)) return '"KaiTi", "STKaiti", "Noto Sans SC", sans-serif';
  return `"${name}", "Noto Sans SC", "Microsoft YaHei", "SimSun", sans-serif`;
}

/**
 * Inject TextObject / ImageObject from page Content.xml when ofd.js skipped them.
 */
export function overlayMissingPageContent(
  pageDiv: HTMLElement,
  meta: PageContentMeta,
  fontIdMap: Map<number, string>,
  mediaIdMap: Map<number, string>
): void {
  const style = pageDiv.getAttribute("style") ?? "";
  const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
  const pageWidthPx = wMatch ? Number(wMatch[1]) : pageDiv.clientWidth || 794;
  if (!pageWidthPx) return;

  const scale = pageWidthPx / meta.pageWidthMm;
  const overlay = ensureOverlayRoot(pageDiv);
  let added = 0;

  for (const match of meta.contentXml.matchAll(
    /<(?:[\w-]+:)?TextObject\b([^>]*)>[\s\S]*?<(?:[\w-]+:)?TextCode([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/gi
  )) {
    const objAttrs = match[1] ?? "";
    const codeAttrs = match[2] ?? "";
    const rawText = decodeXmlText(match[3] ?? "");
    if (!rawText || isTextRendered(pageDiv, rawText)) continue;

    const boundary = parseOfdBox(attr(objAttrs, "Boundary"));
    if (!boundary) continue;

    const codeX = Number(attr(codeAttrs, "X") ?? "0");
    const codeY = Number(attr(codeAttrs, "Y") ?? "0");
    const fontId = attr(objAttrs, "Font") ?? "0";
    const sizeMm = Number(attr(objAttrs, "Size") ?? "3.5");

    const left = (boundary[0] + codeX) * scale;
    const top = (boundary[1] + codeY) * scale;
    const fontSize = Math.max(8, sizeMm * scale * 0.92);

    const span = document.createElement("span");
    span.textContent = rawText;
    span.dataset.ofdOverlayText = "1";
    span.style.cssText = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `font-size:${fontSize}px`,
      `font-family:${fontStackForId(fontId, fontIdMap)}`,
      "color:#000000",
      "line-height:1.1",
      "white-space:pre",
      "font-weight:normal",
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

    if (isImageRendered(pageDiv, left + width / 2, top + height / 2)) continue;

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
}

export async function overlayPagesContent(
  file: File,
  pages: HTMLElement[],
  registry: BlobUrlRegistry
): Promise<void> {
  if (pages.length === 0) return;

  const [metas, fontIdMap, mediaIdMap] = await Promise.all([
    loadPageContentMeta(file),
    buildOfdFontIdMap(file),
    buildOfdMediaIdMap(file, registry),
  ]);

  for (let i = 0; i < pages.length; i++) {
    const meta = metas[i];
    if (!meta) continue;
    overlayMissingPageContent(pages[i], meta, fontIdMap, mediaIdMap);
  }
}
