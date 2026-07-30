import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { Booking, CustomerProfile, PaymentRecord, ProviderProfile } from "@yardmatch/contracts";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

test(
  "Postgres atomically claims first-match economics and persists a balanced idempotent ledger",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const repository = new PrismaMarketplaceRepository(prisma);
    const suffix = randomUUID();
    const customerId = `pg-it-customer-${suffix}`;
    const providerId = `pg-it-provider-${suffix}`;
    const bookingId = `pg-it-booking-${suffix}`;
    const paymentId = `pg-it-payment-${suffix}`;
    const now = new Date().toISOString();
    const address = {
      line1: "1 Integration Way",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US",
      point: { latitude: 39.7532, longitude: -74.2229 }
    };

    const cleanup = async () => {
      await (prisma as any).financialLedgerEntry.deleteMany({ where: { bookingId } });
      await (prisma as any).bookingFinancialSettlement.deleteMany({ where: { bookingId } });
      await (prisma as any).customerProviderRelationship.deleteMany({
        where: { customerId, providerId }
      });
      await prisma.paymentRecord.deleteMany({ where: { id: paymentId } });
      await prisma.booking.deleteMany({ where: { id: bookingId } });
      await (prisma as any).providerCredential.deleteMany({ where: { providerId } });
      await (prisma as any).providerConnectAccount.deleteMany({ where: { providerId } });
      await prisma.customerProperty.deleteMany({ where: { customerId } });
      await prisma.customerProfile.deleteMany({ where: { userId: customerId } });
      await prisma.providerBusinessProfile.deleteMany({ where: { userId: providerId } });
      await prisma.userAccount.deleteMany({ where: { id: { in: [customerId, providerId] } } });
    };

    try {
      await cleanup();
      const customer: CustomerProfile = {
        id: customerId,
        fullName: "Postgres Test Customer",
        email: `${customerId}@example.com`,
        phone: "555-0100",
        role: "customer",
        address,
        createdAt: now,
        propertyNotes: "",
        lawnSizeSqFt: 1000,
        properties: [],
        defaultPropertyId: ""
      };
      const provider: ProviderProfile = {
        id: providerId,
        fullName: "Postgres Test Provider",
        email: `${providerId}@example.com`,
        phone: "555-0200",
        role: "provider",
        address,
        createdAt: now,
        companyName: "Postgres Test Lawns",
        bio: "A test provider used only by the isolated Postgres repository integration suite.",
        yearsExperience: 5,
        serviceRadiusMiles: 10,
        minimumBookingLeadHours: 0,
        staffingMode: "review-first",
        crewReviewLeadHours: 24,
        departureReminderLeadMinutes: 60,
        routeLeaderMode: "provider-only",
        weeklyPayoutDay: "Thu",
        instantPayoutsEnabled: false,
        verificationStatus: "verified",
        sponsoredListingEnabled: false,
        categories: ["lawn-mowing"],
        rating: 5,
        timelinessRating: 5,
        attentionToDetailRating: 5,
        reviewCount: 0,
        calendarConnection: { provider: "google", connected: false }
      };
      await repository.createCustomer(customer);
      await repository.createProvider(provider);

      const booking: Booking = {
        id: bookingId,
        customerId,
        providerId,
        serviceAddress: address,
        category: "lawn-mowing",
        requestedAt: now,
        scheduledStartIso: now,
        scheduledEndIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "completed",
        completedAt: now,
        notes: "Postgres finance integration test",
        totalCents: 7_500,
        serviceEvidence: [],
        interventions: [],
        addressChangeHistory: []
      };
      const payment: PaymentRecord = {
        id: paymentId,
        bookingId,
        amountCents: 7_500,
        currency: "usd",
        status: "captured",
        processor: "stripe",
        refundable: true,
        checkoutSessionId: `cs_${suffix}`,
        processorPaymentIntentId: `pi_${suffix}`,
        paidAt: now,
        createdAt: now,
        updatedAt: now
      };
      await repository.createBooking(booking);
      await repository.createPayment(payment);

      const first = await repository.settleBookingFinancials({
        bookingId,
        paymentId,
        customerId,
        providerId,
        customerChargeCents: 7_500,
        currency: "usd",
        actualProcessorFeeCents: 248
      });
      const repeated = await repository.settleBookingFinancials({
        bookingId,
        paymentId,
        customerId,
        providerId,
        customerChargeCents: 7_500,
        currency: "usd",
        actualProcessorFeeCents: 248
      });
      assert.equal(repeated.id, first.id);
      assert.equal(first.finderFeeCents, 3_000);
      assert.equal(first.providerNetCents, 3_801);

      const ledger = await repository.listFinancialLedgerEntries(bookingId);
      const debits = ledger
        .filter((entry) => entry.direction === "debit")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const credits = ledger
        .filter((entry) => entry.direction === "credit")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      assert.equal(debits, credits);
      assert.equal(new Set(ledger.map((entry) => entry.idempotencyKey)).size, ledger.length);

      await assert.rejects(
        () =>
          prisma.paymentRecord.create({
            data: {
              ...payment,
              id: `${paymentId}-duplicate`,
              checkoutSessionId: payment.checkoutSessionId,
              processorPaymentIntentId: `pi_duplicate_${suffix}`,
              paidAt: new Date(payment.paidAt!),
              createdAt: new Date(payment.createdAt),
              updatedAt: new Date(payment.updatedAt)
            }
          }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      );
    } finally {
      await cleanup();
      await prisma.$disconnect();
    }
  }
);
