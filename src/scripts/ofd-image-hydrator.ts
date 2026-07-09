/**
 * OFD page media hydrator — maps ZIP image assets to Blob URLs.
 * Includes stamps/seals (transparent PNG overlays) and preserves blend modes
 * so official seals render above text without masking it.
 */
import JSZip from "jszip";
import { BlobUrlRegistry, mapBlendMode } from "@/scripts/ofd-render-utils";

const IMAGE_EXT = /\.(jpe?g|png|bmp|gif|webp|tif{1,2}|svg)$/i;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(0, idx + 1) : "";
}

function resolveResPath(xmlPath: string, relative: string): string {
  const base = dirname(xmlPath);
  const parts = (base + relative).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

export async function buildOfdMediaUrlMap(
  file: File,
  registry: BlobUrlRegistry
): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<string, string>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !IMAGE_EXT.test(path)) continue;

    const blob = await entry.async("blob");
    const typed =
      blob.type && blob.type.startsWith("image/")
        ? blob
        : new Blob([await entry.async("arraybuffer")], { type: mimeFromPath(path) });
    const url = registry.create(typed);

    map.set(path, url);
    map.set(path.toLowerCase(), url);
    map.set(basename(path), url);
    map.set(basename(path).toLowerCase(), url);
  }

  for (const path of Object.keys(zip.files).sort(naturalSort)) {
    if (!path.endsWith("DocumentRes.xml") && !path.endsWith("PublicRes.xml")) continue;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?(?:MultiMedia|Res)\b[^>]*(?:Type="Image"|Type\s*=\s*"Image")[^>]*>[\s\S]*?(?:\/>|<\/(?:[\w-]+:)?(?:MultiMedia|Res)>)/gi
    )) {
      const tag = block[0];
      const mediaFile =
        tag.match(/<(?:[\w-]+:)?MediaFile[^>]*>([^<]+)<\/(?:[\w-]+:)?MediaFile>/i)?.[1] ??
        tag.match(/\bMediaFile="([^"]+)"/)?.[1];
      if (!mediaFile) continue;

      const fullPath = resolveResPath(path, mediaFile.trim());
      const entry = zip.file(fullPath) ?? zip.file(mediaFile.trim());
      if (!entry || entry.dir) continue;

      const blob = await entry.async("blob");
      const typed =
        blob.type && blob.type.startsWith("image/")
          ? blob
          : new Blob([await entry.async("arraybuffer")], { type: mimeFromPath(fullPath) });
      const url = registry.create(typed);

      const trimmed = mediaFile.trim();
      map.set(trimmed, url);
      map.set(trimmed.toLowerCase(), url);
      map.set(basename(trimmed), url);
      map.set(fullPath, url);
      map.set(fullPath.toLowerCase(), url);
    }
  }

  return map;
}

function resolveMediaUrl(src: string, map: Map<string, string>): string | null {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return null;
  const trimmed = src.trim();
  const candidates = [
    trimmed,
    trimmed.toLowerCase(),
    basename(trimmed),
    basename(trimmed).toLowerCase(),
    decodeURIComponent(trimmed),
    decodeURIComponent(trimmed).toLowerCase(),
  ];
  for (const key of candidates) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Hydrate a single page: fix image src, background-image, blend modes, z-order.
 * Stamps and seals are included (not filtered) so they overlay text correctly.
 */
export function hydratePageMedia(pageDiv: HTMLElement, mediaMap: Map<string, string>): void {
  pageDiv.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") ?? "";
    const resolved = resolveMediaUrl(src, mediaMap);
    if (resolved) {
      img.src = resolved;
      img.removeAttribute("crossorigin");
    }

    const isStamp =
      /stamp|seal|sign/i.test(src) ||
      img.classList.contains("ofd-stamp") ||
      img.dataset.ofdLayer === "stamp";
    if (isStamp) {
      img.style.mixBlendMode = img.style.mixBlendMode || "multiply";
      img.style.zIndex = img.style.zIndex || "20";
      img.style.pointerEvents = "none";
    }
  });

  pageDiv.querySelectorAll<HTMLElement>("[style*='background'], [data-resource-id]").forEach(el => {
    const style = el.getAttribute("style") ?? "";
    const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (match?.[1]) {
      const resolved = resolveMediaUrl(match[1], mediaMap);
      if (resolved) el.style.backgroundImage = `url("${resolved}")`;
    }

    const blend = el.getAttribute("data-blend-mode") ?? el.getAttribute("blendmode");
    if (blend) el.style.mixBlendMode = mapBlendMode(blend);
  });

  pageDiv.querySelectorAll<SVGElement>("image, use").forEach(node => {
    const href =
      node.getAttribute("href") ??
      node.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
      "";
    const resolved = resolveMediaUrl(href, mediaMap);
    if (!resolved) return;
    node.setAttribute("href", resolved);
    node.setAttributeNS("http://www.w3.org/1999/xlink", "href", resolved);
  });
}

export async function hydratePagesMedia(
  file: File,
  pages: HTMLElement[],
  registry: BlobUrlRegistry
): Promise<void> {
  if (pages.length === 0) return;
  const map = await buildOfdMediaUrlMap(file, registry);
  for (const page of pages) hydratePageMedia(page, map);
}
