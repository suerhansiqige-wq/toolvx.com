import "@/scripts/legacy-polyfills";
import { getAssetPath } from "@/utils/withBase";
import { isPasswordPdfError } from "@/scripts/pdf-errors";
import type { PdfDocumentProxy, PdfJsModule } from "@/scripts/pdf-engine-types";

export type { PdfDocumentProxy, PdfPageProxy } from "@/scripts/pdf-engine-types";

/** UA-based legacy flag (independent of main-thread polyfills). */
const LEGACY_UA_FLAG = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Windows NT 6\.[01]/.test(ua)) return true;
  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/);
  if (chrome && Number(chrome[1]) < 110) return true;
  const firefox = ua.match(/Firefox\/(\d+)/);
  if (firefox && Number(firefox[1]) < 110) return true;
  return false;
})();

const PDFJS_V6_VERSION = "6.1.200";
const PDFJS_V3_VERSION = "3.11.174";

let engineVersion: 3 | 6 | null = null;
let pdfjsModule: PdfJsModule | null = null;
let initPromise: Promise<PdfJsModule> | null = null;
let localAssetsPromise: Promise<boolean> | null = null;

/** Keep a detached-safe copy of PDF bytes for retries and re-open. */
export function clonePdfBytes(data: Uint8Array): Uint8Array {
  return data.slice();
}

function usesPdfjsV3(): boolean {
  return isLegacyPdfEnvironment();
}

function pdfjsAssetRoot(useCdn: boolean): string {
  const v3 = usesPdfjsV3();
  if (useCdn) {
    return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v3 ? PDFJS_V3_VERSION : PDFJS_V6_VERSION}`;
  }
  return getAssetPath(v3 ? "pdfjs-v3" : "pdfjs");
}

function pdfjsAssetUrl(folder: string, useCdn: boolean): string {
  if (useCdn) return `${pdfjsAssetRoot(true)}/${folder}/`;
  const rel = `${pdfjsAssetRoot(false)}/${folder}/`;
  if (typeof window === "undefined") return rel;
  return new URL(rel, window.location.origin).href;
}

function pdfjsFileUrl(file: string, useCdn: boolean): string {
  if (useCdn) return `${pdfjsAssetRoot(true)}/${file}`;
  const rel = `${pdfjsAssetRoot(false)}/${file}`;
  if (typeof window === "undefined") return rel;
  return new URL(rel, window.location.origin).href;
}

function pdfjsWorkerSrcV6(): string {
  const rel = getAssetPath("pdfjs/pdf-worker-bootstrap.mjs");
  if (typeof window === "undefined") return rel;
  return new URL(rel, window.location.origin).href;
}

function pdfjsWorkerSrcV3(): string {
  const rel = getAssetPath("pdfjs-v3/pdf.worker.min.js");
  if (typeof window === "undefined") return rel;
  return new URL(rel, window.location.origin).href;
}

async function loadPdfjsModule(): Promise<PdfJsModule> {
  if (usesPdfjsV3()) {
    const mod = await import("pdfjs-dist-v3/legacy/build/pdf.js");
    const pdfjs =
      (mod as { default?: PdfJsModule }).default ?? (mod as unknown as PdfJsModule);
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrcV3();
    engineVersion = 3;
    return pdfjs;
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrcV6();
  engineVersion = 6;
  return pdfjs as unknown as PdfJsModule;
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
  if (LEGACY_UA_FLAG) return true;
  if (typeof Promise.withResolvers !== "function") return true;
  return false;
}

export function getPdfjsEngineVersion(): 3 | 6 {
  return engineVersion ?? (usesPdfjsV3() ? 3 : 6);
}

/** Check whether self-hosted pdf.js assets are reachable (cmaps/wasm/fonts). */
export function probeLocalPdfAssets(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (!localAssetsPromise) {
    localAssetsPromise = (async () => {
      try {
        const v3 = usesPdfjsV3();
        const urls = v3
          ? [
              pdfjsAssetUrl("cmaps/LICENSE", false),
              pdfjsFileUrl("pdf.worker.min.js", false),
            ]
          : [
              pdfjsAssetUrl("cmaps/LICENSE", false),
              pdfjsAssetUrl("wasm/openjpeg.wasm", false),
              pdfjsAssetUrl("wasm/jbig2.wasm", false),
              pdfjsFileUrl("pdf-worker-bootstrap.mjs", false),
            ];
        const results = await Promise.all(
          urls.map(url =>
            fetch(url, { method: "GET", cache: "force-cache" }).then(r => r.ok)
          )
        );
        return results.every(Boolean);
      } catch {
        return false;
      }
    })();
  }
  return localAssetsPromise;
}

/** Configure pdf.js worker once (v3 on Win7, v6 elsewhere). */
export async function ensurePdfWorker(): Promise<PdfJsModule> {
  if (pdfjsModule) return pdfjsModule;
  if (!initPromise) initPromise = loadPdfjsModule();
  pdfjsModule = await initPromise;
  return pdfjsModule;
}

type LoadPdfOptions = {
  password?: string;
  useWasm?: boolean;
  isOffscreenCanvasSupported?: boolean;
  isImageDecoderSupported?: boolean;
  useCdn?: boolean;
};

function buildDocumentInit(
  data: Uint8Array,
  options?: LoadPdfOptions & { useCdn?: boolean }
): Record<string, unknown> {
  const legacy = isLegacyPdfEnvironment();
  const useCdn = options?.useCdn ?? false;
  const v3 = usesPdfjsV3();

  if (v3) {
    return {
      data,
      password: options?.password,
      cMapUrl: pdfjsAssetUrl("cmaps", useCdn),
      cMapPacked: true,
      standardFontDataUrl: pdfjsAssetUrl("standard_fonts", useCdn),
      useSystemFonts: true,
      disableFontFace: false,
      disableCreateImageBitmap: legacy,
    };
  }

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
    isOffscreenCanvasSupported: options?.isOffscreenCanvasSupported ?? false,
    isImageDecoderSupported: options?.isImageDecoderSupported ?? false,
    disableCreateImageBitmap: legacy,
  };
}

/** Load a PDF from bytes with settings suited to local file previews. */
export async function loadPdfBytes(
  data: Uint8Array,
  options?: LoadPdfOptions
): Promise<PdfDocumentProxy> {
  const pdfjs = await ensurePdfWorker();
  const payload = clonePdfBytes(data);
  const wasm = supportsWebAssembly();
  const localAssets = await probeLocalPdfAssets();
  const legacy = isLegacyPdfEnvironment();
  const v3 = usesPdfjsV3();

  if (v3) {
    const attempts: LoadPdfOptions[] = [
      { ...options, useCdn: false },
      { ...options, useCdn: true },
    ];
    const cdnOnly: LoadPdfOptions[] = [{ ...options, useCdn: true }];
    const strategies = localAssets ? attempts : cdnOnly;
    let lastError: unknown;
    for (const attempt of strategies) {
      try {
        return await pdfjs.getDocument(buildDocumentInit(payload, attempt)).promise;
      } catch (err) {
        lastError = err;
        if (isPasswordPdfError(err)) break;
      }
    }
    throw lastError;
  }

  const noWasmLocal: LoadPdfOptions = {
    ...options,
    useWasm: false,
    useCdn: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  };
  const wasmLocal: LoadPdfOptions = {
    ...options,
    useWasm: true,
    useCdn: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  };
  const noWasmCdn: LoadPdfOptions = {
    ...options,
    useWasm: false,
    useCdn: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  };
  const wasmCdn: LoadPdfOptions = {
    ...options,
    useWasm: true,
    useCdn: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  };

  const preferred: LoadPdfOptions[] = legacy
    ? [noWasmLocal, wasmLocal, noWasmCdn, wasmCdn, { ...options, useWasm: true, useCdn: false }]
    : [wasmLocal, wasmCdn, { ...options, useWasm: true, useCdn: false }, { ...options, useWasm: true, useCdn: true }, { ...options, useWasm: wasm, useCdn: true }, noWasmLocal, noWasmCdn];

  const cdnOnly: LoadPdfOptions[] = legacy
    ? [noWasmCdn, wasmCdn, { ...options, useWasm: true, useCdn: true }]
    : [wasmCdn, { ...options, useWasm: true, useCdn: true }, noWasmCdn];

  const attempts = localAssets ? preferred : cdnOnly;

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

/** @deprecated Use ensurePdfWorker() — kept for type-only imports during migration. */
export type pdfjsLib = PdfJsModule;
