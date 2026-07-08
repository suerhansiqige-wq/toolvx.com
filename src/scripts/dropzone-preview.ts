import { loadPdfBytes, pdfjsLib } from "@/scripts/pdf-worker";
import { t } from "@/scripts/i18n-client";
import { openImageLightbox } from "@/scripts/image-lightbox";
import {
  getMergeEntries,
  getMergeFileList,
  handleMergeInputChange,
  promptAddMergeFiles,
  removeMergeFileById,
  updateMergeActionButton,
} from "@/scripts/merge-file-list";
import {
  clearInputFiles,
  promptAddInputFiles,
  removeInputFile,
} from "@/scripts/input-file-list";
import {
  resetDropzoneScrollbar,
  syncDropzoneScrollbar,
  teardownDropzoneScrollbar,
} from "@/scripts/dropzone-scrollbar";
import { formatBytes } from "./tools";

const objectUrls = new WeakMap<HTMLElement, string[]>();
let previewGeneration = 0;

const THUMB_ROW_CLASS =
  "dropzone-thumbs-scroll flex min-h-[12rem] min-w-0 w-full flex-1 flex-nowrap items-stretch gap-4 overflow-x-auto px-1 pt-1";
const THUMB_ITEM_WIDTH = "w-[132px]";

function revokeUrls(zone: HTMLElement): void {
  for (const url of objectUrls.get(zone) ?? []) {
    URL.revokeObjectURL(url);
  }
  objectUrls.set(zone, []);
}

function trackUrl(zone: HTMLElement, url: string): void {
  const list = objectUrls.get(zone) ?? [];
  list.push(url);
  objectUrls.set(zone, list);
}

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
  );
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function renderPdfThumbnail(file: File, pageNum = 1, scale = 0.35): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await loadPdfBytes(data);
  return renderPdfPageThumbnail(pdf, pageNum, scale);
}

async function renderPdfPageThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 0.35
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

function shouldShowMergePreview(zone: HTMLElement): boolean {
  return zone.closest("#tool-root")?.getAttribute("data-tool-action") === "merge";
}

function shouldShowAllPdfPages(zone: HTMLElement, files: File[]): boolean {
  const action = zone.closest("#tool-root")?.getAttribute("data-tool-action");
  return (
    (action === "split" || action === "delete-pages" || action === "number-pages") &&
    files.length === 1 &&
    isPdfFile(files[0])
  );
}

function fileTypeIcon(type: "pdf" | "text" | "csv" | "file"): string {
  const icons = {
    pdf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-10 text-rose-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 13h4M10 17h2"/></svg>`,
    text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-10 text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`,
    csv: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-10 text-emerald-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2"/></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-10 text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  };
  return icons[type];
}

async function buildThumbSrc(
  zone: HTMLElement,
  file: File,
  pdfScale = 0.35
): Promise<{ src: string; isDataUrl: boolean }> {
  if (isImageFile(file)) {
    const url = URL.createObjectURL(file);
    trackUrl(zone, url);
    return { src: url, isDataUrl: false };
  }
  if (isPdfFile(file)) {
    try {
      const dataUrl = await renderPdfThumbnail(file, 1, pdfScale);
      return { src: dataUrl, isDataUrl: true };
    } catch {
      return { src: "", isDataUrl: true };
    }
  }
  return { src: "", isDataUrl: true };
}

function iconTypeForFile(file: File): "pdf" | "text" | "csv" | "file" {
  if (isPdfFile(file)) return "pdf";
  if (file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv")) return "csv";
  if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) return "text";
  return "file";
}

function createDeleteButton(onRemove: () => void): HTMLButtonElement {
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className =
    "dropzone-thumb-remove interactive absolute end-1 top-1 z-30 flex size-8 items-center justify-center rounded-full border-2 border-white bg-rose-500 font-bold text-white shadow-lg ring-2 ring-rose-500/35 transition hover:scale-110 hover:bg-rose-600 dark:border-rose-950";
  deleteBtn.setAttribute("aria-label", t("remove_file"));
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", e => {
    e.stopPropagation();
    onRemove();
  });
  return deleteBtn;
}

function mountDeleteOnVisual(visual: HTMLElement, onRemove: () => void): void {
  visual.classList.add("relative");
  visual.appendChild(createDeleteButton(onRemove));
}

function addLabelForInput(input: HTMLInputElement): string {
  if (input.accept.includes("image")) return t("add_image");
  return t("add_pdf");
}

function createDropzoneAddCard(label: string, onAdd: () => void): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className =
    `dropzone-add-card interactive flex min-h-[12rem] ${THUMB_ITEM_WIDTH} shrink-0 flex-col items-center justify-center gap-2 self-stretch rounded-xl border-2 border-dashed border-accent/45 bg-accent/5 px-3 py-6 text-center transition-all duration-300 hover:border-accent hover:bg-accent/10`;
  card.setAttribute("aria-label", label);

  card.innerHTML = `
    <span class="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-full shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-6" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </span>
    <span class="text-foreground text-xs font-semibold">${label}</span>
  `;
  card.addEventListener("click", e => {
    e.stopPropagation();
    onAdd();
  });
  return card;
}

function wrapThumbVisual(
  visual: HTMLElement,
  onRemove: () => void,
  widthClass = THUMB_ITEM_WIDTH
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `flex min-h-[10rem] ${widthClass} w-full flex-1 shrink-0`;
  mountDeleteOnVisual(visual, onRemove);
  wrap.appendChild(visual);
  return wrap;
}

function prependAddCard(
  thumbs: HTMLElement,
  input: HTMLInputElement,
  onAdd: () => void
): void {
  thumbs.prepend(
    createDropzoneAddCard(addLabelForInput(input), onAdd)
  );
}

function prependMergeAddCard(thumbs: HTMLElement, onAdd: () => void): void {
  thumbs.prepend(createDropzoneAddCard(t("add_pdf"), onAdd));
}

function createFileThumbCard(options: {
  file: File;
  src: string;
  useIcon: boolean;
  iconType: "pdf" | "text" | "csv" | "file";
  index?: number;
  showOrderBadge?: boolean;
  onRemove: () => void;
  onPreview?: () => void;
}): HTMLElement {
  const { file, src, useIcon, iconType, index, showOrderBadge, onRemove, onPreview } =
    options;

  const card = document.createElement("div");
  card.className = `dropzone-thumb-item relative flex h-full min-h-[12rem] ${THUMB_ITEM_WIDTH} shrink-0 flex-col items-center gap-2 overflow-visible`;

  if (showOrderBadge && index !== undefined) {
    const orderBadge = document.createElement("span");
    orderBadge.className =
      "bg-accent text-accent-foreground absolute start-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full text-[10px] font-bold shadow-sm";
    orderBadge.textContent = String(index + 1);
    card.appendChild(orderBadge);
  }

  const visualTag = onPreview ? "button" : "div";
  const visual = document.createElement(visualTag);
  if (onPreview) {
    (visual as HTMLButtonElement).type = "button";
    visual.className =
      `merge-dropzone-item__preview border-border bg-card flex size-full min-h-[10rem] w-full flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border shadow-sm`;
    visual.setAttribute("aria-label", t("preview_pdf", { name: file.name }));
    visual.addEventListener("click", e => {
      e.stopPropagation();
      onPreview();
    });
  } else {
    visual.className =
      "border-border bg-card flex size-full min-h-[10rem] w-full flex-1 items-center justify-center overflow-hidden rounded-xl border shadow-sm";
  }

  if (useIcon || !src) {
    visual.innerHTML = fileTypeIcon(iconType);
  } else {
    const img = document.createElement("img");
    img.src = src;
    img.alt = file.name;
    img.className = "size-full object-contain object-center";
    img.draggable = false;
    visual.appendChild(img);
  }

  const name = document.createElement("p");
  name.className =
    "text-foreground w-full truncate px-1 text-center text-xs font-medium";
  name.textContent = file.name;
  name.title = file.name;

  const size = document.createElement("p");
  size.className = "text-muted-foreground text-[10px]";
  size.textContent = formatBytes(file.size);

  card.append(wrapThumbVisual(visual, onRemove), name, size);
  return card;
}

function createThumbPlaceholder(): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.className = `border-border bg-muted/40 flex min-h-[10rem] ${THUMB_ITEM_WIDTH} shrink-0 flex-1 animate-pulse items-center justify-center rounded-xl border`;
  placeholder.innerHTML =
    '<div class="border-accent size-6 animate-spin rounded-full border-2 border-t-transparent"></div>';
  return placeholder;
}

async function renderGenericFilesPreview(
  zone: HTMLElement,
  thumbs: HTMLElement,
  input: HTMLInputElement,
  files: File[]
): Promise<void> {
  thumbs.className = THUMB_ROW_CLASS;

  const refreshPreview = () => {
    void updateDropzonePreview(zone, input);
  };

  prependAddCard(thumbs, input, () => {
    promptAddInputFiles(input, refreshPreview);
  });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const placeholder = createThumbPlaceholder();
    thumbs.appendChild(placeholder);

    const { src } = await buildThumbSrc(zone, file, 0.75);
    const useIcon = !src && !isImageFile(file);
    const canPreview = isPdfFile(file) || isImageFile(file);

    const card = createFileThumbCard({
      file,
      src,
      useIcon,
      iconType: iconTypeForFile(file),
      index: i,
      showOrderBadge: input.multiple && files.length > 1,
      onRemove: () => {
        removeInputFile(input, file);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        void refreshPreview();
        syncToolButtonState();
      },
      onPreview: canPreview
        ? () => {
            void (async () => {
              try {
                if (isPdfFile(file)) {
                  const fullSrc = await renderPdfThumbnail(file, 1, 1.15);
                  if (fullSrc) openImageLightbox(fullSrc, file.name);
                } else if (src) {
                  openImageLightbox(src, file.name);
                }
              } catch {
                if (src) openImageLightbox(src, file.name);
              }
            })();
          }
        : undefined,
    });
    thumbs.replaceChild(card, placeholder);
  }
}

function createMergeThumbCard(
  entry: { id: string; name: string; size: number },
  index: number,
  src: string,
  useIcon: boolean,
  iconType: "pdf" | "text" | "csv" | "file",
  onRemove: () => void,
  onPreview: () => void
): HTMLElement {
  const card = document.createElement("div");
  card.className = `merge-dropzone-item relative flex h-full min-h-[12rem] ${THUMB_ITEM_WIDTH} shrink-0 flex-col items-center gap-2 overflow-visible`;

  const orderBadge = document.createElement("span");
  orderBadge.className =
    "bg-accent text-accent-foreground absolute start-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full text-[10px] font-bold shadow-sm";
  orderBadge.textContent = String(index + 1);

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className =
    "merge-dropzone-item__preview border-border bg-card flex size-full min-h-[10rem] w-full flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border shadow-sm";
  previewBtn.setAttribute("aria-label", t("preview_pdf", { name: entry.name }));

  if (useIcon || !src) {
    previewBtn.innerHTML = fileTypeIcon(iconType);
  } else {
    const img = document.createElement("img");
    img.src = src;
    img.alt = entry.name;
    img.className = "size-full object-contain object-center";
    img.draggable = false;
    previewBtn.appendChild(img);
  }
  previewBtn.addEventListener("click", e => {
    e.stopPropagation();
    onPreview();
  });

  const name = document.createElement("p");
  name.className =
    "text-foreground w-full truncate px-1 text-center text-xs font-medium";
  name.textContent = entry.name;
  name.title = entry.name;

  const size = document.createElement("p");
  size.className = "text-muted-foreground text-[10px]";
  size.textContent = formatBytes(entry.size);

  card.append(orderBadge, wrapThumbVisual(previewBtn, onRemove), name, size);
  return card;
}

async function renderMergePdfPreview(
  zone: HTMLElement,
  preview: HTMLElement,
  thumbs: HTMLElement,
  input: HTMLInputElement,
  generation: number
): Promise<void> {
  thumbs.className = THUMB_ROW_CLASS;

  const refreshPreview = () => {
    void updateDropzonePreview(zone, input);
  };

  prependMergeAddCard(thumbs, () => {
    promptAddMergeFiles(refreshPreview);
  });

  const entries = getMergeEntries();
  const files = getMergeFileList();

  for (let i = 0; i < entries.length; i++) {
    if (generation !== previewGeneration) return;

    const entry = entries[i];
    const file = files[i];
    const placeholder = createThumbPlaceholder();
    thumbs.appendChild(placeholder);

    const { src } = await buildThumbSrc(zone, file, 0.75);
    if (generation !== previewGeneration) return;

    const card = createMergeThumbCard(
      entry,
      i,
      src,
      !src,
      "pdf",
      () => {
        removeMergeFileById(entry.id);
        refreshPreview();
      },
      () => {
        void (async () => {
          try {
            const fullSrc = await renderPdfThumbnail(file, 1, 1.15);
            if (fullSrc) openImageLightbox(fullSrc, entry.name);
          } catch {
            if (src) openImageLightbox(src, entry.name);
          }
        })();
      }
    );
    thumbs.replaceChild(card, placeholder);
  }
}

function createPageThumbPlaceholder(pageIndex: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "flex h-full min-h-[12rem] w-[96px] shrink-0 flex-col items-center gap-1.5";
  card.innerHTML = `
    <div class="border-border bg-muted/40 flex min-h-[10rem] w-[96px] flex-1 animate-pulse items-center justify-center rounded-lg border">
      <div class="border-accent size-5 animate-spin rounded-full border-2 border-t-transparent"></div>
    </div>
    <p class="text-muted-foreground text-[10px] font-medium">${t("page_label", { n: String(pageIndex) })}</p>
  `;
  return card;
}

function createPageThumbCard(
  pageIndex: number,
  src: string,
  options?: {
    onRemove?: () => void;
    onPreview?: (trigger: HTMLButtonElement) => void;
  }
): HTMLElement {
  const { onRemove, onPreview } = options ?? {};
  const pageLabel = t("page_label", { n: String(pageIndex) });

  const card = document.createElement("div");
  card.className =
    "flex h-full min-h-[12rem] w-[96px] shrink-0 flex-col items-center gap-1.5 overflow-visible";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className =
    "dropzone-page-thumb__preview border-border bg-card flex size-full min-h-[10rem] w-full flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border shadow-sm";
  previewBtn.setAttribute("aria-label", t("zoom_page_image", { n: String(pageIndex) }));

  const img = document.createElement("img");
  img.src = src;
  img.alt = pageLabel;
  img.className = "size-full object-contain object-center";
  img.draggable = false;
  previewBtn.appendChild(img);

  if (onPreview) {
    previewBtn.addEventListener("click", e => {
      e.stopPropagation();
      onPreview(previewBtn);
    });
  }

  const label = document.createElement("p");
  label.className = "text-muted-foreground w-full truncate text-center text-[10px] font-medium";
  label.textContent = pageLabel;

  if (onRemove) {
    card.append(wrapThumbVisual(previewBtn, onRemove, "w-[96px]"), label);
  } else {
    card.append(previewBtn, label);
  }
  return card;
}

function ensureDropzoneMeta(layout: HTMLElement): HTMLElement {
  let meta = layout.querySelector<HTMLElement>("[data-dropzone-meta]");
  if (!meta) {
    meta = document.createElement("div");
    meta.dataset.dropzoneMeta = "";
    layout.appendChild(meta);
  }
  return meta;
}

function ensureSplitScrollRow(layout: HTMLElement): HTMLElement {
  let scrollRow = layout.querySelector<HTMLElement>("[data-dropzone-split-scroll-row]");
  if (!scrollRow) {
    scrollRow = document.createElement("div");
    scrollRow.dataset.dropzoneSplitScrollRow = "";
    scrollRow.className = "flex min-h-[12rem] w-full min-w-0 shrink-0 items-stretch";
    layout.appendChild(scrollRow);
  }
  return scrollRow;
}

function ensureSplitLayout(
  preview: HTMLElement,
  thumbs: HTMLElement
): HTMLElement {
  let layout = preview.querySelector<HTMLElement>("[data-dropzone-split-layout]");

  if (!layout) {
    layout = document.createElement("div");
    layout.dataset.dropzoneSplitLayout = "";
    layout.className = "flex min-h-0 w-full flex-1 flex-col gap-2";
    preview.appendChild(layout);
  }

  const scrollRow = ensureSplitScrollRow(layout);
  if (thumbs.parentElement !== scrollRow) {
    scrollRow.appendChild(thumbs);
  }

  return layout;
}

function resetPreviewLayout(preview: HTMLElement, thumbs: HTMLElement): void {
  const layout = preview.querySelector("[data-dropzone-split-layout]");
  if (layout) {
    preview.insertBefore(thumbs, layout);
    layout.remove();
  }
  preview.querySelector("[data-dropzone-meta]")?.remove();
  thumbs.className = THUMB_ROW_CLASS;
}

async function renderSplitPdfPreview(
  zone: HTMLElement,
  preview: HTMLElement,
  thumbs: HTMLElement,
  file: File,
  input: HTMLInputElement
): Promise<void> {
  const layout = ensureSplitLayout(preview, thumbs);
  thumbs.className = THUMB_ROW_CLASS;

  const refreshPreview = () => {
    void updateDropzonePreview(zone, input);
  };

  prependAddCard(thumbs, input, () => {
    promptAddInputFiles(input, refreshPreview);
  });

  const removeFile = () => {
    clearInputFiles(input);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    void refreshPreview();
    syncToolButtonState();
  };

  let pageCount = 0;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await loadPdfBytes(data);
    pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      thumbs.appendChild(createPageThumbPlaceholder(i));
    }

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.28 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const src = canvas.toDataURL("image/jpeg", 0.75);
      const placeholder = thumbs.children[i];
      if (placeholder) {
        thumbs.replaceChild(
          createPageThumbCard(i, src, {
            onRemove: i === 1 ? removeFile : undefined,
            onPreview: trigger => {
              void (async () => {
                const pageLabel = t("page_label", { n: String(i) });
                try {
                  const fullSrc = await renderPdfPageThumbnail(pdf, i, 1.15);
                  openImageLightbox(fullSrc, pageLabel, trigger);
                } catch {
                  openImageLightbox(src, pageLabel, trigger);
                }
              })();
            },
          }),
          placeholder
        );
      }
    }
  } catch {
    resetPreviewLayout(preview, thumbs);
    await renderGenericFilesPreview(zone, thumbs, input, [file]);
    return;
  }

  const meta = ensureDropzoneMeta(layout);
  meta.className =
    "text-foreground flex shrink-0 flex-col items-center gap-1 px-1 text-center";
  meta.replaceChildren();

  const nameEl = document.createElement("p");
  nameEl.className = "max-w-full truncate text-sm font-medium";
  nameEl.textContent = file.name;
  nameEl.title = file.name;

  const infoEl = document.createElement("p");
  infoEl.className = "text-muted-foreground text-xs";
  infoEl.textContent = `${formatBytes(file.size)} · ${t("pages_count", { count: String(pageCount) })}`;

  meta.append(nameEl, infoEl);
  layout.appendChild(meta);
}

function syncToolButtonState(): void {
  updateMergeActionButton();
  const root = document.getElementById("tool-root") as
    | (HTMLElement & { __updateToolDisabled?: () => void })
    | null;
  root?.__updateToolDisabled?.();
}

export async function updateDropzonePreview(
  zone: HTMLElement,
  input: HTMLInputElement
): Promise<void> {
  const empty = zone.querySelector<HTMLElement>("[data-dropzone-empty]");
  const preview = zone.querySelector<HTMLElement>("[data-dropzone-preview]");
  const thumbs = zone.querySelector<HTMLElement>("[data-dropzone-thumbs]");
  if (!empty || !preview || !thumbs) return;

  const generation = ++previewGeneration;

  revokeUrls(zone);
  teardownDropzoneScrollbar(thumbs);
  thumbs.innerHTML = "";
  resetPreviewLayout(preview, thumbs);

  let files: File[] = [];

  if (shouldShowMergePreview(zone)) {
    files = getMergeFileList();
  } else {
    files = input.files ? [...input.files] : [];
  }

  if (!files.length) {
    empty.classList.remove("hidden");
    preview.classList.add("hidden");
    zone.classList.remove("has-files");
    resetDropzoneScrollbar(preview, thumbs);
    return;
  }

  empty.classList.add("hidden");
  preview.classList.remove("hidden");
  zone.classList.add("has-files");

  if (shouldShowAllPdfPages(zone, files)) {
    await renderSplitPdfPreview(zone, preview, thumbs, files[0], input);
  } else if (shouldShowMergePreview(zone)) {
    await renderMergePdfPreview(zone, preview, thumbs, input, generation);
    syncToolButtonState();
  } else {
    await renderGenericFilesPreview(zone, thumbs, input, files);
    syncToolButtonState();
  }

  try {
    syncDropzoneScrollbar(thumbs, preview);
  } catch {
    /* scrollbar is optional */
  }
}

export function bindDropzonePreview(
  zone: HTMLElement,
  input: HTMLInputElement,
  signal?: AbortSignal
): void {
  input.addEventListener(
    "change",
    () => {
      void (async () => {
        if (shouldShowMergePreview(zone) && input.files?.length) {
          await handleMergeInputChange(input);
        }
        await updateDropzonePreview(zone, input);
        syncToolButtonState();
      })();
    },
    signal ? { signal } : undefined
  );
}
