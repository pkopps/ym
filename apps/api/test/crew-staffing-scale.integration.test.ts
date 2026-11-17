import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, CrewMatchCandidate, CrewMemberProfile, ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** Answers the crew staffing queries by loading whole tables and filtering, as the staffing paths did before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listScopedBookings: async (query) => (await repository.listBookings()).filter((booking) =>
      (!query.providerId || booking.providerId === query.providerId) && (!query.customerId || booking.customerId === query.customerId) &&
      (!query.endAfter || booking.scheduledEndIso > query.endAfter) && (!query.statuses || query.statuses.includes(booking.status)) &&
      !query.excludeStatuses?.includes(booking.status)),
    listBookingsByIds: async (bookingIds) => (await repository.listBookings()).filter((booking) => bookingIds.includes(booking.id)),
    listCrewMatchesForBookings: async (bookingIds, crewMemberId) => (await repository.listCrewMatches()).filter((match) =>
      bookingIds.includes(match.bookingId) && (!crewMemberId || match.crewMemberId === crewMemberId)),
    listCrewMatchesForCrewMember: async (crewMemberId) => (await repository.listCrewMatches()).filter((match) => match.crewMemberId === crewMemberId),
    listCrewMatchesForCrewMembers: async (crewMemberIds) => (await repository.listCrewMatches()).filter((match) => crewMemberIds.includes(match.crewMemberId)),
    listProvidersByIds: async (providerIds) => (await repository.listProviders()).filter((provider) => providerIds.includes(provider.id)),
    listCustomers: async (customerIds) => (await repository.listCustomers()).filter((customer) => !customerIds || customerIds.includes(customer.id)),
    withLock: (key, callback) => repository.withLock(key, (locked) => callback(wholeTableRepository(locked)))
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

test("Postgres crew staffing reads the same rows through scoped queries as through whole tables", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `crew-staffing-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  // Far from every seeded and test address, so reconciliation only pairs these fixtures with each other.
  const address = { ...template!.address, line1: "1 Staffing Way", point: { latitude: -20.0001, longitude: 20.0001 } };
  const provider = (name: string): ProviderProfile => ({ ...template!, id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`,
    companyName: `Staffing ${name}`, address, credentials: [], staffingMode: "review-first" });
  const providers = { a: provider("a"), b: provider("b") };
  const customerId = `${prefix}-customer`;
  const crew = (name: string): CrewMemberProfile => ({ id: `${prefix}-crew-${name}`, fullName: `Staffing Crew ${name}`, email: `${prefix}-crew-${name}@example.invalid`,
    phone: "555-0300", role: "crew-member", address, createdAt: new Date(now).toISOString(), bio: "Crew staffing integration test", yearsExperience: 2,
    categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 5, preferredSchedule: "flex",
    hasOwnEquipment: false, winterWorkEnabled: false, rating: 4.5, completedJobs: 10, cancellationCount: 0, status: "available" });
  const crews = { familiar: crew("familiar"), clashing: crew("clashing"), fresh: crew("fresh"), clashingClaimer: crew("clashing-claimer") };
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const booking = (name: string, owner: ProviderProfile, status: Booking["status"], startOffsetDays: number): Booking => ({
    id: bookingId(name), customerId, providerId: owner.id, serviceAddress: address, category: "lawn-mowing", requestedAt: new Date(now - 60 * day).toISOString(),
    scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(), scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(),
    status, notes: "Crew staffing integration test", totalCents: 7_500, serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {})
  });
  const bookings = [
    booking("a-open", providers.a, "confirmed", 10), booking("a-staffed", providers.a, "confirmed", 12), booking("a-requested", providers.a, "requested", 14),
    booking("a-done-1", providers.a, "completed", -20), booking("a-done-2", providers.a, "completed", -13), booking("a-cancelled", providers.a, "cancelled", 16),
    booking("b-clash", providers.b, "confirmed", 10), booking("b-same-day", providers.b, "confirmed", 12 + 3 / 24), booking("b-done", providers.b, "completed", -6)
  ];
  const match = (name: string, member: CrewMemberProfile, status: CrewMatchCandidate["status"], ageMinutes: number): CrewMatchCandidate => ({
    id: `${bookingId(name)}-${member.id.split("-crew-")[1]}`, bookingId: bookingId(name), providerId: bookings.find((row) => row.id === bookingId(name))!.providerId,
    crewMemberId: member.id, crewMemberName: member.fullName, crewMemberPhone: member.phone, categories: member.categories,
    availableWeekdays: member.availableWeekdays ?? [], preferredSchedule: member.preferredSchedule, willingToTravelMiles: member.willingToTravelMiles,
    hasOwnEquipment: member.hasOwnEquipment, winterWorkEnabled: false, status, autoAccepted: false, distanceMiles: 0, hourlyRateCents: 2_500,
    createdAt: new Date(now - ageMinutes * 60_000).toISOString()
  });
  const matches = [
    match("a-done-1", crews.familiar, "accepted", 200), match("a-done-2", crews.familiar, "accepted", 190), match("a-staffed", crews.familiar, "accepted", 180),
    match("b-same-day", crews.familiar, "accepted", 170), match("b-clash", crews.clashing, "accepted", 160), match("b-clash", crews.clashingClaimer, "accepted", 155),
    match("b-done", crews.clashing, "accepted", 150), match("a-open", crews.clashing, "pending-provider-review", 140),
    match("a-requested", crews.clashing, "pending-provider-review", 130), match("a-requested", crews.familiar, "pending-provider-review", 120),
    match("a-cancelled", crews.fresh, "declined", 110)
  ];
  const userIds = [customerId, ...Object.values(providers).map((row) => row.id), ...Object.values(crews).map((row) => row.id)];
  const failure = async (work: Promise<unknown>) => work.then(() => "resolved", (error: Error) => error.message);
  try {
    for (const row of Object.values(providers)) await repository.createProvider(row);
    await repository.createCustomer({ ...template!, id: customerId, email: `${customerId}@example.invalid`, role: "customer", address, properties: [],
      defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    for (const row of Object.values(crews)) await repository.createCrewMember(row);
    for (const row of bookings) await repository.createBooking(row);
    for (const row of matches) await repository.createCrewMatch(row);

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());

    // Opening the staffing view reconciles first; do that once so both readers below see the same offers.
    await scoped.getProviderStaffingOverview(providers.a.id);
    await scoped.getProviderStaffingOverview(providers.b.id);

    const everyMatch = await repository.listCrewMatches();
    const everyBooking = await repository.listBookings();
    const candidateIds = [crews.familiar.id, crews.clashing.id];
    const candidateMatches = await repository.listCrewMatchesForCrewMembers(candidateIds);
    assert.deepEqual(candidateMatches, everyMatch.filter((row) => candidateIds.includes(row.crewMemberId)));
    assert.ok(candidateMatches.some((row) => row.providerId === providers.a.id) && candidateMatches.some((row) => row.providerId === providers.b.id));
    assert.deepEqual(await repository.listCrewMatchesForCrewMembers([]), []);
    const active = ["requested", "confirmed", "in-progress", "disputed"];
    const activeRows = await repository.listScopedBookings({ providerId: providers.a.id, statuses: active });
    assert.deepEqual(activeRows, everyBooking.filter((row) => row.providerId === providers.a.id && active.includes(row.status)));
    assert.deepEqual(activeRows.map((row) => row.id), ["a-open", "a-staffed", "a-requested"].map(bookingId));
    assert.deepEqual((await repository.listScopedBookings({ providerId: providers.a.id, statuses: active, excludeStatuses: ["requested"] })).map((row) => row.id),
      ["a-open", "a-staffed"].map(bookingId));

    for (const row of Object.values(providers)) {
      const overview = await scoped.getProviderStaffingOverview(row.id);
      assert.deepEqual(overview, await wholeTable.getProviderStaffingOverview(row.id));
      const window = { fromIso: new Date(now).toISOString(), toIso: new Date(now + 30 * day).toISOString() };
      assert.deepEqual(await scoped.getProviderCalendarOverview(row.id, window), await wholeTable.getProviderCalendarOverview(row.id, window));
    }
    const jobs = (await scoped.getProviderStaffingOverview(providers.a.id)).jobs;
    assert.deepEqual(jobs.map((job) => job.bookingId), ["a-open", "a-staffed", "a-requested"].map(bookingId));
    const requested = jobs.find((job) => job.bookingId === bookingId("a-requested"))!;
    const familiarOffer = requested.matches.find((row) => row.crewMemberId === crews.familiar.id)!;
    const clashingOffer = requested.matches.find((row) => row.crewMemberId === crews.clashing.id)!;
    // Two completed jobs and one upcoming job with this provider count as familiarity; the other candidate has none.
    assert.ok(familiarOffer.recommendationReasons?.includes("Already familiar with this business"));
    assert.ok(!clashingOffer.recommendationReasons?.includes("Already familiar with this business"));
    assert.ok((familiarOffer.recommendationScore ?? 0) > (clashingOffer.recommendationScore ?? 0));

    // Accepting a match checks the crew member's accepted jobs with every provider.
    const clashingReview = { crewMatchId: `${bookingId("a-open")}-clashing`, action: "accept" as const };
    const clearReview = { crewMatchId: `${bookingId("a-requested")}-clashing`, action: "accept" as const };
    assert.match(await failure(scoped.reviewCrewMatch(providers.a.id, clashingReview)), /no longer eligible/);
    assert.equal(await failure(wholeTable.reviewCrewMatch(providers.a.id, clashingReview)), await failure(scoped.reviewCrewMatch(providers.a.id, clashingReview)));
    // With no conflict the review gets past eligibility and stops at the provider's missing coverage instead.
    assert.match(await failure(scoped.reviewCrewMatch(providers.a.id, clearReview)), /workers-compensation/);
    assert.equal(await failure(wholeTable.reviewCrewMatch(providers.a.id, clearReview)), await failure(scoped.reviewCrewMatch(providers.a.id, clearReview)));

    // Claiming an opening checks the same things: the claimer's other jobs and the opening's accepted seats.
    const open = { opportunityId: bookingId("a-open") };
    assert.match(await failure(scoped.claimPublicCrewOpportunity(crews.clashingClaimer.id, open)), /not eligible/);
    assert.equal(await failure(wholeTable.claimPublicCrewOpportunity(crews.clashingClaimer.id, open)), await failure(scoped.claimPublicCrewOpportunity(crews.clashingClaimer.id, open)));
    const filled = { opportunityId: bookingId("a-staffed") };
    assert.match(await failure(scoped.claimPublicCrewOpportunity(crews.fresh.id, filled)), /already been filled/);
    assert.equal(await failure(wholeTable.claimPublicCrewOpportunity(crews.fresh.id, filled)), await failure(scoped.claimPublicCrewOpportunity(crews.fresh.id, filled)));
    const claimed = await scoped.claimPublicCrewOpportunity(crews.fresh.id, open);
    assert.equal(claimed.bookingId, bookingId("a-open"));
    assert.deepEqual(await wholeTable.claimPublicCrewOpportunity(crews.fresh.id, open), await scoped.claimPublicCrewOpportunity(crews.fresh.id, open));
    assert.equal(await prisma.crewMatch.count({ where: { bookingId: bookingId("a-open"), crewMemberId: crews.fresh.id } }), 1);
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.crewMatch.deleteMany({ where: { bookingId: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
