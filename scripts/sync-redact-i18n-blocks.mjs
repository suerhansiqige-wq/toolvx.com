/**
 * Sync redact post i18n blocks.
 *
 * Preferred workflow (keeps zh-posts aligned with Astro markdown pipeline):
 *   1. node scripts/realign-redact-zh.mjs
 *   2. node scripts/export-missing-redact-zh.mjs  (if any missing)
 *   3. Fill scripts/filled-redact-zh.json and run merge-filled-redact-zh.mjs
 *
 * Legacy markdown-only extractor (deprecated):
 *   node scripts/sync-redact-i18n-blocks.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const POSTS_DIR = join(ROOT, "src/content/posts/redaction");
const ZH_BLOCKS_DIR = join(ROOT, "public/locales/zh-posts");
const ZH_PATH = join(ROOT, "src/locales/zh.json");

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { i18nKey: undefined, body: source };
  const fm = match[1];
  const i18nKey = fm.match(/^i18nKey:\s*(\S+)/m)?.[1];
  return { i18nKey, body: match[2] };
}

function extractBlocks(body) {
  const blocks = [];
  const lines = body.split(/\r?\n/);
  let paragraph = [];
  let inCode = false;

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    blocks.push(text);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (t.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !t) {
      if (!inCode && !t) flushParagraph();
      continue;
    }
    if (t.startsWith("![")) continue;
    if (t.startsWith("|")) continue;

    if (t.startsWith("#")) {
      flushParagraph();
      blocks.push(t.replace(/^#+\s*/, ""));
      continue;
    }
    if (t.startsWith(">")) {
      flushParagraph();
      blocks.push(t.replace(/^>\s?/, ""));
      continue;
    }
    if (/^[-*]\s/.test(t) || /^\d+\.\s/.test(t)) {
      flushParagraph();
      blocks.push(t.replace(/^[-*]\s/, "").replace(/^\d+\.\s/, ""));
      continue;
    }

    paragraph.push(t);
  }
  flushParagraph();
  return blocks;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

if (!existsSync(ZH_BLOCKS_DIR)) mkdirSync(ZH_BLOCKS_DIR, { recursive: true });

const zh = loadJson(ZH_PATH);
if (!zh.posts?.redact) zh.posts = { redact: {} };

for (const file of readdirSync(POSTS_DIR)) {
  if (!file.endsWith(".md")) continue;
  const source = readFileSync(join(POSTS_DIR, file), "utf8");
  const { i18nKey, body } = parseFrontmatter(source);
  if (!i18nKey) continue;

  const blocks = extractBlocks(body);
  const existingPath = join(ZH_BLOCKS_DIR, `${i18nKey}.json`);
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(existingPath, "utf8"));
  } catch {
    /* new file */
  }

  const zhBlocks = { ...existing };
  blocks.forEach((_text, index) => {
    const key = `b${index}`;
    if (!zhBlocks[key]) zhBlocks[key] = existing[key] ?? "";
  });

  saveJson(existingPath, zhBlocks);
  console.log(`${i18nKey}: ${blocks.length} blocks → zh-posts/${i18nKey}.json`);
}

console.log("Done. Add Chinese text to public/locales/zh-posts/*.json");
