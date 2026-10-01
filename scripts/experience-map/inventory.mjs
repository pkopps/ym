import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curatedEdges, states } from "./definitions.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const appRoot = path.join(root, "apps/experience-map");
const pageRoot = path.join(root, "apps/web/src/app");
const appNames = ["customer", "provider", "crew"];
const humanize = (value) => value.replace(/[-_/]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function collectFiles(directory, wanted) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(full, wanted) : wanted(full) ? [full] : [];
  });
}

export function discover() {
  const webNodes = collectFiles(pageRoot, (file) => file.endsWith("/page.tsx")).map((file) => {
    const url = "/" + path.relative(pageRoot, path.dirname(file)).split(path.sep).filter((part) => part !== "(site)").join("/");
    const normalized = url === "/" ? url : url.replace(/\/$/, "");
    const role = normalized.startsWith("/ops") ? "ops" : normalized.startsWith("/provider/") ? "provider" : normalized.startsWith("/crew/") ? "crew" : normalized.startsWith("/customer/") ? "customer" : "public";
    return { id: `web:${normalized}`, label: normalized === "/" ? "Home" : humanize(normalized.split("/").filter(Boolean).at(-1)), kind: "web", role, url: normalized, source: path.relative(root, file) };
  }).sort((a, b) => a.url.localeCompare(b.url));
  const mobileNodes = appNames.flatMap((app) => {
    const navigator = path.join(root, `apps/${app}-mobile/src/navigation/${humanize(app)}AppNavigator.tsx`);
    const source = fs.readFileSync(navigator, "utf8");
    const tabBlock = source.match(/const tabs:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
    const tabs = [...tabBlock.matchAll(/key:\s*"([^"]+)"/g)].map((match) => match[1]);
    return ["auth", ...tabs].map((tab) => ({ id: `mobile:${app}:${tab}`, label: `${humanize(app)} · ${humanize(tab)}`, kind: "mobile", role: app, app, screen: tab, source: path.relative(root, tab === "auth" ? path.join(root, `apps/${app}-mobile/src/auth/${humanize(app)}AuthScreen.tsx`) : navigator) }));
  });
  return { webNodes, mobileNodes };
}

function literalRouteEdges(webNodes) {
  const routes = new Set(webNodes.map((node) => node.url));
  const edges = [];
  for (const node of webNodes) {
    const source = fs.readFileSync(path.join(root, node.source), "utf8");
    for (const match of source.matchAll(/(?:href\s*:\s*|href\s*=\s*|href\s*\(\s*)["'`]([^"'`]+)["'`]/g)) {
      const target = match[1].split(/[?#]/)[0];
      if (!target.startsWith("/") || target === node.url || !routes.has(target)) continue;
      edges.push({ from: node.id, to: `web:${target}`, action: `Open ${humanize(target.split("/").at(-1))}`, role: node.role, state: "", evidence: "code-inferred", source: node.source });
    }
  }
  return edges;
}

function homeFooterEdges(webNodes) {
  const sourcePath = "apps/web/src/components/SiteFooter.tsx";
  const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
  const links = source.split("const footerColumns")[1]?.split("const socialLinks")[0] ?? "";
  const routes = new Set(webNodes.map((node) => node.url));
  return [...links.matchAll(/href:\s*"(\/[^"]*)"/g)].map((match) => match[1]).filter((url) => url !== "/" && routes.has(url)).map((url) => ({ from: "web:/", to: `web:${url}`, action: `Open ${humanize(url.split("/").at(-1))} from footer`, role: "public", state: "", evidence: "code-inferred", source: sourcePath }));
}

export function buildInventory() {
  const { webNodes, mobileNodes } = discover();
  const screenshotManifestPath = path.join(appRoot, "captures/manifest.json");
  const screenshots = fs.existsSync(screenshotManifestPath) ? JSON.parse(fs.readFileSync(screenshotManifestPath, "utf8")) : {};
  const nodes = [...webNodes, ...mobileNodes, ...states].map((node) => ({ ...node, capture: screenshots[node.id] ?? null }));
  const seen = new Set();
  const edges = [...curatedEdges, ...literalRouteEdges(webNodes), ...homeFooterEdges(webNodes)].filter((edge) => {
    const key = `${edge.from}|${edge.to}|${edge.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((edge, index) => ({ ...edge, id: `edge-${index + 1}` }));
  return { generatedAt: new Date().toISOString(), counts: { webRoutes: webNodes.length, mobileScreens: mobileNodes.length, states: states.length, edges: edges.length }, nodes, edges };
}
