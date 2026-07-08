import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const headers = `# Cloudflare Pages — pdf.js static assets
/pdfjs/*.mjs
  Content-Type: text/javascript; charset=utf-8

/pdfjs/wasm/*
  Content-Type: application/wasm

/pdfjs/cmaps/*
  Content-Type: application/octet-stream

/pdfjs/standard_fonts/*
  Content-Type: application/octet-stream
`;

if (!fs.existsSync(dist)) {
  console.warn("skip _headers — dist/ not found (run astro build first)");
  process.exit(0);
}

fs.writeFileSync(path.join(dist, "_headers"), headers, "utf8");
console.log("Wrote dist/_headers");
