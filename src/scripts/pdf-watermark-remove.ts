/**
 * Auto-detect and remove text/image watermarks from PDF content streams.
 * Site watermarks (pdf-lib drawText / drawImage) are removed in one pass;
 * other PDFs use cross-page heuristics with preview-before-download.
 */

const MAX_BLOCK_SCAN = 4000;

export type WatermarkRemovalMethod = "site" | "smart" | "none";

export type WatermarkRemovalResult = {
  bytes: Uint8Array;
  removed: number;
  method: WatermarkRemovalMethod;
  summaryKey: string;
};

type GraphicsBlock = { start: number; end: number; body: string };

function isOperatorBoundary(content: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = content[index - 1];
  return /[\s\n\r\[\(<]/.test(prev);
}

function findGraphicsBlockFromQ(content: string, qPos: number): { start: number; end: number } | null {
  let depth = 0;
  for (let i = qPos; i < content.length; i++) {
    if (content[i] === "q" && isOperatorBoundary(content, i)) depth++;
    if (content[i] === "Q" && isOperatorBoundary(content, i)) {
      depth--;
      if (depth === 0) return { start: qPos, end: i + 1 };
    }
  }
  return null;
}

function collectAllGraphicsBlocks(content: string): GraphicsBlock[] {
  const blocks: GraphicsBlock[] = [];
  let pos = 0;
  while (pos < content.length) {
    if (content[pos] === "q" && isOperatorBoundary(content, pos)) {
      const bounds = findGraphicsBlockFromQ(content, pos);
      if (bounds) {
        blocks.push({
          start: bounds.start,
          end: bounds.end,
          body: content.slice(bounds.start, bounds.end),
        });
        pos = bounds.end;
        continue;
      }
    }
    pos++;
  }
  return blocks;
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

  return findGraphicsBlockFromQ(content, start);
}

function usesSiteOpacity(body: string): boolean {
  return /0\.35\s+ca/.test(body) || /\/GS-\d+\s+gs/.test(body);
}

function isSiteTextWatermarkBlock(body: string): boolean {
  return (
    usesSiteOpacity(body) &&
    /36\s+Tf/.test(body) &&
    /(Tj|TJ)/.test(body) &&
    /0\.75\s+0\.75\s+0\.75\s+rg/.test(body)
  );
}

function isSiteImageWatermarkBlock(body: string): boolean {
  return usesSiteOpacity(body) && /\sDo\b/.test(body) && !/BT/.test(body);
}

function isSiteWatermarkBlock(body: string): boolean {
  return isSiteTextWatermarkBlock(body) || isSiteImageWatermarkBlock(body);
}

function isSmartWatermarkCandidate(body: string): boolean {
  const hasLowOpacity =
    /0\.(?:[12]\d?|3[0-5])\s+ca/.test(body) || /\/GS-\d+\s+gs/.test(body);
  const hasText = /BT[\s\S]*?(Tj|TJ)/.test(body);
  const hasImage = /\sDo\b/.test(body);
  const hasRotation = /0\.7\d*\s+0\.7\d*/.test(body);
  if (!hasLowOpacity) return false;
  if (hasText && hasRotation) return true;
  if (hasImage && !/BT/.test(body)) return true;
  return hasText && /36\s+Tf/.test(body);
}

function normalizeBlockFingerprint(body: string): string {
  return body
    .replace(/\d+\.?\d*\s+\d+\.?\d*\s+Td/g, "TD")
    .replace(
      /\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+cm/g,
      "CM"
    )
    .replace(/\((?:\\.|[^\\)])*\)/g, "TEXT")
    .replace(/<[0-9A-Fa-f]+>/g, "TEXT")
    .replace(/\s+/g, " ")
    .trim();
}

function removeMatchingBlocksFromStream(
  content: string,
  predicate: (body: string) => boolean
): { content: string; removed: number } {
  const blocks = collectAllGraphicsBlocks(content).filter(b => predicate(b.body));
  if (!blocks.length) return { content, removed: 0 };

  let result = content;
  let removed = 0;
  for (const block of [...blocks].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, block.start) + result.slice(block.end);
    removed++;
  }
  return { content: result, removed };
}

function removeSiteWatermarksFromStream(content: string): { content: string; removed: number } {
  return removeMatchingBlocksFromStream(content, isSiteWatermarkBlock);
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
    const dictEnd = text.lastIndexOf(">>", streamIdx);
    const dict =
      dictStart >= 0 && dictEnd > dictStart
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

async function decodeContentStream(region: StreamRegion, pdf: Uint8Array): Promise<string | null> {
  const raw = pdf.slice(region.dataStart, region.dataEnd);
  if (region.flate) {
    try {
      return new TextDecoder("latin1").decode(await zlibInflate(raw));
    } catch {
      return null;
    }
  }
  return new TextDecoder("latin1").decode(raw);
}

function isPageContentStream(stream: string, pdfText: string, dictStart: number): boolean {
  return (
    /Tj|TJ|Do|cm|Tm|BT|ET/.test(stream) ||
    /\/Type\s*\/Page/.test(pdfText.slice(Math.max(0, dictStart - 500), dictStart))
  );
}

async function decodePageContentStreams(pdf: Uint8Array): Promise<string[]> {
  const pdfText = new TextDecoder("latin1").decode(pdf);
  const streams: string[] = [];

  for (const region of findStreamRegions(pdf)) {
    const decoded = await decodeContentStream(region, pdf);
    if (!decoded) continue;
    if (!isPageContentStream(decoded, pdfText, region.dictStart)) continue;
    streams.push(decoded);
  }

  return streams;
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
    const decodedText = await decodeContentStream(region, pdf);
    if (!decodedText) continue;
    if (!isPageContentStream(decodedText, pdfText, region.dictStart)) continue;

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

function buildSmartFingerprintPredicate(
  streams: string[]
): ((body: string) => boolean) | null {
  const counts = new Map<string, number>();

  for (const stream of streams) {
    const seenOnPage = new Set<string>();
    for (const block of collectAllGraphicsBlocks(stream)) {
      if (!isSmartWatermarkCandidate(block.body)) continue;
      const fp = normalizeBlockFingerprint(block.body);
      if (!fp || seenOnPage.has(fp)) continue;
      seenOnPage.add(fp);
      counts.set(fp, (counts.get(fp) ?? 0) + 1);
    }
  }

  const threshold = Math.max(1, Math.ceil(streams.length * 0.75));
  const dominant = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([fp]) => fp);

  if (!dominant.length) return null;
  const fpSet = new Set(dominant);
  return body => fpSet.has(normalizeBlockFingerprint(body));
}

function removeLastSmartCandidateFromStream(content: string): { content: string; removed: number } {
  const blocks = collectAllGraphicsBlocks(content).filter(b => isSmartWatermarkCandidate(b.body));
  if (!blocks.length) return { content, removed: 0 };
  const last = blocks[blocks.length - 1];
  return {
    content: content.slice(0, last.start) + content.slice(last.end),
    removed: 1,
  };
}

/** Auto-detect site or heuristic watermarks and return cleaned PDF bytes. */
export async function autoRemoveWatermarks(pdfBytes: Uint8Array): Promise<WatermarkRemovalResult> {
  const siteResult = await rewritePdfStreams(pdfBytes, removeSiteWatermarksFromStream);
  if (siteResult.removed > 0) {
    return {
      bytes: siteResult.bytes,
      removed: siteResult.removed,
      method: "site",
      summaryKey: "watermark_detect_site",
    };
  }

  const streams = await decodePageContentStreams(pdfBytes);
  const smartPredicate = buildSmartFingerprintPredicate(streams);

  if (smartPredicate) {
    const smartResult = await rewritePdfStreams(pdfBytes, stream =>
      removeMatchingBlocksFromStream(stream, smartPredicate)
    );
    if (smartResult.removed > 0) {
      return {
        bytes: smartResult.bytes,
        removed: smartResult.removed,
        method: "smart",
        summaryKey: "watermark_detect_smart",
      };
    }
  }

  const fallback = await rewritePdfStreams(pdfBytes, removeLastSmartCandidateFromStream);
  if (fallback.removed > 0) {
    return {
      bytes: fallback.bytes,
      removed: fallback.removed,
      method: "smart",
      summaryKey: "watermark_detect_smart_low",
    };
  }

  return {
    bytes: pdfBytes,
    removed: 0,
    method: "none",
    summaryKey: "watermark_not_found",
  };
}
