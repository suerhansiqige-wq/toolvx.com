import "@/scripts/legacy-polyfills";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "@/scripts/pdf-worker-shim?worker&url";

let configured = false;

/** Configure pdf.js worker once (legacy build + polyfilled worker for older browsers). */
export function ensurePdfWorker(): typeof pdfjsLib {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    configured = true;
  }
  return pdfjsLib;
}

export type PdfDocumentProxy = Awaited<
  ReturnType<typeof pdfjsLib.getDocument>
>["promise"] extends Promise<infer T>
  ? T
  : never;

type LoadPdfOptions = {
  password?: string;
  useWasm?: boolean;
};

/** Load a PDF from bytes with settings suited to local file previews. */
export async function loadPdfBytes(
  data: Uint8Array,
  options?: LoadPdfOptions
): Promise<PdfDocumentProxy> {
  const pdfjs = ensurePdfWorker();
  const base = {
    data,
    disableAutoFetch: true,
    password: options?.password,
    useWasm: options?.useWasm ?? true,
  };

  try {
    return await pdfjs.getDocument(base).promise;
  } catch (err) {
    if (base.useWasm !== false) {
      return pdfjs.getDocument({ ...base, useWasm: false }).promise;
    }
    throw err;
  }
}

export { pdfjsLib };
