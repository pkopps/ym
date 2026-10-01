import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { ProviderPricingService } from "../src/services/ProviderPricingService";
const databaseUrl = process.env.TEST_DATABASE_URL;
test("Postgres persists service prices and minimum audit history across instances, serializes edits and rolls back invalid batches", { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const repository = new PrismaMarketplaceRepository(prisma);
  const service = new ProviderPricingService(repository);
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const prefix = `pricing-${randomUUID()}`;
  const provider = { ...template!, id: `${prefix}-provider`, email: `${prefix}-provider@example.invalid`, credentials: [], servicePrices: [] };
  const adminId = `${prefix}-admin`;
  const zip = "09998";
  try {
    await repository.createProvider(provider);
    await repository.createOpsUser({ ...template!, id: adminId, email: `${prefix}-admin@example.invalid`, role: "ops", internalScope: "admin" });
    const input = { postalCode: zip, category: "lawn-mowing" as const, minimumStartingPriceCents: 3500, reason: "Integration test minimum" };
    await service.setMinimum(adminId, input);
    await service.setMinimum(adminId, { ...input, category: "seasonal-cleanup" });
    const second = new ProviderPricingService(new PrismaMarketplaceRepository(prisma));
    await Promise.all([service.save(provider.id, [{ postalCode: zip, category: "lawn-mowing", startingPriceCents: 4500 }]), second.save(provider.id, [{ postalCode: zip, category: "seasonal-cleanup", startingPriceCents: 6500 }])]);
    assert.equal((await repository.findProviderById(provider.id))!.servicePrices!.length, 2);
    assert.equal((await second.overview(provider.id, zip)).prices.find(row => row.category === "lawn-mowing")!.savedStartingPriceCents, 4500);
    await assert.rejects(second.save(provider.id, [{ postalCode: zip, category: "lawn-mowing", startingPriceCents: 5000 }, { postalCode: zip, category: "seasonal-cleanup", startingPriceCents: 1 }]), /at least/);
    assert.equal((await second.overview(provider.id, zip)).prices[0]!.savedStartingPriceCents, 4500);
    await Promise.all([service.setMinimum(adminId, { ...input, minimumStartingPriceCents: 4000 }), second.setMinimum(adminId, { ...input, minimumStartingPriceCents: 5500 })]);
    const record = (await second.minimums(zip)).find(row => row.category === "lawn-mowing")!;
    assert.equal(record.history.length, 3);
    assert.equal(record.history[2]!.previousMinimumCents, record.history[1]!.minimumStartingPriceCents);
    assert.equal((await second.overview(provider.id, zip)).prices[0]!.effectiveStartingPriceCents, Math.max(4500, record.minimumStartingPriceCents));
    await assert.rejects(prisma.zipServiceMinimum.create({ data: { postalCode: "bad", category: "lawn-mowing", minimumStartingPriceCents: 3500 } }));
    await assert.rejects(prisma.zipServiceMinimum.update({ where: { postalCode_category: { postalCode: zip, category: "lawn-mowing" } }, data: { minimumStartingPriceCents: 0 } }));
  } finally {
    await prisma.zipServiceMinimum.deleteMany({ where: { postalCode: zip } });
    await prisma.userAccount.deleteMany({ where: { id: { in: [provider.id, adminId] } } });
    await prisma.$disconnect();
  }
});
