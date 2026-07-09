/**
 * OFD XML helpers — shared by merge engine and resource remapping.
 * Pure string/DOM-free utilities safe for Web Workers.
 */

const ID_ATTR_RE =
  /\b(ID|ResourceID|Font|TemplateID|DrawParam|ColorSpace|MultiMedia|ImageMask|Thumbnail)\s*=\s*"(\d+)"/gi;

const PAGE_ENTRY_RE =
  /<(?:[\w-]+:)?Page\b[^>]*\/>|<(?:[\w-]+:)?Page\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?Page>/gi;

export function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Decode OFD TextCode entity references and strip nested tags. */
export function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Parse PhysicalBox / Boundary "x y w h" (mm) into numbers. */
export function parseOfdBox(raw: string | null | undefined): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 4 || parts.some(n => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

export function parseOfdDocRoot(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?DocRoot[^>]*>([^<]+)<\/(?:[\w-]+:)?DocRoot>/i);
  return match?.[1]?.trim() ?? null;
}

export function parseOfdSignatures(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?Signatures[^>]*>([^<]+)<\/(?:[\w-]+:)?Signatures>/i);
  return match?.[1]?.trim() ?? null;
}

export function docPrefixFromRoot(docRoot: string): string | null {
  const match = docRoot.match(/^(Doc_\d+)\//i);
  return match ? `${match[1]}/` : null;
}

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(0, idx + 1) : "";
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function resolveRelativePath(basePath: string, relative: string): string {
  const base = dirname(basePath);
  const parts = (base + relative).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/** Resolve MultiMedia MediaFile path using Res BaseLoc (e.g. Doc_0/Res/IMAGE_3.png). */
export function resolveOfdMediaPath(
  resXmlPath: string,
  resXml: string,
  mediaFile: string
): string {
  const trimmed = mediaFile.trim();
  const baseLoc =
    resXml.match(/<(?:[\w-]+:)?Res\b[^>]*\bBaseLoc\s*=\s*"([^"]+)"/i)?.[1]?.trim() ??
    resXml.match(/\bBaseLoc\s*=\s*"([^"]+)"/i)?.[1]?.trim();
  if (baseLoc) {
    const docDir = dirname(resXmlPath);
    return resolveRelativePath(docDir, `${baseLoc.replace(/\/$/, "")}/${trimmed}`);
  }
  return resolveRelativePath(resXmlPath, trimmed);
}

/** Collect every numeric ID declared or referenced in OFD XML fragments. */
export function collectNumericIds(...xmlChunks: string[]): Set<number> {
  const ids = new Set<number>();
  for (const xml of xmlChunks) {
    if (!xml) continue;
    for (const match of xml.matchAll(/\bID\s*=\s*"(\d+)"/gi)) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) ids.add(n);
    }
    for (const match of xml.matchAll(
      /\b(ResourceID|Font|TemplateID|DrawParam|ColorSpace)\s*=\s*"(\d+)"/gi
    )) {
      const n = Number(match[2]);
      if (Number.isFinite(n)) ids.add(n);
    }
  }
  return ids;
}

export function maxNumericId(ids: Iterable<number>): number {
  let max = 0;
  for (const id of ids) max = Math.max(max, id);
  return max;
}

/** Remap numeric ID attribute values using a lookup table. */
export function remapIdsInXml(xml: string, idMap: Map<number, number>): string {
  if (idMap.size === 0) return xml;
  return xml.replace(ID_ATTR_RE, (full, attr: string, raw: string) => {
    const oldId = Number(raw);
    const mapped = idMap.get(oldId);
    return mapped !== undefined ? `${attr}="${mapped}"` : full;
  });
}

export type PageRef = {
  id: number;
  baseLoc: string;
  raw: string;
};

/** Parse <ofd:Page> entries from Document.xml. */
export function parseDocumentPages(documentXml: string): PageRef[] {
  const pages: PageRef[] = [];
  for (const match of documentXml.matchAll(PAGE_ENTRY_RE)) {
    const block = match[0];
    const id = Number(block.match(/\bID\s*=\s*"(\d+)"/i)?.[1] ?? NaN);
    const baseLoc =
      block.match(/\bBaseLoc\s*=\s*"([^"]+)"/i)?.[1]?.trim() ??
      block.match(/<(?:[\w-]+:)?BaseLoc[^>]*>([^<]+)</i)?.[1]?.trim();
    if (!baseLoc || !Number.isFinite(id)) continue;
    pages.push({ id, baseLoc, raw: block });
  }
  return pages;
}

export type TemplateRef = {
  id: number;
  baseLoc: string;
  raw: string;
};

export function parseDocumentTemplates(documentXml: string): TemplateRef[] {
  const templates: TemplateRef[] = [];
  const re =
    /<(?:[\w-]+:)?TemplatePage\b[^>]*\/>|<(?:[\w-]+:)?TemplatePage\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?TemplatePage>/gi;
  for (const match of documentXml.matchAll(re)) {
    const block = match[0];
    const id = Number(block.match(/\bID\s*=\s*"(\d+)"/i)?.[1] ?? NaN);
    const baseLoc =
      block.match(/\bBaseLoc\s*=\s*"([^"]+)"/i)?.[1]?.trim() ??
      block.match(/<(?:[\w-]+:)?BaseLoc[^>]*>([^<]+)</i)?.[1]?.trim();
    if (!baseLoc || !Number.isFinite(id)) continue;
    templates.push({ id, baseLoc, raw: block });
  }
  return templates;
}

/** Append page entries before closing </ofd:Pages>. */
export function appendPagesToDocument(documentXml: string, pageEntries: string[]): string {
  if (pageEntries.length === 0) return documentXml;
  const closing = /<\/(?:[\w-]+:)?Pages>/i.exec(documentXml);
  if (!closing || closing.index === undefined) {
    throw new Error("document-pages-missing");
  }
  const insert = pageEntries.join("");
  return documentXml.slice(0, closing.index) + insert + documentXml.slice(closing.index);
}

/** Append template entries inside <ofd:CommonData>. */
export function appendTemplatesToDocument(documentXml: string, templateEntries: string[]): string {
  if (templateEntries.length === 0) return documentXml;
  const closing = /<\/(?:[\w-]+:)?CommonData>/i.exec(documentXml);
  if (!closing || closing.index === undefined) {
    throw new Error("document-commondata-missing");
  }
  const insert = templateEntries.join("");
  return documentXml.slice(0, closing.index) + insert + documentXml.slice(closing.index);
}

/**
 * Merge two resource XML documents (DocumentRes / PublicRes).
 * Appends child resource blocks from `source` into `target`, remapping IDs.
 */
export function mergeResourceXml(
  targetXml: string,
  sourceXml: string,
  idMap: Map<number, number>
): string {
  if (!sourceXml.trim()) return targetXml;
  const remapped = remapIdsInXml(sourceXml, idMap);

  const bodyMatch = remapped.match(/<(?:[\w-]+:)?Res\b[^>]*>([\s\S]*)<\/(?:[\w-]+:)?Res>/i);
  if (!bodyMatch?.[1]?.trim()) return targetXml;

  const inner = bodyMatch[1].trim();
  const closing = /<\/(?:[\w-]+:)?Res>/i.exec(targetXml);
  if (!closing || closing.index === undefined) return targetXml;
  return targetXml.slice(0, closing.index) + inner + targetXml.slice(closing.index);
}

export function buildPageEntry(pageId: number, baseLoc: string): string {
  return `<ofd:Page ID="${pageId}" BaseLoc="${baseLoc}"/>`;
}

export function buildTemplateEntry(templateId: number, baseLoc: string): string {
  return `<ofd:TemplatePage ID="${templateId}" BaseLoc="${baseLoc}"/>`;
}

export function randomDocId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export function singleDocOfdXml(docRoot: string, signatures?: string): string {
  const sigXml = signatures
    ? `<ofd:Signatures>${signatures}</ofd:Signatures>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" DocType="OFD" Version="1.1"><ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomDocId()}</ofd:DocID></ofd:DocInfo><ofd:DocRoot>${docRoot}</ofd:DocRoot>${sigXml}</ofd:DocBody></ofd:OFD>`;
}
