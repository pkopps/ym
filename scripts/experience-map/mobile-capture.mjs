import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import sharp from "sharp";
import { appRoot, root } from "./inventory.mjs";

const fullDir = path.join(appRoot, "public/captures/full");
const manifestPath = path.join(appRoot, "captures/manifest.json");
const fixturePath = path.join(fullDir, "mobile-fixtures.json");
let simulator = process.env.EXPERIENCE_MAP_SIMULATOR_ID;
const tabs = {
  customer: [["dashboard", "Home"], ["book", "Book"], ["bookings", "Visits"], ["account", "Account"]],
  provider: [["dashboard", "Home"], ["schedule", "Schedule"], ["crew", "Staffing"], ["account", "Business"]],
  crew: [["today", "Today"], ["schedule", "Schedule"], ["availability", "Availability"], ["account", "Account"]]
};
const selectedApps = new Set((process.env.EXPERIENCE_MAP_APPS ?? "customer,crew").split(",").map((app) => app.trim()).filter(Boolean));
for (const app of selectedApps) if (!(app in tabs)) throw new Error(`Unknown mobile app: ${app}`);
const placeholders = { customer: "customer@example.com", provider: "owner@greenstride.example", crew: "crew.member@example.com" };
const command = (name, args, options = {}) => spawnSync(name, args, { cwd: root, encoding: "utf8", ...options });
const available = (name) => command("which", [name]).status === 0;
const yaml = (value) => JSON.stringify(value);
const walk = (directory) => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : [];

async function main() {
  if (!available("maestro") || !available("xcrun")) { console.warn("Maestro or Xcode CLI unavailable; iPhone screenshots remain pending."); return; }
  const inventory = command("xcrun", ["simctl", "list", "devices", "available", "--json"]);
  if (inventory.status !== 0) { console.warn("Cannot read iPhone simulator inventory; screenshots remain pending."); return; }
  const devices = Object.values(JSON.parse(inventory.stdout).devices).flat().filter((device) => device.name.startsWith("iPhone"));
  const selected = devices.find((device) => device.udid === simulator) ?? devices.find((device) => device.state === "Booted") ?? devices.find((device) => device.name === "iPhone 16") ?? devices[0];
  if (!selected) { console.warn("No available iPhone simulator; screenshots remain pending."); return; }
  simulator = selected.udid;
  if (selected.state !== "Booted") {
    console.log(`Booting ${selected.name}…`);
    const boot = command("xcrun", ["simctl", "boot", simulator]);
    if (boot.status !== 0) { console.warn(`Could not boot ${selected.name}: ${boot.stderr}`); return; }
    command("xcrun", ["simctl", "bootstatus", simulator, "-b"], { stdio: "inherit", timeout: 120000 });
  }
  if (!fs.existsSync(fixturePath)) { console.warn("Synthetic mobile credentials unavailable; run web capture first."); return; }
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  const api = await fetch("http://localhost:4001/api/docs/openapi.json").catch(() => null);
  let apiProcess;
  if (!api?.ok) {
    apiProcess = spawn("npm", ["run", "dev:api"], { cwd: root, env: { ...process.env, DATABASE_URL: "", PORT: "4001" }, stdio: "ignore", detached: true });
    let ready = false;
    for (let index = 0; index < 60; index++) { await new Promise((resolve) => setTimeout(resolve, 1000)); try { ready = (await fetch("http://localhost:4001/api/docs/openapi.json")).ok; if (ready) break; } catch { /* starting */ } }
    if (!ready) throw new Error("Local API failed to start for native capture.");
  }
  try {
    for (const [app, appTabs] of Object.entries(tabs)) {
      if (!selectedApps.has(app)) continue;
      const appId = `com.yardmatch.${app}`;
      const installed = command("xcrun", ["simctl", "get_app_container", simulator, appId, "app"]);
      if (installed.status !== 0 || process.env.EXPERIENCE_MAP_REBUILD_MOBILE === "1") {
        console.log(`Building ${app} iPhone app for simulator…`);
        const build = command("npm", ["--workspace", `@yardmatch/${app}-mobile`, "run", "ios", "--", "--device", simulator, "--configuration", "Release", "--no-bundler"], { stdio: "inherit", timeout: 15 * 60 * 1000, env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: "http://localhost:4001" } });
        if (build.status !== 0) { console.warn(`${app} iOS build failed; screenshots remain pending.`); continue; }
      }
      const fixture = fixtures[app];
      const flow = [
        `appId: ${appId}`, "---", "- launchApp:", "    clearState: true", "    clearKeychain: true", "- waitForAnimationToEnd",
        `- assertVisible: ${yaml(placeholders[app])}`,
        `- takeScreenshot: mobile-${app}-auth`,
        `- tapOn: ${yaml(placeholders[app])}`, `- inputText: ${yaml(fixture.email)}`,
        `- tapOn: ${yaml("Password")}`, `- inputText: ${yaml(fixture.password)}`,
        "- tapOn:", "    point: \"50%,16%\"",
        "- tapOn:", `    text: ${yaml("Log in")}`, "    index: 1",
        `- assertVisible: ${yaml(appTabs[0][1])}`,
        "- waitForAnimationToEnd",
        `- takeScreenshot: mobile-${app}-${appTabs[0][0]}`
      ];
      for (const [screen, label] of appTabs.slice(1)) flow.push(`- tapOn: ${yaml(`.*, ${label}`)}`, "- waitForAnimationToEnd", `- takeScreenshot: mobile-${app}-${screen}`);
      const flowPath = path.join(fullDir, `maestro-${app}.yaml`);
      fs.writeFileSync(flowPath, flow.join("\n") + "\n");
      const output = path.join(fullDir, `maestro-output-${app}-${Date.now()}`);
      fs.mkdirSync(output, { recursive: true });
      const result = command("maestro", ["--device", simulator, "test", "--test-output-dir", output, flowPath], { stdio: "inherit", timeout: 5 * 60 * 1000 });
      if (result.status !== 0) console.warn(`${app} Maestro flow incomplete; captured screens will still be imported.`);
      const captures = walk(output).filter((candidate) => candidate.endsWith(".png") && path.basename(path.dirname(candidate)) === "takeScreenshot").sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
      // A failed flow can leave the app on the iOS home screen immediately after its last capture.
      const trustworthyCaptures = result.status === 0 ? captures : captures.slice(0, -1);
      for (const file of trustworthyCaptures) {
        const id = path.basename(file, ".png").replace(/^mobile-/, "mobile:").replace(/-(auth|dashboard|book|bookings|account|schedule|crew|today|availability)$/, ":$1");
        if (!id.startsWith(`mobile:${app}:`)) continue;
        const name = `mobile-${app}-${id.split(":").at(-1)}`;
        const full = `captures/full/${name}.png`;
        const thumbnail = `captures/thumbnails/${name}.webp`;
        fs.copyFileSync(file, path.join(appRoot, "public", full));
        await sharp(file).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(path.join(appRoot, "public", thumbnail));
        manifest[id] = { thumbnail, full, status: "captured", capturedAt: new Date().toISOString() };
        console.log(`captured ${id}`);
      }
      const latest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
      for (const [id, capture] of Object.entries(manifest)) if (id.startsWith(`mobile:${app}:`)) latest[id] = capture;
      fs.writeFileSync(manifestPath, JSON.stringify(latest, null, 2) + "\n");
    }
  } finally { if (apiProcess?.pid) { try { process.kill(-apiProcess.pid, "SIGTERM"); } catch { /* already stopped */ } } }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
