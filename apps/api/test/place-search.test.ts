import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { isPlaceSuggestionSafeToAutoSelect, type PlaceSuggestion } from "@yardmatch/contracts";
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
  assert.equal(payload.searchMode, "local-dataset");
  assert.ok(["medium", "low"].includes(payload.searchConfidence));
  assert.ok(payload.suggestions.length > 0);
  assert.equal(payload.suggestions[0].address.city, "Brooklyn");
  assert.ok(payload.suggestions[0].matchReason);
});

test("place search matches state names and postal queries against fallback suggestions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new MarketplaceController(platform);

  const stateResponse = createMockResponse();
  await controller.handle(
    {
      method: "GET",
      path: "/api/places/search",
      body: undefined,
      query: new URLSearchParams({ query: "Franklin Tennessee" }),
      headers: {}
    },
    stateResponse as never
  );

  assert.equal(stateResponse.getStatusCode(), 200);
  const statePayload = stateResponse.readJson();
  assert.ok(statePayload.suggestions.length > 0);
  assert.equal(statePayload.suggestions[0].address.city, "Franklin");
  assert.equal(statePayload.suggestions[0].address.state, "TN");
  assert.ok(statePayload.suggestions[0].matchReason);

  const postalResponse = createMockResponse();
  await controller.handle(
    {
      method: "GET",
      path: "/api/places/search",
      body: undefined,
      query: new URLSearchParams({ query: "11201" }),
      headers: {}
    },
    postalResponse as never
  );

  assert.equal(postalResponse.getStatusCode(), 200);
  const postalPayload = postalResponse.readJson();
  assert.ok(postalPayload.suggestions.length > 0);
  assert.equal(postalPayload.suggestions[0].address.city, "Brooklyn");
  assert.equal(postalPayload.suggestions[0].matchQuality, "high");
  assert.match(postalPayload.suggestions[0].matchReason, /zip/i);
});

test("place search supports practical area aliases in the fallback dataset", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new MarketplaceController(platform);
  const response = createMockResponse();

  await controller.handle(
    {
      method: "GET",
      path: "/api/places/search",
      body: undefined,
      query: new URLSearchParams({ query: "bklyn" }),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const payload = response.readJson();
  assert.ok(payload.suggestions.length > 0);
  assert.equal(payload.suggestions[0].address.city, "Brooklyn");
  assert.equal(payload.suggestions[0].matchQuality, "high");
  assert.match(payload.suggestions[0].matchReason, /alias/i);
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
  assert.equal(payload.searchMode, "none");
  assert.equal(payload.searchConfidence, "low");
  assert.equal(payload.suggestions.length, 0);
});

test("place suggestion auto-select safety only trusts strong matches", () => {
  const googleSuggestion: PlaceSuggestion = {
    id: "google-brooklyn",
    label: "Brooklyn, NY",
    source: "google-geocoding",
    address: {
      line1: "Brooklyn, NY",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      country: "US",
      point: { latitude: 40.695, longitude: -73.989 }
    }
  };
  const localHighSuggestion: PlaceSuggestion = {
    ...googleSuggestion,
    id: "local-high-brooklyn",
    source: "local-dataset",
    matchQuality: "high",
    matchReason: "Direct ZIP match to a known service area."
  };
  const localMediumSuggestion: PlaceSuggestion = {
    ...googleSuggestion,
    id: "local-medium-brooklyn",
    source: "local-dataset",
    matchQuality: "medium",
    matchReason: "Closest local service-area guess."
  };

  assert.equal(isPlaceSuggestionSafeToAutoSelect(undefined), false);
  assert.equal(isPlaceSuggestionSafeToAutoSelect(googleSuggestion), true);
  assert.equal(isPlaceSuggestionSafeToAutoSelect(localHighSuggestion), true);
  assert.equal(isPlaceSuggestionSafeToAutoSelect(localMediumSuggestion), false);
});
