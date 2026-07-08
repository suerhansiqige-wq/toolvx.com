import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "dist", "pagefind");
const dest = join(root, "public", "pagefind");

if (!existsSync(src)) {
  console.error("Missing dist/pagefind — run astro build and pagefind first.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(root, "public"), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied dist/pagefind → public/pagefind");
