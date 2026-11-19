// N9 from reports/explorer/summary-2026-11-17.md: providers in launch ZIPs could not set any price.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { defaultServiceStartingPrices, launchServiceZipCodes, launchZipMinimumsActor, type ServiceCategory } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { ProviderPricingService } from "../src/services/ProviderPricingService";

test("every launch ZIP has a minimum for every service, equal to the platform starting price", async () => {
  const repository = new InMemoryMarketplaceRepository();
  for (const zip of launchServiceZipCodes) {
    const rows = await repository.listZipServiceMinimums(zip);
    assert.equal(rows.length, Object.keys(defaultServiceStartingPrices).length, zip);
    for (const row of rows) {
      assert.equal(row.minimumStartingPriceCents, defaultServiceStartingPrices[row.category]);
      assert.equal(row.history[0]?.changedBy, launchZipMinimumsActor);
    }
  }
  assert.deepEqual(await repository.listZipServiceMinimums("08006"), [], "ZIPs outside launch stay unpriced until ops sets them");
});

test("a provider in a launch ZIP can set prices, and an ops admin can still raise a minimum with the launch default kept in history", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const service = new ProviderPricingService(repository);
  const provider = (await repository.listProviders())[0]!;
  const category = provider.categories[0] as ServiceCategory;
  const overview = await service.overview(provider.id, "08758");
  assert.ok(overview.prices.every(row => row.minimumStartingPriceCents !== undefined));
  const saved = await service.save(provider.id, [{ postalCode: "08758", category, startingPriceCents: defaultServiceStartingPrices[category] + 1500 }]);
  assert.equal(saved.prices.find(row => row.category === category)?.savedStartingPriceCents, defaultServiceStartingPrices[category] + 1500);

  const admin = await platform.registerUser({ fullName: "Price Admin", email: `${randomUUID()}@example.invalid`, phone: "5550100", role: "ops", internalScope: "admin", address: provider.address });
  const raised = await service.setMinimum(admin.id, { postalCode: "08758", category, minimumStartingPriceCents: defaultServiceStartingPrices[category] + 500, reason: "Local market review" });
  assert.equal(raised.history.length, 2);
  assert.equal(raised.history[0]!.changedBy, launchZipMinimumsActor);
  assert.equal(raised.history[1]!.previousMinimumCents, defaultServiceStartingPrices[category]);
});
