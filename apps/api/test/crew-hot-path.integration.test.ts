import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, CrewMatchCandidate, CrewMemberProfile, CustomerProfile, ProviderProfile } from "@yardmatch/contracts";
import type { MarketplaceRepository, UpcomingBookingsQuery } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";
const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((left, right) => left.id.localeCompare(right.id));

/**
 * Answers the scoped queries the way the service did before they existed: load the whole table, then filter.
 * Running the service against this and against the real repository proves the scoped queries return the same rows.
 */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listCrewMatchesForBookings: async (bookingIds: string[], crewMemberId?: string) =>
      (await repository.listCrewMatches()).filter(
        (match) => bookingIds.includes(match.bookingId) && (!crewMemberId || match.crewMemberId === crewMemberId)
      ),
    listCrewMatchesForCrewMember: async (crewMemberId: string) =>
      (await repository.listCrewMatches()).filter((match) => match.crewMemberId === crewMemberId),
    listProvidersByIds: async (providerIds: string[]) =>
      (await repository.listProviders()).filter((provider) => providerIds.includes(provider.id)),
    listBookingsByIds: async (bookingIds: string[]) =>
      (await repository.listBookings()).filter((booking) => bookingIds.includes(booking.id)),
    listUpcomingBookings: async (query: UpcomingBookingsQuery) =>
      (await repository.listBookings()).filter(
        (booking) =>
          new Date(booking.scheduledStartIso).getTime() > new Date(query.afterIso).getTime() &&
          query.statuses.includes(booking.status) &&
          (!query.providerId || booking.providerId === query.providerId)
      ),
    withLock: (key, callback) => repository.withLock(key, (locked) => callback(wholeTableRepository(locked)))
  };
  return new Proxy(repository, {
    get(target, property) {
      const override = (overrides as Record<string | symbol, unknown>)[property];
      if (override) {
        return override;
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

async function withCrewFixtures(
  run: (context: {
    prisma: PrismaClient;
    repository: PrismaMarketplaceRepository;
    ids: { providerA: string; providerB: string; customer: string; crewA: string; crewB: string };
    bookingId: (name: string) => string;
    isOwn: (row: { id: string }) => boolean;
    booking: (name: string, providerId: string, status: Booking["status"], startOffsetDays: number, extra?: Partial<Booking>) => Booking;
  }) => Promise<void>
): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `crew-hot-path-${randomUUID()}`;
  const ids = {
    providerA: `${prefix}-provider-a`,
    providerB: `${prefix}-provider-b`,
    customer: `${prefix}-customer`,
    crewA: `${prefix}-crew-a`,
    crewB: `${prefix}-crew-b`
  };
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  // Far from every seeded and test address, so global crew reconciliation only ever pairs these fixtures with each other.
  const address = {
    line1: "1 Hot Path Way",
    city: "Barnegat",
    state: "NJ",
    postalCode: "08005",
    country: "US",
    point: { latitude: 10.0001, longitude: 10.0001 }
  };
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const booking = (
    name: string,
    providerId: string,
    status: Booking["status"],
    startOffsetDays: number,
    extra: Partial<Booking> = {}
  ): Booking => ({
    id: bookingId(name),
    customerId: ids.customer,
    providerId,
    serviceAddress: address,
    category: "lawn-mowing",
    requestedAt: nowIso,
    scheduledStartIso: new Date(now + startOffsetDays * 86_400_000).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * 86_400_000 + 3_600_000).toISOString(),
    status,
    notes: "Crew hot-path integration test",
    totalCents: 7_500,
    serviceEvidence: [],
    interventions: [],
    addressChangeHistory: [],
    ...extra
  });
  const provider = (id: string, companyName: string): ProviderProfile => ({
    id,
    fullName: companyName,
    email: `${id}@example.com`,
    phone: "555-0200",
    role: "provider",
    address,
    createdAt: nowIso,
    companyName,
    bio: "A test provider used only by the crew hot-path integration suite.",
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
  });
  const crew = (id: string, fullName: string): CrewMemberProfile => ({
    id,
    fullName,
    email: `${id}@example.com`,
    phone: "555-0300",
    role: "crew-member",
    address,
    createdAt: nowIso,
    bio: "A test crew member used only by the crew hot-path integration suite.",
    yearsExperience: 2,
    categories: ["lawn-mowing"],
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    willingToTravelMiles: 5,
    preferredSchedule: "flex",
    hasOwnEquipment: false,
    winterWorkEnabled: false,
    rating: 4.5,
    completedJobs: 10,
    cancellationCount: 0,
    status: "available"
  });
  const match = (
    name: string,
    providerId: string,
    crewMember: CrewMemberProfile,
    status: CrewMatchCandidate["status"],
    ageMinutes: number
  ): CrewMatchCandidate => ({
    id: `${bookingId(name)}-${crewMember.id.slice(-6)}`,
    bookingId: bookingId(name),
    providerId,
    crewMemberId: crewMember.id,
    crewMemberName: crewMember.fullName,
    crewMemberPhone: crewMember.phone,
    categories: crewMember.categories,
    availableWeekdays: crewMember.availableWeekdays ?? [],
    preferredSchedule: crewMember.preferredSchedule,
    willingToTravelMiles: crewMember.willingToTravelMiles,
    hasOwnEquipment: crewMember.hasOwnEquipment,
    winterWorkEnabled: false,
    status,
    autoAccepted: false,
    distanceMiles: 0,
    hourlyRateCents: 2_500,
    createdAt: new Date(now - ageMinutes * 60_000).toISOString()
  });
  const userIds = Object.values(ids);
  const cleanup = async () => {
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.crewMatch.deleteMany({ where: { bookingId: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
  };

  try {
    const customer: CustomerProfile = {
      id: ids.customer,
      fullName: "Hot Path Customer",
      email: `${ids.customer}@example.com`,
      phone: "555-0100",
      role: "customer",
      address,
      createdAt: nowIso,
      propertyNotes: "",
      lawnSizeSqFt: 1000,
      properties: [],
      defaultPropertyId: ""
    };
    const crewA = crew(ids.crewA, "Hot Path Crew A");
    const crewB = crew(ids.crewB, "Hot Path Crew B");
    await repository.createCustomer(customer);
    await repository.createProvider(provider(ids.providerA, "Hot Path Lawns A"));
    await repository.createProvider(provider(ids.providerB, "Hot Path Lawns B"));
    await repository.createCrewMember(crewA);
    await repository.createCrewMember(crewB);

    // Every upcoming booking has the one accepted crew member a lawn-mowing job needs, so reconciliation adds nothing.
    for (const row of [
      booking("past-a", ids.providerA, "completed", -5),
      booking("past-b", ids.providerB, "completed", -4),
      booking("upcoming-a", ids.providerA, "confirmed", 10, { onRouteConfirmedAt: nowIso }),
      booking("upcoming-b", ids.providerB, "requested", 11),
      booking("upcoming-in-progress", ids.providerA, "in-progress", 12),
      booking("upcoming-cancelled", ids.providerB, "cancelled", 13)
    ]) {
      await repository.createBooking(row);
    }
    for (const row of [
      match("past-a", ids.providerA, crewA, "accepted", 60),
      match("past-b", ids.providerB, crewB, "accepted", 50),
      match("upcoming-a", ids.providerA, crewA, "accepted", 40),
      match("upcoming-a", ids.providerA, crewB, "declined", 35),
      match("upcoming-b", ids.providerB, crewB, "accepted", 30),
      match("upcoming-b", ids.providerB, crewA, "pending-provider-review", 20),
      match("upcoming-in-progress", ids.providerA, crewB, "accepted", 10)
    ]) {
      await repository.createCrewMatch(row);
    }

    await run({ prisma, repository, ids, bookingId, booking, isOwn: (row) => row.id.startsWith(prefix) });
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

test("Postgres scoped crew queries return the same rows as the whole-table loads", { skip }, async () => {
  await withCrewFixtures(async ({ repository, ids, bookingId, isOwn }) => {
    const [allMatches, allBookings, allProviders] = await Promise.all([
      repository.listCrewMatches(),
      repository.listBookings(),
      repository.listProviders()
    ]);

    // Matches for one booking (GPS pings and arrival tracking). Callers do not depend on row order.
    for (const name of ["upcoming-a", "upcoming-b", "past-a", "upcoming-cancelled"]) {
      assert.deepEqual(
        byId(await repository.listCrewMatchesForBookings([bookingId(name)])),
        byId(allMatches.filter((match) => match.bookingId === bookingId(name)))
      );
    }

    // Matches for one crew member (crew schedule and crew status), newest first like the whole-table load.
    for (const crewMemberId of [ids.crewA, ids.crewB]) {
      const scoped = await repository.listCrewMatchesForCrewMember(crewMemberId);
      assert.ok(scoped.length >= 3);
      assert.deepEqual(scoped, allMatches.filter((match) => match.crewMemberId === crewMemberId));
    }
    assert.deepEqual(await repository.listCrewMatchesForCrewMember(`${ids.crewA}-missing`), []);

    // Upcoming bookings (crew openings and reconciliation), in start order like the whole-table load.
    const afterIso = new Date().toISOString();
    const queries: UpcomingBookingsQuery[] = [
      { afterIso, statuses: ["requested", "confirmed"] },
      { afterIso, statuses: ["requested", "confirmed", "in-progress"] },
      { afterIso, statuses: ["requested", "confirmed", "in-progress"], providerId: ids.providerA }
    ];
    for (const query of queries) {
      const expected = allBookings.filter(
        (booking) =>
          isOwn(booking) &&
          new Date(booking.scheduledStartIso).getTime() > new Date(afterIso).getTime() &&
          query.statuses.includes(booking.status) &&
          (!query.providerId || booking.providerId === query.providerId)
      );
      assert.ok(expected.length >= 2);
      assert.deepEqual((await repository.listUpcomingBookings(query)).filter(isOwn), expected);
    }

    // Providers by id.
    assert.deepEqual(
      byId(await repository.listProvidersByIds([ids.providerA, ids.providerB, `${ids.providerA}-missing`])),
      byId(allProviders.filter((provider) => provider.id === ids.providerA || provider.id === ids.providerB))
    );
    assert.deepEqual(await repository.listProvidersByIds([]), []);
  });
});

test("Postgres crew schedule, openings and tracking match the whole-table results", { skip }, async () => {
  await withCrewFixtures(async ({ prisma, repository, ids, bookingId, isOwn }) => {
    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());
    const matchCount = () => prisma.crewMatch.count({ where: { bookingId: { startsWith: bookingId("") } } });
    const before = await matchCount();

    for (const crewMemberId of [ids.crewA, ids.crewB]) {
      const result = await scoped.getCrewMatchesForCrew(crewMemberId);
      assert.equal(result.matches.length, crewMemberId === ids.crewA ? 3 : 4);
      assert.deepEqual(result, await wholeTable.getCrewMatchesForCrew(crewMemberId));
    }
    assert.equal(await matchCount(), before, "fully staffed bookings must not gain matches");

    const openings = (await scoped.listCrewOpportunities()).filter(isOwn);
    assert.deepEqual(openings.map((opening) => opening.id), [bookingId("upcoming-a"), bookingId("upcoming-b")]);
    assert.deepEqual(openings, (await wholeTable.listCrewOpportunities()).filter(isOwn));

    const identity = (userId: string, role: "customer" | "provider" | "crew-member") => ({
      userId,
      email: `${userId}@example.com`,
      role,
      sessionVersion: 0
    });
    const nowIso = new Date().toISOString();
    for (const actor of [identity(ids.customer, "customer"), identity(ids.providerA, "provider"), identity(ids.crewA, "crew-member")]) {
      assert.deepEqual(
        await scoped.getBookingArrivalTracking(actor, bookingId("upcoming-a"), nowIso),
        await wholeTable.getBookingArrivalTracking(actor, bookingId("upcoming-a"), nowIso)
      );
    }
    await assert.rejects(
      scoped.getBookingArrivalTracking(identity(ids.crewB, "crew-member"), bookingId("upcoming-a"), nowIso),
      /accepted assignments/
    );

    const ping = {
      bookingId: bookingId("upcoming-a"),
      point: { latitude: 10.0002, longitude: 10.0002 },
      capturedAtIso: nowIso,
      speedMph: 20,
      accuracyMeters: 8
    };
    assert.deepEqual(
      await scoped.updateBookingRouteLocation(identity(ids.providerA, "provider"), ping),
      await wholeTable.updateBookingRouteLocation(identity(ids.providerA, "provider"), ping)
    );
    await assert.rejects(
      scoped.updateBookingRouteLocation(identity(ids.crewA, "crew-member"), ping),
      /handles route tracking personally/
    );
  });
});

test("Postgres crew reconciliation still offers an unstaffed upcoming booking to eligible crew", { skip }, async () => {
  await withCrewFixtures(async ({ prisma, repository, ids, bookingId, booking }) => {
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    await repository.createBooking(booking("unstaffed", ids.providerA, "confirmed", 20));

    await platform.getCrewMatchesForCrew(ids.crewA);

    const created = await prisma.crewMatch.findMany({ where: { bookingId: bookingId("unstaffed") } });
    assert.deepEqual(created.map((match) => match.crewMemberId).sort(), [ids.crewA, ids.crewB]);
    assert.ok(created.every((match) => match.status === "pending-provider-review" && match.providerId === ids.providerA));
  });
});

test("Postgres crew staffing locks one provider at a time, not every provider", { skip }, async () => {
  await withCrewFixtures(async ({ prisma, repository, ids, bookingId, booking }) => {
    const platform = new MarketplacePlatformService(new PrismaMarketplaceRepository(prisma), new DataEngineeringLogger());
    await repository.createBooking(booking("unstaffed-a", ids.providerA, "confirmed", 20));
    await repository.createBooking(booking("unstaffed-b", ids.providerB, "confirmed", 21));
    const offered = (name: string) => prisma.crewMatch.count({ where: { bookingId: bookingId(name) } });

    // Another request is in the middle of staffing provider A.
    let release!: () => void;
    let held!: () => void;
    const isHeld = new Promise<void>((resolve) => { held = resolve; });
    const holder = repository.withLock(`crew-staffing:${ids.providerA}`, async () => {
      held();
      await new Promise<void>((resolve) => { release = resolve; });
    });
    await isHeld;

    try {
      // Provider B is staffed without waiting for provider A.
      await platform.getProviderStaffingOverview(ids.providerB);
      assert.equal(await offered("unstaffed-b"), 2);

      // Provider A's own staffing waits for the lock.
      let finished = false;
      const waiting = platform.getProviderStaffingOverview(ids.providerA).then(() => { finished = true; });
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(finished, false);
      assert.equal(await offered("unstaffed-a"), 0);

      release();
      await holder;
      await waiting;
      assert.equal(await offered("unstaffed-a"), 2);
    } finally {
      release();
      await holder.catch(() => {});
    }
  });
});

test("Postgres tryWithLock reports a lock held by another transaction without waiting", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const key = `crew-schedule:try-lock-${randomUUID()}`;
  let release!: () => void;
  let held!: () => void;
  const isHeld = new Promise<void>((resolve) => { held = resolve; });
  const holder = repository.withLock(key, async () => {
    held();
    await new Promise<void>((resolve) => { release = resolve; });
  });
  try {
    await isHeld;
    assert.deepEqual(await repository.tryWithLock(key, async () => "ran"), { acquired: false });
    assert.deepEqual(await repository.tryWithLock(`${key}-other`, async () => "ran"), { acquired: true, value: "ran" });
    // The transaction that holds a lock can take it again.
    assert.deepEqual(
      await repository.withLock(`${key}-nested`, (locked) => locked.tryWithLock(`${key}-nested`, async () => "ran")),
      { acquired: true, value: "ran" }
    );
    release();
    await holder;
    assert.deepEqual(await repository.tryWithLock(key, async () => "ran"), { acquired: true, value: "ran" });
  } finally {
    release();
    await holder.catch(() => {});
    await prisma.$disconnect();
  }
});
