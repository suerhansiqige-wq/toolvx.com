import { applyI18n, onI18nReady, t } from "@/scripts/i18n-client";
import {
  exportCanvasesToPdf,
  isOfdFile,
  loadOfdPreview,
  pdfFilenameFromOfd,
} from "@/scripts/ofd-core";

type OfdToolMode = string;
type OfdToolStatus = "ready" | "coming-soon";

let currentFile: File | null = null;
let currentCanvases: HTMLCanvasElement[] = [];
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

function getStatus(): OfdToolStatus {
  return (getRoot()?.dataset.status as OfdToolStatus) ?? "coming-soon";
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
  if (actionBtn) actionBtn.disabled = next || !currentFile || getStatus() !== "ready";
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

async function renderPreview(pages: HTMLElement[]) {
  const preview = $("ofd-preview");
  if (!preview) return;
  preview.replaceChildren();
  for (const page of pages) {
    page.classList.add("ofd-preview__page");
    preview.appendChild(page);
  }
}

async function handleFile(file: File) {
  if (!isOfdFile(file)) {
    setStatusMessage(t(wsKey("errorInvalid")), true);
    return;
  }

  currentFile = file;
  currentCanvases = [];
  outputBlob = null;
  clearPreview();
  resetOutput();
  setBusy(true);
  setStatusMessage(t(wsKey("processing")));

  try {
    const { pages, canvases } = await loadOfdPreview(file);
    currentCanvases = canvases;
    await renderPreview(pages);

    const mode = getMode();
    if (mode === "reader") {
      setStatusMessage(t(wsKey("readerReady")));
    } else {
      setStatusMessage(t(wsKey("success")));
    }
  } catch {
    currentFile = null;
    clearPreview();
    setStatusMessage(t(wsKey("error")), true);
  } finally {
    setBusy(false);
    syncActionState();
  }
}

function syncActionState() {
  const actionBtn = $("ofd-action-btn") as HTMLButtonElement | null;
  if (!actionBtn) return;

  const status = getStatus();
  const mode = getMode();
  const hasFile = Boolean(currentFile);

  if (status !== "ready") {
    actionBtn.disabled = true;
    actionBtn.textContent = t(wsKey("comingSoonAction"));
    return;
  }

  actionBtn.disabled = busy || !hasFile;
  actionBtn.textContent =
    mode === "reader" ? t(wsKey("convert")) : t(wsKey("convert"));
}

async function runAction() {
  if (busy || !currentFile) return;
  const status = getStatus();
  const mode = getMode();

  if (status !== "ready") {
    setStatusMessage(t(wsKey("comingSoonAction")), true);
    return;
  }

  if (mode === "reader") {
    $("ofd-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (mode === "to-pdf") {
    if (currentCanvases.length === 0) {
      setStatusMessage(t(wsKey("error")), true);
      return;
    }

    setBusy(true);
    setStatusMessage(t(wsKey("processing")));
    try {
      outputBlob = await exportCanvasesToPdf(currentCanvases);
      const downloadBtn = $("ofd-download-btn") as HTMLAnchorElement | null;
      if (downloadBtn) {
        downloadBtn.href = URL.createObjectURL(outputBlob);
        downloadBtn.download = pdfFilenameFromOfd(currentFile.name);
        downloadBtn.classList.remove("pointer-events-none", "opacity-45");
      }
      setStatusMessage(t(wsKey("success")));
    } catch {
      resetOutput();
      setStatusMessage(t(wsKey("error")), true);
    } finally {
      setBusy(false);
      syncActionState();
    }
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
      const file = event.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    },
    { signal }
  );

  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      if (file) void handleFile(file);
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

  currentFile = null;
  currentCanvases = [];
  outputBlob = null;
  busy = false;

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
