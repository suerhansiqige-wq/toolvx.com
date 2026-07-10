/**
 * Remove text or image watermarks by editing page content streams in-place.
 * Targets watermarks added by this site (pdf-lib drawText / drawImage) and common
 * diagonal text / centered image overlays in content streams.
 */

const MAX_BLOCK_SCAN = 4000;

function escapePdfLiteral(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Build search needles for a watermark string in PDF content streams. */
export function buildTextWatermarkPatterns(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const patterns = new Set<string>();
  patterns.add(`(${escapePdfLiteral(trimmed)})`);

  let hex = "";
  for (const ch of trimmed) {
    hex += ch.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase();
  }
  patterns.add(`<${hex}>`);
  patterns.add(`<FEFF${hex}>`);

  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    patterns.add(`(${trimmed})`);
  }

  return [...patterns];
}

function isOperatorBoundary(content: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = content[index - 1];
  return /[\s\n\r\[\(<]/.test(prev);
}

function findGraphicsBlockBounds(content: string, hitIndex: number): { start: number; end: number } | null {
  let start = -1;
  const scanStart = Math.max(0, hitIndex - MAX_BLOCK_SCAN);
  for (let i = hitIndex; i >= scanStart; i--) {
    if (content[i] === "q" && isOperatorBoundary(content, i)) {
      start = i;
      break;
    }
  }

  if (start < 0) {
    const btStart = content.lastIndexOf("BT", hitIndex);
    if (btStart >= 0 && hitIndex - btStart < 800) {
      const etEnd = content.indexOf("ET", hitIndex);
      if (etEnd >= 0) return { start: btStart, end: etEnd + 2 };
    }
    return null;
  }

  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "q" && isOperatorBoundary(content, i)) depth++;
    if (content[i] === "Q" && isOperatorBoundary(content, i)) {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  return null;
}

export function removeTextFromContentStream(content: string, text: string): { content: string; removed: number } {
  const patterns = buildTextWatermarkPatterns(text);
  if (!patterns.length) return { content, removed: 0 };

  let result = content;
  let removed = 0;
  let changed = true;

  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      let idx = 0;
      while ((idx = result.indexOf(pattern, idx)) !== -1) {
        const bounds = findGraphicsBlockBounds(result, idx);
        if (bounds) {
          result = result.slice(0, bounds.start) + result.slice(bounds.end);
          removed++;
          changed = true;
          idx = bounds.start;
        } else {
          idx += pattern.length;
        }
      }
    }
  }

  return { content: result, removed };
}

function copyBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(data.byteLength);
  out.set(data);
  return out;
}

async function zlibInflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("zlib-unsupported");
  }
  const stream = new Blob([copyBytes(data)]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("zlib-unsupported");
  }
  const stream = new Blob([copyBytes(data)]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type StreamRegion = {
  dictStart: number;
  dictEnd: number;
  dataStart: number;
  dataEnd: number;
  flate: boolean;
};

function findStreamRegions(pdf: Uint8Array): StreamRegion[] {
  const text = new TextDecoder("latin1").decode(pdf);
  const regions: StreamRegion[] = [];
  const streamToken = "stream";
  const endToken = "endstream";

  let pos = 0;
  while (pos < text.length) {
    const streamIdx = text.indexOf(streamToken, pos);
    if (streamIdx < 0) break;

    const lineBefore = text.slice(Math.max(0, streamIdx - 8), streamIdx);
    if (!/[\r\n]$/.test(lineBefore) && streamIdx > 0) {
      pos = streamIdx + streamToken.length;
      continue;
    }

    let dataStart = streamIdx + streamToken.length;
    if (text[dataStart] === "\r" && text[dataStart + 1] === "\n") dataStart += 2;
    else if (text[dataStart] === "\n") dataStart += 1;

    const endIdx = text.indexOf(endToken, dataStart);
    if (endIdx < 0) break;

    let dataEnd = endIdx;
    if (text[dataEnd - 1] === "\n") dataEnd -= 1;
    if (text[dataEnd - 1] === "\r") dataEnd -= 1;

    const dictStart = text.lastIndexOf("<<", streamIdx);
    const dictEnd = text.indexOf(">>", streamIdx);
    const dict =
      dictStart >= 0 && dictEnd >= 0 && dictEnd < streamIdx
        ? text.slice(dictStart, dictEnd + 2)
        : "";
    const flate = /\/Filter\s*\/FlateDecode/.test(dict) || /\/Filter\s*\[\s*\/FlateDecode/.test(dict);

    regions.push({
      dictStart,
      dictEnd: dictEnd >= 0 ? dictEnd + 2 : dictStart,
      dataStart,
      dataEnd,
      flate,
    });

    pos = endIdx + endToken.length;
  }

  return regions;
}

function updateLengthInDict(dictText: string, newLength: number): string {
  if (/\/Length\s+\d+/.test(dictText)) {
    return dictText.replace(/\/Length\s+\d+/, `/Length ${newLength}`);
  }
  return dictText.replace("<<", `<< /Length ${newLength} `);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function fingerprintImageBytes(bytes: Uint8Array, mimeHint?: string): Promise<Uint8Array | null> {
  const blob = new Blob([copyBytes(bytes)], {
    type: mimeHint ?? "image/png",
  });
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, 16, 16);
    bitmap.close();
    return new Uint8Array(ctx.getImageData(0, 0, 16, 16).data);
  } catch {
    return null;
  }
}

function fingerprintDistance(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 4) {
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  return sum;
}

function collectXObjectNamesForObject(pdfText: string, objectLabel: string): string[] {
  const names: string[] = [];
  const escaped = objectLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`/([A-Za-z0-9]+)\\s+${escaped}\\b`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(pdfText))) {
    names.push(`/${match[1]}`);
  }
  return names;
}

async function findMatchingImageObjectLabels(
  pdfText: string,
  pdf: Uint8Array,
  reference: Uint8Array,
  mimeHint?: string
): Promise<string[]> {
  const refFp = await fingerprintImageBytes(reference, mimeHint);
  if (!refFp) return [];

  const regions = findStreamRegions(pdf);
  const matches: string[] = [];

  for (const region of regions) {
    const dictText = pdfText.slice(region.dictStart, region.dictEnd);
    if (!/\/Subtype\s*\/Image/.test(dictText)) continue;

    const objPos = pdfText.lastIndexOf("obj", region.dictStart);
    const objChunk = pdfText.slice(Math.max(0, objPos - 24), objPos);
    const labelMatch = objChunk.match(/(\d+)\s+(\d+)\s+$/);
    if (!labelMatch) continue;

    const objectLabel = `${labelMatch[1]} ${labelMatch[2]} R`;
    const raw = pdf.slice(region.dataStart, region.dataEnd);
    let decoded: Uint8Array = raw;
    if (region.flate) {
      try {
        decoded = await zlibInflate(raw);
      } catch {
        continue;
      }
    }

    const mime = /\/Filter\s*\/DCTDecode/.test(dictText)
      ? "image/jpeg"
      : /\/Filter\s*\/JPXDecode/.test(dictText)
        ? "image/jpx"
        : "image/png";

    const fp = await fingerprintImageBytes(decoded, mime);
    if (!fp) continue;
    if (fingerprintDistance(refFp, fp) < 1200) {
      matches.push(objectLabel);
    }
  }

  return matches;
}

function removeImageOpsFromStream(content: string, xobjectNames: string[]): { content: string; removed: number } {
  let result = content;
  let removed = 0;

  for (const name of xobjectNames) {
    const token = `${name} Do`;
    let idx = 0;
    while ((idx = result.indexOf(token, idx)) !== -1) {
      const bounds = findGraphicsBlockBounds(result, idx);
      if (bounds) {
        result = result.slice(0, bounds.start) + result.slice(bounds.end);
        removed++;
        idx = bounds.start;
      } else {
        const lineStart = result.lastIndexOf("\n", idx);
        const lineEnd = result.indexOf("\n", idx);
        result =
          result.slice(0, lineStart >= 0 ? lineStart : 0) +
          result.slice(lineEnd >= 0 ? lineEnd : result.length);
        removed++;
      }
    }
  }

  return { content: result, removed };
}

async function rewritePdfStreams(
  pdf: Uint8Array,
  editStream: (decoded: string) => { content: string; removed: number }
): Promise<{ bytes: Uint8Array; removed: number }> {
  const pdfText = new TextDecoder("latin1").decode(pdf);
  const regions = findStreamRegions(pdf);
  let totalRemoved = 0;

  type Edit = { region: StreamRegion; dictBytes: Uint8Array; dataBytes: Uint8Array };
  const edits: Edit[] = [];

  for (const region of regions) {
    const dictText = pdfText.slice(region.dictStart, region.dictEnd);
    const raw = pdf.slice(region.dataStart, region.dataEnd);

    let decodedText: string;
    if (region.flate) {
      try {
        decodedText = new TextDecoder("latin1").decode(await zlibInflate(raw));
      } catch {
        continue;
      }
    } else {
      decodedText = new TextDecoder("latin1").decode(raw);
    }

    const looksLikeContent =
      /Tj|TJ|Do|cm|Tm|BT|ET/.test(decodedText) ||
      /\/Type\s*\/Page/.test(pdfText.slice(Math.max(0, region.dictStart - 500), region.dictStart));
    if (!looksLikeContent) continue;

    const { content: edited, removed } = editStream(decodedText);
    if (removed === 0) continue;

    totalRemoved += removed;
    const editedBytes = new TextEncoder().encode(edited);
    const outBytes = region.flate ? await zlibDeflate(editedBytes) : editedBytes;
    const newDict = updateLengthInDict(dictText, outBytes.length);

    edits.push({
      region,
      dictBytes: new TextEncoder().encode(newDict),
      dataBytes: outBytes,
    });
  }

  if (!edits.length) return { bytes: pdf, removed: 0 };

  edits.sort((a, b) => b.region.dictStart - a.region.dictStart);

  let result = pdf;
  for (const edit of edits) {
    const { region, dictBytes, dataBytes } = edit;
    result = concatBytes([
      result.slice(0, region.dictStart),
      dictBytes,
      result.slice(region.dictEnd, region.dataStart),
      dataBytes,
      result.slice(region.dataEnd),
    ]);
  }

  return { bytes: result, removed: totalRemoved };
}

export async function removeTextWatermarkFromPdf(
  file: File,
  text: string
): Promise<Uint8Array> {
  const pdf = await file.arrayBuffer().then(buf => new Uint8Array(buf));
  const { bytes, removed } = await rewritePdfStreams(pdf, stream =>
    removeTextFromContentStream(stream, text)
  );
  if (removed === 0) throw new Error("watermark-not-found");
  return bytes;
}

export async function removeImageWatermarkFromPdf(
  file: File,
  imageFile: File
): Promise<Uint8Array> {
  const pdf = await file.arrayBuffer().then(buf => new Uint8Array(buf));
  const pdfText = new TextDecoder("latin1").decode(pdf);
  const refBytes = new Uint8Array(await imageFile.arrayBuffer());
  const mime = imageFile.type || (imageFile.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

  const objectLabels = await findMatchingImageObjectLabels(pdfText, pdf, refBytes, mime);
  if (!objectLabels.length) throw new Error("watermark-not-found");

  const xobjectNames = [...new Set(objectLabels.flatMap(label => collectXObjectNamesForObject(pdfText, label)))];
  if (!xobjectNames.length) throw new Error("watermark-not-found");

  const { bytes, removed } = await rewritePdfStreams(pdf, stream =>
    removeImageOpsFromStream(stream, xobjectNames)
  );
  if (removed === 0) throw new Error("watermark-not-found");
  return bytes;
}
