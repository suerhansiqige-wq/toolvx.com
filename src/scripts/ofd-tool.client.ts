import { applyI18n, onI18nReady, t } from "@/scripts/i18n-client";
import {
  compressOfdFile,
  disposeOfdSession,
  exportCanvasesToLongImage,
  exportCanvasesToPdf,
  exportCanvasesToPngZip,
  exportFileToSvgZip,
  exportPagesToHtml,
  extractOfdText,
  isOfdFile,
  mergeOfdFiles,
  outputFilename,
  pdfFilenameFromOfd,
  renderOfdThumbnail,
  resolveExportCanvases,
  type OfdProgressReporter,
} from "@/scripts/ofd-core";
import { BlobUrlRegistry, triggerBlobDownload } from "@/scripts/ofd-render-utils";
import { terminateOfdZipWorker } from "@/scripts/ofd-zip-client";
import { createLegacyFilePicker } from "@/scripts/file-input";
import { formatBytes } from "@/scripts/tools";

type OfdToolMode = string;

const THUMB_ROW_CLASS = "ofd-thumbs-row";

let currentFiles: File[] = [];
let extractedText = "";
let outputBlob: Blob | null = null;
let busy = false;
let thumbGeneration = 0;
let lastExportCanvases: HTMLCanvasElement[] = [];
const downloadUrlRegistry = new BlobUrlRegistry();
let activeDownloadUrl: string | null = null;

function $(id: string) {
  return document.getElementById(id);
}

function getRoot() {
  return document.getElementById("ofd-tool-root");
}

function getMode(): OfdToolMode {
  return getRoot()?.dataset.mode ?? "reader";
}

function isMultipleMode(): boolean {
  return getRoot()?.dataset.multiple === "true";
}

function wsKey(key: string) {
  return `ofd.workspace.${key}`;
}

function setStatusMessage(message: string, isError = false) {
  const apply = () => {
    const el = $("ofd-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("text-destructive", isError);
    el.classList.toggle("text-muted-foreground", !isError);
  };
  requestAnimationFrame(apply);
}

function getThumbCard(index = 0): HTMLElement | null {
  return document.querySelector(`[data-ofd-thumb-index="${index}"]`);
}

function setProgress(percent: number, stageKey?: string, thumbIndex = 0) {
  const card = getThumbCard(thumbIndex);
  if (!card) return;

  const area = card.querySelector<HTMLElement>(".ofd-thumb-progress");
  const bar = card.querySelector<HTMLElement>(".ofd-thumb-progress__bar");
  const track = card.querySelector<HTMLElement>(".ofd-thumb-progress__track");
  const label = card.querySelector<HTMLElement>(".ofd-thumb-progress__label");
  if (!area || !bar || !label) return;

  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  area.classList.remove("hidden");
  bar.style.width = `${clamped}%`;
  track?.setAttribute("aria-valuenow", String(clamped));
  label.textContent = stageKey ? t(wsKey(stageKey)) : "";
}

function hideProgress(thumbIndex = 0) {
  getThumbCard(thumbIndex)?.querySelector(".ofd-thumb-progress")?.classList.add("hidden");
}

function hideAllProgress() {
  document.querySelectorAll(".ofd-thumb-progress").forEach(el => el.classList.add("hidden"));
}

function makeProgressReporter(thumbIndex = 0): OfdProgressReporter {
  return (percent, stageKey) => setProgress(percent, stageKey, thumbIndex);
}

function setBusy(next: boolean) {
  busy = next;
  const actionBtn = $("ofd-action-btn") as HTMLButtonElement | null;
  const input = $("ofd-file-input") as HTMLInputElement | null;
  const addBtn = $("ofd-add-file-btn") as HTMLButtonElement | null;
  if (actionBtn) actionBtn.disabled = next || currentFiles.length === 0;
  if (input) input.disabled = next;
  if (addBtn) addBtn.disabled = next;
}

function resetOutput() {
  outputBlob = null;
  disposeOfdSession(lastExportCanvases);
  lastExportCanvases = [];
  const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
  if (downloadBtn) {
    downloadBtn.classList.add("pointer-events-none", "opacity-45");
    downloadBtn.removeAttribute("href");
  }
  if (activeDownloadUrl) {
    downloadUrlRegistry.revoke(activeDownloadUrl);
    activeDownloadUrl = null;
  }
}

function attachDownload(blob: Blob, filename: string) {
  const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
  if (!downloadBtn) return;

  if (activeDownloadUrl) downloadUrlRegistry.revoke(activeDownloadUrl);
  activeDownloadUrl = downloadUrlRegistry.create(blob);
  downloadBtn.href = activeDownloadUrl;
  downloadBtn.download = filename;
  downloadBtn.classList.remove("pointer-events-none", "opacity-45");

  // 兼容部分浏览器：点击下载按钮时再次触发 Blob 下载
  downloadBtn.onclick = event => {
    event.preventDefault();
    triggerBlobDownload(blob, filename);
  };
}

function ofdFileIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-10 text-violet-500" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 13h4M10 17h2"/></svg>`;
}

function createDeleteButton(onRemove: () => void): HTMLButtonElement {
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "ofd-thumb-remove interactive";
  deleteBtn.setAttribute("aria-label", t(wsKey("removeFile")));
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", e => {
    e.stopPropagation();
    onRemove();
  });
  return deleteBtn;
}

function createAddCard(): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.id = "ofd-add-file-btn";
  card.className = "ofd-add-card interactive";
  card.setAttribute("aria-label", t(wsKey("addFile")));
  card.setAttribute("data-i18n", "ofd.workspace.addFile");
  card.textContent = t(wsKey("addFile"));

  card.addEventListener("click", e => {
    e.stopPropagation();
    if (busy) return;
    promptAddOfdFiles();
  });
  return card;
}

function createProgressBlock(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "ofd-thumb-progress hidden w-full px-1";
  wrap.innerHTML = `
    <div class="ofd-thumb-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="ofd-thumb-progress__bar" style="width: 0%"></div>
    </div>
    <p class="ofd-thumb-progress__label"></p>
  `;
  return wrap;
}

function createThumbSpinner(): HTMLElement {
  const spinner = document.createElement("div");
  spinner.className = "ofd-thumb-spinner";
  spinner.setAttribute("aria-hidden", "true");
  return spinner;
}

function createFileThumb(file: File, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "ofd-thumb-item";
  card.dataset.ofdThumbIndex = String(index);

  if (isMultipleMode() && currentFiles.length > 1) {
    const orderBadge = document.createElement("span");
    orderBadge.className = "ofd-thumb-order";
    orderBadge.textContent = String(index + 1);
    card.appendChild(orderBadge);
  }

  const visual = document.createElement("div");
  visual.className = "ofd-thumb-visual";
  visual.dataset.ofdThumbVisual = "";
  visual.appendChild(createThumbSpinner());

  const name = document.createElement("p");
  name.className = "ofd-thumb-name";
  name.textContent = file.name;
  name.title = file.name;

  const size = document.createElement("p");
  size.className = "ofd-thumb-size";
  size.textContent = formatBytes(file.size);

  card.append(visual, name, size, createProgressBlock());
  return card;
}

async function loadThumbPreview(
  file: File,
  visual: HTMLElement,
  index: number,
  generation: number
) {
  let src = "";
  try {
    src = await renderOfdThumbnail(file);
  } catch {
    src = "";
  }

  if (generation !== thumbGeneration) return;

  visual.replaceChildren();
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = file.name;
    img.draggable = false;
    visual.appendChild(img);
  } else {
    const iconWrap = document.createElement("div");
    iconWrap.innerHTML = ofdFileIcon();
    visual.appendChild(iconWrap.firstElementChild ?? iconWrap);
  }
  visual.appendChild(createDeleteButton(() => removeFileAt(index)));
}

function renderFileThumbs() {
  const zone = $("ofd-drop-zone");
  const empty = $("ofd-drop-empty");
  const filled = $("ofd-drop-filled");
  const thumbs = $("ofd-file-chips");
  const input = $("ofd-file-input") as HTMLInputElement | null;
  if (!zone || !empty || !filled || !thumbs) return;

  thumbGeneration += 1;
  const generation = thumbGeneration;
  thumbs.replaceChildren();

  if (currentFiles.length === 0) {
    empty.classList.remove("hidden");
    filled.classList.add("hidden");
    zone.classList.remove("has-files", "ofd-drop-zone--active");
    hideAllProgress();
    if (input) input.value = "";
    return;
  }

  empty.classList.add("hidden");
  filled.classList.remove("hidden");
  zone.classList.add("has-files");
  thumbs.className = THUMB_ROW_CLASS;

  thumbs.appendChild(createAddCard());

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i];
    const card = createFileThumb(file, i);
    thumbs.appendChild(card);

    const visual = card.querySelector<HTMLElement>("[data-ofd-thumb-visual]");
    if (visual) void loadThumbPreview(file, visual, i, generation);
  }

  applyI18n();
}

function removeFileAt(index: number) {
  currentFiles = currentFiles.filter((_, i) => i !== index);
  extractedText = "";
  outputBlob = null;
  resetOutput();
  renderFileThumbs();
  if (currentFiles.length === 0) {
    setStatusMessage("");
    syncActionState();
    return;
  }
  setStatusMessage(t(wsKey("fileReady")));
  syncActionState();
}

function primaryFile(): File | null {
  return currentFiles[0] ?? null;
}

function mapErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "invalid-ofd") return t(wsKey("errorInvalid"));
  if (code === "need-multiple") return t(wsKey("errorNeedMultiple"));
  if (code === "merge-copy-failed") return t(wsKey("errorMergeFailed"));
  if (code === "no-text") return t(wsKey("errorNoText"));
  if (code === "timeout" || code === "ofd-script-load-failed") {
    return t(wsKey("errorTimeout"));
  }
  if (code === "no-visual" || code === "no-pages" || code === "no-svg") {
    return t(wsKey("errorNoVisual"));
  }
  return t(wsKey("error"));
}

function mergeIncomingFiles(list: File[]) {
  const valid = list.filter(isOfdFile);
  if (valid.length === 0) return false;

  if (isMultipleMode()) {
    const seen = new Set(currentFiles.map(f => `${f.name}:${f.size}`));
    for (const file of valid) {
      const key = `${file.name}:${file.size}`;
      if (!seen.has(key)) {
        currentFiles.push(file);
        seen.add(key);
      }
    }
  } else {
    currentFiles = [valid[0]];
  }
  return true;
}

function shouldAutoProcessOnUpload(): boolean {
  const mode = getMode();
  return mode === "to-text" || mode === "compress" || mode === "merge";
}

async function handleFiles(files: FileList | File[]) {
  const list = Array.from(files);
  if (!mergeIncomingFiles(list)) {
    setStatusMessage(t(wsKey("errorInvalid")), true);
    return;
  }

  if (isMultipleMode() && currentFiles.length < 2) {
    renderFileThumbs();
    setStatusMessage(t(wsKey("errorNeedMultiple")), true);
    syncActionState();
    return;
  }

  extractedText = "";
  outputBlob = null;
  resetOutput();
  renderFileThumbs();

  if (!shouldAutoProcessOnUpload()) {
    setStatusMessage(t(wsKey("fileReady")));
    syncActionState();
    return;
  }

  setBusy(true);
  setStatusMessage("");
  setProgress(5, "progressReadingFile");

  const mode = getMode();
  const report = makeProgressReporter();

  try {
    if (mode === "to-text") {
      setProgress(20, "progressExtracting");
      const chunks: string[] = [];
      for (let i = 0; i < currentFiles.length; i++) {
        setProgress(20 + Math.round(((i + 1) / currentFiles.length) * 65), "progressExtracting");
        chunks.push(await extractOfdText(currentFiles[i]));
      }
      extractedText = chunks.filter(Boolean).join("\n\n");
      if (!extractedText.trim()) throw new Error("no-text");
      setProgress(100, "progressDone");
      setStatusMessage(t(wsKey("fileReady")));
    } else if (mode === "compress") {
      const file = primaryFile();
      if (!file) throw new Error("no-file");
      setProgress(30, "progressCompressing");
      outputBlob = await compressOfdFile(file);
      setProgress(95, "progressExporting");
      attachDownload(outputBlob, outputFilename(file.name, "ofd"));
      setProgress(100, "progressDone");
      setStatusMessage(t(wsKey("success")));
    } else if (mode === "merge") {
      setProgress(25, "progressMerging");
      outputBlob = await mergeOfdFiles(currentFiles, report);
      attachDownload(
        outputBlob,
        `${currentFiles[0].name.replace(/\.ofd$/i, "")}-merged.ofd`
      );
      setProgress(100, "progressDone");
      setStatusMessage(t(wsKey("success")));
    }
  } catch (error) {
    if (mode === "merge" || mode === "compress") {
      currentFiles = [];
      renderFileThumbs();
    }
    extractedText = "";
    hideProgress();
    setStatusMessage(mapErrorMessage(error), true);
  } finally {
    setBusy(false);
    syncActionState();
  }
}

async function loadExportCanvases(file: File, report: OfdProgressReporter) {
  disposeOfdSession(lastExportCanvases);
  lastExportCanvases = await resolveExportCanvases(file, report);
  return lastExportCanvases;
}

function actionLabelKey(): string {
  const mode = getMode();
  switch (mode) {
    case "merge":
      return "actionMerge";
    case "compress":
      return "actionCompress";
    case "to-text":
      return "actionExtract";
    case "reader":
      return "actionView";
    default:
      return "convert";
  }
}

function syncActionState() {
  const actionBtn = $("ofd-action-btn") as HTMLButtonElement | null;
  if (!actionBtn) return;

  const hasFiles = currentFiles.length > 0;
  actionBtn.disabled = busy || !hasFiles;
  actionBtn.textContent = t(wsKey(actionLabelKey()));
}

async function runAction() {
  if (busy || currentFiles.length === 0) return;
  const mode = getMode();
  const file = primaryFile();
  if (!file) return;

  setBusy(true);
  setStatusMessage("");
  setProgress(2, "progressReadingFile");

  const report = makeProgressReporter();

  try {
    let blob: Blob | null = null;
    let filename = "";

    switch (mode) {
      case "to-pdf":
      case "reader": {
        const exportCanvases = await loadExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportCanvasesToPdf(exportCanvases);
        filename = pdfFilenameFromOfd(file.name);
        break;
      }
      case "to-image": {
        const exportCanvases = await loadExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportCanvasesToPngZip(exportCanvases, file.name.replace(/\.ofd$/i, ""));
        filename = outputFilename(file.name, "zip");
        break;
      }
      case "to-long-image": {
        const exportCanvases = await loadExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportCanvasesToLongImage(exportCanvases);
        filename = outputFilename(file.name, "png");
        break;
      }
      case "to-svg": {
        blob = await exportFileToSvgZip(file, file.name.replace(/\.ofd$/i, ""), report);
        filename = outputFilename(file.name, "svg.zip");
        break;
      }
      case "to-web": {
        const exportCanvases = await loadExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportPagesToHtml([], file.name.replace(/\.ofd$/i, ""), exportCanvases);
        filename = outputFilename(file.name, "html");
        break;
      }
      case "to-text": {
        setProgress(80, "progressExporting");
        blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
        filename = outputFilename(file.name, "txt");
        break;
      }
      case "merge": {
        if (!outputBlob) {
          outputBlob = await mergeOfdFiles(currentFiles, report);
        }
        blob = outputBlob;
        filename = `${file.name.replace(/\.ofd$/i, "")}-merged.ofd`;
        break;
      }
      case "compress": {
        if (!outputBlob) {
          setProgress(40, "progressCompressing");
          outputBlob = await compressOfdFile(file);
        }
        blob = outputBlob;
        filename = outputFilename(file.name, "ofd");
        break;
      }
      default:
        throw new Error("unsupported-mode");
    }

    if (blob) {
      outputBlob = blob;
      attachDownload(blob, filename);
    }
    setProgress(100, "progressDone");
    setStatusMessage(t(wsKey("success")));
  } catch (error) {
    resetOutput();
    hideProgress();
    setStatusMessage(mapErrorMessage(error), true);
  } finally {
    setBusy(false);
    syncActionState();
  }
}

function promptAddOfdFiles() {
  const picker = createLegacyFilePicker({
    accept: ".ofd,application/ofd,application/octet-stream",
    multiple: isMultipleMode(),
    onChange: files => void handleFiles(files),
  });
  picker.click();
}

function bindDropZone(signal: AbortSignal) {
  const zone = $("ofd-drop-zone");
  const input = $("ofd-file-input") as HTMLInputElement | null;
  if (!zone || !input) return;

  zone.addEventListener(
    "click",
    event => {
      const target = event.target as HTMLElement;
      if (target === input || target.closest(".file-input-overlay")) return;
      if (target.closest("button, a")) return;
      if (zone.classList.contains("has-files")) return;
      if (busy) return;
      openFileInput(input);
    },
    { signal }
  );

  zone.addEventListener(
    "dragover",
    event => {
      event.preventDefault();
      zone.classList.add("ofd-drop-zone--active");
    },
    { signal }
  );
  zone.addEventListener(
    "dragleave",
    () => {
      zone.classList.remove("ofd-drop-zone--active");
    },
    { signal }
  );
  zone.addEventListener(
    "drop",
    event => {
      event.preventDefault();
      zone.classList.remove("ofd-drop-zone--active");
      const files = event.dataTransfer?.files;
      if (files?.length) void handleFiles(files);
    },
    { signal }
  );

  input.addEventListener(
    "change",
    () => {
      if (input.files?.length) void handleFiles(input.files);
      input.value = "";
    },
    { signal }
  );
}

function openFileInput(input: HTMLInputElement) {
  input.value = "";
  input.click();
}

function bindActions(signal: AbortSignal) {
  $("ofd-action-btn")?.addEventListener(
    "click",
    () => {
      void runAction();
    },
    { signal }
  );
}

function initOfdTool() {
  const root = getRoot() as (HTMLElement & { __ofdToolAbort?: AbortController }) | null;
  if (!root) return;

  root.__ofdToolAbort?.abort();
  terminateOfdZipWorker();
  disposeOfdSession(lastExportCanvases);
  lastExportCanvases = [];
  downloadUrlRegistry.revokeAll();
  activeDownloadUrl = null;

  const ac = new AbortController();
  root.__ofdToolAbort = ac;

  currentFiles = [];
  extractedText = "";
  outputBlob = null;
  busy = false;

  bindDropZone(ac.signal);
  bindActions(ac.signal);
  resetOutput();
  renderFileThumbs();
  hideAllProgress();
  syncActionState();
  setStatusMessage("");
  applyI18n();
}

onI18nReady(() => syncActionState());
initOfdTool();
document.addEventListener("astro:page-load", initOfdTool);
window.addEventListener("beforeunload", () => {
  terminateOfdZipWorker();
  disposeOfdSession(lastExportCanvases);
  downloadUrlRegistry.revokeAll();
});
