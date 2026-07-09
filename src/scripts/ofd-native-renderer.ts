/**
 * Deterministic OFD → Canvas renderer.
 * Parses OFD XML directly from the ZIP package and paints via Canvas2D —
 * no ofd.js DOM, no html2canvas. Same output across browsers at a fixed DPI scale.
 */
import JSZip from "jszip";
import {
  buildOfdFontIdMap,
  buildOfdMediaIdMap,
  type MediaAsset,
} from "@/scripts/ofd-content-overlay";
import {
  drawOfdImageInBoundary,
  isLikelyStampResource,
  isPortraitImage,
  isPortraitSlot,
  parseOfdCtm,
} from "@/scripts/ofd-image-draw";
import {
  BlobUrlRegistry,
  createHiDpiCanvas,
  isCanvasRenderable,
  yieldToMain,
} from "@/scripts/ofd-render-utils";
import {
  decodeXmlText,
  naturalSort,
  parseDocumentPages,
  parseDocumentTemplates,
  parseOfdBox,
  parseOfdDocRoot,
  resolveRelativePath,
} from "@/scripts/ofd-xml-utils";

export type NativeRenderOptions = {
  targetWidthPx: number;
  onProgress?: (percent: number) => void;
};

type PageLayer = {
  xml: string;
  zOrder: number;
  kind: "template" | "page" | "annotation";
};

type ImageCache = Map<number, HTMLImageElement>;

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i");
  return tag.match(re)?.[1] ?? null;
}

function tagBlock(xml: string, tagName: string): string | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`,
    "i"
  );
  return xml.match(re)?.[1] ?? null;
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path) ?? zip.file(path.replace(/^\//, ""));
  if (!entry || entry.dir) return null;
  return entry.async("string");
}

function parsePageAreaMm(documentXml: string, pageXml: string): [number, number] {
  const areaMatch =
    pageXml.match(/<(?:[\w-]+:)?PhysicalBox[^>]*>([^<]+)</i) ??
    documentXml.match(/<(?:[\w-]+:)?PageArea[\s\S]*?<(?:[\w-]+:)?PhysicalBox[^>]*>([^<]+)</i);
  const box = parseOfdBox(areaMatch?.[1]);
  if (!box) return [210, 297];
  return [box[2] || 210, box[3] || 297];
}

function extractLayerBodies(xml: string): string[] {
  const layers: string[] = [];
  for (const match of xml.matchAll(
    /<(?:[\w-]+:)?Layer\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Layer>/gi
  )) {
    if (match[1]?.trim()) layers.push(match[1]);
  }
  if (layers.length > 0) return layers;

  const content = tagBlock(xml, "Content");
  if (content?.trim()) return [content];
  return [xml];
}

function parseColor(tag: string, fillOrStroke: "FillColor" | "StrokeColor"): string | null {
  const block = tag.match(
    new RegExp(`<(?:[\\w-]+:)?${fillOrStroke}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/(?:[\\w-]+:)?${fillOrStroke}>)`, "i")
  )?.[0];
  if (!block) return null;
  const value = attr(block, "Value");
  if (!value) return null;
  const parts = value.trim().split(/\s+/).map(Number);
  const alphaRaw = attr(block, "Alpha");
  const alpha = alphaRaw !== null ? Number(alphaRaw) / 255 : 1;
  if (parts.length >= 3) {
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${Number.isFinite(alpha) ? alpha : 1})`;
  }
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    const g = parts[0];
    return `rgba(${g},${g},${g},${Number.isFinite(alpha) ? alpha : 1})`;
  }
  return null;
}

function fontFamilyForId(fontId: string, fontIdMap: Map<number, string>): string {
  const name = fontIdMap.get(Number(fontId));
  if (!name) return '"SimSun", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  if (/courier/i.test(name)) return '"Courier New", Courier, monospace';
  if (/宋|song/i.test(name)) return '"SimSun", "NSimSun", "Microsoft YaHei", sans-serif';
  if (/楷|kai/i.test(name)) return '"KaiTi", "STKaiti", "Microsoft YaHei", sans-serif';
  if (/黑|hei/i.test(name)) return '"SimHei", "Microsoft YaHei", sans-serif';
  return `"${name}", "Microsoft YaHei", "SimSun", sans-serif`;
}

function drawAbbreviatedPath(g: CanvasRenderingContext2D, data: string): void {
  const tokens = data.trim().split(/\s+/);
  let i = 0;
  g.beginPath();
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === "M" || op === "S") {
      g.moveTo(Number(tokens[i++]), Number(tokens[i++]));
    } else if (op === "L") {
      g.lineTo(Number(tokens[i++]), Number(tokens[i++]));
    } else if (op === "B") {
      const x1 = Number(tokens[i++]);
      const y1 = Number(tokens[i++]);
      const x2 = Number(tokens[i++]);
      const y2 = Number(tokens[i++]);
      const x3 = Number(tokens[i++]);
      const y3 = Number(tokens[i++]);
      g.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    } else if (op === "Q") {
      const x1 = Number(tokens[i++]);
      const y1 = Number(tokens[i++]);
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      g.quadraticCurveTo(x1, y1, x, y);
    } else if (op === "C") {
      g.closePath();
    } else if (op === "A") {
      i += 7;
    }
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = url;
  });
}

function resolveImageAsset(
  resourceId: number,
  boundary: [number, number, number, number],
  mediaMap: Map<number, MediaAsset>,
  portraitAssets: MediaAsset[],
  portraitIdx: { value: number }
): MediaAsset | undefined {
  if (Number.isFinite(resourceId)) {
    const hit = mediaMap.get(resourceId);
    if (hit) return hit;
  }
  if (!isPortraitSlot(boundary[2], boundary[3])) return undefined;
  const asset = portraitAssets[portraitIdx.value];
  if (asset) portraitIdx.value++;
  return asset;
}

function paintTextObject(
  g: CanvasRenderingContext2D,
  tag: string,
  scaleX: number,
  scaleY: number,
  fontIdMap: Map<number, string>
): void {
  const boundary = parseOfdBox(attr(tag, "Boundary"));
  if (!boundary) return;

  const textCodeMatch = tag.match(
    /<(?:[\w-]+:)?TextCode([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/i
  );
  if (!textCodeMatch) return;

  const codeAttrs = textCodeMatch[1] ?? "";
  const rawText = decodeXmlText(textCodeMatch[2] ?? "");
  if (!rawText) return;

  const codeX = Number(attr(codeAttrs, "X") ?? "0");
  const codeY = Number(attr(codeAttrs, "Y") ?? "0");
  const fontId = attr(tag, "Font") ?? "0";
  const sizeMm = Number(attr(tag, "Size") ?? "3.5");
  const fontScale = Math.min(scaleX, scaleY);

  const left = (boundary[0] + codeX) * scaleX;
  const top = (boundary[1] + codeY) * scaleY;
  const fontSize = Math.max(8, sizeMm * fontScale * 0.96);

  const fill = parseColor(tag, "FillColor") ?? "#000000";
  g.save();
  g.font = `${fontSize}px ${fontFamilyForId(fontId, fontIdMap)}`;
  g.fillStyle = fill;
  g.textBaseline = "alphabetic";
  g.fillText(rawText, left, top + fontSize * 0.88);
  g.restore();
}

function paintPathObject(
  g: CanvasRenderingContext2D,
  tag: string,
  scaleX: number,
  scaleY: number
): void {
  const boundary = parseOfdBox(attr(tag, "Boundary"));
  if (!boundary) return;

  const dataMatch = tag.match(/<(?:[\w-]+:)?AbbreviatedData[^>]*>([^<]+)</i);
  if (!dataMatch?.[1]) return;

  const left = boundary[0] * scaleX;
  const top = boundary[1] * scaleY;
  const ctm = parseOfdCtm(attr(tag, "CTM"));
  const lineWidth = Number(attr(tag, "LineWidth") ?? "0.25") * Math.min(scaleX, scaleY);
  const fill = parseColor(tag, "FillColor");
  const stroke = parseColor(tag, "StrokeColor") ?? fill ?? "#000000";

  g.save();
  g.translate(left, top);
  g.scale(scaleX, scaleY);
  if (ctm) g.transform(ctm[0], ctm[1], ctm[2], ctm[3], ctm[4], ctm[5]);

  drawAbbreviatedPath(g, dataMatch[1]);

  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(0.25, lineWidth);
    g.stroke();
  }
  g.restore();
}

async function paintImageObject(
  g: CanvasRenderingContext2D,
  tag: string,
  scaleX: number,
  scaleY: number,
  mediaMap: Map<number, MediaAsset>,
  portraitAssets: MediaAsset[],
  imageCache: ImageCache,
  portraitIdx: { value: number }
): Promise<void> {
  const boundary = parseOfdBox(attr(tag, "Boundary"));
  if (!boundary) return;

  const resourceId = Number(attr(tag, "ResourceID"));
  const asset = resolveImageAsset(resourceId, boundary, mediaMap, portraitAssets, portraitIdx);
  if (!asset) return;

  let img = imageCache.get(resourceId);
  if (!img) {
    try {
      img = await loadImage(asset.url);
      if (Number.isFinite(resourceId)) imageCache.set(resourceId, img);
    } catch {
      return;
    }
  }

  const left = boundary[0] * scaleX;
  const top = boundary[1] * scaleY;
  const width = boundary[2] * scaleX;
  const height = boundary[3] * scaleY;
  const ctm = parseOfdCtm(attr(tag, "CTM"));
  const stamp = isLikelyStampResource(asset.pathHint, img);

  drawOfdImageInBoundary(g, img, left, top, width, height, ctm, {
    stamp,
    forceContain: isPortraitImage(img),
  });
}

async function paintStampAnnotation(
  g: CanvasRenderingContext2D,
  xml: string,
  scaleX: number,
  scaleY: number,
  mediaMap: Map<number, MediaAsset>,
  imageCache: ImageCache
): Promise<void> {
  for (const match of xml.matchAll(
    /<(?:[\w-]+:)?Annot\b[^>]*Type\s*=\s*"Stamp"[^>]*>[\s\S]*?<(?:[\w-]+:)?Appearance\b[^>]*Boundary\s*=\s*"([^"]+)"/gi
  )) {
    const boundary = parseOfdBox(match[1]);
    if (!boundary) continue;

    const stampAsset = [...mediaMap.values()].find(a => /stamp|seal|章|印/i.test(a.pathHint));
    if (!stampAsset) continue;

    let img: HTMLImageElement;
    try {
      img = await loadImage(stampAsset.url);
    } catch {
      continue;
    }

    const left = boundary[0] * scaleX;
    const top = boundary[1] * scaleY;
    const width = boundary[2] * scaleX;
    const height = boundary[3] * scaleY;
    drawOfdImageInBoundary(g, img, left, top, width, height, null, {
      stamp: true,
      forceContain: true,
    });
    imageCache.set(-1, img);
  }
}

async function paintLayerXml(
  g: CanvasRenderingContext2D,
  layerXml: string,
  scaleX: number,
  scaleY: number,
  fontIdMap: Map<number, string>,
  mediaMap: Map<number, MediaAsset>,
  portraitAssets: MediaAsset[],
  imageCache: ImageCache
): Promise<void> {
  const portraitIdx = { value: 0 };

  for (const match of layerXml.matchAll(
    /<(?:[\w-]+:)?PathObject\b[\s\S]*?(?:\/>|<\/(?:[\w-]+:)?PathObject>)/gi
  )) {
    paintPathObject(g, match[0], scaleX, scaleY);
  }

  for (const match of layerXml.matchAll(
    /<(?:[\w-]+:)?TextObject\b[\s\S]*?<\/(?:[\w-]+:)?TextObject>/gi
  )) {
    paintTextObject(g, match[0], scaleX, scaleY, fontIdMap);
  }

  for (const match of layerXml.matchAll(
    /<(?:[\w-]+:)?ImageObject\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w-]+:)?ImageObject>)/gi
  )) {
    await paintImageObject(
      g,
      match[0],
      scaleX,
      scaleY,
      mediaMap,
      portraitAssets,
      imageCache,
      portraitIdx
    );
  }
}

async function resolvePageContentOnlyXml(zip: JSZip, pagePath: string): Promise<string | null> {
  if (/Content\.xml$/i.test(pagePath)) {
    return readZipText(zip, pagePath);
  }
  if (/Page\.xml$/i.test(pagePath)) {
    const sibling = pagePath.replace(/Page\.xml$/i, "Content.xml");
    const siblingXml = await readZipText(zip, sibling);
    if (siblingXml) return siblingXml;
  }
  const raw = await readZipText(zip, pagePath);
  if (!raw) return null;
  const contentLoc =
    raw.match(/\bContentLoc\s*=\s*"([^"]+)"/i)?.[1] ??
    raw.match(/<(?:[\w-]+:)?ContentLoc[^>]*>([^<]+)</i)?.[1];
  if (contentLoc) {
    return readZipText(zip, resolveRelativePath(pagePath, contentLoc.trim()));
  }
  const dir = pagePath.replace(/[^/]+$/, "");
  return readZipText(zip, `${dir}Content.xml`);
}

async function collectPageLayers(
  zip: JSZip,
  docRoot: string,
  documentXml: string,
  pageIndex: number,
  pagePath: string,
  templateMap: Map<number, string>
): Promise<{ layers: PageLayer[]; pageXml: string }> {
  const descriptorXml = (await readZipText(zip, pagePath)) ?? "";
  const contentXml = (await resolvePageContentOnlyXml(zip, pagePath)) ?? descriptorXml;
  const layers: PageLayer[] = [];

  const tplSource = descriptorXml.includes("Template") ? descriptorXml : contentXml;
  for (const tplRef of tplSource.matchAll(
    /<(?:[\w-]+:)?Template\b[^>]*TemplateID\s*=\s*"(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w-]+:)?Template>)/gi
  )) {
    const block = tplRef[0];
    const tplId = Number(tplRef[1]);
    const zOrder = /ZOrder\s*=\s*"Foreground"/i.test(block) ? 1 : 0;
    const tplPath = templateMap.get(tplId);
    if (!tplPath) continue;
    const tplXml = await readZipText(zip, tplPath);
    if (!tplXml) continue;
    for (const body of extractLayerBodies(tplXml)) {
      layers.push({ xml: body, zOrder, kind: "template" });
    }
  }

  for (const body of extractLayerBodies(contentXml)) {
    layers.push({ xml: body, zOrder: 2, kind: "page" });
  }

  const prefix = docRoot.replace(/[^/]+$/, "");
  const annotPaths = [
    `${prefix}Annots/Page_${pageIndex}/Annotation.xml`,
    `${prefix}Annots/Page_${pageIndex}/Annotations.xml`,
  ];
  for (const annotPath of annotPaths) {
    const annotXml = await readZipText(zip, annotPath);
    if (annotXml) {
      layers.push({ xml: annotXml, zOrder: 3, kind: "annotation" });
    }
  }

  layers.sort((a, b) => a.zOrder - b.zOrder);
  const pageXml = descriptorXml.includes("PhysicalBox") ? descriptorXml : contentXml;
  return { layers, pageXml };
}

async function renderPage(
  zip: JSZip,
  docRoot: string,
  documentXml: string,
  pageIndex: number,
  pagePath: string,
  templateMap: Map<number, string>,
  targetWidthPx: number,
  fontIdMap: Map<number, string>,
  mediaPack: { map: Map<number, MediaAsset>; portraitAssets: MediaAsset[] }
): Promise<HTMLCanvasElement | null> {
  const { layers, pageXml } = await collectPageLayers(
    zip,
    docRoot,
    documentXml,
    pageIndex,
    pagePath,
    templateMap
  );
  if (layers.length === 0) return null;

  const [pageWidthMm, pageHeightMm] = parsePageAreaMm(documentXml, pageXml);
  const scale = targetWidthPx / pageWidthMm;
  const cssHeight = Math.max(1, Math.round(pageHeightMm * scale));

  const { canvas, ctx } = createHiDpiCanvas(targetWidthPx, cssHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidthPx, cssHeight);

  const imageCache: ImageCache = new Map();

  for (const layer of layers) {
    if (layer.kind === "annotation") {
      await paintStampAnnotation(ctx, layer.xml, scale, scale, mediaPack.map, imageCache);
    } else {
      await paintLayerXml(
        ctx,
        layer.xml,
        scale,
        scale,
        fontIdMap,
        mediaPack.map,
        mediaPack.portraitAssets,
        imageCache
      );
    }
  }

  return isCanvasRenderable(canvas) ? canvas : null;
}

/**
 * Render every page of an OFD file to canvases using native XML parsing.
 * Deterministic across browsers — no DOM / html2canvas dependency.
 */
export async function renderOfdToCanvasesNative(
  file: File,
  registry: BlobUrlRegistry,
  options: NativeRenderOptions
): Promise<HTMLCanvasElement[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const ofdXml = await readZipText(zip, "OFD.xml");
  if (!ofdXml) throw new Error("ofd-xml-missing");

  const docRoot = parseOfdDocRoot(ofdXml);
  if (!docRoot) throw new Error("ofd-docroot-missing");

  const documentXml = (await readZipText(zip, docRoot)) ?? "";
  if (!documentXml) throw new Error("ofd-document-missing");

  const templateMap = new Map<number, string>();
  for (const tpl of parseDocumentTemplates(documentXml)) {
    templateMap.set(tpl.id, resolveRelativePath(docRoot, tpl.baseLoc));
  }

  const pagePaths: string[] = [];
  for (const page of parseDocumentPages(documentXml)) {
    pagePaths.push(resolveRelativePath(docRoot, page.baseLoc));
  }
  if (pagePaths.length === 0) {
    for (const path of Object.keys(zip.files).sort(naturalSort)) {
      if (/\/Pages\/Page_\d+\/(?:Content|Page)\.xml$/i.test(path)) pagePaths.push(path);
    }
  }
  if (pagePaths.length === 0) throw new Error("ofd-no-pages");

  const [fontIdMap, mediaPack] = await Promise.all([
    buildOfdFontIdMap(file),
    buildOfdMediaIdMap(file, registry),
  ]);

  const canvases: HTMLCanvasElement[] = [];
  const total = pagePaths.length;

  for (let i = 0; i < total; i++) {
    options.onProgress?.(30 + Math.round(((i + 1) / total) * 55));
    const canvas = await renderPage(
      zip,
      docRoot,
      documentXml,
      i,
      pagePaths[i],
      templateMap,
      options.targetWidthPx,
      fontIdMap,
      mediaPack
    );
    if (canvas) canvases.push(canvas);
    await yieldToMain();
  }

  if (canvases.length === 0) throw new Error("native-render-empty");
  return canvases;
}
