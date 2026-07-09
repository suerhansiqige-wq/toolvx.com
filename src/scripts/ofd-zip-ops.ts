/**
 * Pure ZIP-layer OFD operations (no DOM).
 * Merge engine deeply parses Document.xml / DocumentRes.xml, remaps resource IDs,
 * and concatenates pages into a single document to avoid reader corruption.
 */
import JSZip from "jszip";
import {
  appendPagesToDocument,
  appendTemplatesToDocument,
  basename,
  buildPageEntry,
  buildTemplateEntry,
  collectNumericIds,
  docPrefixFromRoot,
  maxNumericId,
  mergeResourceXml,
  naturalSort,
  parseDocumentPages,
  parseDocumentTemplates,
  parseOfdDocRoot,
  remapIdsInXml,
  resolveRelativePath,
  singleDocOfdXml,
} from "@/scripts/ofd-xml-utils";

const PAGE_CONTENT_RE = /^Doc_\d+\/Pages\/Page_\d+\/Content\.xml$/i;

function decodeXmlText(value: string): string {
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

function discoverPrimaryDocPrefix(zip: JSZip, ofdXml: string | undefined): string {
  const docRoot = ofdXml ? parseOfdDocRoot(ofdXml) : null;
  if (docRoot) {
    const prefix = docPrefixFromRoot(docRoot);
    if (prefix) return prefix;
  }
  const prefixes = new Set<string>();
  for (const path of Object.keys(zip.files)) {
    const match = path.match(/^(Doc_\d+)\//i);
    if (match) prefixes.add(`${match[1]}/`);
  }
  return [...prefixes].sort(naturalSort)[0] ?? "Doc_0/";
}

function zipPathStartsWith(path: string, prefix: string): boolean {
  return path.toLowerCase().startsWith(prefix.toLowerCase());
}

function remapZipPath(path: string, sourcePrefix: string, targetPrefix: string): string {
  if (!zipPathStartsWith(path, sourcePrefix)) return path;
  return targetPrefix + path.slice(sourcePrefix.length);
}

function uniqueZipPath(zip: JSZip, desired: string): string {
  if (!zip.file(desired)) return desired;
  const dot = desired.lastIndexOf(".");
  const base = dot >= 0 ? desired.slice(0, dot) : desired;
  const ext = dot >= 0 ? desired.slice(dot) : "";
  let i = 1;
  while (zip.file(`${base}_m${i}${ext}`)) i += 1;
  return `${base}_m${i}${ext}`;
}

type MergeState = {
  outZip: JSZip;
  docPrefix: string;
  documentXml: string;
  documentResXml: string;
  publicResXml: string;
  usedIds: Set<number>;
  nextPageIndex: number;
  nextTplIndex: number;
};

async function readText(zip: JSZip, path: string): Promise<string> {
  return (await zip.file(path)?.async("string")) ?? "";
}

async function initMergeState(outZip: JSZip, docPrefix: string): Promise<MergeState> {
  const documentPath = `${docPrefix}Document.xml`;
  const documentXml = await readText(outZip, documentPath);
  if (!documentXml) throw new Error("invalid-ofd");

  const documentResPath = `${docPrefix}DocumentRes.xml`;
  const publicResPath = `${docPrefix}PublicRes.xml`;
  const documentResXml = await readText(outZip, documentResPath);
  const publicResXml = await readText(outZip, publicResPath);

  const pages = parseDocumentPages(documentXml);
  let nextPageIndex = 0;
  for (const path of Object.keys(outZip.files)) {
    const match = path.match(new RegExp(`^${docPrefix.replace("/", "\\/")}Pages\\/Page_(\\d+)\\/`, "i"));
    if (match) nextPageIndex = Math.max(nextPageIndex, Number(match[1]) + 1);
  }
  if (nextPageIndex === 0) nextPageIndex = pages.length;

  let nextTplIndex = 0;
  for (const path of Object.keys(outZip.files)) {
    const match = path.match(new RegExp(`^${docPrefix.replace("/", "\\/")}Tpls\\/Tpl_(\\d+)\\/`, "i"));
    if (match) nextTplIndex = Math.max(nextTplIndex, Number(match[1]) + 1);
  }

  const usedIds = collectNumericIds(documentXml, documentResXml, publicResXml);
  for (const path of Object.keys(outZip.files)) {
    if (path.endsWith("Content.xml") || path.endsWith("Annotations.xml")) {
      usedIds.add(maxNumericId(collectNumericIds(await readText(outZip, path))));
    }
  }

  return {
    outZip,
    docPrefix,
    documentXml,
    documentResXml,
    publicResXml,
    usedIds,
    nextPageIndex,
    nextTplIndex,
  };
}

function allocateId(state: MergeState, oldId: number): number {
  let next = maxNumericId(state.usedIds) + 1;
  while (state.usedIds.has(next)) next += 1;
  state.usedIds.add(next);
  return next;
}

function buildIdMap(state: MergeState, sourceIds: Set<number>): Map<number, number> {
  const map = new Map<number, number>();
  const sorted = [...sourceIds].sort((a, b) => a - b);
  for (const oldId of sorted) {
    if (!map.has(oldId)) map.set(oldId, allocateId(state, oldId));
  }
  return map;
}

async function mergeSourceIntoState(
  state: MergeState,
  srcZip: JSZip,
  srcPrefix: string
): Promise<void> {
  const srcDocumentPath = `${srcPrefix}Document.xml`;
  const srcDocumentXml = await readText(srcZip, srcDocumentPath);
  if (!srcDocumentXml) throw new Error("invalid-ofd");

  const srcDocumentRes = await readText(srcZip, `${srcPrefix}DocumentRes.xml`);
  const srcPublicRes = await readText(srcZip, `${srcPrefix}PublicRes.xml`);

  const srcPages = parseDocumentPages(srcDocumentXml);
  const srcTemplates = parseDocumentTemplates(srcDocumentXml);

  const sourceXmlPaths: string[] = [srcDocumentXml, srcDocumentRes, srcPublicRes];
  for (const path of Object.keys(srcZip.files)) {
    if (!zipPathStartsWith(path, srcPrefix)) continue;
    if (path.endsWith("Content.xml") || path.endsWith("Annotations.xml")) {
      sourceXmlPaths.push(await readText(srcZip, path));
    }
  }

  const sourceIds = collectNumericIds(...sourceXmlPaths);
  const idMap = buildIdMap(state, sourceIds);

  state.documentResXml = mergeResourceXml(state.documentResXml, srcDocumentRes, idMap);
  state.publicResXml = mergeResourceXml(state.publicResXml, srcPublicRes, idMap);

  const newTemplateEntries: string[] = [];

  for (const tpl of srcTemplates) {
    const newTplId = idMap.get(tpl.id) ?? allocateId(state, tpl.id);
    templateIdMap.set(tpl.id, newTplId);

    const srcTplFolder = dirnameUnderPrefix(tpl.baseLoc);
    const srcTplName = basename(tpl.baseLoc);
    const targetTplFolder = `Tpls/Tpl_${state.nextTplIndex}/`;
    const targetContent = `${targetTplFolder}${srcTplName}`;

    await copyTree(state, srcZip, srcPrefix, srcTplFolder, targetTplFolder, idMap);
    newTemplateEntries.push(buildTemplateEntry(newTplId, targetContent));
    state.nextTplIndex += 1;
  }

  if (newTemplateEntries.length > 0) {
    state.documentXml = appendTemplatesToDocument(state.documentXml, newTemplateEntries);
  }

  const newPageEntries: string[] = [];

  for (const page of srcPages) {
    const newPageId = allocateId(state, page.id);
    const srcPageFolder = dirnameUnderPrefix(page.baseLoc);
    const srcPageName = basename(page.baseLoc);
    const targetPageFolder = `Pages/Page_${state.nextPageIndex}/`;
    const targetContent = `${targetPageFolder}${srcPageName}`;

    await copyTree(state, srcZip, srcPrefix, srcPageFolder, targetPageFolder, idMap);

    const annotSrc = `${srcPrefix}${srcPageFolder}`.replace(/\/$/, "");
    const annotFolder = `${annotSrc.replace(/Pages\/Page_\d+/i, `Annots/Page_${basename(srcPageFolder).replace("Page_", "")}`)}/`;
    if (Object.keys(srcZip.files).some(p => zipPathStartsWith(p, annotFolder))) {
      const targetAnnotFolder = `Annots/Page_${state.nextPageIndex}/`;
      await copyTree(state, srcZip, srcPrefix, annotFolder, targetAnnotFolder, idMap);
    }

    newPageEntries.push(buildPageEntry(newPageId, targetContent));
    state.nextPageIndex += 1;
  }

  if (newPageEntries.length === 0) throw new Error("merge-copy-failed");
  state.documentXml = appendPagesToDocument(state.documentXml, newPageEntries);
}

function dirnameUnderPrefix(baseLoc: string): string {
  const idx = baseLoc.lastIndexOf("/");
  return idx >= 0 ? baseLoc.slice(0, idx + 1) : "";
}

async function copyTree(
  state: MergeState,
  srcZip: JSZip,
  srcPrefix: string,
  srcRelFolder: string,
  targetRelFolder: string,
  idMap: Map<number, number>
): Promise<void> {
  const normalizedSrc = srcRelFolder.replace(/\/+/g, "/");
  const normalizedTarget = targetRelFolder.replace(/\/+/g, "/");

  for (const [path, entry] of Object.entries(srcZip.files)) {
    if (entry.dir || !zipPathStartsWith(path, `${srcPrefix}${normalizedSrc}`)) continue;

    const rel = path.slice(srcPrefix.length);
    const targetRel = remapZipPath(rel, normalizedSrc, normalizedTarget);
    const targetPath = `${state.docPrefix}${targetRel}`;

    if (path.endsWith(".xml")) {
      const xml = await entry.async("string");
      state.outZip.file(targetPath, remapIdsInXml(xml, idMap));
    } else {
      state.outZip.file(targetPath, await entry.async("uint8array"));
    }
  }

  for (const [path, entry] of Object.entries(srcZip.files)) {
    if (entry.dir || !zipPathStartsWith(path, srcPrefix)) continue;
    if (!/\.(ttf|otf|woff2?|eot|jpe?g|png|bmp|gif|webp|tif{1,2})$/i.test(path)) continue;
    const rel = path.slice(srcPrefix.length);
    if (rel.startsWith(normalizedSrc)) continue;
    const resMatch = rel.match(/^Res\//i);
    if (!resMatch) continue;
    const targetPath = uniqueZipPath(state.outZip, `${state.docPrefix}${rel}`);
    state.outZip.file(targetPath, await entry.async("uint8array"));
  }
}

async function finalizeMergeState(state: MergeState): Promise<ArrayBuffer> {
  state.outZip.file(`${state.docPrefix}Document.xml`, state.documentXml);
  if (state.documentResXml) {
    state.outZip.file(`${state.docPrefix}DocumentRes.xml`, state.documentResXml);
  }
  if (state.publicResXml) {
    state.outZip.file(`${state.docPrefix}PublicRes.xml`, state.publicResXml);
  }

  const docRoot = `${state.docPrefix}Document.xml`;
  state.outZip.file("OFD.xml", singleDocOfdXml(docRoot));

  return state.outZip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function compressOfdBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function extractOfdTextFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const lines: string[] = [];

  for (const path of Object.keys(zip.files).sort(naturalSort)) {
    if (!path.endsWith("Content.xml") && !path.endsWith("Annotations.xml")) continue;
    const entry = zip.files[path];
    if (!entry || entry.dir) continue;
    const xml = await entry.async("string");
    for (const match of xml.matchAll(/<(?:[\w-]+:)?TextCode[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/g)) {
      const text = decodeXmlText(match[1] ?? "");
      if (text) lines.push(text);
    }
  }

  return [...new Set(lines)].join("\n");
}

/**
 * Merge multiple OFD buffers into one package.
 * Pages from every input are concatenated into the first document with remapped IDs.
 */
export async function mergeOfdBuffers(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (buffers.length < 2) throw new Error("need-multiple");

  const outZip = await JSZip.loadAsync(buffers[0]);
  const baseOfdXml = await readText(outZip, "OFD.xml");
  if (!baseOfdXml) throw new Error("invalid-ofd");

  const docPrefix = discoverPrimaryDocPrefix(outZip, baseOfdXml);
  const state = await initMergeState(outZip, docPrefix);

  for (let i = 1; i < buffers.length; i++) {
    const srcZip = await JSZip.loadAsync(buffers[i]);
    const srcOfdXml = await readText(srcZip, "OFD.xml");
    if (!srcOfdXml) throw new Error("invalid-ofd");
    const srcPrefix = discoverPrimaryDocPrefix(srcZip, srcOfdXml);
    await mergeSourceIntoState(state, srcZip, srcPrefix);
  }

  return finalizeMergeState(state);
}

export async function getOfdPageCountFromBuffer(buffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);
  let count = 0;
  for (const path of Object.keys(zip.files)) {
    if (PAGE_CONTENT_RE.test(path)) count++;
  }
  return count;
}
