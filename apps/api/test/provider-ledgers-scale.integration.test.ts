import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, CrewMatchCandidate, ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** Answers the per-owner queries by loading whole tables and filtering, as the calendar and ledgers did before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listScopedBookings: async (query) => (await repository.listBookings()).filter((booking) =>
      (!query.providerId || booking.providerId === query.providerId) && (!query.customerId || booking.customerId === query.customerId) &&
      (!query.endAfter || booking.scheduledEndIso > query.endAfter) && !query.excludeStatuses?.includes(booking.status)),
    listBookingsByIds: async (bookingIds) => (await repository.listBookings()).filter((booking) => bookingIds.includes(booking.id)),
    listCrewMatchesForBookings: async (bookingIds, crewMemberId) => (await repository.listCrewMatches()).filter((match) =>
      bookingIds.includes(match.bookingId) && (!crewMemberId || match.crewMemberId === crewMemberId)),
    listCrewMatchesForCrewMember: async (crewMemberId) => (await repository.listCrewMatches()).filter((match) => match.crewMemberId === crewMemberId),
    listCustomers: async (customerIds) => (await repository.listCustomers()).filter((customer) => !customerIds || customerIds.includes(customer.id))
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

test("Postgres provider calendar and payout ledgers match the whole-table versions", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `ledgers-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const provider = (name: string): ProviderProfile => ({ ...template!, id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`,
    companyName: `Ledger ${name}`, credentials: [] });
  const providers = [provider("a"), provider("b")];
  const customerIds = [`${prefix}-customer-1`, `${prefix}-customer-2`];
  const crewIds = [`${prefix}-crew-1`, `${prefix}-crew-2`];
  const booking = (name: string, providerIndex: number, customerIndex: number, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: `${prefix}-booking-${name}`, customerId: customerIds[customerIndex]!, providerId: providers[providerIndex]!.id, serviceAddress: template!.address,
    category: "lawn-mowing", requestedAt: new Date(now - 60 * day).toISOString(), scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status, notes: `Notes for ${name}`, totalCents: 7_500 + startOffsetDays,
    serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" || status === "refunded" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const bookings = [
    booking("a-completed-old", 0, 0, "completed", -30),
    booking("a-completed", 0, 1, "completed", -3, { onRouteConfirmedAt: new Date(now - 3 * day).toISOString(), serviceEvidence: [{ id: `${prefix}-evidence`, phase: "after",
      evidenceType: "photo", capturedAt: new Date(now - 3 * day).toISOString(), capturedByRole: "crew-member", capturedByUserId: crewIds[0]! }] }),
    booking("a-refunded", 0, 0, "refunded", -2),
    booking("a-disputed", 0, 1, "disputed", -1, { completedAt: new Date(now - day).toISOString(), disputedAt: new Date(now).toISOString() }),
    booking("a-cancelled", 0, 0, "cancelled", -4),
    booking("a-upcoming", 0, 0, "confirmed", 2),
    booking("a-upcoming-later", 0, 1, "requested", 6),
    booking("a-outside-window", 0, 1, "confirmed", 40),
    booking("b-completed", 1, 0, "completed", -5),
    booking("b-upcoming", 1, 1, "confirmed", 3)
  ];
  const match = (bookingName: string, crewIndex: number, status: CrewMatchCandidate["status"], ageMinutes: number): CrewMatchCandidate => ({
    id: `${prefix}-match-${bookingName}-${crewIndex}`, bookingId: `${prefix}-booking-${bookingName}`, providerId: bookings.find((row) => row.id === `${prefix}-booking-${bookingName}`)!.providerId,
    crewMemberId: crewIds[crewIndex]!, crewMemberName: `Ledger Crew ${crewIndex}`, crewMemberPhone: "555-0100", categories: ["lawn-mowing"],
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], preferredSchedule: "flex", willingToTravelMiles: 10, hasOwnEquipment: false,
    winterWorkEnabled: false, status, distanceMiles: 1, hourlyRateCents: 2_500, createdAt: new Date(now - ageMinutes * 60_000).toISOString()
  });
  const matches = [
    match("a-completed-old", 0, "accepted", 90), match("a-completed", 0, "accepted", 80), match("a-completed", 1, "accepted", 70),
    match("a-refunded", 0, "accepted", 60), match("a-disputed", 1, "cancelled-by-crew", 50), match("a-upcoming", 0, "accepted", 40),
    match("a-upcoming-later", 1, "pending-provider-review", 30), match("b-completed", 0, "accepted", 20), match("b-upcoming", 0, "accepted", 10),
    match("b-upcoming", 1, "declined", 5)
  ];
  try {
    for (const row of providers) await repository.createProvider(row);
    for (const id of customerIds) await repository.createCustomer({ ...template!, id, email: `${id}@example.invalid`, fullName: `Customer ${id.slice(-1)}`, role: "customer",
      properties: [], defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    for (const id of crewIds) await repository.createCrewMember({ ...template!, id, email: `${id}@example.invalid`, role: "crew-member", bio: "Ledger test crew",
      yearsExperience: 2, categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 10,
      preferredSchedule: "flex", hasOwnEquipment: false, rating: 4.5, completedJobs: 3, status: "assigned" } as never);
    for (const row of bookings) await repository.createBooking(row);
    for (const row of matches) await repository.createCrewMatch(row);

    // listBookingsByIds now promises the order listBookings uses.
    const everyBooking = await repository.listBookings();
    const someIds = ["b-upcoming", "a-completed-old", "a-upcoming", "a-refunded"].map((name) => `${prefix}-booking-${name}`);
    assert.deepEqual(await repository.listBookingsByIds(someIds), everyBooking.filter((row) => someIds.includes(row.id)));
    assert.deepEqual((await repository.listBookingsByIds(someIds)).map((row) => row.id),
      ["a-completed-old", "a-refunded", "a-upcoming", "b-upcoming"].map((name) => `${prefix}-booking-${name}`));

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());

    for (const row of providers) {
      const ledger = await scoped.getProviderPayoutLedger(row.id);
      assert.deepEqual(ledger, await wholeTable.getProviderPayoutLedger(row.id));
      const window = { fromIso: new Date(now - day).toISOString(), toIso: new Date(now + 14 * day).toISOString() };
      assert.deepEqual(await scoped.getProviderCalendarOverview(row.id, window), await wholeTable.getProviderCalendarOverview(row.id, window));
    }
    const ledgerA = await scoped.getProviderPayoutLedger(providers[0]!.id);
    assert.deepEqual(ledgerA.entries.map((entry) => [entry.bookingId, entry.crewMembersAssigned, entry.customerName]), [
      [`${prefix}-booking-a-disputed`, 0, "Customer 2"], [`${prefix}-booking-a-refunded`, 1, "Customer 1"],
      [`${prefix}-booking-a-completed`, 2, "Customer 2"], [`${prefix}-booking-a-completed-old`, 1, "Customer 1"]
    ]);
    const calendarA = await scoped.getProviderCalendarOverview(providers[0]!.id, { fromIso: new Date(now).toISOString(), toIso: new Date(now + 14 * day).toISOString() });
    assert.deepEqual(calendarA.events.filter((event) => event.bookingId).map((event) => [event.bookingId, event.notes]), [
      [`${prefix}-booking-a-upcoming`, "Notes for a-upcoming"], [`${prefix}-booking-a-upcoming-later`, "Notes for a-upcoming-later"]
    ]);

    for (const id of crewIds) {
      assert.deepEqual(await scoped.getCrewPayoutLedger(id), await wholeTable.getCrewPayoutLedger(id));
    }
    const crewLedger = await scoped.getCrewPayoutLedger(crewIds[0]!);
    assert.equal(crewLedger.attendanceSummary.completedAssignmentCount, 4);
    assert.equal(crewLedger.attendanceSummary.activeAssignmentCount, 2);
    assert.equal((await scoped.getCrewPayoutLedger(crewIds[1]!)).attendanceSummary.completedAssignmentCount, 1);
  } finally {
    // Opening the calendar reconciles crew, which offers the upcoming jobs and queues notifications.
    const userIds = [...providers.map((row) => row.id), ...customerIds, ...crewIds];
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.crewMatch.deleteMany({ where: { bookingId: { startsWith: prefix } } });
    await prisma.bookingFinancialSettlement.deleteMany({ where: { bookingId: { startsWith: prefix } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
