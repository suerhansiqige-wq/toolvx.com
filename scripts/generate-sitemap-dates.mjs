import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsRoot = path.join(root, "src/content/posts");
const outFile = path.join(root, "src/data/sitemap-post-dates.json");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match?.[1] ?? "";
}

function parseDate(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

const dates = {};

if (fs.existsSync(postsRoot)) {
  for (const file of walk(postsRoot)) {
    const fm = readFrontmatter(file);
    const lastmod = parseDate(fm, "modDatetime") || parseDate(fm, "pubDatetime");
    if (!lastmod) continue;
    const rel = path
      .relative(postsRoot, file)
      .replace(/\\/g, "/")
      .replace(/\.md$/, "");
    dates[`/posts/${rel}/`] = lastmod;
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(dates, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, outFile)} (${Object.keys(dates).length} posts)`);
