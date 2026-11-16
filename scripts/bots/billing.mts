import type { PrismaClient } from "@prisma/client";
import { PrismaMarketplaceRepository } from "../../apps/api/src/repositories/PrismaMarketplaceRepository";
import { FinderFeeService } from "../../apps/api/src/services/FinderFeeService";
import { FakeProviderBilling } from "../../apps/api/test/helpers/finderFeeFixtures";

/**
 * Fast-forwards finder-fee billing past the 72-hour dispute window, using a fake card gateway (no Stripe call), so the
 * invariant checker sees what billing would do with the run's disputed, cancelled and completed jobs. Every bot provider
 * gets a fake saved card first, so a charge that should not happen shows up as "paid" rather than "no card".
 */
export async function closeDisputeWindows(prisma: PrismaClient, providerIds: string[], hoursAhead = 80) {
  const repository = new PrismaMarketplaceRepository(prisma);
  const billing = new FakeProviderBilling();
  const service = new FinderFeeService(repository, billing, { disputeWindowHours: 72 });
  for (const providerId of providerIds) {
    const setup = await service.startCardSetup(providerId, undefined);
    await service.completeCardSetup(providerId, setup.setupSessionId);
  }
  const result = await service.processDue(new Date(Date.now() + hoursAhead * 3_600_000).toISOString());
  const statuses = await prisma.finderFeeCharge.groupBy({ by: ["status"], _count: true });
  return { ...result, charged: billing.chargeCalls.length, statuses: Object.fromEntries(statuses.map(row => [row.status, row._count])) };
}
