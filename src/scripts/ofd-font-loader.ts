/**
 * OFD embedded font loader with resilient fallback.
 * Registers FontFace from DocumentRes / PublicRes; on failure, maps families
 * to safe system font stacks so text never renders invisible.
 */
import JSZip from "jszip";
import { injectFontFallbackStyle, injectFontIdAliasStyle } from "@/scripts/ofd-render-utils";

const FONT_EXT = /\.(ttf|otf|woff2?|eot)$/i;
const FONT_FACE_TIMEOUT_MS = 6_000;
const FONTS_READY_TIMEOUT_MS = 2_500;
const FONT_BATCH_TIMEOUT_MS = 14_000;

const SYSTEM_FALLBACK_STACK =
  '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimSun", system-ui, sans-serif';

const loadedFontFileKeys = new Set<string>();
const registeredFamilies = new Set<string>();

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
  id?: number;
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

async function parseFontDescriptors(zip: JSZip): Promise<{
  descriptors: FontDescriptor[];
  systemFontIds: Map<number, string>;
}> {
  const descriptors: FontDescriptor[] = [];
  const systemFontIds = new Map<number, string>();
  const seen = new Set<string>();

  for (const path of Object.keys(zip.files)) {
    if (!path.endsWith("DocumentRes.xml") && !path.endsWith("PublicRes.xml")) continue;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;

    for (const block of xml.matchAll(
      /<(?:[\w-]+:)?Font\b[\s\S]*?(?:\/>|<\/(?:[\w-]+:)?Font>)/gi
    )) {
      const tag = block[0];
      const fontId = Number(tag.match(/\bID\s*=\s*"(\d+)"/i)?.[1] ?? NaN);
      const fontName = tag.match(/\bFontName="([^"]+)"/)?.[1];
      const familyName = tag.match(/\bFamilyName="([^"]+)"/)?.[1];
      const fileRef =
        tag.match(/<(?:[\w-]+:)?FontFile[^>]*>([^<]+)<\/(?:[\w-]+:)?FontFile>/i)?.[1] ??
        tag.match(/\bFontFile="([^"]+)"/)?.[1];

      const names = [
        ...new Set(
          [
            fontName,
            familyName,
            Number.isFinite(fontId) ? String(fontId) : null,
            fileRef?.split("/").pop()?.replace(/\.[^.]+$/, ""),
          ].filter(Boolean) as string[]
        ),
      ];

      if (fileRef) {
        const filePath = resolveResPath(path, fileRef.trim());
        const key = filePath.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (names.length === 0) continue;
        descriptors.push({
          names,
          filePath,
          id: Number.isFinite(fontId) ? fontId : undefined,
        });
      } else if (names.length > 0 && Number.isFinite(fontId)) {
        systemFontIds.set(fontId, fontName ?? familyName ?? names[0]);
      }
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

  return { descriptors, systemFontIds };
}

async function registerFontFace(names: string[], data: ArrayBuffer): Promise<boolean> {
  if (typeof FontFace === "undefined" || !document.fonts) return false;
  const primary = names[0];
  if (!primary) return false;

  try {
    const face = new FontFace(primary, data);
    await withTimeout(face.load(), FONT_FACE_TIMEOUT_MS);
    document.fonts.add(face);
    registeredFamilies.add(primary);

    for (const alias of names.slice(1)) {
      if (alias === primary) continue;
      try {
        const aliasFace = new FontFace(alias, data);
        await withTimeout(aliasFace.load(), FONT_FACE_TIMEOUT_MS);
        document.fonts.add(aliasFace);
        registeredFamilies.add(alias);
      } catch {
        /* alias registration is best-effort */
      }
    }
    return true;
  } catch {
    return false;
  }
}

function registerSystemFallback(names: string[]): void {
  for (const name of names) {
    if (registeredFamilies.has(name)) continue;
    registeredFamilies.add(name);
  }
  injectFontFallbackStyle(names);
}

export async function loadOfdEmbeddedFonts(file: File): Promise<void> {
  if (typeof document === "undefined") return;

  const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
  if (loadedFontFileKeys.has(cacheKey)) return;

  try {
    await withTimeout(loadOfdEmbeddedFontsInner(file), FONT_BATCH_TIMEOUT_MS);
    loadedFontFileKeys.add(cacheKey);
  } catch {
    /* font loading must never block the render pipeline */
  }
}

async function loadOfdEmbeddedFontsInner(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const { descriptors, systemFontIds } = await parseFontDescriptors(zip);
  const fallbackNames: string[] = [];
  const loads: Promise<void>[] = [];

  for (const desc of descriptors) {
    const entry = zip.file(desc.filePath) ?? zip.file(desc.filePath.replace(/^\//, ""));
    if (!entry || entry.dir) {
      fallbackNames.push(...desc.names);
      continue;
    }

    loads.push(
      withTimeout(entry.async("arraybuffer"), FONT_FACE_TIMEOUT_MS)
        .then(async buf => {
          const ok = await registerFontFace(desc.names, buf);
          if (!ok) fallbackNames.push(...desc.names);
        })
        .catch(() => {
          fallbackNames.push(...desc.names);
        })
    );
  }

  await Promise.all(loads);

  if (fallbackNames.length > 0) {
    registerSystemFallback([...new Set(fallbackNames)]);
  }

  if (systemFontIds.size > 0) {
    injectFontIdAliasStyle(systemFontIds);
  }

  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONTS_READY_TIMEOUT_MS).catch(() => undefined);
  }

  if (registeredFamilies.size === 0 && descriptors.length > 0) {
    injectFontFallbackStyle(
      descriptors.flatMap(d => d.names).length > 0
        ? descriptors.flatMap(d => d.names)
        : ["ofd-font"]
    );
  }

  void SYSTEM_FALLBACK_STACK;
}

export function clearOfdFontCache(): void {
  loadedFontFileKeys.clear();
  registeredFamilies.clear();
  document.getElementById("ofd-font-fallback-style")?.remove();
  document.getElementById("ofd-font-id-alias-style")?.remove();
}

export function getRegisteredFontFamilies(): string[] {
  return [...registeredFamilies];
}
