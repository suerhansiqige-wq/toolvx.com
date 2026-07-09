import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(root, "node_modules", "ofd.js", "lib", "ofd.umd.min.js"),
  path.join(root, "node_modules", "ofd.js", "dist", "ofd.js"),
];
const src = candidates.find(p => fs.existsSync(p));
const destDir = path.join(root, "public", "vendor");
const dest = path.join(destDir, "ofd.umd.min.js");

if (!src) {
  console.error("ofd.js UMD bundle not found — run npm install first.");
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied ofd.umd.min.js → public/vendor/");
