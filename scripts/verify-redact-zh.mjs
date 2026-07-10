import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unified, markdownConfigDefaults } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import { rehypeRedactPostI18n } from "../src/utils/rehype-redact-post-i18n.ts";

const i18nKey = "freelancerSecurity";
const path = join("src/content/posts/redaction/freelancer-invoice-contract-redaction.md");
const source = readFileSync(path, "utf8");
const body = source.replace(/^---[\s\S]*?---\r?\n/, "");
const zh = JSON.parse(readFileSync(`public/locales/zh-posts/${i18nKey}.json`, "utf8"));

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
const { code } = await renderer.render(body, { fileURL: path, frontmatter: { i18nKey } });

const BLOCK_RE =
  /<(h[1-6]|p|li|th|td|blockquote)(?:\s[^>]*)?\sdata-i18n="posts\.redact\.[^"]+\.(b\d+)"[^>]*>([\s\S]*?)<\/\1>/gi;

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x26;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

let m;
while ((m = BLOCK_RE.exec(code)) !== null) {
  const key = m[2];
  const n = Number(key.slice(1));
  if (n < 93 || n > 110) continue;
  const en = htmlToText(m[3]);
  const z = zh[key] ?? "";
  console.log(`${key} EN: ${en.slice(0, 70)}`);
  console.log(`    ZH: ${(z || "(empty)").slice(0, 70)}`);
  console.log();
}
