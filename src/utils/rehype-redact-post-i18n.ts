import { readFileSync } from "node:fs";

const I18N_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "th", "td", "blockquote"]);
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

function readI18nKey(file: {
  path?: string;
  history?: string[];
  data?: unknown;
}): string | undefined {
  const fromAstro = (file.data as { astro?: { frontmatter?: { i18nKey?: string } } })
    ?.astro?.frontmatter?.i18nKey;
  if (fromAstro) return fromAstro;

  const diskPath = file.path ?? file.history?.[0];
  if (!diskPath) return undefined;

  try {
    const source = readFileSync(diskPath, "utf8");
    const match = source.match(/^i18nKey:\s*(\S+)/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/** Add data-i18n keys to redact guide post blocks for client-side locale switching. */
export function rehypeRedactPostI18n() {
  return (tree: HastNode, file: { path?: string; history?: string[]; data?: unknown }) => {
    const i18nKey = readI18nKey(file);
    if (!i18nKey) return;

    let block = 0;
    walkElements(tree, node => {
      if (!node.tagName || !I18N_TAGS.has(node.tagName)) return;
      node.properties = {
        ...node.properties,
        "data-i18n": `posts.redact.${i18nKey}.b${block++}`,
      };
    });
  };
}
