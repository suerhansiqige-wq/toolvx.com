import "@/scripts/legacy-polyfills";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "@/scripts/pdf-worker-shim?worker&url";

const PDFJS_VERSION = "6.1.200";
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

let configured = false;

/** Win7 / Chrome < 110 and other browsers missing newer PDF.js APIs. */
export function isLegacyPdfEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof Promise.withResolvers !== "function") return true;

  const ua = navigator.userAgent;
  if (/Windows NT 6\.[01]/.test(ua)) return true;

  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/);
  if (chrome && Number(chrome[1]) < 110) return true;

  return false;
}

function buildDocumentInit(
  data: Uint8Array,
  options?: LoadPdfOptions
): Parameters<typeof pdfjsLib.getDocument>[0] {
  const legacy = isLegacyPdfEnvironment();
  return {
    data,
    disableAutoFetch: true,
    password: options?.password,
    useWasm: options?.useWasm ?? !legacy,
    cMapUrl: `${PDFJS_CDN}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
    wasmUrl: `${PDFJS_CDN}/wasm/`,
    useSystemFonts: true,
    isOffscreenCanvasSupported: options?.isOffscreenCanvasSupported ?? !legacy,
    isImageDecoderSupported: options?.isImageDecoderSupported ?? !legacy,
  };
}

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
  isOffscreenCanvasSupported?: boolean;
  isImageDecoderSupported?: boolean;
};

/** Load a PDF from bytes with settings suited to local file previews. */
export async function loadPdfBytes(
  data: Uint8Array,
  options?: LoadPdfOptions
): Promise<PdfDocumentProxy> {
  const pdfjs = ensurePdfWorker();
  const attempts: LoadPdfOptions[] = [
    options ?? {},
    { ...options, useWasm: false },
    {
      ...options,
      useWasm: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
    },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await pdfjs.getDocument(buildDocumentInit(data, attempt)).promise;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export { pdfjsLib };
