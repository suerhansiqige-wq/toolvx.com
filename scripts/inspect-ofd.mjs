import JSZip from "jszip";
import fs from "fs";

const path = process.argv[2];
const buf = fs.readFileSync(path);
const zip = await JSZip.loadAsync(buf);
const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir).sort();
console.log("file:", path, "entries:", paths.length);
for (const p of paths) console.log(p);

const docRoot = (await zip.file("OFD.xml")?.async("string"))?.match(/<(?:[\w-]+:)?DocRoot[^>]*>([^<]+)</i)?.[1]?.trim();
console.log("\nDocRoot:", docRoot);
if (docRoot) {
  const doc = await zip.file(docRoot)?.async("string");
  console.log("\n=== Document.xml ===\n", doc?.slice(0, 2000));
}

for (const cp of paths.filter((x) => /Content\.xml$/i.test(x) || /Page\.xml$/i.test(x))) {
  const xml = await zip.file(cp).async("string");
  console.log(`\n=== ${cp} (${xml.length} chars) ===\n`, xml.slice(0, 6000));
}

for (const rp of paths.filter((x) => /DocumentRes\.xml$/i.test(x) || /PublicRes\.xml$/i.test(x))) {
  const xml = await zip.file(rp).async("string");
  console.log(`\n=== ${rp} ===\n`, xml.slice(0, 4000));
}

const sig = paths.find((x) => /Signature\.xml$/i.test(x));
if (sig) {
  const xml = await zip.file(sig).async("string");
  console.log(`\n=== ${sig} ===\n`, xml);
}
