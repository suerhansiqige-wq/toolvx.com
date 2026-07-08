import "@/scripts/legacy-polyfills";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "@/scripts/pdf-worker-shim?worker&url";
import { getAssetPath } from "@/utils/withBase";
import { isPasswordPdfError } from "@/scripts/pdf-errors";

const PDFJS_VERSION = "6.1.200";
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

let configured = false;
let localAssetsPromise: Promise<boolean> | null = null;

/** Keep a detached-safe copy of PDF bytes for retries and re-open. */
export function clonePdfBytes(data: Uint8Array): Uint8Array {
  return data.slice();
}

/** Check whether self-hosted pdf.js assets are reachable (cmaps/wasm/fonts). */
export function probeLocalPdfAssets(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (!localAssetsPromise) {
    localAssetsPromise = (async () => {
      try {
        const url = pdfjsAssetUrl("cmaps/LICENSE", false);
        const response = await fetch(url, { method: "GET", cache: "force-cache" });
        return response.ok;
      } catch {
        return false;
      }
    })();
  }
  return localAssetsPromise;
}

/** Win7 Chrome 109+ still supports WebAssembly — required for many PDF image codecs. */
export function supportsWebAssembly(): boolean {
  if (typeof WebAssembly !== "object") return false;
  try {
    return typeof WebAssembly.instantiate === "function";
  } catch {
    return false;
  }
}

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

function pdfjsAssetUrl(folder: string, useCdn: boolean): string {
  if (useCdn) return `${PDFJS_CDN}/${folder}/`;
  const rel = getAssetPath(`pdfjs/${folder}/`);
  if (typeof window === "undefined") return rel;
  return new URL(rel, window.location.origin).href;
}

function buildDocumentInit(
  data: Uint8Array,
  options?: LoadPdfOptions & { useCdn?: boolean }
): Parameters<typeof pdfjsLib.getDocument>[0] {
  const legacy = isLegacyPdfEnvironment();
  const useCdn = options?.useCdn ?? false;
  const wasmDefault = legacy ? supportsWebAssembly() : true;
  return {
    data,
    disableAutoFetch: false,
    password: options?.password,
    useWasm: options?.useWasm ?? wasmDefault,
    cMapUrl: pdfjsAssetUrl("cmaps", useCdn),
    cMapPacked: true,
    standardFontDataUrl: pdfjsAssetUrl("standard_fonts", useCdn),
    wasmUrl: pdfjsAssetUrl("wasm", useCdn),
    useSystemFonts: true,
    isOffscreenCanvasSupported: options?.isOffscreenCanvasSupported ?? !legacy,
    isImageDecoderSupported: options?.isImageDecoderSupported ?? false,
  };
}

function pdfjsWorkerSrc(): string {
  if (typeof window === "undefined") return workerUrl;
  if (isLegacyPdfEnvironment()) {
    const rel = getAssetPath("pdfjs/pdf.worker.min.mjs");
    return new URL(rel, window.location.origin).href;
  }
  return workerUrl;
}

/** Configure pdf.js worker once (legacy build + polyfilled worker for older browsers). */
export function ensurePdfWorker(): typeof pdfjsLib {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc();
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
  useCdn?: boolean;
};

/** Load a PDF from bytes with settings suited to local file previews. */
export async function loadPdfBytes(
  data: Uint8Array,
  options?: LoadPdfOptions
): Promise<PdfDocumentProxy> {
  const pdfjs = ensurePdfWorker();
  const payload = clonePdfBytes(data);
  const wasm = supportsWebAssembly();
  const localAssets = await probeLocalPdfAssets();

  const cdnFirst: LoadPdfOptions[] = [
    { ...options, useWasm: true, useCdn: true },
    { ...options, useWasm: wasm, useCdn: true },
    {
      ...options,
      useWasm: false,
      useCdn: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
    },
  ];

  const localFirst: LoadPdfOptions[] = [
    { ...options, useWasm: options?.useWasm ?? wasm },
    { ...options, useWasm: true },
    { ...options, useWasm: wasm, useCdn: true },
    { ...options, useWasm: true, useCdn: true },
    { ...options, useWasm: false },
    {
      ...options,
      useWasm: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
    },
    {
      ...options,
      useWasm: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      useCdn: true,
    },
  ];

  const attempts = localAssets ? localFirst : [...cdnFirst, ...localFirst];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await pdfjs.getDocument(buildDocumentInit(payload, attempt)).promise;
    } catch (err) {
      lastError = err;
      if (isPasswordPdfError(err)) break;
    }
  }

  throw lastError;
}

export { pdfjsLib };
