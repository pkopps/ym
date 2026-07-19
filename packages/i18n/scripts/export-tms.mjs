import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
const localesDir = path.join(packageRoot, "locales");
const outDir = path.join(packageRoot, "tms-export");
const sourceMessages = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));

fs.mkdirSync(outDir, { recursive: true });

const rows = Object.entries(sourceMessages)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, source]) => ({
    key,
    source,
    description: inferDescription(key),
    surface: key.split(".")[0],
    maxLength: null,
    screenshotHint: null
  }));

fs.writeFileSync(path.join(outDir, "yardmatch-source-en.json"), `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Exported ${rows.length} source strings to ${path.relative(process.cwd(), outDir)}.`);

function inferDescription(key) {
  if (key.startsWith("api.")) return "API-authored message returned to web or mobile clients.";
  if (key.startsWith("metadata.")) return "SEO metadata, Open Graph, or social preview copy.";
  if (key.startsWith("mobile.")) return "Native mobile UI copy.";
  if (key.startsWith("customer.search.")) return "Public customer search and matching flow copy.";
  if (key.startsWith("service.")) return "Shared service category label.";
  return "YardMatch product UI copy.";
}
