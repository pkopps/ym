import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

function createController() {
  return new MarketplaceController(
    new MarketplacePlatformService(new InMemoryMarketplaceRepository(), new DataEngineeringLogger())
  );
}

test("marketplace controller routes ops payout preview and review escalation before auth guards run", () => {
  const controller = createController();

  assert.equal(
    controller.canHandle({
      method: "GET",
      path: "/api/payouts/ops/preview",
      body: undefined,
      query: new URLSearchParams(),
      headers: {}
    }),
    true
  );

  assert.equal(
    controller.canHandle({
      method: "POST",
      path: "/api/providers/reviews/escalate",
      body: undefined,
      query: new URLSearchParams(),
      headers: {}
    }),
    true
  );
});

test("controller handler paths are declared in canHandle gates", () => {
  const controllerFiles = [
    "AuthController.ts",
    "DocsController.ts",
    "MarketplaceController.ts",
    "ObservabilityController.ts",
    "SupportController.ts"
  ];

  const drift: Array<{ file: string; missing: string[] }> = [];
  for (const file of controllerFiles) {
    const source = readFileSync(new URL(`../src/controllers/${file}`, import.meta.url), "utf8");
    const canHandleStart = source.indexOf("public canHandle");
    const handleStart = source.indexOf("public async handle");

    assert.ok(canHandleStart >= 0, `${file} must expose canHandle`);
    assert.ok(handleStart >= 0, `${file} must expose handle`);

    const canHandleSource = source.slice(canHandleStart, handleStart);
    const handleSource = source.slice(handleStart);
    const declaredPaths = extractControllerPaths(canHandleSource);
    const handlerPaths = extractControllerPaths(handleSource);
    const missing = [...new Set(handlerPaths)].filter((path) => !declaredPaths.includes(path));

    if (missing.length > 0) {
      drift.push({ file, missing });
    }
  }

  assert.deepEqual(drift, []);
});

function extractControllerPaths(source: string): string[] {
  return [...source.matchAll(/context\.path === "([^"]+)"|context\.path === '([^']+)'/g)].map(
    (match) => match[1] ?? match[2] ?? ""
  );
}
