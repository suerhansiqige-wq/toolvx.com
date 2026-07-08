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
