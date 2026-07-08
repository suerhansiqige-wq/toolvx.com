/** Win7-safe file input classes (avoid Tailwind `hidden` / display:none). */
export const FILE_INPUT_LEGACY_CLASS = "file-input-native-hidden";
export const FILE_INPUT_OVERLAY_CLASS = "file-input-overlay";

export function prepareLegacyFileInput(input: HTMLInputElement): void {
  if (input.classList.contains("hidden")) {
    input.classList.remove("hidden");
  }
  if (!input.classList.contains(FILE_INPUT_OVERLAY_CLASS)) {
    input.classList.add(FILE_INPUT_LEGACY_CLASS);
  }
}

/** Open the native file picker (works on Win7 when input is not display:none). */
export function openFileInput(input: HTMLInputElement): void {
  prepareLegacyFileInput(input);
  input.value = "";
  input.click();
}

/** Temporary picker for “add more files” flows. */
export function createLegacyFilePicker(options: {
  accept: string;
  multiple: boolean;
  onChange: (files: File[]) => void;
}): HTMLInputElement {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = options.accept;
  picker.multiple = options.multiple;
  picker.className = FILE_INPUT_LEGACY_CLASS;
  picker.addEventListener("change", () => {
    const files = picker.files?.length ? [...picker.files] : [];
    if (files.length) options.onChange(files);
    picker.remove();
  });
  document.body.appendChild(picker);
  return picker;
}
