import { resetDropzoneScrollbar } from "@/scripts/dropzone-scrollbar";

/** Run callback on first paint and after every Astro client navigation. */
export function onToolPageReady(init: () => void): void {
  init();
  document.addEventListener("astro:page-load", init);
}

function resetDropzoneOnNavigate(root: HTMLElement): void {
  const zone = root.querySelector<HTMLElement>("[data-dropzone]");
  const input = document.getElementById("file-input") as HTMLInputElement | null;

  void import("@/scripts/merge-file-list").then(({ clearMergeFiles }) => {
    clearMergeFiles();
  });

  if (input) {
    void import("@/scripts/input-file-list").then(({ clearInputFiles }) => {
      clearInputFiles(input);
    });
  }

  if (!zone) return;

  const empty = zone.querySelector<HTMLElement>("[data-dropzone-empty]");
  const preview = zone.querySelector<HTMLElement>("[data-dropzone-preview]");
  const thumbs = zone.querySelector<HTMLElement>("[data-dropzone-thumbs]");
  if (empty && preview) {
    empty.classList.remove("hidden");
    preview.classList.add("hidden");
    zone.classList.remove("has-files");
  }
  if (thumbs) thumbs.innerHTML = "";
  zone.querySelector("[data-dropzone-split-layout]")?.remove();
  zone.querySelector("[data-dropzone-meta]")?.remove();
  if (preview && thumbs) resetDropzoneScrollbar(preview, thumbs);
}

/** Bind drop zones on the current tool page (re-binds after each client navigation). */
export function bindDropZones(): void {
  const root = document.getElementById("tool-root");
  if (!root) return;

  const rootEl = root as HTMLElement & { __dropzoneAbort?: AbortController };
  rootEl.__dropzoneAbort?.abort();

  const ac = new AbortController();
  rootEl.__dropzoneAbort = ac;

  resetDropzoneOnNavigate(root);

  root.querySelectorAll<HTMLElement>("[data-dropzone]").forEach(zone => {
    const inputId = zone.dataset.inputId ?? "file-input";
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    const isMergeZone = () =>
      zone.closest("#tool-root")?.getAttribute("data-tool-action") === "merge";

    zone.addEventListener(
      "click",
      event => {
        const target = event.target as HTMLElement;
        if (target === input || target.closest("a, button")) return;

        if (zone.classList.contains("has-files")) {
          return;
        }

        input.click();
      },
      { signal: ac.signal }
    );

    zone.addEventListener("dragover", event => event.preventDefault(), {
      signal: ac.signal,
    });

    zone.addEventListener(
      "drop",
      event => {
        event.preventDefault();
        const files = event.dataTransfer?.files;
        if (!files?.length) return;

        if (isMergeZone()) {
          void import("@/scripts/merge-file-list").then(
            async ({
              appendMergeFiles,
              replaceMergeFiles,
              getMergeEntries,
              clearNativeInput,
            }) => {
              const list = [...files];
              if (getMergeEntries().length === 0) {
                await replaceMergeFiles(list);
              } else {
                await appendMergeFiles(list);
              }
              clearNativeInput(input);
              void import("@/scripts/dropzone-preview").then(
                ({ updateDropzonePreview }) => {
                  void updateDropzonePreview(zone, input);
                }
              );
              void import("@/scripts/merge-file-list").then(
                ({ updateMergeActionButton }) => {
                  updateMergeActionButton();
                }
              );
            }
          );
          return;
        }

        void import("@/scripts/input-file-list").then(
          async ({ appendInputFiles, replaceInputFiles, getInputFileList }) => {
            const list = [...files];
            if (getInputFileList(input).length === 0) {
              replaceInputFiles(input, list);
            } else if (input.multiple) {
              appendInputFiles(input, list);
            } else {
              replaceInputFiles(input, list);
            }
            input.dispatchEvent(new Event("change", { bubbles: true }));
            void import("@/scripts/dropzone-preview").then(
              ({ updateDropzonePreview }) => {
                void updateDropzonePreview(zone, input);
              }
            );
          }
        );
      },
      { signal: ac.signal }
    );

    void import("@/scripts/dropzone-preview").then(({ bindDropzonePreview }) => {
      bindDropzonePreview(zone, input, ac.signal);
    });
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
