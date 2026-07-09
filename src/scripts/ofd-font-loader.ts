/**
 * OFD 内嵌字体加载 — 解析 DocumentRes / PublicRes 中的 Font 定义并注册 FontFace
 */
import JSZip from "jszip";

const FONT_EXT = /\.(ttf|otf|woff2?|eot)$/i;
const FONT_FACE_TIMEOUT_MS = 6_000;
const FONTS_READY_TIMEOUT_MS = 2_000;
const FONT_BATCH_TIMEOUT_MS = 12_000;

const loadedFontFileKeys = new Set<string>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

type FontDescriptor = {
  names: string[];
  filePath: string;
};

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

async function parseFontDescriptors(zip: JSZip): Promise<FontDescriptor[]> {
  const descriptors: FontDescriptor[] = [];
  const seen = new Set<string>();

  for (const path of Object.keys(zip.files)) {
    if (!path.endsWith("DocumentRes.xml") && !path.endsWith("PublicRes.xml")) continue;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?Font\b[\s\S]*?(?:\/>|<\/(?:[\w-]+:)?Font>)/gi
    )) {
      const tag = block[0];
      const fontName = tag.match(/\bFontName="([^"]+)"/)?.[1];
      const familyName = tag.match(/\bFamilyName="([^"]+)"/)?.[1];
      const fileRef =
        tag.match(/<(?:[\w-]+:)?FontFile[^>]*>([^<]+)<\/(?:[\w-]+:)?FontFile>/i)?.[1] ??
        tag.match(/\bFontFile="([^"]+)"/)?.[1];
      if (!fileRef) continue;

      const filePath = resolveResPath(path, fileRef.trim());
      const key = filePath.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const names = [
        ...new Set(
          [fontName, familyName, fileRef.split("/").pop()?.replace(/\.[^.]+$/, "")].filter(
            Boolean
          ) as string[]
        ),
      ];
      if (names.length === 0) continue;
      descriptors.push({ names, filePath });
    }

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?Res\b[^>]*Type="Font"[^>]*>[\s\S]*?<\/(?:[\w-]+:)?Res>/gi
    )) {
      const tag = block[0];
      const fontName = tag.match(/\bFontName="([^"]+)"/)?.[1];
      const fileRef = tag.match(/<(?:[\w-]+:)?MediaFile[^>]*>([^<]+)<\/(?:[\w-]+:)?MediaFile>/i)?.[1];
      if (!fileRef) continue;
      const filePath = resolveResPath(path, fileRef.trim());
      const key = filePath.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const names = [
        ...new Set(
          [fontName, fileRef.split("/").pop()?.replace(/\.[^.]+$/, "")].filter(Boolean) as string[]
        ),
      ];
      if (names.length === 0) continue;
      descriptors.push({ names, filePath });
    }
  }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !FONT_EXT.test(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const baseName = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "ofd-font";
    descriptors.push({ names: [baseName], filePath: path });
  }

  return descriptors;
}

async function registerFontFace(names: string[], data: ArrayBuffer): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return;
  const primary = names[0];
  if (!primary) return;

  const face = new FontFace(primary, data);
  await withTimeout(face.load(), FONT_FACE_TIMEOUT_MS);
  document.fonts.add(face);

  for (const alias of names.slice(1)) {
    if (alias === primary) continue;
    try {
      const aliasFace = new FontFace(alias, data);
      await withTimeout(aliasFace.load(), FONT_FACE_TIMEOUT_MS);
      document.fonts.add(aliasFace);
    } catch {
      /* 别名注册失败可忽略 */
    }
  }
}

export async function loadOfdEmbeddedFonts(file: File): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return;

  const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
  if (loadedFontFileKeys.has(cacheKey)) return;

  try {
    await withTimeout(loadOfdEmbeddedFontsInner(file), FONT_BATCH_TIMEOUT_MS);
    loadedFontFileKeys.add(cacheKey);
  } catch {
    /* 字体加载失败不阻断主流程 */
  }
}

async function loadOfdEmbeddedFontsInner(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const descriptors = await parseFontDescriptors(zip);
  const loads: Promise<void>[] = [];

  for (const desc of descriptors) {
    const entry = zip.file(desc.filePath) ?? zip.file(desc.filePath.replace(/^\//, ""));
    if (!entry || entry.dir) continue;
    loads.push(
      withTimeout(entry.async("arraybuffer"), FONT_FACE_TIMEOUT_MS)
        .then(buf => registerFontFace(desc.names, buf))
        .catch(() => undefined)
    );
  }

  await Promise.all(loads);

  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONTS_READY_TIMEOUT_MS).catch(() => undefined);
  }
}

export function clearOfdFontCache(): void {
  loadedFontFileKeys.clear();
}
