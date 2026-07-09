/**
 * 纯 ZIP 层 OFD 操作（无 DOM 依赖）
 * 可在 Web Worker 与主线程共用，避免合并/压缩/抽文本阻塞 UI。
 */
import JSZip from "jszip";

const PAGE_CONTENT_RE = /^Doc_\d+\/Pages\/Page_\d+\/Content\.xml$/i;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

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

function parseOfdDocRoot(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?DocRoot[^>]*>([^<]+)<\/(?:[\w-]+:)?DocRoot>/i);
  return match?.[1]?.trim() ?? null;
}

function parseOfdSignatures(ofdXml: string): string | null {
  const match = ofdXml.match(/<(?:[\w-]+:)?Signatures[^>]*>([^<]+)<\/(?:[\w-]+:)?Signatures>/i);
  return match?.[1]?.trim() ?? null;
}

function docPrefixFromRoot(docRoot: string): string | null {
  const match = docRoot.match(/^(Doc_\d+)\//i);
  return match ? `${match[1]}/` : null;
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

function randomDocId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function appendDocBody(ofdXml: string, docRoot: string, signatures?: string): string {
  const sigXml = signatures ? `<ofd:Signatures>${signatures}</ofd:Signatures>` : "";
  const body = `<ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomDocId()}</ofd:DocID></ofd:DocInfo><ofd:DocRoot>${docRoot}</ofd:DocRoot>${sigXml}</ofd:DocBody>`;
  return ofdXml.replace("</ofd:OFD>", `${body}</ofd:OFD>`);
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

export async function mergeOfdBuffers(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (buffers.length < 2) throw new Error("need-multiple");

  const outZip = await JSZip.loadAsync(buffers[0]);
  let ofdXml = await outZip.file("OFD.xml")?.async("string");
  if (!ofdXml) throw new Error("invalid-ofd");

  let nextDocIndex = 0;
  for (const path of Object.keys(outZip.files)) {
    const match = path.match(/^Doc_(\d+)\//i);
    if (match) nextDocIndex = Math.max(nextDocIndex, Number(match[1]) + 1);
  }

  for (let i = 1; i < buffers.length; i++) {
    const srcZip = await JSZip.loadAsync(buffers[i]);
    const srcOfdXml = await srcZip.file("OFD.xml")?.async("string");
    if (!srcOfdXml) throw new Error("invalid-ofd");

    const sourcePrefix = discoverPrimaryDocPrefix(srcZip, srcOfdXml);
    const targetPrefix = `Doc_${nextDocIndex}/`;
    let copied = 0;

    for (const [path, entry] of Object.entries(srcZip.files)) {
      if (entry.dir || !zipPathStartsWith(path, sourcePrefix)) continue;
      outZip.file(remapZipPath(path, sourcePrefix, targetPrefix), await entry.async("uint8array"));
      copied++;
    }
    if (copied === 0) throw new Error("merge-copy-failed");

    const docRoot = parseOfdDocRoot(srcOfdXml) ?? `${sourcePrefix}Document.xml`;
    const remappedDocRoot = remapZipPath(docRoot, sourcePrefix, targetPrefix);
    const signatures = parseOfdSignatures(srcOfdXml);
    const remappedSignatures = signatures
      ? remapZipPath(signatures, sourcePrefix, targetPrefix)
      : undefined;
    ofdXml = appendDocBody(ofdXml, remappedDocRoot, remappedSignatures);
    nextDocIndex += 1;
  }

  outZip.file("OFD.xml", ofdXml);
  return outZip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

export async function getOfdPageCountFromBuffer(buffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);
  let count = 0;
  for (const path of Object.keys(zip.files)) {
    if (PAGE_CONTENT_RE.test(path)) count++;
  }
  return count;
}
