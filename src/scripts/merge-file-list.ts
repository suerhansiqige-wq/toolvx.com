export type MergeFileEntry = {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
};

let mergeEntries: MergeFileEntry[] = [];
let nextMergeId = 0;

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function dedupeKey(name: string, size: number): string {
  return `${name}\0${size}`;
}

async function fileToEntry(file: File): Promise<MergeFileEntry> {
  return {
    id: `merge-${++nextMergeId}`,
    name: file.name,
    size: file.size,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export function getMergeEntries(): MergeFileEntry[] {
  return mergeEntries;
}

export function getMergeFileList(): File[] {
  return mergeEntries.map(
    entry =>
      new File([entry.bytes.slice()], entry.name, {
        type: "application/pdf",
      })
  );
}

export function clearMergeFiles(): void {
  mergeEntries = [];
}

export function clearNativeInput(input: HTMLInputElement): void {
  input.value = "";
}

/** Replace entire merge queue (first upload / drop on empty zone). */
export async function replaceMergeFiles(files: File[]): Promise<number> {
  const entries: MergeFileEntry[] = [];
  for (const file of files) {
    if (!isPdfFile(file)) continue;
    entries.push(await fileToEntry(file));
  }
  mergeEntries = entries;
  notifyMergeFilesUpdated();
  return mergeEntries.length;
}

/** Append new PDFs, skipping same name+size already in queue. */
export async function appendMergeFiles(files: File[]): Promise<number> {
  const before = mergeEntries.length;
  const seen = new Set(mergeEntries.map(e => dedupeKey(e.name, e.size)));
  for (const file of files) {
    if (!isPdfFile(file)) continue;
    const key = dedupeKey(file.name, file.size);
    if (seen.has(key)) continue;
    seen.add(key);
    mergeEntries.push(await fileToEntry(file));
  }
  if (mergeEntries.length !== before) {
    notifyMergeFilesUpdated();
  }
  return mergeEntries.length;
}

export function removeMergeFileById(id: string): void {
  mergeEntries = mergeEntries.filter(entry => entry.id !== id);
  notifyMergeFilesUpdated();
}

/** Enable/disable merge action button from the file queue (does not depend on tool-page init). */
export function updateMergeActionButton(): void {
  const root = document.getElementById("tool-root");
  if (root?.dataset.toolAction !== "merge") return;

  const btn = document.getElementById("tool-action-btn") as HTMLButtonElement | null;
  if (!btn || btn.dataset.loading === "true") return;

  btn.disabled = getMergeFileCount() < 2;
}

export function notifyMergeFilesUpdated(): void {
  updateMergeActionButton();
  document.dispatchEvent(new CustomEvent("merge-files-changed"));
}

export function promptAddMergeFiles(onAdded: () => void): void {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".pdf,application/pdf";
  picker.multiple = true;
  picker.className = "hidden";
  picker.addEventListener("change", () => {
    void (async () => {
      if (picker.files?.length) {
        await appendMergeFiles([...picker.files]);
        onAdded();
      }
      picker.remove();
    })();
  });
  document.body.appendChild(picker);
  picker.click();
}

/** Handle native file-input change for merge tool. */
export async function handleMergeInputChange(
  input: HTMLInputElement
): Promise<void> {
  if (!input.files?.length) return;
  const picked = [...input.files];
  clearNativeInput(input);

  if (mergeEntries.length === 0) {
    await replaceMergeFiles(picked);
  } else {
    await appendMergeFiles(picked);
  }
}

export function getMergeFileCount(): number {
  return mergeEntries.length;
}

export function getMergeEntryBytes(): { name: string; bytes: Uint8Array }[] {
  return mergeEntries.map(entry => ({
    name: entry.name,
    bytes: entry.bytes.slice(),
  }));
}
