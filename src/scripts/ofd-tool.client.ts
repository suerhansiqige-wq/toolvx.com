import { applyI18n, onI18nReady, t } from "@/scripts/i18n-client";
import {
  compressOfdFile,
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
  resolveExportCanvases,
  type OfdProgressReporter,
} from "@/scripts/ofd-core";
import { formatBytes } from "@/scripts/tools";
import { openFileInput } from "@/scripts/file-input";

type OfdToolMode = string;

let currentFiles: File[] = [];
let extractedText = "";
let outputBlob: Blob | null = null;
let busy = false;

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
  const el = $("ofd-status");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("text-destructive", isError);
  el.classList.toggle("text-muted-foreground", !isError);
}

function setProgress(percent: number, stageKey?: string) {
  const area = $("ofd-progress-area");
  const bar = $("ofd-progress-bar");
  const track = $("ofd-progress-track");
  const label = $("ofd-progress-label");
  if (!area || !bar || !label) return;

  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  area.classList.remove("hidden");
  bar.style.width = `${clamped}%`;
  track?.setAttribute("aria-valuenow", String(clamped));
  label.textContent = stageKey ? t(wsKey(stageKey)) : "";
}

function hideProgress() {
  $("ofd-progress-area")?.classList.add("hidden");
}

function makeProgressReporter(): OfdProgressReporter {
  return (percent, stageKey) => setProgress(percent, stageKey);
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
  const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
  if (downloadBtn) {
    downloadBtn.classList.add("pointer-events-none", "opacity-45");
    downloadBtn.removeAttribute("href");
  }
}

function renderFileChips() {
  const zone = $("ofd-drop-zone");
  const empty = $("ofd-drop-empty");
  const filled = $("ofd-drop-filled");
  const chips = $("ofd-file-chips");
  const input = $("ofd-file-input") as HTMLInputElement | null;
  if (!zone || !empty || !filled || !chips) return;

  chips.replaceChildren();

  if (currentFiles.length === 0) {
    empty.classList.remove("hidden");
    filled.classList.add("hidden");
    zone.classList.remove("ofd-drop-zone--has-files");
    hideProgress();
    if (input) input.value = "";
    return;
  }

  empty.classList.add("hidden");
  filled.classList.remove("hidden");
  zone.classList.add("ofd-drop-zone--has-files");

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i];
    const chip = document.createElement("div");
    chip.className = "ofd-file-chip";

    const icon = document.createElement("span");
    icon.className = "ofd-file-chip__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📄";

    const meta = document.createElement("div");
    meta.className = "ofd-file-chip__meta";

    const name = document.createElement("span");
    name.className = "ofd-file-chip__name";
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement("span");
    size.className = "ofd-file-chip__size";
    size.textContent = formatBytes(file.size);

    meta.append(name, size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ofd-file-chip__remove";
    remove.setAttribute("aria-label", t(wsKey("removeFile")));
    remove.textContent = "×";
    remove.addEventListener("click", event => {
      event.stopPropagation();
      removeFileAt(i);
    });

    chip.append(icon, meta, remove);
    chips.appendChild(chip);
  }
}

function removeFileAt(index: number) {
  currentFiles = currentFiles.filter((_, i) => i !== index);
  extractedText = "";
  outputBlob = null;
  resetOutput();
  renderFileChips();
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

async function handleFiles(files: FileList | File[]) {
  const list = Array.from(files);
  if (!mergeIncomingFiles(list)) {
    setStatusMessage(t(wsKey("errorInvalid")), true);
    return;
  }

  if (isMultipleMode() && currentFiles.length < 2) {
    renderFileChips();
    setStatusMessage(t(wsKey("errorNeedMultiple")), true);
    syncActionState();
    return;
  }

  extractedText = "";
  outputBlob = null;
  resetOutput();
  renderFileChips();
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
    } else {
      setProgress(100, "progressDone");
      setStatusMessage(t(wsKey("fileReady")));
    }
  } catch (error) {
    if (mode === "merge" || mode === "compress") {
      currentFiles = [];
      renderFileChips();
    }
    extractedText = "";
    hideProgress();
    setStatusMessage(mapErrorMessage(error), true);
  } finally {
    setBusy(false);
    syncActionState();
  }
}

function attachDownload(blob: Blob, filename: string) {
  const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
  if (!downloadBtn) return;
  downloadBtn.href = URL.createObjectURL(blob);
  downloadBtn.download = filename;
  downloadBtn.classList.remove("pointer-events-none", "opacity-45");
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
        const exportCanvases = await resolveExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportCanvasesToPdf(exportCanvases);
        filename = pdfFilenameFromOfd(file.name);
        break;
      }
      case "to-image": {
        const exportCanvases = await resolveExportCanvases(file, report);
        setProgress(93, "progressExporting");
        blob = await exportCanvasesToPngZip(exportCanvases, file.name.replace(/\.ofd$/i, ""));
        filename = outputFilename(file.name, "zip");
        break;
      }
      case "to-long-image": {
        const exportCanvases = await resolveExportCanvases(file, report);
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
        const exportCanvases = await resolveExportCanvases(file, report);
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

function bindDropZone(signal: AbortSignal) {
  const zone = $("ofd-drop-zone");
  const input = $("ofd-file-input") as HTMLInputElement | null;
  const addBtn = $("ofd-add-file-btn");
  if (!zone || !input) return;

  addBtn?.addEventListener(
    "click",
    event => {
      event.stopPropagation();
      if (busy) return;
      openFileInput(input);
    },
    { signal }
  );

  zone.addEventListener(
    "click",
    event => {
      if (busy) return;
      const target = event.target as HTMLElement;
      if (
        target.closest("#ofd-add-file-btn, .ofd-file-chip__remove, button, a") ||
        currentFiles.length > 0
      ) {
        return;
      }
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
  const ac = new AbortController();
  root.__ofdToolAbort = ac;

  currentFiles = [];
  extractedText = "";
  outputBlob = null;
  busy = false;

  bindDropZone(ac.signal);
  bindActions(ac.signal);
  resetOutput();
  renderFileChips();
  hideProgress();
  syncActionState();
  setStatusMessage("");
  applyI18n();
}

onI18nReady(() => syncActionState());
initOfdTool();
document.addEventListener("astro:page-load", initOfdTool);
