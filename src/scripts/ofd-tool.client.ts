import { applyI18n, onI18nReady, t } from "@/scripts/i18n-client";
import {
  compressOfdFile,
  exportCanvasesToLongImage,
  exportCanvasesToPdf,
  exportCanvasesToPngZip,
  exportPagesToHtml,
  exportPagesToSvgZip,
  extractOfdText,
  isOfdFile,
  loadMultipleOfdPreviews,
  loadOfdPreview,
  mergeOfdFiles,
  outputFilename,
  pdfFilenameFromOfd,
  resolveExportCanvases,
} from "@/scripts/ofd-core";

type OfdToolMode = string;

let currentFiles: File[] = [];
let currentPages: HTMLElement[] = [];
let currentCanvases: HTMLCanvasElement[] = [];
let extractedText = "";
let outputBlob: Blob | null = null;
let busy = false;
let usedImageFallback = false;

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

function setBusy(next: boolean) {
  busy = next;
  const actionBtn = $("ofd-action-btn") as HTMLButtonElement | null;
  const input = $("ofd-file-input") as HTMLInputElement | null;
  if (actionBtn) actionBtn.disabled = next || currentFiles.length === 0;
  if (input) input.disabled = next;
}

function resetOutput() {
  outputBlob = null;
  const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
  if (downloadBtn) {
    downloadBtn.classList.add("pointer-events-none", "opacity-45");
    downloadBtn.removeAttribute("href");
  }
}

function clearPreview() {
  const preview = $("ofd-preview");
  if (preview) preview.replaceChildren();
}

async function renderPreview(pages: HTMLElement[], canvases: HTMLCanvasElement[]) {
  const preview = $("ofd-preview");
  if (!preview) return;
  preview.replaceChildren();

  if (pages.length > 0) {
    for (const page of pages) {
      page.classList.add("ofd-preview__page");
      preview.appendChild(page);
    }
    return;
  }

  for (const canvas of canvases) {
    const wrap = document.createElement("div");
    wrap.className = "ofd-preview__page";
    const display = document.createElement("canvas");
    display.width = canvas.width;
    display.height = canvas.height;
    display.classList.add("ofd-preview__fallback-canvas");
    display.getContext("2d")?.drawImage(canvas, 0, 0);
    wrap.appendChild(display);
    preview.appendChild(wrap);
  }
}

function primaryFile(): File | null {
  return currentFiles[0] ?? null;
}

function statusForMode(mode: string, fallback: boolean): string {
  if (fallback) return t(wsKey("fallbackImages"));
  if (mode === "reader") return t(wsKey("readerReady"));
  return t(wsKey("success"));
}

function mapErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "invalid-ofd") return t(wsKey("errorInvalid"));
  if (code === "need-multiple") return t(wsKey("errorNeedMultiple"));
  if (code === "no-text") return t(wsKey("errorNoText"));
  if (code === "no-visual" || code === "no-pages" || code === "no-svg") {
    return t(wsKey("errorNoVisual"));
  }
  return t(wsKey("error"));
}

async function handleFiles(files: FileList | File[]) {
  const list = Array.from(files).filter(isOfdFile);
  if (list.length === 0) {
    setStatusMessage(t(wsKey("errorInvalid")), true);
    return;
  }

  if (isMultipleMode() && list.length < 2) {
    setStatusMessage(t(wsKey("errorNeedMultiple")), true);
    return;
  }

  currentFiles = isMultipleMode() ? list : [list[0]];
  currentPages = [];
  currentCanvases = [];
  extractedText = "";
  outputBlob = null;
  usedImageFallback = false;
  clearPreview();
  resetOutput();
  setBusy(true);
  setStatusMessage(t(wsKey("processing")));

  const mode = getMode();

  try {
    if (mode === "to-text") {
      const chunks: string[] = [];
      for (const file of currentFiles) {
        chunks.push(await extractOfdText(file));
      }
      extractedText = chunks.filter(Boolean).join("\n\n");
      if (!extractedText.trim()) throw new Error("no-text");
      setStatusMessage(t(wsKey("success")));
    } else if (mode === "compress") {
      const file = primaryFile();
      if (!file) throw new Error("no-file");
      outputBlob = await compressOfdFile(file);
      attachDownload(outputBlob, outputFilename(file.name, "ofd"));
      setStatusMessage(t(wsKey("success")));
    } else if (mode === "merge") {
      outputBlob = await mergeOfdFiles(currentFiles);
      attachDownload(outputBlob, `${currentFiles[0].name.replace(/\.ofd$/i, "")}-merged.ofd`);
      try {
        const { pages, canvases, usedImageFallback: fallback } =
          await loadMultipleOfdPreviews(currentFiles);
        currentPages = pages;
        currentCanvases = canvases;
        usedImageFallback = fallback;
        await renderPreview(pages, canvases);
      } catch {
        // merged file is still downloadable without preview
      }
      setStatusMessage(t(wsKey("success")));
    } else {
      const { pages, canvases, usedImageFallback: fallback } =
        currentFiles.length > 1
          ? await loadMultipleOfdPreviews(currentFiles)
          : await loadOfdPreview(currentFiles[0]);
      currentPages = pages;
      currentCanvases = canvases;
      usedImageFallback = fallback;
      await renderPreview(pages, canvases);
      setStatusMessage(statusForMode(mode, fallback));
    }
  } catch (error) {
    currentFiles = [];
    currentPages = [];
    currentCanvases = [];
    extractedText = "";
    usedImageFallback = false;
    clearPreview();
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

  if (mode === "reader") {
    $("ofd-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  setBusy(true);
  setStatusMessage(t(wsKey("processing")));

  try {
    let blob: Blob | null = null;
    let filename = "";

    const exportCanvases =
      mode === "to-pdf" ||
      mode === "to-image" ||
      mode === "to-long-image" ||
      mode === "to-web"
        ? await resolveExportCanvases(file, currentPages, currentCanvases)
        : currentCanvases;

    switch (mode) {
      case "to-pdf": {
        blob = await exportCanvasesToPdf(exportCanvases);
        filename = pdfFilenameFromOfd(file.name);
        break;
      }
      case "to-image": {
        blob = await exportCanvasesToPngZip(exportCanvases, file.name.replace(/\.ofd$/i, ""));
        filename = outputFilename(file.name, "zip");
        break;
      }
      case "to-long-image": {
        blob = await exportCanvasesToLongImage(exportCanvases);
        filename = outputFilename(file.name, "png");
        break;
      }
      case "to-svg": {
        if (currentPages.length === 0) throw new Error("no-svg");
        blob = await exportPagesToSvgZip(currentPages, file.name.replace(/\.ofd$/i, ""));
        filename = outputFilename(file.name, "svg.zip");
        break;
      }
      case "to-web": {
        blob = await exportPagesToHtml(currentPages, file.name.replace(/\.ofd$/i, ""), exportCanvases);
        filename = outputFilename(file.name, "html");
        break;
      }
      case "to-text": {
        blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
        filename = outputFilename(file.name, "txt");
        break;
      }
      case "merge": {
        if (!outputBlob) {
          outputBlob = await mergeOfdFiles(currentFiles);
        }
        blob = outputBlob;
        filename = `${file.name.replace(/\.ofd$/i, "")}-merged.ofd`;
        break;
      }
      case "compress": {
        if (!outputBlob) {
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
    setStatusMessage(statusForMode(mode, usedImageFallback));
  } catch (error) {
    resetOutput();
    setStatusMessage(mapErrorMessage(error), true);
  } finally {
    setBusy(false);
    syncActionState();
  }
}

function bindDropZone(signal: AbortSignal) {
  const zone = $("ofd-drop-zone");
  const input = $("ofd-file-input") as HTMLInputElement | null;
  if (!zone || !input) return;

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
  currentPages = [];
  currentCanvases = [];
  extractedText = "";
  outputBlob = null;
  busy = false;
  usedImageFallback = false;

  bindDropZone(ac.signal);
  bindActions(ac.signal);
  resetOutput();
  syncActionState();
  setStatusMessage("");
  applyI18n();
}

onI18nReady(() => syncActionState());
initOfdTool();
document.addEventListener("astro:page-load", initOfdTool);
