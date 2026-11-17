import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** Finds the feed's provider the way the service did before: load every provider, then scan for the token. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  return new Proxy(repository, {
    get(target, property) {
      if (property === "findProviderByCalendarFeedToken") {
        return async (feedToken: string) => (await target.listProviders()).find((provider) => provider.calendarConnection.feedToken === feedToken);
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

test("Postgres calendar feed token lookup finds the same provider as scanning every provider", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `calendar-feed-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const customerId = `${prefix}-customer`;
  const provider = (name: string, feedToken?: string): ProviderProfile => ({
    ...template!, id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`, companyName: `Feed ${name}`, credentials: [],
    calendarConnection: { ...template!.calendarConnection, feedToken }
  });
  const providers = [provider("a", `${prefix}-token-a`), provider("none"), provider("b", `${prefix}-token-b`)];
  try {
    for (const row of providers) await repository.createProvider(row);
    await repository.createCustomer({ ...template!, id: customerId, email: `${customerId}@example.invalid`, role: "customer", properties: [],
      defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    const start = Date.now() + 5 * 86_400_000;
    await repository.createBooking({ id: `${prefix}-booking`, customerId, providerId: providers[2]!.id, serviceAddress: template!.address, category: "lawn-mowing",
      requestedAt: new Date().toISOString(), scheduledStartIso: new Date(start).toISOString(), scheduledEndIso: new Date(start + 3_600_000).toISOString(),
      status: "confirmed", notes: "Calendar feed integration test", totalCents: 7_500, serviceEvidence: [], interventions: [], addressChangeHistory: [] });

    const everyProvider = await repository.listProviders();
    for (const token of [`${prefix}-token-a`, `${prefix}-token-b`, `${prefix}-token-missing`, `${prefix}-token`]) {
      assert.deepEqual(await repository.findProviderByCalendarFeedToken(token), everyProvider.find((row) => row.calendarConnection.feedToken === token));
    }
    assert.equal((await repository.findProviderByCalendarFeedToken(`${prefix}-token-b`))?.id, providers[2]!.id);
    assert.equal(await repository.findProviderByCalendarFeedToken(`${prefix}-token-missing`), undefined);

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());
    const withoutStamp = (feed: string) => feed.replaceAll(/^DTSTAMP:.*$/gm, "");
    const feed = await scoped.buildCalendarFeedByToken(`${prefix}-token-b`);
    assert.match(feed, new RegExp(`${prefix}-booking`));
    assert.equal(withoutStamp(feed), withoutStamp(await wholeTable.buildCalendarFeedByToken(`${prefix}-token-b`)));
    await assert.rejects(scoped.buildCalendarFeedByToken(`${prefix}-token-missing`), /Calendar feed not found/);
    await assert.rejects(wholeTable.buildCalendarFeedByToken(`${prefix}-token-missing`), /Calendar feed not found/);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
