import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgRoot = path.join(root, "node_modules", "pdfjs-dist");
const dest = path.join(root, "public", "pdfjs");
const assetDirs = ["cmaps", "standard_fonts", "wasm"];
const workerFiles = [
  { from: "legacy/build/pdf.worker.min.mjs", to: "pdf.worker.min.mjs" },
];

if (!fs.existsSync(pkgRoot)) {
  console.error("pdfjs-dist not found — run npm install first.");
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

for (const dir of assetDirs) {
  const from = path.join(pkgRoot, dir);
  const to = path.join(dest, dir);
  if (!fs.existsSync(from)) {
    console.warn(`skip missing pdfjs asset dir: ${dir}`);
    continue;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

console.log(`Copied pdfjs ${assetDirs.join(", ")} → public/pdfjs/`);

for (const { from: relFrom, to } of workerFiles) {
  const from = path.join(pkgRoot, relFrom);
  const destFile = path.join(dest, to);
  if (!fs.existsSync(from)) {
    console.warn(`skip missing pdfjs worker: ${relFrom}`);
    continue;
  }
  fs.copyFileSync(from, destFile);
  console.log(`Copied pdfjs worker → public/pdfjs/${to}`);
}

const bootstrap = `/**
 * Self-hosted pdf.js worker bootstrap (Win7 / Chrome 109+).
 * Polyfills run in the worker before loading the legacy worker bundle.
 */
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", {
    value: function at(index) {
      const len = this.length;
      const relative = index >= 0 ? index : len + index;
      if (relative < 0 || relative >= len) return undefined;
      return this[relative];
    },
    writable: true,
    configurable: true,
  });
}

import "./pdf.worker.min.mjs";
`;

fs.writeFileSync(path.join(dest, "pdf-worker-bootstrap.mjs"), bootstrap, "utf8");
console.log("Wrote public/pdfjs/pdf-worker-bootstrap.mjs");

const v3PkgRoot = path.join(root, "node_modules", "pdfjs-dist-v3");
const v3Dest = path.join(root, "public", "pdfjs-v3");
const v3AssetDirs = ["cmaps", "standard_fonts"];
const v3WorkerFiles = [
  { from: "legacy/build/pdf.worker.min.js", to: "pdf.worker.min.js" },
  { from: "legacy/build/pdf.min.js", to: "pdf.min.js" },
];

if (!fs.existsSync(v3PkgRoot)) {
  console.error("pdfjs-dist-v3 not found — run npm install first.");
  process.exit(1);
}

fs.mkdirSync(v3Dest, { recursive: true });

for (const dir of v3AssetDirs) {
  const from = path.join(v3PkgRoot, dir);
  const to = path.join(v3Dest, dir);
  if (!fs.existsSync(from)) {
    console.warn(`skip missing pdfjs-v3 asset dir: ${dir}`);
    continue;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

for (const { from: relFrom, to } of v3WorkerFiles) {
  const from = path.join(v3PkgRoot, relFrom);
  const destFile = path.join(v3Dest, to);
  if (!fs.existsSync(from)) {
    console.warn(`skip missing pdfjs-v3 file: ${relFrom}`);
    continue;
  }
  fs.copyFileSync(from, destFile);
}

console.log(`Copied pdfjs-v3 ${v3AssetDirs.join(", ")} + worker → public/pdfjs-v3/`);
