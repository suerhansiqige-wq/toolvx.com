/**
 * pdf.js worker entry: polyfills first, then load the legacy worker bundle.
 * Vite bundles this file as the worker script URL passed to pdf.js.
 */
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve: (value: unknown) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
