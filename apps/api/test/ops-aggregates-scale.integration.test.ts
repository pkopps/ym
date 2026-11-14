import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, LaunchLead, PaymentRecord, ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** Hands these ops screens every booking, customer and provider, as they loaded before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listBookingsByStatuses: async () => await repository.listBookings(),
    listBookingsByIds: async () => await repository.listBookings(),
    // The payout preview used to walk every booking itself, so nothing was totalled ahead of it.
    summarizeBookingsWithoutPayments: async () => ({ completedTotalCents: 0, disputedAfterCompletionCount: 0 }),
    listBookingsForCustomersOrLaunchLeads: async () => await repository.listBookings(),
    listCustomers: async () => await repository.listCustomers(),
    listProvidersByIds: async () => await repository.listProviders()
  };
  return new Proxy(repository, {
    get(target, property) {
      const override = (overrides as Record<string | symbol, unknown>)[property];
      if (override) return override;
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

test("Postgres ops payout preview, financial exceptions and launch leads match the whole-table versions", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `ops-aggregates-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const provider = (name: string): ProviderProfile => ({ ...template!, id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`,
    companyName: `Aggregates ${name}`, credentials: [] });
  const providers = [provider("a"), provider("b")];
  const customerIds = [`${prefix}-customer-1`, `${prefix}-customer-2`, `${prefix}-customer-3`];
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const booking = (name: string, providerIndex: number, customerIndex: number, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: bookingId(name), customerId: customerIds[customerIndex]!, providerId: providers[providerIndex]!.id, serviceAddress: template!.address, category: "lawn-mowing",
    requestedAt: new Date(now - (60 - startOffsetDays) * day).toISOString(), scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status, notes: "Ops aggregates integration test", totalCents: 7_500 + startOffsetDays,
    serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" || status === "refunded" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const leadIds = [`${prefix}-lead-email`, `${prefix}-lead-phone`, `${prefix}-lead-linked`, `${prefix}-lead-none`];
  const bookings = [
    booking("a-ready", 0, 0, "completed", -20), booking("a-recent", 0, 1, "completed", -1), booking("a-refunded", 0, 0, "refunded", -9),
    booking("a-disputed", 0, 1, "disputed", -4, { completedAt: new Date(now - 4 * day).toISOString(), disputedAt: new Date(now - 3 * day).toISOString() }),
    booking("a-disputed-early", 0, 0, "disputed", -2, { disputedAt: new Date(now - day).toISOString() }),
    booking("a-refund-review", 0, 2, "completed", -6), booking("a-cancelled-review", 0, 2, "cancelled", -5),
    booking("a-exception", 0, 1, "in-progress", -0.01, { activeExceptionType: "weather-delay", activeExceptionReportedAt: new Date(now - 3_600_000).toISOString() }),
    booking("a-done-exception", 0, 0, "completed", -8, { activeExceptionType: "weather-delay", activeExceptionReportedAt: new Date(now - 8 * day).toISOString() }),
    booking("b-upcoming", 1, 0, "confirmed", 3), booking("b-requested", 1, 1, "requested", 5, { launchLeadId: leadIds[2] }),
    booking("b-ready", 1, 2, "completed", -15, { launchLeadId: leadIds[3] }), booking("b-cancelled", 1, 1, "cancelled", 6)
  ];
  const payment = (name: string, status: PaymentRecord["status"], extra: Partial<PaymentRecord> = {}): PaymentRecord => ({
    id: `${prefix}-payment-${name}`, bookingId: bookingId(name), amountCents: 7_500, currency: "usd", status, processor: "stripe", refundable: false,
    createdAt: new Date(now - day).toISOString(), updatedAt: new Date(now - day).toISOString(), ...extra
  });
  const underReview = { refundReviewStatus: "requested" as const, refundReason: "Ops aggregates test", refundRequestedByRole: "customer" as const };
  const payments = [
    payment("a-refund-review", "pending", { ...underReview, refundRequestedAt: new Date(now - 2 * day).toISOString() }),
    payment("a-cancelled-review", "pending", { ...underReview, refundRequestedAt: new Date(now - 3 * day).toISOString() }),
    payment("a-refunded", "refunded", { refundReviewedAt: new Date(now - 8 * day).toISOString() })
  ];
  const lead = (index: number, contact: Partial<LaunchLead>): LaunchLead => ({
    id: leadIds[index]!, sourceChannel: "website", contactName: `Lead ${index}`, preferredContactMethod: "email", areaLabel: "Barnegat, NJ",
    message: "Ops aggregates integration test", status: "new", firstResponseDueAt: new Date(now + day).toISOString(), convertedBookingIds: [], reviewIds: [],
    createdAt: new Date(now - index * 3_600_000).toISOString(), updatedAt: new Date(now).toISOString(), ...contact
  });
  const userIds = [...customerIds, ...providers.map((row) => row.id)];
  const unstamped = <T extends { generatedAt?: string }>(result: T) => ({ ...result, generatedAt: "" });
  try {
    for (const row of providers) await repository.createProvider(row);
    for (const [index, id] of customerIds.entries()) await repository.createCustomer({ ...template!, id, email: `${id}@example.invalid`, phone: `60955501${10 + index}`,
      fullName: `Aggregates Customer ${index + 1}`, role: "customer", properties: [], defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    const leads = [lead(0, { email: `  ${customerIds[0]!.toUpperCase()}@EXAMPLE.invalid ` }), lead(1, { phone: "(609) 555-0111" }), lead(2, {}),
      lead(3, { email: `${prefix}-nobody@example.invalid` })];
    for (const row of leads) await repository.createLaunchLead(row);
    for (const row of bookings) await repository.createBooking(row);
    for (const row of payments) await repository.createPayment(row);

    const everyBooking = await repository.listBookings();
    const scopedRows = await repository.listBookingsForCustomersOrLaunchLeads({ customerIds: [customerIds[2]!], launchLeadIds: [leadIds[2]!] });
    assert.deepEqual(scopedRows, everyBooking.filter((row) => row.customerId === customerIds[2] || row.launchLeadId === leadIds[2]));
    assert.deepEqual(scopedRows.map((row) => row.id), ["b-ready", "a-refund-review", "a-cancelled-review", "b-requested"].map(bookingId));
    assert.deepEqual(await repository.listBookingsForCustomersOrLaunchLeads({ customerIds: [], launchLeadIds: [] }), []);

    const paidBookingIds = new Set((await repository.listPayments()).map((row) => row.bookingId));
    const neverPaid = everyBooking.filter((row) => !paidBookingIds.has(row.id));
    assert.deepEqual(await repository.summarizeBookingsWithoutPayments(), {
      completedTotalCents: neverPaid.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.totalCents, 0),
      disputedAfterCompletionCount: neverPaid.filter((row) => row.status === "disputed" && Boolean(row.completedAt)).length
    });

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());

    const exceptions = unstamped(await scoped.getOpsFinancialExceptionSummary());
    assert.deepEqual(exceptions, unstamped(await wholeTable.getOpsFinancialExceptionSummary()));
    const own = <T extends { bookingId: string }>(rows: T[]) => rows.filter((row) => row.bookingId.startsWith(prefix));
    assert.deepEqual(own(exceptions.payoutHolds).map((row) => [row.bookingId, row.holdReason]), [
      [bookingId("a-refund-review"), "refund-review"], [bookingId("a-cancelled-review"), "refund-review"], [bookingId("a-disputed"), "dispute"]
    ]);
    assert.deepEqual(own(exceptions.refundReviews).map((row) => [row.bookingId, row.bookingStatus, row.customerName]), [
      [bookingId("a-refund-review"), "completed", "Aggregates Customer 3"], [bookingId("a-cancelled-review"), "cancelled", "Aggregates Customer 3"]
    ]);
    assert.deepEqual(own(exceptions.activeExceptions).map((row) => row.bookingId), [bookingId("a-exception")]);

    const preview = unstamped(await scoped.getOpsPayoutPreview());
    assert.deepEqual(preview, unstamped(await wholeTable.getOpsPayoutPreview()));
    // Without a captured payment the four completed fixtures wait on the customer; the disputed and refund-review ones are held.
    const awaitingCents = ["a-ready", "a-recent", "a-done-exception", "b-ready"].reduce((sum, name) => sum + bookings.find((row) => row.id === bookingId(name))!.totalCents, 0);
    assert.ok(preview.totalAwaitingCustomerPaymentCents >= awaitingCents);
    assert.ok(preview.onHoldEntryCount >= 2);

    const opsLeads = await scoped.listOpsLaunchLeads();
    assert.deepEqual(opsLeads, await wholeTable.listOpsLaunchLeads());
    const suggested = (index: number) => opsLeads.find((item) => item.lead.id === leadIds[index])!.suggestedBookingMatches.map((match) => [match.bookingId.split("-booking-")[1], match.matchReason]);
    assert.deepEqual(suggested(0), [["b-upcoming", "email"], ["a-disputed-early", "email"], ["a-done-exception", "email"], ["a-refunded", "email"]]);
    assert.deepEqual(suggested(1).map((row) => row[1]), ["phone", "phone", "phone", "phone"]);
    assert.ok(!suggested(1).some((row) => row[0] === "b-requested"));
    assert.deepEqual(suggested(2), []);
    assert.deepEqual(suggested(3), []);
  } finally {
    await prisma.paymentRecord.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.launchLead.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
