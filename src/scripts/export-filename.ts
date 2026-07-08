/** Strip the last extension segment (e.g. "report.pdf" → "report"). */
export function basenameWithoutExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || "document";
}

/** Replace or append an extension on a filename. */
export function replaceExtension(name: string, newExt: string): string {
  const ext = newExt.startsWith(".") ? newExt : `.${newExt}`;
  return `${basenameWithoutExt(name)}${ext}`;
}

/** Single-file PDF output: keep the uploaded filename unchanged. */
export function originalPdfFilename(file: File): string {
  return file.name;
}

/** ZIP export derived from a PDF upload (report.pdf → report.zip). */
export function zipFilenameFromPdf(file: File): string {
  return replaceExtension(file.name, "zip");
}

/** ZIP of multiple compressed PDFs. */
export function zipFilenameCompressedBatch(files: File[]): string {
  if (files.length === 1) return zipFilenameFromPdf(files[0]);
  return `${basenameWithoutExt(files[0]?.name ?? "documents")}-compressed.zip`;
}

/** Merged + compressed PDF output name. */
export function mergedCompressedFilename(files: File[]): string {
  return `${basenameWithoutExt(files[0]?.name ?? "document")}-merged-compressed.pdf`;
}

/** PDF export derived from an image upload (photo.jpg → photo.pdf). */
export function pdfFilenameFromImage(file: File): string {
  return replaceExtension(file.name, "pdf");
}

/** Merge output: use the first uploaded file's name. */
export function mergeOutputFilename(files: File[]): string {
  return files[0]?.name ?? "document.pdf";
}

/** Two-part split: original name for part 1, " (2)" suffix for part 2. */
export function splitPartFilenames(file: File): [string, string] {
  const ext = file.name.match(/(\.[^./\\]+)$/)?.[1] ?? ".pdf";
  const base = basenameWithoutExt(file.name);
  return [`${base}${ext}`, `${base} (2)${ext}`];
}

/** Page file inside a ZIP (keeps original basename + page index). */
export function zipPageFilename(sourceName: string, pageIndex: number): string {
  return `${basenameWithoutExt(sourceName)}-page-${pageIndex}.pdf`;
}

/** Image file inside a ZIP (keeps original basename + page index). */
export function zipImageFilename(
  sourceName: string,
  pageIndex: number,
  ext: "jpg" | "png"
): string {
  return `${basenameWithoutExt(sourceName)}-page-${pageIndex}.${ext}`;
}

/** Single or multi-page JPG export filename. */
export function pageImageFilename(
  sourceName: string,
  pageIndex: number,
  totalPages: number,
  ext: "jpg" | "png" = "jpg"
): string {
  if (totalPages === 1) return replaceExtension(sourceName, ext);
  return zipImageFilename(sourceName, pageIndex, ext);
}
