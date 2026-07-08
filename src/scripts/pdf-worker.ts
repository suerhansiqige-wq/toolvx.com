import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

let configured = false;

/** Configure pdf.js worker once (legacy build for older browsers). */
export function ensurePdfWorker(): typeof pdfjsLib {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    configured = true;
  }
  return pdfjsLib;
}

export type PdfDocumentProxy = Awaited<
  ReturnType<typeof pdfjsLib.getDocument>
>["promise"] extends Promise<infer T>
  ? T
  : never;

/** Load a PDF from bytes with settings suited to local file previews. */
export async function loadPdfBytes(
  data: Uint8Array,
  options?: { password?: string }
): Promise<PdfDocumentProxy> {
  const pdfjs = ensurePdfWorker();
  return pdfjs.getDocument({
    data,
    disableAutoFetch: true,
    password: options?.password,
  }).promise;
}

export { pdfjsLib };
