import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, ProviderProfile, SupportTicket } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** Answers the scoped queries by loading whole tables and filtering, as these screens and sweeps did before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listBookingsForProviders: async (providerIds) => (await repository.listBookings()).filter((booking) => providerIds.includes(booking.providerId)),
    listBookingsByStatuses: async () => await repository.listBookings(),
    countBookings: async () => (await repository.listBookings()).length,
    listScopedBookings: async (query) => (await repository.listBookings()).filter((booking) =>
      (!query.providerId || booking.providerId === query.providerId) && (!query.customerId || booking.customerId === query.customerId) &&
      (!query.endAfter || booking.scheduledEndIso > query.endAfter) && !query.excludeStatuses?.includes(booking.status)),
    listBookingsByIds: async (bookingIds) => (await repository.listBookings()).filter((booking) => bookingIds.includes(booking.id)),
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

type PrivateSweeps = {
  processBookingScheduleFollowUps(asOfIso: string, dryRun: boolean): Promise<{ sentNotificationCount: number; alreadySentCount: number; skippedCount: number }>;
  listProviderAssistantCandidates(providerId: string): Promise<Array<{ id: string }>>;
};

test("Postgres ops screens and sweeps match the whole-table versions", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `ops-screens-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const provider = (name: string, verificationStatus: ProviderProfile["verificationStatus"]): ProviderProfile => ({ ...template!,
    id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`, companyName: `Ops ${name}`, verificationStatus, credentials: [] });
  const providers = { verified: provider("verified", "verified"), pending: provider("pending", "pending-review") };
  const customerIds = [`${prefix}-customer-1`, `${prefix}-customer-2`];
  const opsId = `${prefix}-ops`;
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const booking = (name: string, owner: ProviderProfile, customerIndex: number, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: bookingId(name), customerId: customerIds[customerIndex]!, providerId: owner.id, serviceAddress: template!.address, category: "lawn-mowing",
    requestedAt: new Date(now - 60 * day).toISOString(), scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status, notes: "Ops screens integration test", totalCents: 7_500,
    serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const bookings = [
    booking("v-done-1", providers.verified, 0, "completed", -40), booking("v-done-2", providers.verified, 0, "completed", -12),
    booking("v-done-other", providers.verified, 1, "completed", -9), booking("v-missed", providers.verified, 0, "confirmed", -1),
    booking("v-upcoming", providers.verified, 1, "confirmed", 4), booking("v-requested", providers.verified, 0, "requested", 6),
    booking("v-cancelled", providers.verified, 1, "cancelled", 8),
    booking("p-open", providers.pending, 0, "confirmed", 5), booking("p-disputed", providers.pending, 1, "disputed", -3, { disputedAt: new Date(now - 2 * day).toISOString() }),
    booking("p-refunded", providers.pending, 0, "refunded", -7), booking("p-exception", providers.pending, 1, "in-progress", -0.01, { activeExceptionType: "weather-delay",
      activeExceptionReportedAt: new Date(now - 3_600_000).toISOString() })
  ];
  const ticket = (name: string, requesterId: string, ageDays: number, bookingName?: string): SupportTicket => ({
    id: `${prefix}-ticket-${name}`, bookingId: bookingName ? bookingId(bookingName) : undefined, requesterId, subject: `Ticket ${name}`, description: "Ops screens integration test",
    issueType: "service-quality", status: "open", createdAt: new Date(now - ageDays * day).toISOString(), updatedAt: new Date(now - ageDays * day).toISOString()
  });
  const tickets = [ticket("customer-booking", customerIds[0]!, 5, "v-done-2"), ticket("provider-booking", providers.pending.id, 3, "p-disputed"),
    ticket("provider-no-booking", providers.verified.id, 2), ticket("customer-no-booking", customerIds[1]!, 1)];
  const userIds = [...customerIds, opsId, ...Object.values(providers).map((row) => row.id)];
  const ops = { userId: opsId, email: `${opsId}@example.invalid`, role: "ops" as const, sessionVersion: 0 };
  const unstamped = <T extends { generatedAt?: string }>(result: T) => ({ ...result, generatedAt: "" });
  const own = <T>(rows: T[]) => rows.filter((row) => JSON.stringify(row).includes(prefix));
  try {
    for (const row of Object.values(providers)) await repository.createProvider(row);
    for (const id of customerIds) await repository.createCustomer({ ...template!, id, email: `${id}@example.invalid`, fullName: `Ops Customer ${id.slice(-1)}`, role: "customer",
      properties: [], defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    for (const row of bookings) await repository.createBooking(row);
    for (const row of tickets) await repository.createSupportTicket(row);

    const everyBooking = await repository.listBookings();
    const providerIds = Object.values(providers).map((row) => row.id);
    assert.deepEqual(await repository.listBookingsForProviders(providerIds), everyBooking.filter((row) => providerIds.includes(row.providerId)));
    assert.deepEqual((await repository.listBookingsForProviders([providers.pending.id])).map((row) => row.id), ["p-refunded", "p-disputed", "p-exception", "p-open"].map(bookingId));
    assert.deepEqual(await repository.listBookingsForProviders([]), []);
    const due = ["confirmed", "in-progress"] as Booking["status"][];
    assert.deepEqual(await repository.listBookingsByStatuses(due), everyBooking.filter((row) => due.includes(row.status)));
    assert.deepEqual(own(await repository.listBookingsByStatuses(due)).map((row) => row.id), ["v-missed", "p-exception", "v-upcoming", "p-open"].map(bookingId));
    assert.equal(await repository.countBookings(), everyBooking.length);

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());
    const asOfIso = new Date(now).toISOString();

    const queue = await scoped.listProviderVerificationQueue();
    assert.deepEqual(queue, await wholeTable.listProviderVerificationQueue());
    const pendingItem = queue.find((item) => item.provider.id === providers.pending.id)!;
    assert.equal(pendingItem.openBookingCount, 3);
    assert.ok(!queue.some((item) => item.provider.id === providers.verified.id));
    assert.deepEqual(unstamped(await scoped.processProviderOnboardingAutomation(ops, { dryRun: true, asOfIso })),
      unstamped(await wholeTable.processProviderOnboardingAutomation(ops, { dryRun: true, asOfIso })));
    const pendingOnly = unstamped(await scoped.processProviderOnboardingAutomation(ops, { dryRun: true, asOfIso, providerId: providers.pending.id }));
    assert.deepEqual(pendingOnly, unstamped(await wholeTable.processProviderOnboardingAutomation(ops, { dryRun: true, asOfIso, providerId: providers.pending.id })));
    assert.equal(pendingOnly.providerCount, 1);

    for (const id of customerIds) {
      assert.deepEqual(await scoped.listCustomerReviewOpportunities(id), await wholeTable.listCustomerReviewOpportunities(id));
      assert.deepEqual(await scoped.listCustomerRetentionOpportunities(id), await wholeTable.listCustomerRetentionOpportunities(id));
    }
    assert.deepEqual((await scoped.listCustomerReviewOpportunities(customerIds[0]!)).opportunities.map((row) => row.bookingId), ["v-done-2", "v-done-1"].map(bookingId));

    for (const row of Object.values(providers)) {
      await scoped.getProviderStaffingOverview(row.id);
      const overview = await scoped.getProviderStaffingOverview(row.id);
      assert.deepEqual(overview.retentionProgram, (await wholeTable.getProviderStaffingOverview(row.id)).retentionProgram);
      assert.deepEqual(await (scoped as unknown as PrivateSweeps).listProviderAssistantCandidates(row.id),
        await (wholeTable as unknown as PrivateSweeps).listProviderAssistantCandidates(row.id));
    }
    assert.deepEqual((await (scoped as unknown as PrivateSweeps).listProviderAssistantCandidates(providers.verified.id)).map((row) => row.id),
      ["v-upcoming", "v-requested"].map(bookingId));

    const supportTickets = await scoped.listOpsSupportTickets();
    assert.deepEqual(supportTickets, await wholeTable.listOpsSupportTickets());
    const ownTickets = supportTickets.filter((item) => item.ticket.id.startsWith(prefix));
    assert.deepEqual(ownTickets.map((item) => [item.ticket.id.split("-ticket-")[1], item.booking?.id, item.customerName, item.providerName, item.timeline[0]?.actorRole]).sort(), [
      ["customer-booking", bookingId("v-done-2"), "Ops Customer 1", "Ops verified", "customer"],
      ["customer-no-booking", undefined, undefined, undefined, "customer"],
      ["provider-booking", bookingId("p-disputed"), "Ops Customer 2", "Ops pending", "provider"],
      ["provider-no-booking", undefined, undefined, undefined, "provider"]
    ].sort());
    assert.deepEqual(unstamped(await scoped.escalateStaleOpsSupportTickets(ops, { dryRun: true, asOfIso })),
      unstamped(await wholeTable.escalateStaleOpsSupportTickets(ops, { dryRun: true, asOfIso })));

    const followUps = await (scoped as unknown as PrivateSweeps).processBookingScheduleFollowUps(asOfIso, true);
    assert.deepEqual(followUps, await (wholeTable as unknown as PrivateSweeps).processBookingScheduleFollowUps(asOfIso, true));
    assert.equal(followUps.sentNotificationCount + followUps.alreadySentCount + followUps.skippedCount >= bookings.length, true);
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.supportTicket.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.crewMatch.deleteMany({ where: { bookingId: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
