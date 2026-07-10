/**
 * Export empty zh blocks with English source text for translation.
 * Run: node scripts/export-missing-redact-zh.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { unified, markdownConfigDefaults } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import { rehypeRedactPostI18n } from "../src/utils/rehype-redact-post-i18n.ts";

const ROOT = join(import.meta.dirname, "..");
const POSTS_DIR = join(ROOT, "src/content/posts/redaction");
const ZH_DIR = join(ROOT, "public/locales/zh-posts");

const BLOCK_RE =
  /<(h[1-6]|p|li|th|td|blockquote)(?:\s[^>]*)?\sdata-i18n="(posts\.redact\.(\w+)\.(b\d+))"[^>]*>([\s\S]*?)<\/\1>/gi;

function stripMarkdown(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x26;/g, "&")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function htmlToText(html) {
  return stripMarkdown(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const i18nKey = match?.[1].match(/^i18nKey:\s*(\S+)/m)?.[1];
  return { i18nKey, body: match?.[2] ?? source };
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

const missing = {};

for (const file of readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"))) {
  const path = join(POSTS_DIR, file);
  const source = readFileSync(path, "utf8");
  const { i18nKey, body } = parseFrontmatter(source);
  if (!i18nKey) continue;
  const zh = JSON.parse(readFileSync(join(ZH_DIR, `${i18nKey}.json`), "utf8"));
  const { code: html } = await renderer.render(body, { fileURL: path, frontmatter: { i18nKey } });

  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html)) !== null) {
    const [, , , keyCheck, blockKey, innerHtml] = m;
    if (keyCheck !== i18nKey) continue;
    const text = htmlToText(innerHtml);
    if (!text) continue;
    if (!zh[blockKey]?.trim()) {
      if (!missing[i18nKey]) missing[i18nKey] = {};
      missing[i18nKey][blockKey] = text;
    }
  }
}

writeFileSync(join(ROOT, "scripts/missing-redact-zh.json"), `${JSON.stringify(missing, null, 2)}\n`, "utf8");
let total = 0;
for (const [k, v] of Object.entries(missing)) {
  const n = Object.keys(v).length;
  total += n;
  console.log(`${k}: ${n} missing`);
}
console.log(`total: ${total}`);
