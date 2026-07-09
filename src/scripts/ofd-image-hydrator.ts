/**
 * OFD 页面图片资源修复 — 将包内多媒体文件挂载为 Blob URL，防止预览/导出漏图
 */
import JSZip from "jszip";
import { BlobUrlRegistry } from "@/scripts/ofd-render-utils";

const IMAGE_EXT = /\.(jpe?g|png|bmp|gif|webp|tif{1,2})$/i;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export async function buildOfdMediaUrlMap(
  file: File,
  registry: BlobUrlRegistry
): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const map = new Map<string, string>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !IMAGE_EXT.test(path)) continue;
    const lower = path.toLowerCase();
    if (lower.includes("/stamp") || lower.includes("/seal")) continue;

    const blob = await entry.async("blob");
    const url = registry.create(blob);
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
      /<(?:[\w-]+:)?Res\b[^>]*Type="Image"[^>]*>[\s\S]*?<\/(?:[\w-]+:)?Res>/gi
    )) {
      const tag = block[0];
      const mediaFile = tag.match(/<(?:[\w-]+:)?MediaFile[^>]*>([^<]+)<\/(?:[\w-]+:)?MediaFile>/i)?.[1];
      if (!mediaFile) continue;
      const fullPath = path.includes("/")
        ? `${path.slice(0, path.lastIndexOf("/") + 1)}${mediaFile.trim()}`
        : mediaFile.trim();
      const entry = zip.file(fullPath);
      if (!entry || entry.dir) continue;
      const blob = await entry.async("blob");
      const url = registry.create(blob);
      map.set(mediaFile.trim(), url);
      map.set(basename(mediaFile), url);
      map.set(fullPath, url);
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
  ];
  for (const key of candidates) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return null;
}

export function hydratePageMedia(pageDiv: HTMLElement, mediaMap: Map<string, string>): void {
  pageDiv.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") ?? "";
    const resolved = resolveMediaUrl(src, mediaMap);
    if (resolved) {
      img.src = resolved;
      img.removeAttribute("crossorigin");
    }
  });

  pageDiv.querySelectorAll<HTMLElement>("[style*='background']").forEach(el => {
    const style = el.getAttribute("style") ?? "";
    const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (!match?.[1]) return;
    const resolved = resolveMediaUrl(match[1], mediaMap);
    if (resolved) el.style.backgroundImage = `url("${resolved}")`;
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
