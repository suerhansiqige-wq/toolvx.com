/**
 * Merge filled-redact-zh.json translations into public/locales/zh-posts/*.json
 * Run: node scripts/merge-filled-redact-zh.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ZH_DIR = join(ROOT, "public/locales/zh-posts");
const FILLED = join(ROOT, "scripts/filled-redact-zh.json");

const filled = JSON.parse(readFileSync(FILLED, "utf8"));
let merged = 0;

for (const [i18nKey, blocks] of Object.entries(filled)) {
  const path = join(ZH_DIR, `${i18nKey}.json`);
  const zh = JSON.parse(readFileSync(path, "utf8"));
  for (const [blockKey, text] of Object.entries(blocks)) {
    if (!text?.trim()) continue;
    zh[blockKey] = text;
    merged++;
  }
  writeFileSync(path, `${JSON.stringify(zh, null, 2)}\n`, "utf8");
  const empty = Object.entries(zh).filter(([, v]) => !v?.trim()).length;
  console.log(`${i18nKey}: merged ${Object.keys(blocks).length}, empty remaining=${empty}`);
}

console.log(`total merged: ${merged}`);
