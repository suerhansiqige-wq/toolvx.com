import {
  getMergeEntryBytes,
  getMergeFileList,
  updateMergeActionButton,
} from "@/scripts/merge-file-list";
import { t, applyI18n, onI18nReady } from "@/scripts/i18n-client";
import { openImageLightbox, closeImageLightbox } from "@/scripts/image-lightbox";
import { bindDropZones, formatBytes } from "@/scripts/tools";
import {
  mergeOutputFilename,
  mergedCompressedFilename,
  originalPdfFilename,
  pdfFilenameFromImage,
  zipFilenameCompressedBatch,
  zipFilenameFromPdf,
  zipPageFilename,
} from "@/scripts/export-filename";
import {
  compressPdfBytes,
  compressPdfFile,
  compressPdfFilesToZip,
  mergePdfBytes,
  mergePdfFiles,
  type CompressionLevel,
  splitPdfAllPages,
  splitPdfExtractPages,
  rotatePdf,
  deletePdfPages,
  editPdfMetadata,
  numberPdfPages,
  cropPdf,
  watermarkPdf,
  watermarkPdfWithImage,
  signPdf,
  protectPdf,
  unlockPdf,
  imagesToPdf,
  pdfPagesToImages,
  pdfPageImagesToZip,
  pdfPagesToJpegs,
  getPdfPageCount,
  PDF_TO_JPG_PAGE_THRESHOLD,
  zipToBlob,
  openPdfReader,
  renderReaderPage,
  type ReaderState,
} from "@/scripts/pdf-tools";

type ToolAction = string;

function getRoot() {
  return document.getElementById("tool-root");
}

function getAction(): ToolAction | null {
  return getRoot()?.dataset.toolAction ?? null;
}

function getI18nKey(): string {
  return getRoot()?.dataset.i18nKey ?? "";
}

function toolKey(suffix: string): string {
  return `tools.${getI18nKey()}.${suffix}`;
}

function $(id: string) {
  return document.getElementById(id);
}

function showError(msg?: string) {
  const el = $("tool-error");
  if (el) {
    el.textContent = msg ?? t("common.error");
    el.classList.remove("hidden");
  }
  resetToolOutput();
}

function hideError() {
  const el = $("tool-error");
  if (el) {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

const downloadUrls: string[] = [];

function resetToolOutput(): void {
  closeImageLightbox();
  $("tool-success-row")?.classList.add("hidden");

  const dl = $("tool-download-btn") as HTMLAnchorElement | null;
  if (dl) {
    dl.classList.remove("is-ready");
    dl.href = "#";
    dl.setAttribute("aria-disabled", "true");
    dl.setAttribute("tabindex", "-1");
  }

  const multi = $("tool-multi-download");
  if (multi) {
    multi.innerHTML = "";
    multi.className =
      "tool-action-segment hidden w-full grid-cols-2 gap-1 rounded-[1.25rem] p-1";
  }

  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadUrls.length = 0;
  $("tool-stats")?.classList.add("hidden");
}

function showSuccess(): void {
  const row = $("tool-success-row");
  row?.classList.remove("hidden");
  row?.classList.add("flex");
  const bar = $("tool-action-bar");
  if (bar) applyI18n(bar);
}

function enableDownload(url: string, filename: string): void {
  downloadUrls.push(url);
  const dl = $("tool-download-btn") as HTMLAnchorElement | null;
  if (dl) {
    dl.href = url;
    dl.download = filename;
    dl.classList.add("is-ready");
    dl.setAttribute("aria-disabled", "false");
    dl.removeAttribute("tabindex");
  }
  showSuccess();
}

function enableMultiDownload(
  items: { url: string; filename: string; label: string }[]
): void {
  const dl = $("tool-download-btn");
  dl?.classList.remove("is-ready");

  const multi = $("tool-multi-download");
  if (!multi) return;

  multi.innerHTML = items
    .map(item => {
      downloadUrls.push(item.url);
      return `<a href="${item.url}" download="${item.filename}" class="tool-download-btn is-ready interactive flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-[1rem] px-3 text-sm font-semibold tracking-tight transition-all duration-300">${item.label}</a>`;
    })
    .join("");
  multi.className =
    "tool-action-segment grid w-full grid-cols-2 gap-1 rounded-[1.25rem] p-1";
  multi.classList.remove("hidden");
  showSuccess();
}

const THUMB_PREVIEW_PAGE_SIZE = 8;

type ThumbDownloadItem = {
  url: string;
  filename: string;
  pageIndex: number;
};

function createThumbDownloadCard(
  item: ThumbDownloadItem,
  downloadWord: string
): HTMLElement {
  const pageLabel = t("page_label", { n: String(item.pageIndex) });

  const card = document.createElement("div");
  card.className =
    "tool-page-thumb-card flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-accent hover:shadow-md";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className =
    "tool-page-thumb-card__preview aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-white dark:bg-gray-900";
  previewBtn.setAttribute("aria-label", t("zoom_page_image", { n: String(item.pageIndex) }));

  const img = document.createElement("img");
  img.src = item.url;
  img.alt = pageLabel;
  img.className =
    "size-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]";
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  previewBtn.appendChild(img);
  previewBtn.addEventListener("click", () => {
    openImageLightbox(item.url, pageLabel, previewBtn);
  });

  const footer = document.createElement("div");
  footer.className = "flex items-center justify-between gap-2 px-3 py-2.5";

  const pageNum = document.createElement("span");
  pageNum.className = "text-muted-foreground text-xs font-medium";
  pageNum.textContent = pageLabel;

  const downloadLink = document.createElement("a");
  downloadLink.href = item.url;
  downloadLink.download = item.filename;
  downloadLink.className =
    "text-accent interactive text-xs font-semibold hover:underline";
  downloadLink.textContent = downloadWord;
  downloadLink.setAttribute("aria-label", `${downloadWord} ${pageLabel}`);

  footer.append(pageNum, downloadLink);
  card.append(previewBtn, footer);
  return card;
}

function enableThumbnailDownloads(items: ThumbDownloadItem[]): void {
  const multi = $("tool-multi-download");
  if (!multi) return;

  const downloadWord = t("common.download");
  multi.replaceChildren();

  for (const item of items) {
    downloadUrls.push(item.url);
  }

  const grid = document.createElement("div");
  grid.className = "tool-page-thumbnails-grid";
  multi.appendChild(grid);

  const pagination = document.createElement("div");
  pagination.className =
    "tool-page-thumbnails-pagination hidden shrink-0 items-center justify-center gap-3";
  multi.appendChild(pagination);

  const totalPages = Math.max(1, Math.ceil(items.length / THUMB_PREVIEW_PAGE_SIZE));
  let currentPage = 0;

  const renderPage = (pageIndex: number) => {
    currentPage = pageIndex;
    grid.replaceChildren();

    const start = pageIndex * THUMB_PREVIEW_PAGE_SIZE;
    const slice = items.slice(start, start + THUMB_PREVIEW_PAGE_SIZE);
    for (const item of slice) {
      grid.appendChild(createThumbDownloadCard(item, downloadWord));
    }

    pagination.replaceChildren();
    if (totalPages <= 1) {
      pagination.classList.add("hidden");
      pagination.classList.remove("flex");
      return;
    }

    pagination.classList.remove("hidden");
    pagination.classList.add("flex");

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className =
      "interactive rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
    prevBtn.textContent = t("common.prevPage");
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 0) renderPage(currentPage - 1);
    });

    const label = document.createElement("span");
    label.className = "text-muted-foreground min-w-[7rem] text-center text-sm tabular-nums";
    label.textContent = t("common.pageOf", {
      current: String(currentPage + 1),
      total: String(totalPages),
    });

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className =
      "interactive rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
    nextBtn.textContent = t("common.nextPage");
    nextBtn.disabled = currentPage >= totalPages - 1;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages - 1) renderPage(currentPage + 1);
    });

    pagination.append(prevBtn, label, nextBtn);
  };

  renderPage(0);

  multi.className =
    "tool-action-segment tool-page-thumbnails flex w-full flex-col gap-3 rounded-[1.25rem] p-3";
  multi.classList.remove("hidden");
  showSuccess();
}

function downloadBlob(blob: Blob, filename: string) {
  enableDownload(URL.createObjectURL(blob), filename);
}

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
  downloadBlob(new Blob([buffer as ArrayBuffer], { type: mime }), filename);
}

async function imageFileToJpegBytes(file: File): Promise<Uint8Array> {
  if (
    file.type === "image/jpeg" ||
    file.name.toLowerCase().match(/\.jpe?g$/)
  ) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject()), "image/jpeg", 0.92);
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function normalizeImageFiles(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (file, i) => {
      if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
        return file;
      }
      const bytes = await imageFileToJpegBytes(file);
      return new File([bytes as BlobPart], file.name.replace(/\.[^./\\]+$/i, ".jpg"), {
        type: "image/jpeg",
      });
    })
  );
}

function getFiles(multiple = false): File[] {
  const input = $("file-input") as HTMLInputElement | null;
  if (!input) return [];
  if (getAction() === "merge") {
    return getMergeFileList();
  }
  if (!input.files?.length) return [];
  return multiple ? [...input.files] : [input.files[0]];
}

function setInteractiveLabel(
  el: HTMLButtonElement | HTMLAnchorElement,
  text: string
): void {
  const label = el.querySelector<HTMLElement>(".truncate, [data-i18n]");
  if (label) label.textContent = text;
  else el.textContent = text;
}

const PROCESS_ERROR_KEYS: Record<string, string> = {
  "Need at least 2 PDF files to merge": "error_merge_min_files",
  "No valid pages specified": "error_no_valid_pages",
  "Cannot delete all pages": "error_delete_all_pages",
};

function mapProcessError(err: unknown): string {
  if (err instanceof Error && err.message) {
    for (const [fragment, key] of Object.entries(PROCESS_ERROR_KEYS)) {
      if (err.message.includes(fragment)) return t(key);
    }
    if (err.message.startsWith("Failed to read")) return t("error_read_file");
    return err.message;
  }
  return t("common.error");
}

function setButtonLoading(btn: HTMLButtonElement, loading: boolean) {
  if (loading) {
    btn.dataset.loading = "true";
  } else {
    delete btn.dataset.loading;
  }
  btn.disabled = loading;
  setInteractiveLabel(
    btn,
    loading ? t("common.processing") : t(toolKey("action"))
  );
}

function bindActionButton(handler: () => Promise<void>) {
  const btn = $("tool-action-btn") as HTMLButtonElement | null;
  const input = $("file-input") as HTMLInputElement | null;
  const root = getRoot();
  const action = getAction();
  if (!btn || !action) return;

  const bindId = `${action}-${getI18nKey()}`;
  const isMerge = action === "merge";
  const isCompress = action === "compress";

  const updateDisabled = () => {
    if (isMerge) {
      updateMergeActionButton();
      return;
    }

    if (isCompress) {
      const files = getFiles(true);
      const count = files.length;
      const multi = $("compress-multi-actions");
      const eachBtn = $("tool-compress-each-btn") as HTMLButtonElement | null;
      const mergeBtn = $("tool-compress-merge-btn") as HTMLButtonElement | null;

      multi?.classList.toggle("hidden", count < 2);
      btn.classList.toggle("hidden", count >= 2);

      if (count < 2) {
        btn.disabled = count === 0;
      } else {
        if (eachBtn) eachBtn.disabled = false;
        if (mergeBtn) mergeBtn.disabled = false;
      }
      return;
    }

    btn.disabled = getFiles(false).length === 0;
  };

  if (root) {
    (root as HTMLElement & { __updateToolDisabled?: () => void }).__updateToolDisabled =
      updateDisabled;
  }

  if (btn.dataset.toolBound === bindId) {
    updateDisabled();
    return;
  }
  btn.dataset.toolBound = bindId;

  const prevAbort = (btn as HTMLButtonElement & { __toolAbort?: AbortController })
    .__toolAbort;
  prevAbort?.abort();

  const ac = new AbortController();
  (btn as HTMLButtonElement & { __toolAbort?: AbortController }).__toolAbort = ac;

  if (!isMerge) {
    input?.addEventListener(
      "change",
      () => {
        hideError();
        resetToolOutput();
        updateDisabled();
      },
      { signal: ac.signal }
    );
  }

  document.addEventListener(
    "merge-files-changed",
    () => {
      if (!isMerge) return;
      hideError();
      resetToolOutput();
      updateDisabled();
    },
    { signal: ac.signal }
  );

  document.addEventListener(
    "input-files-changed",
    () => {
      if (isMerge) return;
      hideError();
      resetToolOutput();
      updateDisabled();
    },
    { signal: ac.signal }
  );

  updateDisabled();

  btn.addEventListener(
    "click",
    async () => {
      hideError();
      setButtonLoading(btn, true);
      try {
        await handler();
      } catch (err) {
        console.error(err);
        const msg =
          err instanceof Error && err.message
            ? mapProcessError(err)
            : t(toolKey("error"));
        showError(msg);
      } finally {
        setButtonLoading(btn, false);
        updateDisabled();
      }
    },
    { signal: ac.signal }
  );
}

function getCompressionLevel(): CompressionLevel {
  return (
    (document.querySelector('input[name="compression"]:checked') as HTMLInputElement)
      ?.value ?? "balanced"
  ) as CompressionLevel;
}

function showCompressStats(orig: number, out: number): void {
  const stats = $("tool-stats");
  if (!stats) return;
  const saved = Math.max(0, orig - out);
  const pct = orig ? Math.round((saved / orig) * 100) : 0;
  stats.textContent = t("common.compressStats", {
    orig: formatBytes(orig),
    out: formatBytes(out),
    pct: String(pct),
  });
  stats.classList.remove("hidden");
}

function setAuxButtonLoading(
  btn: HTMLButtonElement,
  loading: boolean,
  labelKey: string
): void {
  btn.disabled = loading;
  setInteractiveLabel(
    btn,
    loading ? t("common.processing") : t(labelKey)
  );
}

function initCompress() {
  bindActionButton(async () => {
    const files = getFiles(true);
    if (files.length !== 1) return;

    const file = files[0];
    const bytes = await compressPdfFile(file, getCompressionLevel());
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
    showCompressStats(file.size, bytes.byteLength);
  });

  const eachBtn = $("tool-compress-each-btn") as HTMLButtonElement | null;
  const mergeBtn = $("tool-compress-merge-btn") as HTMLButtonElement | null;
  if (!eachBtn) return;

  const bindId = `compress-extra-${getI18nKey()}`;
  if (eachBtn.dataset.compressExtraBound === bindId) {
    (
      getRoot() as (HTMLElement & { __updateToolDisabled?: () => void }) | null
    )?.__updateToolDisabled?.();
    return;
  }
  eachBtn.dataset.compressExtraBound = bindId;
  if (mergeBtn) mergeBtn.dataset.compressExtraBound = bindId;

  const prevAbort = (
    eachBtn as HTMLButtonElement & { __compressAbort?: AbortController }
  ).__compressAbort;
  prevAbort?.abort();

  const ac = new AbortController();
  (eachBtn as HTMLButtonElement & { __compressAbort?: AbortController }).__compressAbort =
    ac;

  const runAux = async (
    btn: HTMLButtonElement,
    labelKey: string,
    task: () => Promise<void>
  ) => {
    hideError();
    setAuxButtonLoading(btn, true, labelKey);
    const mainBtn = $("tool-action-btn") as HTMLButtonElement | null;
    if (mainBtn) mainBtn.disabled = true;
    if (eachBtn && eachBtn !== btn) eachBtn.disabled = true;
    if (mergeBtn && mergeBtn !== btn) mergeBtn.disabled = true;
    try {
      await task();
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error && err.message ? err.message : t(toolKey("error"));
      showError(msg);
    } finally {
      setAuxButtonLoading(btn, false, labelKey);
      const root = getRoot() as
        | (HTMLElement & { __updateToolDisabled?: () => void })
        | null;
      root?.__updateToolDisabled?.();
    }
  };

  eachBtn.addEventListener(
    "click",
    () => {
      void runAux(eachBtn, "common.compressEach", async () => {
        const files = getFiles(true);
        if (files.length < 2) throw new Error(t("common.needTwoFiles"));

        const level = getCompressionLevel();
        const zip = await compressPdfFilesToZip(files, level);
        const blob = await zipToBlob(zip);
        downloadBlob(blob, zipFilenameCompressedBatch(files));

        const orig = files.reduce((sum, file) => sum + file.size, 0);
        showCompressStats(orig, blob.size);
      });
    },
    { signal: ac.signal }
  );

  mergeBtn?.addEventListener(
    "click",
    () => {
      void runAux(mergeBtn, "common.compressMerge", async () => {
        const files = getFiles(true);
        if (files.length < 2) throw new Error(t("common.needTwoFiles"));

        const level = getCompressionLevel();
        const merged = await mergePdfFiles(files);
        const bytes = await compressPdfBytes(merged, level);
        const orig = files.reduce((sum, file) => sum + file.size, 0);
        downloadBytes(bytes, mergedCompressedFilename(files), "application/pdf");
        showCompressStats(orig, bytes.byteLength);
      });
    },
    { signal: ac.signal }
  );
}

function initMerge() {
  bindActionButton(async () => {
    const entries = getMergeEntryBytes();
    if (entries.length < 2) throw new Error(t("common.needTwoFiles"));

    const bytes = await mergePdfBytes(entries);
    const files = getMergeFileList();
    downloadBytes(bytes, mergeOutputFilename(files), "application/pdf");
  });
}

function initSplit() {
  const pagesWrap = document.getElementById("split-pages-wrap");

  const updateMode = () => {
    const mode =
      (document.querySelector('input[name="split-mode"]:checked') as HTMLInputElement)
        ?.value ?? "all";
    pagesWrap?.classList.toggle("hidden", mode === "all");
  };

  document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
    radio.addEventListener("change", updateMode);
  });
  updateMode();

  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const mode =
      (document.querySelector('input[name="split-mode"]:checked') as HTMLInputElement)
        ?.value ?? "all";
    if (mode === "all") {
      const zip = await splitPdfAllPages(file);
      const blob = await zipToBlob(zip);
      downloadBlob(blob, zipFilenameFromPdf(file));
    } else {
      const pageSpec =
        (document.getElementById("split-page") as HTMLInputElement)?.value ?? "";
      const result = await splitPdfExtractPages(file, pageSpec);
      if (result.single) {
        downloadBytes(
          result.single,
          zipPageFilename(file.name, result.pageNumbers[0]!),
          "application/pdf"
        );
      } else if (result.zip) {
        const blob = await zipToBlob(result.zip);
        downloadBlob(blob, zipFilenameFromPdf(file));
      }
    }
  });
}

function initRotate() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const angle = parseInt(
      (document.getElementById("rotate-angle") as HTMLSelectElement)?.value ?? "90",
      10
    ) as 90 | 180 | 270;
    const bytes = await rotatePdf(file, angle);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initDeletePages() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const spec = (document.getElementById("page-spec") as HTMLInputElement)?.value ?? "";
    const bytes = await deletePdfPages(file, spec);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initEditMetadata() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const bytes = await editPdfMetadata(file, {
      title: (document.getElementById("meta-title") as HTMLInputElement)?.value,
      author: (document.getElementById("meta-author") as HTMLInputElement)?.value,
      subject: (document.getElementById("meta-subject") as HTMLInputElement)?.value,
    });
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initNumberPages() {
  const input = $("file-input") as HTMLInputElement | null;
  const startAtInput = $("page-number-start-at") as HTMLInputElement | null;

  const syncStartAtMax = async () => {
    const file = getFiles()[0];
    if (!file || !startAtInput) return;
    try {
      const count = await getPdfPageCount(file);
      startAtInput.max = String(count);
      if (parseInt(startAtInput.value, 10) > count) {
        startAtInput.value = String(count);
      }
    } catch {
      startAtInput.removeAttribute("max");
    }
  };

  input?.addEventListener("change", () => {
    void syncStartAtMax();
  });
  void syncStartAtMax();

  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const startAtPage = parseInt(startAtInput?.value ?? "1", 10);
    const startNumber = parseInt(
      ($("page-number-start-from") as HTMLInputElement | null)?.value ?? "1",
      10
    );
    const bytes = await numberPdfPages(file, { startAtPage, startNumber });
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initCrop() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const margin = parseFloat(
      (document.getElementById("crop-margin") as HTMLInputElement)?.value ?? "5"
    );
    const bytes = await cropPdf(file, margin);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initWatermark() {
  const textWrap = $("watermark-text-wrap");
  const imageWrap = $("watermark-image-wrap");
  const imageInput = $("watermark-image-input") as HTMLInputElement | null;
  const imageName = $("watermark-image-name");

  const updateMode = () => {
    const mode =
      (document.querySelector('input[name="watermark-mode"]:checked') as HTMLInputElement)
        ?.value ?? "text";
    textWrap?.classList.toggle("hidden", mode === "image");
    imageWrap?.classList.toggle("hidden", mode === "text");
  };

  document.querySelectorAll('input[name="watermark-mode"]').forEach(radio => {
    radio.addEventListener("change", updateMode);
  });
  updateMode();

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (imageName) imageName.textContent = file?.name ?? "";
  });

  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const mode =
      (document.querySelector('input[name="watermark-mode"]:checked') as HTMLInputElement)
        ?.value ?? "text";

    hideError();
    let bytes: Uint8Array;
    if (mode === "image") {
      const imageFile = imageInput?.files?.[0];
      if (!imageFile) {
        showError(t("watermark_image_required"));
        return;
      }
      bytes = await watermarkPdfWithImage(file, imageFile);
    } else {
      const text =
        (document.getElementById("watermark-text") as HTMLInputElement)?.value ||
        t("common.watermarkDefault");
      bytes = await watermarkPdf(file, text);
    }
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initSign() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const sig =
      (document.getElementById("signature-text") as HTMLInputElement)?.value ||
      t("common.signatureDefault");
    const bytes = await signPdf(file, sig);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initProtect() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const pw = (document.getElementById("pdf-password") as HTMLInputElement)?.value;
    const confirm = (document.getElementById("pdf-password-confirm") as HTMLInputElement)
      ?.value;
    if (!pw || pw !== confirm) throw new Error(t("common.passwordMismatch"));
    const bytes = await protectPdf(file, pw);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initUnlock() {
  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const pw = (document.getElementById("pdf-password") as HTMLInputElement)?.value ?? "";
    const bytes = await unlockPdf(file, pw);
    downloadBytes(bytes, originalPdfFilename(file), "application/pdf");
  });
}

function initImagesToPdf() {
  bindActionButton(async () => {
    const files = await normalizeImageFiles(getFiles(true));
    if (!files.length) return;
    const bytes = await imagesToPdf(files);
    downloadBytes(bytes, pdfFilenameFromImage(files[0]), "application/pdf");
  });
}

function initPdfToJpg() {
  const input = $("file-input") as HTMLInputElement | null;
  const downloadBtn = $("tool-download-btn");
  const downloadLabel = downloadBtn?.querySelector(".truncate");

  const refreshExportMode = async () => {
    const stats = $("tool-stats");
    const file = getFiles()[0];
    if (!file) {
      stats?.classList.add("hidden");
      return;
    }
    try {
      const count = await getPdfPageCount(file);
      const hd = count <= PDF_TO_JPG_PAGE_THRESHOLD;
      if (stats) {
        stats.textContent = t(hd ? "pdf_export_hd" : "pdf_export_zip", {
          count: String(count),
        });
        stats.classList.remove("hidden");
      }
      if (downloadLabel) {
        downloadLabel.textContent = t("download_zip_pack");
      }
    } catch {
      stats?.classList.add("hidden");
    }
  };

  bindActionButton(async () => {
    const file = getFiles()[0];
    if (!file) return;
    const pageCount = await getPdfPageCount(file);

    const zipFilename = zipFilenameFromPdf(file);

    if (pageCount <= PDF_TO_JPG_PAGE_THRESHOLD) {
      const images = await pdfPagesToJpegs(file);
      const zip = pdfPageImagesToZip(images);
      const blob = await zipToBlob(zip);
      enableThumbnailDownloads(
        images.map(img => {
          const url = URL.createObjectURL(img.blob);
          return {
            url,
            filename: img.filename,
            pageIndex: img.pageIndex,
          };
        })
      );
      enableDownload(URL.createObjectURL(blob), zipFilename);
    } else {
      const zip = await pdfPagesToImages(file, "jpeg");
      const blob = await zipToBlob(zip);
      downloadBlob(blob, zipFilename);
    }
  });

  input?.addEventListener("change", () => {
    void refreshExportMode();
  });
}

let readerState: ReaderState | null = null;
let readerFullscreenOpen = false;
let readerFsLastFocused: HTMLElement | null = null;

function initReader() {
  const btn = $("tool-action-btn") as HTMLButtonElement | null;
  const input = $("file-input") as HTMLInputElement | null;
  const viewer = $("pdf-reader-view");
  const canvas = $("pdf-canvas") as HTMLCanvasElement | null;
  const fsCanvas = $("pdf-canvas-fullscreen") as HTMLCanvasElement | null;
  const pageLabel = $("reader-page-label");
  const fsPageLabel = $("reader-fs-page-label");
  const prevBtn = $("reader-prev") as HTMLButtonElement | null;
  const nextBtn = $("reader-next") as HTMLButtonElement | null;
  const sidePrevBtn = $("reader-side-prev") as HTMLButtonElement | null;
  const sideNextBtn = $("reader-side-next") as HTMLButtonElement | null;
  const fsPrevBtn = $("reader-fs-prev") as HTMLButtonElement | null;
  const fsNextBtn = $("reader-fs-next") as HTMLButtonElement | null;
  const fullscreenBtn = $("reader-fullscreen-btn");
  const fullscreenOverlay = $("pdf-reader-fullscreen");
  const fullscreenClose = $("reader-fullscreen-close");
  const canvasWrap = $("pdf-reader-canvas-wrap");

  if (!btn || btn.dataset.initialized === "true") return;
  btn.dataset.initialized = "true";

  input?.addEventListener("change", () => {
    hideError();
    viewer?.classList.add("hidden");
    closeReaderFullscreen();
    btn.disabled = !input.files?.length;
  });

  const pageLabelText = () => {
    if (!readerState) return "";
    return t("common.pageOf", {
      current: readerState.currentPage,
      total: readerState.pdf.numPages,
    });
  };

  const updateNavButtons = () => {
    if (!readerState) return;
    const atStart = readerState.currentPage <= 1;
    const atEnd = readerState.currentPage >= readerState.pdf.numPages;
    for (const el of [prevBtn, sidePrevBtn, fsPrevBtn]) {
      if (el) el.disabled = atStart;
    }
    for (const el of [nextBtn, sideNextBtn, fsNextBtn]) {
      if (el) el.disabled = atEnd;
    }
  };

  const renderInline = async () => {
    if (!readerState || !canvas) return;
    const wrap = canvasWrap;
    const fitTo =
      wrap && wrap.clientWidth > 0 && wrap.clientHeight > 0
        ? {
            width: Math.max(280, wrap.clientWidth - 32),
            height: Math.max(320, wrap.clientHeight - 32),
          }
        : undefined;
    await renderReaderPage(
      readerState,
      canvas,
      fitTo ? { fitTo, hd: true } : undefined
    );
    if (pageLabel) pageLabel.textContent = pageLabelText();
    updateNavButtons();
  };

  const getFullscreenFit = () => {
    const body = fullscreenOverlay?.querySelector<HTMLElement>(
      ".pdf-reader-fullscreen-body"
    );
    if (body && body.clientWidth > 0 && body.clientHeight > 0) {
      return { width: body.clientWidth, height: body.clientHeight };
    }
    const sideInset = 88;
    const topInset = 56;
    const bottomInset = 76;
    return {
      width: Math.max(320, window.innerWidth - sideInset * 2),
      height: Math.max(240, window.innerHeight - topInset - bottomInset),
    };
  };

  const waitForLayout = () =>
    new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const renderFullscreen = async () => {
    if (!readerState || !fsCanvas || !readerFullscreenOpen) return;
    await waitForLayout();
    const fitTo = getFullscreenFit();
    await renderReaderPage(readerState, fsCanvas, {
      fitTo,
      hd: true,
    });
    if (fsPageLabel) fsPageLabel.textContent = pageLabelText();
    updateNavButtons();
  };

  const render = async () => {
    await renderInline();
    if (readerFullscreenOpen) await renderFullscreen();
  };

  const openReaderFullscreen = async () => {
    if (!readerState || !fullscreenOverlay) return;
    readerFsLastFocused = document.activeElement as HTMLElement | null;
    readerFullscreenOpen = true;
    fullscreenOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    await renderFullscreen();
    fullscreenClose?.focus();
  };

  const closeReaderFullscreen = () => {
    if (!fullscreenOverlay) return;
    readerFullscreenOpen = false;
    fullscreenOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    readerFsLastFocused?.focus();
    readerFsLastFocused = null;
  };

  const changePage = async (delta: number) => {
    if (!readerState) return;
    const next = readerState.currentPage + delta;
    if (next < 1 || next > readerState.pdf.numPages) return;
    readerState.currentPage = next;
    await render();
  };

  prevBtn?.addEventListener("click", () => {
    void changePage(-1);
  });
  nextBtn?.addEventListener("click", () => {
    void changePage(1);
  });
  sidePrevBtn?.addEventListener("click", () => {
    void changePage(-1);
  });
  sideNextBtn?.addEventListener("click", () => {
    void changePage(1);
  });
  fsPrevBtn?.addEventListener("click", () => {
    void changePage(-1);
  });
  fsNextBtn?.addEventListener("click", () => {
    void changePage(1);
  });

  fullscreenBtn?.addEventListener("click", () => {
    void openReaderFullscreen();
  });

  canvas?.addEventListener("click", () => {
    void openReaderFullscreen();
  });

  fullscreenClose?.addEventListener("click", closeReaderFullscreen);

  fullscreenOverlay?.addEventListener("click", event => {
    if (event.target === fullscreenOverlay) closeReaderFullscreen();
  });

  document.addEventListener("keydown", event => {
    if (!readerState || viewer?.classList.contains("hidden")) return;

    if (readerFullscreenOpen && event.key === "Escape") {
      event.preventDefault();
      closeReaderFullscreen();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void changePage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      void changePage(1);
    }
  });

  window.addEventListener("resize", () => {
    if (readerFullscreenOpen) void renderFullscreen();
  });

  btn.addEventListener("click", async () => {
    const file = getFiles()[0];
    if (!file || !canvas) return;
    hideError();
    closeReaderFullscreen();
    setButtonLoading(btn, true);
    try {
      readerState = await openPdfReader(file);
      viewer?.classList.remove("hidden");
      if (canvasWrap) {
        const i18nRoot = canvasWrap.parentElement ?? viewer;
        if (i18nRoot) applyI18n(i18nRoot);
      }
      await render();
      resetToolOutput();
    } catch (err) {
      console.error(err);
      showError(t(toolKey("error")));
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

const handlers: Record<string, () => void> = {
  compress: initCompress,
  merge: initMerge,
  split: initSplit,
  rotate: initRotate,
  "delete-pages": initDeletePages,
  "edit-metadata": initEditMetadata,
  reader: initReader,
  "number-pages": initNumberPages,
  crop: initCrop,
  watermark: initWatermark,
  "pdf-to-jpg": initPdfToJpg,
  "jpg-to-pdf": initImagesToPdf,
  sign: initSign,
  unlock: initUnlock,
  protect: initProtect,
};

function initToolPage() {
  const boot = () => {
    bindDropZones();

    const dl = $("tool-download-btn");
    if (dl && !dl.dataset.downloadGuardBound) {
      dl.dataset.downloadGuardBound = "true";
      dl.addEventListener("click", e => {
        if (dl.getAttribute("aria-disabled") === "true") e.preventDefault();
      });
    }

    const action = getAction();
    if (!action) return;
    handlers[action]?.();
  };

  if (!getRoot()) {
    requestAnimationFrame(() => {
      if (getRoot()) boot();
      else requestAnimationFrame(boot);
    });
    return;
  }

  boot();
}

onI18nReady(initToolPage);
