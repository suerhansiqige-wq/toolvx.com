export function getInputFileList(input: HTMLInputElement): File[] {
  return input.files?.length ? [...input.files] : [];
}

export function setInputFileList(input: HTMLInputElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const file of files) {
    dt.items.add(file);
  }
  input.files = dt.files;
}

export function clearInputFiles(input: HTMLInputElement): void {
  input.value = "";
  setInputFileList(input, []);
}

export function removeInputFileAt(input: HTMLInputElement, index: number): void {
  const files = getInputFileList(input);
  files.splice(index, 1);
  setInputFileList(input, files);
}

export function removeInputFile(
  input: HTMLInputElement,
  file: File
): void {
  const files = getInputFileList(input);
  const index = files.findIndex(
    f => f === file || (f.name === file.name && f.size === file.size)
  );
  if (index >= 0) removeInputFileAt(input, index);
}

export function appendInputFiles(
  input: HTMLInputElement,
  newFiles: File[]
): void {
  if (!newFiles.length) return;
  if (input.multiple) {
    setInputFileList(input, [...getInputFileList(input), ...newFiles]);
  } else {
    setInputFileList(input, [newFiles[0]]);
  }
}

export function replaceInputFiles(
  input: HTMLInputElement,
  files: File[]
): void {
  if (input.multiple) {
    setInputFileList(input, files);
  } else {
    setInputFileList(input, files.length ? [files[0]] : []);
  }
}

export function notifyInputFilesUpdated(): void {
  document.dispatchEvent(new CustomEvent("input-files-changed"));
}

export function promptAddInputFiles(
  input: HTMLInputElement,
  onAdded: () => void
): void {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = input.accept;
  picker.multiple = input.multiple;
  picker.className = "hidden";
  picker.addEventListener("change", () => {
    void (async () => {
      if (picker.files?.length) {
        const picked = [...picker.files];
        if (getInputFileList(input).length === 0) {
          replaceInputFiles(input, picked);
        } else {
          appendInputFiles(input, picked);
        }
        input.dispatchEvent(new Event("change", { bubbles: true }));
        notifyInputFilesUpdated();
        onAdded();
      }
      picker.remove();
    })();
  });
  document.body.appendChild(picker);
  picker.click();
}
