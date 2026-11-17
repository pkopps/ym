import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import type { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { seedFinderFeeParties } from "./helpers/finderFeeFixtures";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

test(
  "Postgres: a resubmitted single-service booking with one request id returns the first booking, and a second owner cannot take the time",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const repository = new PrismaMarketplaceRepository(prisma);
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const prefix = `guard-it-${randomUUID()}`;
    const startedAt = new Date();
    const { provider, customers } = await seedFinderFeeParties(repository, [3_000, 3_000], prefix);
    try {
      // Approve the provider the way ops would; the workflow helper's credential update does not reach Postgres.
      const now = new Date().toISOString();
      for (const type of ["business-registration", "general-liability-insurance", "workers-compensation"] as const) {
        await repository.upsertProviderCredential({ id: `${prefix}-${type}`, providerId: provider.id, type, status: "verified", jurisdiction: "NJ",
          submittedAt: now, reviewedAt: now, expiresAt: "2099-12-31T00:00:00Z" });
      }
      await repository.updateProvider(provider.id, { verificationStatus: "verified", categories: ["lawn-mowing"] });
      const startIso = future(50), endIso = future(51);
      const book = (index: number, requestId?: string) => createWorkflowBooking(platform, repository as unknown as InMemoryMarketplaceRepository, customers[index]!.id, {
        providerId: provider.id, serviceAddress: customers[index]!.properties[0]!.address, servicePropertyId: customers[index]!.properties[0]!.id,
        category: "lawn-mowing", scheduledStartIso: startIso, scheduledEndIso: endIso, notes: "", totalCents: 6_000, ...(requestId ? { requestId } : {})
      });
      const requestId = `guard-${randomUUID()}`;
      const first = await book(0, requestId);
      const again = await book(0, requestId);
      assert.equal(again.id, first.id);
      // The early-arrival opt-in round-trips through Postgres (off by default).
      assert.equal((await repository.findBookingById(first.id))!.earlyArrivalOk, undefined);
      await repository.updateBooking(first.id, { earlyArrivalOk: true });
      assert.equal((await repository.findBookingById(first.id))!.earlyArrivalOk, true);
      await assert.rejects(book(1), /no longer open with this provider/);
    } finally {
      await prisma.crewMatch.deleteMany({ where: { providerId: provider.id } });
      // Bookings notify the provider, the customer and ops, and queue deliveries. Integration tests run one at a time,
      // so everything created since this test started is its own; leftovers would skew the notification worker test.
      await prisma.notificationDelivery.deleteMany({ where: { createdAt: { gte: startedAt } } });
      await prisma.appNotification.deleteMany({ where: { createdAt: { gte: startedAt } } });
      await prisma.booking.deleteMany({ where: { providerId: provider.id } });
      await prisma.customerProperty.deleteMany({ where: { customerId: { in: customers.map(row => row.id) } } });
      await prisma.customerProfile.deleteMany({ where: { userId: { in: customers.map(row => row.id) } } });
      await prisma.providerCredential.deleteMany({ where: { providerId: provider.id } });
      await prisma.providerBusinessProfile.deleteMany({ where: { userId: provider.id } });
      await prisma.userAccount.deleteMany({ where: { id: { in: [provider.id, ...customers.map(row => row.id)] } } });
      await prisma.$disconnect();
    }
  }
);
