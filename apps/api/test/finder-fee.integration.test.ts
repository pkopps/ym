import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { FinderFeeRelationshipConflictError } from "../src/repositories/finderFeeRecords";
import { FinderFeeService, finderFeeIdempotencyKey } from "../src/services/FinderFeeService";
import { createCompletedBooking, FakeProviderBilling, hoursAfter, seedFinderFeeParties } from "./helpers/finderFeeFixtures";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const COMPLETED_AT = "2026-11-02T15:00:00.000Z";

test(
  "Postgres enforces one finder fee per relationship and one waiver per provider across API instances, and retries idempotently",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const prefix = `ff-it-${randomUUID()}`;
    const repository = new PrismaMarketplaceRepository(prisma);
    const billing = new FakeProviderBilling();
    // Two API instances with their own repository objects share one database.
    const instanceA = new FinderFeeService(repository, billing, { disputeWindowHours: 72 });
    const instanceB = new FinderFeeService(new PrismaMarketplaceRepository(prisma), billing, { disputeWindowHours: 72 });
    let providerId = "";
    let customerIds: string[] = [];
    try {
      const { provider, customers } = await seedFinderFeeParties(repository, [3_000, 7_000, 12_000], prefix);
      providerId = provider.id;
      customerIds = customers.map(row => row.id);
      const [setup] = await Promise.all([instanceA.startCardSetup(provider.id, undefined), instanceB.startCardSetup(provider.id, undefined)]);
      assert.equal((await instanceB.completeCardSetup(provider.id, setup.setupSessionId)).card?.last4, "4242");
      assert.equal(billing.createdCustomers.length, 1);

      // Concurrent first completions for every customer from both instances.
      const bookings = await Promise.all(customers.flatMap(customer => [0, 1, 2].map(offset =>
        createCompletedBooking(repository, provider, customer, hoursAfter(COMPLETED_AT, offset)))));
      await Promise.all(bookings.map((booking, index) => (index % 2 ? instanceA : instanceB).recordCompletion(booking)));
      const charges = await repository.listFinderFeeCharges({ providerId: provider.id });
      assert.equal(charges.length, 3);
      assert.equal(new Set(charges.map(row => row.customerId)).size, 3);
      assert.equal(charges.filter(row => row.waived).length, 1);
      const byCustomer = new Map(charges.map(row => [row.customerId, row]));
      const large = byCustomer.get(customers[1]!.id)!;
      const veryLarge = byCustomer.get(customers[2]!.id)!;
      if (!large.waived) assert.deepEqual([large.tier, large.feeCents], ["large", 11_000]);
      if (!veryLarge.waived) assert.deepEqual([veryLarge.tier, veryLarge.feeCents], ["very-large", 15_000]);

      // Database constraints hold even without the application lock.
      const sample = charges.find(row => !row.waived)!;
      const waivedRow = charges.find(row => row.waived)!;
      const otherBooking = bookings.find(row => !charges.some(charge => charge.bookingId === row.id))!;
      await assert.rejects(repository.createFinderFeeCharge({ ...sample, id: randomUUID(), bookingId: otherBooking.id }), FinderFeeRelationshipConflictError);
      const extraCustomer = (await seedFinderFeeParties(repository, [3_000], `${prefix}-extra`)).customers[0]!;
      customerIds.push(extraCustomer.id);
      const extraBooking = await createCompletedBooking(repository, provider, extraCustomer, COMPLETED_AT);
      await assert.rejects(
        repository.createFinderFeeCharge({ ...waivedRow, id: randomUUID(), customerId: extraCustomer.id, bookingId: extraBooking.id }),
        FinderFeeRelationshipConflictError
      );
      await assert.rejects(prisma.finderFeeCharge.update({ where: { id: sample.id }, data: { feeCents: sample.listFeeCents + 1 } }));
      await assert.rejects(prisma.finderFeeCharge.update({ where: { id: sample.id }, data: { status: "paid" } }));
      await assert.rejects(prisma.finderFeeCharge.update({ where: { id: sample.id }, data: { status: "invented" } }));
      await assert.rejects(prisma.finderFeeCharge.update({ where: { id: waivedRow.id }, data: { feeCents: 100, listFeeCents: 7_500 } }));

      // Nothing is billable before the window; then the first attempt for one charge is declined.
      await Promise.all([instanceA.processDue(hoursAfter(COMPLETED_AT, 70)), instanceB.processDue(hoursAfter(COMPLETED_AT, 70))]);
      assert.equal(billing.chargeCalls.length, 0);
      billing.delayMs = 25;
      billing.script.push("decline");
      const t0 = hoursAfter(COMPLETED_AT, 80);
      await Promise.all([instanceA.processDue(t0), instanceB.processDue(t0), instanceA.processDue(t0), instanceB.processDue(t0)]);
      assert.equal(billing.chargeCalls.length, 2, "each billable charge is attempted once");
      const afterFirst = await repository.listFinderFeeCharges({ providerId: provider.id });
      assert.deepEqual(afterFirst.map(row => row.status).sort(), ["paid", "retry-scheduled", "waived"]);
      const retrying = afterFirst.find(row => row.status === "retry-scheduled")!;
      assert.equal(retrying.attemptCount, 1);

      await Promise.all([instanceA.processDue(hoursAfter(t0, 1)), instanceB.processDue(hoursAfter(t0, 1))]);
      const final = await repository.listFinderFeeCharges({ providerId: provider.id });
      assert.deepEqual(final.map(row => row.status).sort(), ["paid", "paid", "waived"]);
      assert.equal(new Set(final.flatMap(row => row.stripePaymentIntentId ? [row.stripePaymentIntentId] : [])).size, 2);
      assert.deepEqual(
        billing.chargeCalls.filter(call => call.idempotencyKey.startsWith(`finder-fee:${retrying.id}:`)).map(call => call.idempotencyKey),
        [finderFeeIdempotencyKey(retrying.id, 0), finderFeeIdempotencyKey(retrying.id, 1)]
      );
      assert.equal(billing.succeededIntentIds.length, 2);
    } finally {
      await prisma.finderFeeCharge.deleteMany({ where: { providerId } });
      await prisma.providerBillingAccount.deleteMany({ where: { providerId } });
      await prisma.booking.deleteMany({ where: { providerId } });
      await prisma.customerProperty.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.customerProfile.deleteMany({ where: { userId: { in: customerIds } } });
      await prisma.providerBusinessProfile.deleteMany({ where: { userId: providerId } });
      await prisma.userAccount.deleteMany({ where: { id: { in: [providerId, ...customerIds] } } });
      await prisma.$disconnect();
    }
  }
);
