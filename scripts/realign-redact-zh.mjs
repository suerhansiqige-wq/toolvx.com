/**
 * Realign zh-posts/*.json block keys to match Astro markdown pipeline order.
 * Run: node scripts/realign-redact-zh.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { unified, markdownConfigDefaults } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import { rehypeRedactPostI18n } from "../src/utils/rehype-redact-post-i18n.ts";

const ROOT = join(import.meta.dirname, "..");
const POSTS_DIR = join(ROOT, "src/content/posts/redaction");
const ZH_DIR = join(ROOT, "public/locales/zh-posts");
const BACKUP_DIR = join(ROOT, "scripts/.zh-posts-backup");

const BLOCK_RE =
  /<(h[1-6]|p|li|th|td|blockquote)(?:\s[^>]*)?\sdata-i18n="(posts\.redact\.(\w+)\.(b\d+))"[^>]*>([\s\S]*?)<\/\1>/gi;

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x26;/g, "&");
}

function stripMarkdown(text) {
  return decodeEntities(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "");
}

function normalizeForMatch(text) {
  return stripMarkdown(text)
    .replace(/[—–―\u2014\u2013]/g, "-")
    .replace(/[â€™]/g, "'")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[\uFFFD?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function htmlToText(html) {
  return stripMarkdown(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { i18nKey: undefined, body: source };
  const i18nKey = match[1].match(/^i18nKey:\s*(\S+)/m)?.[1];
  return { i18nKey, body: match[2] };
}

function extractLegacyBlocks(body) {
  const blocks = [];
  const lines = body.split(/\r?\n/);
  let paragraph = [];
  let inCode = false;
  const flush = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push(text);
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !t) {
      if (!inCode && !t) flush();
      continue;
    }
    if (t.startsWith("![")) continue;
    if (t.startsWith("|")) continue;
    if (/^<!--.*-->$/.test(t)) {
      flush();
      blocks.push(t);
      continue;
    }
    if (t.startsWith("#")) {
      flush();
      blocks.push(t.replace(/^#+\s*/, ""));
      continue;
    }
    if (t.startsWith(">")) {
      flush();
      blocks.push(t.replace(/^>\s?/, ""));
      continue;
    }
    if (/^[-*]\s/.test(t) || /^\d+\.\s/.test(t)) {
      flush();
      blocks.push(t.replace(/^[-*]\s/, "").replace(/^\d+\.\s/, ""));
      continue;
    }
    paragraph.push(t);
  }
  flush();
  return blocks;
}

if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

/** Build English→Chinese map from git-original zh keyed by markdown block order. */
function buildLegacyEnZhMap() {
  const map = new Map();

  for (const file of readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"))) {
    const path = join(POSTS_DIR, file);
    const source = readFileSync(path, "utf8");
    const { i18nKey, body } = parseFrontmatter(source);
    if (!i18nKey) continue;

    const backupPath = join(BACKUP_DIR, `${i18nKey}.json`);
    const zhPath = join(ZH_DIR, `${i18nKey}.json`);
    if (!existsSync(backupPath)) copyFileSync(zhPath, backupPath);

    const oldZh = JSON.parse(readFileSync(backupPath, "utf8"));
    const mdBlocks = extractLegacyBlocks(body);
    mdBlocks.forEach((en, i) => {
      const zh = oldZh[`b${i}`];
      if (!zh?.trim() || zh.startsWith("<!--") || en.startsWith("<!--")) return;
      const key = normalizeForMatch(en);
      if (!map.has(key)) map.set(key, zh);
    });
  }
  return map;
}

function lookupZh(text, map) {
  const key = normalizeForMatch(text);
  if (!key) return "";
  return map.get(key) ?? "";
}

const processor = unified({
  remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
  rehypePlugins: [rehypeCallouts, rehypeRedactPostI18n],
  gfm: true,
  smartypants: false,
});

const renderer = await processor.createRenderer({
  gfm: true,
  smartypants: false,
  syntaxHighlight: false,
  ...markdownConfigDefaults,
});

const enToZh = buildLegacyEnZhMap();

for (const file of readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"))) {
  const path = join(POSTS_DIR, file);
  const source = readFileSync(path, "utf8");
  const { i18nKey, body } = parseFrontmatter(source);
  if (!i18nKey) continue;

  const { code: html } = await renderer.render(body, {
    fileURL: path,
    frontmatter: { i18nKey },
  });

  const out = {};
  let reused = 0;
  let missing = 0;
  const missingList = [];

  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html)) !== null) {
    const [, , , keyCheck, blockKey, innerHtml] = m;
    if (keyCheck !== i18nKey) continue;
    const text = htmlToText(innerHtml);
    const zh = lookupZh(text, enToZh);
    if (zh?.trim()) {
      out[blockKey] = zh;
      reused++;
    } else {
      out[blockKey] = "";
      missing++;
      if (text) missingList.push({ blockKey, text });
    }
  }

  writeFileSync(join(ZH_DIR, `${i18nKey}.json`), `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`${i18nKey}: ${Object.keys(out).length} blocks, reused=${reused}, missing=${missing}`);
  if (missingList.length) {
    missingList.slice(0, 6).forEach(x => console.log(`  ${x.blockKey}: ${x.text.slice(0, 72)}`));
    if (missingList.length > 6) console.log(`  ... +${missingList.length - 6} more`);
  }
}
