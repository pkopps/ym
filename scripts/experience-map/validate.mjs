import fs from "node:fs";
import path from "node:path";
import { appRoot, buildInventory, discover, root } from "./inventory.mjs";

export function validate(inventory = buildInventory()) {
  const errors = [];
  const warnings = [];
  const ids = new Set(inventory.nodes.map((node) => node.id));
  const discovered = discover();
  for (const node of [...discovered.webNodes, ...discovered.mobileNodes]) {
    if (!ids.has(node.id)) errors.push(`Missing discovered screen: ${node.id}`);
  }
  for (const edge of inventory.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`Broken connection ${edge.from} -> ${edge.to}`);
    if (!edge.action || !edge.role || !edge.evidence || !edge.source) errors.push(`Incomplete connection ${edge.id}`);
    if (!fs.existsSync(path.join(root, edge.source))) errors.push(`Missing evidence source ${edge.source}`);
    if (edge.from.startsWith("mobile:") && edge.to.startsWith("mobile:") && edge.from.split(":")[1] !== edge.to.split(":")[1]) errors.push(`Unproven cross-app link ${edge.id}`);
  }
  for (const node of inventory.nodes) {
    if (!node.capture) warnings.push(`Screenshot missing: ${node.id}`);
    else if (!fs.existsSync(path.join(appRoot, "public", node.capture.thumbnail))) warnings.push(`Thumbnail missing: ${node.id}`);
  }
  if (inventory.counts.webRoutes !== discovered.webNodes.length || inventory.counts.mobileScreens !== discovered.mobileNodes.length) errors.push("Discovery count mismatch");
  return { errors, warnings, counts: inventory.counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const result = validate();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
