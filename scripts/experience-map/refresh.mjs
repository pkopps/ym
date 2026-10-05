import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { appRoot, buildInventory } from "./inventory.mjs";
import { validate } from "./validate.mjs";

const skipCapture = process.argv.includes("--no-capture");
if (!skipCapture) {
  const web = spawnSync(process.execPath, ["--import", "tsx", "scripts/experience-map/web-capture.mts"], { stdio: "inherit", env: process.env });
  if (web.status !== 0) console.warn(`Web capture incomplete (exit ${web.status}). Existing thumbnails and placeholders remain visible.`);
  const quote = spawnSync("npx", ["playwright", "test", "--config=playwright.config.ts", "tests/web/customer-booking-golden-path.spec.ts", "-g", "homepage search carries signup intent"], { stdio: "inherit", env: process.env });
  if (quote.status !== 0) console.warn(`Quote capture test incomplete (exit ${quote.status}). The quote card remains a placeholder if no earlier test artifact exists.`);
  const mobile = spawnSync(process.execPath, ["scripts/experience-map/mobile-capture.mjs"], { stdio: "inherit", env: process.env });
  if (mobile.status !== 0) console.warn(`iPhone capture incomplete (exit ${mobile.status}). Missing screens remain labeled.`);
}
const manifestPath = path.join(appRoot, "captures/manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const verifiedArtifacts = {
  "web:/": "honest-launch-home-desktop.png",
  "customer:top-matches": "customer-top-matches-desktop.png",
  "customer:directory": "customer-directory-desktop.png",
  "customer:quote": "customer-quote-desktop.png",
  "customer:history": "customer-history-mobile.png",
  "customer:dispute": "complaint-form-desktop.png",
  "crew:assignment": "crew-assignment-accepted-desktop.png",
  "ops:case": "complaint-review-desktop.png",
  "customer:recovery": "booking-replacement-consent-desktop.png",
  "provider:approved": "provider-onboarding-verified-desktop.png"
};
for (const [id, file] of Object.entries(verifiedArtifacts)) {
  const source = path.resolve("reports/agent-checkpoints/engineer/latest", file);
  if (!fs.existsSync(source)) continue;
  const name = id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const full = `captures/full/${name}.png`;
  const thumbnail = `captures/thumbnails/${name}.webp`;
  fs.mkdirSync(path.join(appRoot, "public/captures/full"), { recursive: true });
  fs.mkdirSync(path.join(appRoot, "public/captures/thumbnails"), { recursive: true });
  fs.copyFileSync(source, path.join(appRoot, "public", full));
  await sharp(source).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(path.join(appRoot, "public", thumbnail));
  manifest[id] = { thumbnail, full, status: "test-artifact", capturedAt: new Date().toISOString(), source: `tests/web → ${file}` };
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
const inventory = buildInventory();
const result = validate(inventory);
fs.mkdirSync(path.join(appRoot, "data"), { recursive: true });
fs.writeFileSync(path.join(appRoot, "data/inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
console.log(`Experience map: ${inventory.counts.webRoutes} web routes, ${inventory.counts.mobileScreens} mobile screens, ${inventory.counts.states} states, ${inventory.counts.edges} connections.`);
console.log(`${result.errors.length} broken connections; ${result.warnings.length} screenshots pending.`);
if (result.errors.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
