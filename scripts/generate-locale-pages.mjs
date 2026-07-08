import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/pages");
const locales = ["zh", "ja", "fr", "de", "es", "ko", "pt", "ru", "ar", "it"];

const pages = [
  { file: "index.astro", importPath: "../index.astro" },
  { file: "about.astro", importPath: "../about.astro" },
  { file: "404.astro", importPath: "../404.astro" },
  { file: "search.astro", importPath: "../search.astro" },
  {
    file: "posts/[...page].astro",
    importPath: "../../posts/[...page].astro",
    reexport: ["getStaticPaths"],
  },
  {
    file: "posts/[...slug]/index.astro",
    importPath: "../../posts/[...slug]/index.astro",
    reexport: ["getStaticPaths"],
  },
  { file: "tags/index.astro", importPath: "../../tags/index.astro" },
  {
    file: "tags/[tag]/[...page].astro",
    importPath: "../../tags/[tag]/[...page].astro",
    reexport: ["getStaticPaths"],
  },
  {
    file: "archives/index.astro",
    importPath: "../../archives/index.astro",
  },
  {
    file: "converter/index.astro",
    importPath: "../../converter/index.astro",
  },
];

for (const locale of locales) {
  for (const page of pages) {
    const targetDir = path.dirname(path.join(root, locale, page.file));
    const targetFile = path.join(root, locale, page.file);
    fs.mkdirSync(targetDir, { recursive: true });

    const reexports = (page.reexport ?? [])
      .map(name => `export { ${name} } from "${page.importPath}";`)
      .join("\n");

    const content = `---
import Page from "${page.importPath}";
${reexports}
---

<Page {...Astro.props} />
`;

    fs.writeFileSync(targetFile, content, "utf8");
    console.log("wrote", targetFile);
  }
}
