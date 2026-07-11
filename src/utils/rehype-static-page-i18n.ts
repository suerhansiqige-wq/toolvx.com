import { readFileSync } from "node:fs";

const I18N_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "th",
  "td",
  "blockquote",
  "strong",
  "em",
]);
const BLOCK_CONTAINER_TAGS = new Set(["blockquote", "li", "td", "th"]);

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function walkElements(node: HastNode, visit: (el: HastNode) => void): void {
  if (node.type === "element" && node.tagName) {
    visit(node);
    if (!BLOCK_CONTAINER_TAGS.has(node.tagName)) {
      for (const child of node.children ?? []) {
        if (child.type === "element") walkElements(child, visit);
      }
    }
  } else if (node.type === "root") {
    for (const child of node.children ?? []) {
      if (child.type === "element") walkElements(child, visit);
    }
  }
}

function readStaticPageI18nKey(file: {
  path?: string;
  history?: string[];
  data?: unknown;
}): string | undefined {
  /* Read from a dedicated frontmatter field that is distinct from the
     `i18nKey` used by rehypeRedactPostI18n, so blog posts are never
     accidentally processed by this plugin. */
  const fromAstro = (
    file.data as { astro?: { frontmatter?: { staticPageI18n?: string } } }
  )?.astro?.frontmatter?.staticPageI18n;
  if (fromAstro) return fromAstro;

  const diskPath = file.path ?? file.history?.[0];
  if (!diskPath) return undefined;

  try {
    const source = readFileSync(diskPath, "utf8");
    const match = source.match(/^staticPageI18n:\s*(\S+)/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Add data-i18n keys to static page content blocks (terms, privacy-policy,
 * about, contact, etc.) for browser auto-translation plugin recognition.
 *
 * Usage: add `staticPageI18n: terms` (or privacy, about, contact) to the
 * page's frontmatter. The plugin will assign sequential keys like
 * `pages.terms.b0`, `pages.terms.b1`, ... to every text-bearing element.
 *
 * IMPORTANT: This uses `staticPageI18n` (NOT `i18nKey`) to avoid conflicts
 * with rehypeRedactPostI18n which handles blog posts.
 */
export function rehypeStaticPageI18n() {
  return (
    tree: HastNode,
    file: { path?: string; history?: string[]; data?: unknown }
  ) => {
    const pageKey = readStaticPageI18nKey(file);
    if (!pageKey) return;

    let block = 0;
    walkElements(tree, (node) => {
      if (!node.tagName || !I18N_TAGS.has(node.tagName)) return;
      node.properties = {
        ...node.properties,
        "data-i18n": `pages.${pageKey}.b${block++}`,
      };
    });
  };
}
