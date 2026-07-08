import "@/scripts/legacy-polyfills";
import { loadPdfBytes, pdfjsLib, ensurePdfWorker } from "@/scripts/pdf-worker";
import { PDFDocument } from "pdf-lib";
import { REDACT_PALETTE } from "@/scripts/redact-colors";
import { onI18nReady, t } from "@/scripts/i18n-client";

ensurePdfWorker();

type EffectType = "blackout" | "pixelate" | "blur";

type PageStore = {
  canvas: HTMLCanvasElement;
  undoStack: ImageData[];
  redoStack: ImageData[];
};

type Point = { x: number; y: number };

const DEFAULT_MOSAIC = 12;
const DEFAULT_BLUR = 14;
const PDF_RENDER_SCALE = 1.5;
const THUMBS_PER_VIEW = 5;
const EXPORT_MAX_BYTES = 2 * 1024 * 1024;
const MIN_JPEG_QUALITY = 0.22;
const EXPORT_SCALE_STEPS = [1, 0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.28];

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let overlayCanvas: HTMLCanvasElement;
let overlayCtx: CanvasRenderingContext2D;

let isPdf = false;
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let pdfPageSizePts: { width: number; height: number }[] = [];
let currentPage = 1;
let totalPages = 1;
let pageStores: PageStore[] = [];

let originalFileName = "redacted";
let originalMime = "image/png";

let fillColor = "#000000";
let hasFillColor = false;
let effectType: EffectType = "pixelate";
let mosaicSize = DEFAULT_MOSAIC;
let blurRadius = DEFAULT_BLUR;

let selectionStart: Point | null = null;
let selectionEnd: Point | null = null;
let isDragging = false;

let originalImageSnapshot: ImageData | null = null;

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function canvasPoint(evt: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.max(0, Math.min(canvas.width, (evt.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height, (evt.clientY - rect.top) * scaleY)),
  };
}

function normalizeRect(a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { x, y, width, height };
}

function pushUndoSnapshot() {
  const store = pageStores[currentPage - 1];
  if (!store || !ctx) return;
  store.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  store.redoStack = [];
  updateHistoryButtons();
}

function restoreSnapshot(data: ImageData) {
  if (!ctx) return;
  ctx.putImageData(data, 0, 0);
  syncOverlaySize();
  void refreshThumbForCurrentPage();
}

function updateHistoryButtons() {
  const store = pageStores[currentPage - 1];
  const undoBtn = $("redact-undo") as HTMLButtonElement | null;
  const redoBtn = $("redact-redo") as HTMLButtonElement | null;
  if (!store || !undoBtn || !redoBtn) return;
  undoBtn.disabled = store.undoStack.length === 0;
  redoBtn.disabled = store.redoStack.length === 0;
}

function enterEditor() {
  const home = $("redact-home");
  const editor = $("redact-editor");
  home?.classList.add("redact-home--leaving");

  window.setTimeout(() => {
    showWorkspace(true);
    home?.classList.remove("redact-home--leaving");
    requestAnimationFrame(() => {
      editor?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, 280);
}

function syncThumbSidebarHeight() {
  const thumb = $("redact-thumb-sidebar");
  const controls = $("redact-control-panel");
  if (!thumb || !controls) return;

  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const isActive = thumb.classList.contains("redact-thumb-active");

  if (!isDesktop || !isActive) {
    thumb.style.height = "";
    return;
  }

  thumb.style.height = `${Math.round(controls.getBoundingClientRect().height)}px`;
}

function syncCanvasAreaHeight() {
  const wrap = $("redact-canvas-wrap");
  const controls = $("redact-control-panel");
  if (!wrap || !controls) return;

  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const isActive = !$("redact-editor")?.classList.contains("hidden");

  if (!isDesktop || !isActive || wrap.classList.contains("hidden")) {
    wrap.style.height = "";
    return;
  }

  wrap.style.height = `${Math.round(controls.getBoundingClientRect().height)}px`;
}

function refreshEditorLayout() {
  syncCanvasAreaHeight();
  if (pageStores.length > 0 && currentPage >= 1) {
    loadPageToMain(currentPage);
  } else {
    fitCanvasToContainer();
  }
  syncThumbSidebarHeight();
}

function showWorkspace(active: boolean) {
  $("redact-home")?.classList.toggle("hidden", active);
  $("redact-editor")?.classList.toggle("hidden", !active);
  $("redact-page")?.classList.toggle("redact-page--editing", active);
  $("redact-canvas-wrap")?.classList.toggle("hidden", !active);
  $("redact-floating-upload")?.classList.toggle("hidden", !active);
  $("redact-history")?.classList.toggle("hidden", !active);
  $("redact-effects")?.classList.toggle("hidden", !active);
  $("redact-export-btn")?.classList.toggle("hidden", !active);
  $("redact-page-controls")?.classList.toggle("hidden", !active || !isPdf);
  $("redact-thumb-sidebar")?.classList.toggle("redact-thumb-active", active && isPdf);
  if (active) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => refreshEditorLayout());
    });
  }
}

function syncOverlaySize() {
  if (!overlayCanvas || !canvas) return;
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.width = canvas.style.width;
  overlayCanvas.style.height = canvas.style.height;
}

function clearSelectionOverlay() {
  if (!overlayCtx || !overlayCanvas) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawSelectionOverlay() {
  if (!overlayCtx || !selectionStart || !selectionEnd) return;
  clearSelectionOverlay();
  const { x, y, width, height } = normalizeRect(selectionStart, selectionEnd);
  if (width < 2 || height < 2) return;
  overlayCtx.strokeStyle = "#2563eb";
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.strokeRect(x, y, width, height);
  overlayCtx.fillStyle = "rgba(37, 99, 235, 0.12)";
  overlayCtx.fillRect(x, y, width, height);
}

function applyBlackout(x: number, y: number, w: number, h: number) {
  if (!ctx) return;
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
}

function applyPixelate(x: number, y: number, w: number, h: number, block: number) {
  if (!ctx || w < 1 || h < 1) return;
  const bw = Math.max(2, block);
  const imageData = ctx.getImageData(x, y, w, h);
  const { data, width, height } = imageData;
  for (let py = 0; py < height; py += bw) {
    for (let px = 0; px < width; px += bw) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let dy = 0; dy < bw && py + dy < height; dy++) {
        for (let dx = 0; dx < bw && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      for (let dy = 0; dy < bw && py + dy < height; dy++) {
        for (let dx = 0; dx < bw && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imageData, x, y);
}

function applyBlur(x: number, y: number, w: number, h: number, radius: number) {
  if (!ctx || w < 1 || h < 1) return;
  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  tctx.filter = `blur(${radius}px)`;
  tctx.drawImage(temp, 0, 0);
  tctx.filter = "none";
  ctx.drawImage(temp, 0, 0, w, h, x, y, w, h);
}

function applyEffectToRegion(x: number, y: number, w: number, h: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iw = Math.floor(w);
  const ih = Math.floor(h);
  if (iw < 2 || ih < 2) return;

  if (effectType === "blackout") {
    if (!hasFillColor) return;
    applyBlackout(ix, iy, iw, ih);
  } else if (effectType === "pixelate") {
    applyPixelate(ix, iy, iw, ih, mosaicSize);
  } else {
    applyBlur(ix, iy, iw, ih, blurRadius);
  }
}

function commitSelection() {
  if (!selectionStart || !selectionEnd) return;
  const { x, y, width, height } = normalizeRect(selectionStart, selectionEnd);
  selectionStart = null;
  selectionEnd = null;
  clearSelectionOverlay();
  if (width < 4 || height < 4) return;
  if (effectType === "blackout" && !hasFillColor) return;
  pushUndoSnapshot();
  applyEffectToRegion(x, y, width, height);
  saveCurrentPageToStore();
  void refreshThumbForCurrentPage();
}

function saveCurrentPageToStore() {
  const store = pageStores[currentPage - 1];
  if (!store || !ctx) return;
  const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const newCanvas = document.createElement("canvas");
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  newCanvas.getContext("2d")?.putImageData(snap, 0, 0);
  store.canvas = newCanvas;
}

async function renderPdfPageToCanvas(pageNum: number, target: HTMLCanvasElement) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  target.width = Math.floor(viewport.width);
  target.height = Math.floor(viewport.height);
  const c = target.getContext("2d");
  if (!c) return;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, target.width, target.height);
  await page.render({ canvasContext: c, viewport, canvas: target }).promise;
  const base = page.getViewport({ scale: 1 });
  pdfPageSizePts[pageNum - 1] = { width: base.width, height: base.height };
}

function fitCanvasToContainer() {
  const wrap = $("redact-canvas-wrap");
  const stage = $("redact-canvas-stage");
  const inner = $("redact-canvas-inner");
  if (!wrap || !stage || !inner || !canvas.width) return;

  syncCanvasAreaHeight();

  const styles = getComputedStyle(wrap);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availW = Math.max(1, wrap.clientWidth - padX);
  const availH = Math.max(1, wrap.clientHeight - padY);
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const aspect = canvas.height / canvas.width;

  let cssW = availW;
  let cssH = Math.round(cssW * aspect);

  if (isDesktop && wrap.style.height) {
    if (cssH > availH) {
      cssH = availH;
      cssW = Math.round(cssH / aspect);
    }
    stage.style.width = "100%";
    stage.style.height = "100%";
  } else {
    stage.style.width = `${availW}px`;
    stage.style.height = `${cssH}px`;
  }

  inner.style.width = `${cssW}px`;
  inner.style.height = `${cssH}px`;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  syncOverlaySize();
}

function loadPageToMain(pageNum: number) {
  const store = pageStores[pageNum - 1];
  if (!store) return;
  canvas.width = store.canvas.width;
  canvas.height = store.canvas.height;
  ctx.drawImage(store.canvas, 0, 0);
  syncOverlaySize();
  fitCanvasToContainer();
  currentPage = pageNum;
  updatePageLabel();
  updateHistoryButtons();
  highlightThumb(pageNum);
}

function saveMainToCurrentPage() {
  saveCurrentPageToStore();
}

async function switchPage(delta: number) {
  const next = currentPage + delta;
  if (next < 1 || next > totalPages) return;
  saveMainToCurrentPage();
  loadPageToMain(next);
}

function updatePageLabel() {
  const cur = $("redact-page-current");
  const tot = $("redact-page-total");
  if (cur) cur.textContent = String(currentPage);
  if (tot) tot.textContent = String(totalPages);
}

let thumbViewStart = 0;

async function refreshThumbForCurrentPage() {
  const store = pageStores[currentPage - 1];
  const thumb = document.querySelector<HTMLImageElement>(
    `[data-redact-thumb="${currentPage}"]`
  );
  if (store && thumb) {
    thumb.src = store.canvas.toDataURL("image/jpeg", 0.55);
  }
}

async function buildThumbnails() {
  const list = $("redact-thumb-list");
  if (!list) return;
  list.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const store = pageStores[i - 1];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "redact-thumb-item";
    btn.dataset.page = String(i);
    const img = document.createElement("img");
    img.src = store.canvas.toDataURL("image/jpeg", 0.5);
    img.alt = t("page_label", { n: String(i) });
    img.className = "block w-full";
    img.dataset.redactThumb = String(i);
    const label = document.createElement("span");
    label.textContent = t("page_label", { n: String(i) });
    btn.append(img, label);
    btn.addEventListener("click", () => {
      saveMainToCurrentPage();
      loadPageToMain(i);
    });
    list.appendChild(btn);
  }
  renderThumbWindow();
  highlightThumb(currentPage);
  syncThumbSidebarHeight();
}

function renderThumbWindow() {
  const items = document.querySelectorAll<HTMLElement>(".redact-thumb-item");
  items.forEach((el, idx) => {
    el.classList.toggle(
      "redact-thumb-item--hidden",
      idx < thumbViewStart || idx >= thumbViewStart + THUMBS_PER_VIEW
    );
  });
  const pag = $("redact-thumb-pagination");
  if (!pag) return;
  pag.classList.toggle("hidden", totalPages <= THUMBS_PER_VIEW);
  const info = $("redact-thumb-info");
  if (info) {
    const end = Math.min(thumbViewStart + THUMBS_PER_VIEW, totalPages);
    info.textContent = t("redact_thumb_range", {
      start: String(thumbViewStart + 1),
      end: String(end),
      total: String(totalPages),
    });
  }
}

function highlightThumb(pageNum: number) {
  document.querySelectorAll(".redact-thumb-item").forEach(el => {
    el.classList.toggle("border-accent", el.getAttribute("data-page") === String(pageNum));
  });
}

async function loadImageFile(file: File) {
  isPdf = false;
  originalFileName = file.name.replace(/\.[^.]+$/, "") || "image";
  originalMime = file.type || "image/png";

  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
  URL.revokeObjectURL(url);

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  originalImageSnapshot = snap;

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = canvas.width;
  pageCanvas.height = canvas.height;
  pageCanvas.getContext("2d")?.putImageData(snap, 0, 0);

  pageStores = [{ canvas: pageCanvas, undoStack: [], redoStack: [] }];
  totalPages = 1;
  currentPage = 1;
  syncOverlaySize();
  fitCanvasToContainer();
  updatePageLabel();
  updateHistoryButtons();
}

async function loadPdfFile(file: File) {
  isPdf = true;
  originalFileName = file.name.replace(/\.pdf$/i, "") || "document";
  originalMime = "application/pdf";

  const bytes = new Uint8Array(await file.arrayBuffer());
  pdfDoc = await loadPdfBytes(bytes);
  totalPages = pdfDoc.numPages;
  pdfPageSizePts = new Array(totalPages);
  pageStores = [];

  for (let i = 1; i <= totalPages; i++) {
    const pageCanvas = document.createElement("canvas");
    await renderPdfPageToCanvas(i, pageCanvas);
    pageStores.push({ canvas: pageCanvas, undoStack: [], redoStack: [] });
  }

  currentPage = 1;
  loadPageToMain(1);
  await buildThumbnails();
}

async function handleFile(file: File) {
  const isPdfFile =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  try {
    thumbViewStart = 0;
    currentPage = 1;
    if (isPdfFile) await loadPdfFile(file);
    else await loadImageFile(file);
    if ($("redact-page")?.classList.contains("redact-page--editing")) {
      showWorkspace(true);
    } else {
      enterEditor();
    }
  } catch (err) {
    console.error(err);
    alert(t("redact_file_error"));
  } finally {
    const input = $("redact-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }
}

function undo() {
  const store = pageStores[currentPage - 1];
  if (!store || store.undoStack.length === 0) return;
  const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  store.redoStack.push(current);
  const prev = store.undoStack.pop()!;
  restoreSnapshot(prev);
  saveCurrentPageToStore();
  updateHistoryButtons();
}

function redo() {
  const store = pageStores[currentPage - 1];
  if (!store || store.redoStack.length === 0) return;
  const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  store.undoStack.push(current);
  const next = store.redoStack.pop()!;
  restoreSnapshot(next);
  saveCurrentPageToStore();
  updateHistoryButtons();
}

function resetToOriginal() {
  if (isPdf) {
    void (async () => {
      for (let i = 1; i <= totalPages; i++) {
        await renderPdfPageToCanvas(i, pageStores[i - 1].canvas);
        pageStores[i - 1].undoStack = [];
        pageStores[i - 1].redoStack = [];
      }
      loadPageToMain(currentPage);
      await buildThumbnails();
    })();
    return;
  }
  if (!originalImageSnapshot) return;
  pushUndoSnapshot();
  restoreSnapshot(originalImageSnapshot);
  saveCurrentPageToStore();
}

async function canvasToBlob(
  source: HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    source.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      mime,
      quality
    );
  });
}

async function canvasToJpegBytes(
  source: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob = await canvasToBlob(source, "image/jpeg", quality);
  return new Uint8Array(await blob.arrayBuffer());
}

function scaledCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const next = document.createElement("canvas");
  next.width = Math.max(1, Math.floor(source.width * scale));
  next.height = Math.max(1, Math.floor(source.height * scale));
  const context = next.getContext("2d");
  if (!context) throw new Error("Canvas not supported");
  context.drawImage(source, 0, 0, next.width, next.height);
  return next;
}

function byteSize(data: Blob | Uint8Array): number {
  return data instanceof Blob ? data.size : data.byteLength;
}

function mimeToExt(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "png";
}

function nextExportFilename(baseName: string, ext: string): string {
  const storageKey = `redact-export:${baseName}`;
  const serial = Number(sessionStorage.getItem(storageKey) || "0") + 1;
  sessionStorage.setItem(storageKey, String(serial));
  return `${baseName}${serial}.${ext.replace(/^\./, "")}`;
}

async function binarySearchBlob(
  source: HTMLCanvasElement,
  mime: string,
  maxBytes: number
): Promise<Blob | null> {
  if (mime === "image/png" || mime === "image/gif") {
    const blob = await canvasToBlob(source, mime);
    return blob.size <= maxBytes ? blob : null;
  }

  let low = MIN_JPEG_QUALITY;
  let high = 0.98;
  let best: Blob | null = null;

  for (let i = 0; i < 12; i++) {
    const quality = (low + high) / 2;
    const blob = await canvasToBlob(source, mime, quality);
    if (blob.size <= maxBytes) {
      best = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (best) return best;

  const minBlob = await canvasToBlob(source, mime, MIN_JPEG_QUALITY);
  return minBlob.size <= maxBytes ? minBlob : null;
}

async function encodeCanvasToBudget(
  source: HTMLCanvasElement,
  maxBytes: number
): Promise<Uint8Array> {
  for (const scale of EXPORT_SCALE_STEPS) {
    const canvasSource = scale === 1 ? source : scaledCanvas(source, scale);
    const blob = await binarySearchBlob(canvasSource, "image/jpeg", maxBytes);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
  }

  let scale = EXPORT_SCALE_STEPS[EXPORT_SCALE_STEPS.length - 1]!;
  while (scale >= 0.12) {
    const canvasSource = scaledCanvas(source, scale);
    const blob = await canvasToBlob(canvasSource, "image/jpeg", MIN_JPEG_QUALITY);
    if (blob.size <= maxBytes) return new Uint8Array(await blob.arrayBuffer());
    scale *= 0.82;
  }

  const tiny = scaledCanvas(source, 0.12);
  return canvasToJpegBytes(tiny, MIN_JPEG_QUALITY);
}

async function encodeImageUnderLimit(
  source: HTMLCanvasElement,
  preferredMime: string
): Promise<Blob> {
  for (const scale of EXPORT_SCALE_STEPS) {
    const canvasSource = scale === 1 ? source : scaledCanvas(source, scale);

    if (
      scale === EXPORT_SCALE_STEPS[0] &&
      (preferredMime === "image/png" || preferredMime === "image/gif")
    ) {
      const lossless = await binarySearchBlob(canvasSource, preferredMime, EXPORT_MAX_BYTES);
      if (lossless) return lossless;
    }

    if (preferredMime === "image/webp") {
      const webp = await binarySearchBlob(canvasSource, "image/webp", EXPORT_MAX_BYTES);
      if (webp) return webp;
    }

    const jpeg = await binarySearchBlob(canvasSource, "image/jpeg", EXPORT_MAX_BYTES);
    if (jpeg) return jpeg;
  }

  let scale = EXPORT_SCALE_STEPS[EXPORT_SCALE_STEPS.length - 1]!;
  while (scale >= 0.12) {
    const canvasSource = scaledCanvas(source, scale);
    const jpeg = await binarySearchBlob(canvasSource, "image/jpeg", EXPORT_MAX_BYTES);
    if (jpeg) return jpeg;
    scale *= 0.82;
  }

  let tinyScale = 0.12;
  while (tinyScale >= 0.05) {
    const blob = await canvasToBlob(
      scaledCanvas(source, tinyScale),
      "image/jpeg",
      MIN_JPEG_QUALITY
    );
    if (blob.size <= EXPORT_MAX_BYTES) return blob;
    tinyScale *= 0.75;
  }

  return canvasToBlob(scaledCanvas(source, 0.05), "image/jpeg", MIN_JPEG_QUALITY);
}

async function buildPdfBytes(jpegQuality: number, scale = 1): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  for (let i = 0; i < pageStores.length; i++) {
    const store = pageStores[i];
    const pts = pdfPageSizePts[i] ?? {
      width: store.canvas.width / PDF_RENDER_SCALE,
      height: store.canvas.height / PDF_RENDER_SCALE,
    };
    const canvasSource = scale === 1 ? store.canvas : scaledCanvas(store.canvas, scale);
    const jpegBytes = await canvasToJpegBytes(canvasSource, jpegQuality);
    const image = await out.embedJpg(jpegBytes);
    const page = out.addPage([pts.width, pts.height]);
    page.drawImage(image, { x: 0, y: 0, width: pts.width, height: pts.height });
  }

  return out.save({ useObjectStreams: true });
}

async function buildPdfWithPerPageBudget(
  perPageBudget: number,
  scale: number
): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  for (let i = 0; i < pageStores.length; i++) {
    const store = pageStores[i];
    const pts = pdfPageSizePts[i] ?? {
      width: store.canvas.width / PDF_RENDER_SCALE,
      height: store.canvas.height / PDF_RENDER_SCALE,
    };
    const canvasSource = scale === 1 ? store.canvas : scaledCanvas(store.canvas, scale);
    const jpegBytes = await encodeCanvasToBudget(canvasSource, perPageBudget);
    const image = await out.embedJpg(jpegBytes);
    const page = out.addPage([pts.width, pts.height]);
    page.drawImage(image, { x: 0, y: 0, width: pts.width, height: pts.height });
  }

  return out.save({ useObjectStreams: true });
}

async function exportPdfUnderLimit(): Promise<Uint8Array> {
  for (const scale of EXPORT_SCALE_STEPS) {
    let low = MIN_JPEG_QUALITY;
    let high = 0.98;
    let best: Uint8Array | null = null;

    for (let i = 0; i < 12; i++) {
      const quality = (low + high) / 2;
      const bytes = await buildPdfBytes(quality, scale);
      if (bytes.byteLength <= EXPORT_MAX_BYTES) {
        best = bytes;
        low = quality;
      } else {
        high = quality;
      }
    }

    if (best) return best;

    const atMinQuality = await buildPdfBytes(MIN_JPEG_QUALITY, scale);
    if (atMinQuality.byteLength <= EXPORT_MAX_BYTES) return atMinQuality;
  }

  const pageCount = Math.max(1, pageStores.length);
  let perPageBudget = Math.floor((EXPORT_MAX_BYTES * 0.88) / pageCount);

  for (let attempt = 0; attempt < 12; attempt++) {
    for (const scale of EXPORT_SCALE_STEPS.slice(3)) {
      const bytes = await buildPdfWithPerPageBudget(perPageBudget, scale);
      if (bytes.byteLength <= EXPORT_MAX_BYTES) return bytes;
    }
    perPageBudget = Math.max(1024, Math.floor(perPageBudget * 0.78));
  }

  let scale = 0.28;
  let budget = 1024;
  let bytes = await buildPdfWithPerPageBudget(budget, scale);
  while (bytes.byteLength > EXPORT_MAX_BYTES && budget > 256) {
    budget = Math.max(256, Math.floor(budget * 0.7));
    bytes = await buildPdfWithPerPageBudget(budget, scale);
  }
  return bytes;
}

function applyRedactDocumentMeta() {
  if (!$("redact-page")) return;
  document.title = t("redact.seo.title");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta) meta.content = t("redact.seo.description");
}

function reportExportError(err: unknown) {
  console.error(err);
  if (err instanceof Error && err.message === "REDACT_EXPORT_SIZE") {
    alert(t("redact_export_error_size"));
    return;
  }
  alert(t("redact_export_error_generic"));
}

async function exportFile() {
  saveMainToCurrentPage();

  if (isPdf) {
    const pdfBytes = await exportPdfUnderLimit();
    if (byteSize(pdfBytes) > EXPORT_MAX_BYTES) {
      throw new Error("REDACT_EXPORT_SIZE");
    }
    downloadBytes(pdfBytes, nextExportFilename(originalFileName, "pdf"), "application/pdf");
    return;
  }

  const store = pageStores[0];
  const preferredMime = originalMime.startsWith("image/") ? originalMime : "image/png";
  const blob = await encodeImageUnderLimit(store.canvas, preferredMime);
  if (byteSize(blob) > EXPORT_MAX_BYTES) {
    throw new Error("REDACT_EXPORT_SIZE");
  }
  const mime = blob.type || "image/jpeg";
  downloadBytes(blob, nextExportFilename(originalFileName, mimeToExt(mime)), mime);
}

function downloadBytes(data: Blob | Uint8Array, filename: string, mime: string) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildColorPalette() {
  const grid = $("redact-color-palette");
  if (!grid) return;
  grid.innerHTML = "";
  REDACT_PALETTE.forEach(color => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "redact-color-swatch";
    btn.style.backgroundColor = color;
    btn.title = color;
    btn.setAttribute("aria-label", color);
    btn.addEventListener("click", () => selectColor(color, btn));
    grid.appendChild(btn);
  });
}

function setEffectType(type: EffectType) {
  effectType = type;
  const effectSelect = $("redact-effect-type") as HTMLSelectElement | null;
  if (effectSelect) effectSelect.value = type;
}

function selectColor(color: string, btn: HTMLButtonElement) {
  fillColor = color;
  hasFillColor = true;
  setEffectType("blackout");
  document.querySelectorAll(".redact-color-swatch").forEach(el => {
    el.classList.remove("selected");
  });
  btn.classList.add("selected");
  const preview = $("redact-color-preview");
  if (preview) preview.style.backgroundColor = color;
}

function clearFillColor() {
  hasFillColor = false;
  setEffectType("pixelate");
  document.querySelectorAll(".redact-color-swatch").forEach(el => {
    el.classList.remove("selected");
  });
  const preview = $("redact-color-preview");
  if (preview) preview.style.backgroundColor = "transparent";
}

function bindPointerEvents() {
  canvas.addEventListener("pointerdown", e => {
    if (!hasFillColor && effectType === "blackout") return;
    canvas.setPointerCapture(e.pointerId);
    isDragging = true;
    selectionStart = canvasPoint(e);
    selectionEnd = selectionStart;
    drawSelectionOverlay();
  });

  canvas.addEventListener("pointermove", e => {
    if (!isDragging) return;
    selectionEnd = canvasPoint(e);
    drawSelectionOverlay();
  });

  const endDrag = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    selectionEnd = canvasPoint(e);
    commitSelection();
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
}

function bindFileInput(input: HTMLInputElement) {
  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  input.addEventListener("change", () => onFiles(input.files));

  const bindDrop = (el: HTMLElement) => {
    el.addEventListener("dragover", e => {
      e.preventDefault();
      el.classList.add("dragover");
    });
    el.addEventListener("dragleave", () => el.classList.remove("dragover"));
    el.addEventListener("drop", e => {
      e.preventDefault();
      el.classList.remove("dragover");
      onFiles(e.dataTransfer?.files ?? null);
    });
    el.addEventListener("click", () => input.click());
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
  };

  const empty = $("redact-empty");
  const floating = $("redact-floating-upload");
  if (empty) bindDrop(empty);
  if (floating) bindDrop(floating);
}

let initialized = false;

function initRedactTool() {
  const canvasEl = $("redact-canvas") as HTMLCanvasElement | null;
  const overlayEl = $("redact-overlay") as HTMLCanvasElement | null;
  const fileInput = $("redact-file-input") as HTMLInputElement | null;
  if (!canvasEl || !overlayEl || !fileInput) return;

  canvas = canvasEl;
  overlayCanvas = overlayEl;
  const c = canvas.getContext("2d");
  const o = overlayCanvas.getContext("2d");
  if (!c || !o) return;
  ctx = c;
  overlayCtx = o;

  if (!initialized) {
    initialized = true;
    buildColorPalette();
    bindPointerEvents();
    bindFileInput(fileInput);

    $("redact-undo")?.addEventListener("click", undo);
    $("redact-redo")?.addEventListener("click", redo);
    $("redact-reset")?.addEventListener("click", resetToOriginal);
    $("redact-export-btn")?.addEventListener("click", () => {
      void exportFile().catch(reportExportError);
    });
    $("redact-clear-color")?.addEventListener("click", clearFillColor);
    $("redact-prev-page")?.addEventListener("click", () => void switchPage(-1));
    $("redact-next-page")?.addEventListener("click", () => void switchPage(1));

    $("redact-thumb-prev")?.addEventListener("click", () => {
      thumbViewStart = Math.max(0, thumbViewStart - THUMBS_PER_VIEW);
      renderThumbWindow();
    });
    $("redact-thumb-next")?.addEventListener("click", () => {
      thumbViewStart = Math.min(
        Math.max(0, totalPages - 1),
        thumbViewStart + THUMBS_PER_VIEW
      );
      renderThumbWindow();
    });

    const effectSelect = $("redact-effect-type") as HTMLSelectElement | null;
    effectSelect?.addEventListener("change", () => {
      setEffectType(effectSelect.value as EffectType);
    });

    const mosaicRange = $("redact-mosaic-size") as HTMLInputElement | null;
    mosaicRange?.addEventListener("input", () => {
      mosaicSize = Number(mosaicRange.value) || DEFAULT_MOSAIC;
      const label = $("redact-mosaic-value");
      if (label) label.textContent = String(mosaicSize);
    });

    const blurRange = $("redact-blur-radius") as HTMLInputElement | null;
    blurRange?.addEventListener("input", () => {
      blurRadius = Number(blurRange.value) || DEFAULT_BLUR;
      const label = $("redact-blur-value");
      if (label) label.textContent = String(blurRadius);
    });

    document.addEventListener("keydown", e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    });

    window.addEventListener("resize", () => {
      syncCanvasAreaHeight();
      fitCanvasToContainer();
      syncThumbSidebarHeight();
    });

    const controlPanel = $("redact-control-panel");
    if (controlPanel && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        syncCanvasAreaHeight();
        fitCanvasToContainer();
        syncThumbSidebarHeight();
      });
      observer.observe(controlPanel);
    }
  }

  if (pageStores.length === 0) {
    showWorkspace(false);
  }
  applyRedactDocumentMeta();
}

onI18nReady(() => {
  initRedactTool();
});

document.addEventListener("astro:page-load", () => {
  initRedactTool();
});
