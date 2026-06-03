import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

function createMockResponse() {
  let statusCode = 200;
  let payload = "";

  return {
    setHeader() {},
    writeHead(nextStatusCode: number) {
      statusCode = nextStatusCode;
    },
    end(chunk?: string) {
      payload = chunk ?? "";
    },
    readJson() {
      return JSON.parse(payload);
    },
    getStatusCode() {
      return statusCode;
    }
  };
}

test("place search returns deterministic fallback suggestions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new MarketplaceController(platform);
  const response = createMockResponse();

  await controller.handle(
    {
      method: "GET",
      path: "/api/places/search",
      body: undefined,
      query: new URLSearchParams({ query: "Brooklyn" }),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const payload = response.readJson();
  assert.ok(payload.suggestions.length > 0);
  assert.equal(payload.suggestions[0].address.city, "Brooklyn");
});

test("place search returns no results for tiny queries", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new MarketplaceController(platform);
  const response = createMockResponse();

  await controller.handle(
    {
      method: "GET",
      path: "/api/places/search",
      body: undefined,
      query: new URLSearchParams({ query: "a" }),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const payload = response.readJson();
  assert.equal(payload.suggestions.length, 0);
});
