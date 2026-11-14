import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, BookingEvidenceEntry, ProviderProfile, ProviderReview } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { CompletedBookingAreaSummary, MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** The grouping the public overview did in memory over every booking, before the query existed. */
function summarizeByArea(bookings: Booking[], recentSinceIso: string): CompletedBookingAreaSummary[] {
  const groups = new Map<string, CompletedBookingAreaSummary>();
  for (const booking of bookings) {
    if (booking.status !== "completed") continue;
    const key = JSON.stringify([booking.providerId, booking.serviceAddress.city, booking.serviceAddress.state, booking.category]);
    const group = groups.get(key) ?? { providerId: booking.providerId, city: booking.serviceAddress.city, state: booking.serviceAddress.state,
      category: booking.category, completedBookingCount: 0, recentCompletedBookingCount: 0, firstScheduledStartIso: booking.scheduledStartIso };
    group.completedBookingCount += 1;
    if (Date.parse(booking.completedAt ?? booking.scheduledEndIso) >= Date.parse(recentSinceIso)) group.recentCompletedBookingCount += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Answers the overview's scoped queries by loading whole tables and filtering, as the service did before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listProvidersByVerificationStatus: async (status) => (await repository.listProviders()).filter((provider) => provider.verificationStatus === status),
    summarizeCompletedBookingsByArea: async (recentSinceIso) => summarizeByArea(await repository.listBookings(), recentSinceIso),
    listCompletedBookingsWithMarketingPhotos: async () => await repository.listBookings(),
    listLatestProviderReviews: async (providerIds) => (await Promise.all(providerIds.map((id) => repository.listProviderReviews(id)))).flat()
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

test("Postgres public overview queries return the same rows, in the same order, as the whole-table loads", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `public-overview-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const customerId = `${prefix}-customer`;
  const provider = (name: string, verificationStatus: ProviderProfile["verificationStatus"], city: string): ProviderProfile => ({
    ...template!, id: `${prefix}-provider-${name}`, email: `${prefix}-provider-${name}@example.invalid`, companyName: `Overview ${name}`,
    verificationStatus, credentials: [], address: { ...template!.address, city }
  });
  const providers = [provider("a", "verified", "Barnegat"), provider("b", "verified", "Waretown"), provider("c", "pending-review", "Barnegat")];
  const photo = (id: string, phase: BookingEvidenceEntry["phase"], marketingUseStatus?: BookingEvidenceEntry["marketingUseStatus"]): BookingEvidenceEntry => ({
    id: `${prefix}-evidence-${id}`, phase, evidenceType: "photo", capturedAt: new Date(now - day).toISOString(), capturedByRole: "provider",
    capturedByUserId: providers[0]!.id, imageDataUrl: "data:image/png;base64,AAAA", marketingUseStatus
  });
  const booking = (name: string, providerIndex: number, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: `${prefix}-booking-${name}`, customerId, providerId: providers[providerIndex]!.id, serviceAddress: template!.address, category: "lawn-mowing",
    requestedAt: new Date(now - 400 * day).toISOString(), scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status, notes: "Public overview integration test",
    totalCents: 7_500, serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const elsewhere = { ...template!.address, city: "  forked   river ", state: "nj" };
  const bookings = [
    booking("old", 0, "completed", -200),
    booking("recent", 0, "completed", -10, { serviceEvidence: [photo("recent-before", "before", "granted"), photo("recent-after", "after", "granted")] }),
    booking("recent-other-category", 0, "completed", -9, { category: "leaf-blowing" }),
    booking("other-area", 1, "completed", -20, { serviceAddress: elsewhere, serviceEvidence: [photo("area-before", "before", "granted"), photo("area-after", "after", "granted")] }),
    booking("other-area-same-city", 1, "completed", -19, { serviceAddress: { ...elsewhere, city: "Forked River", state: "NJ" } }),
    booking("no-completion-time", 1, "completed", -5, { completedAt: undefined, serviceEvidence: [photo("untimed-before", "before", "granted"), photo("untimed-after", "after", "granted")] }),
    booking("photos-not-cleared", 0, "completed", -8, { serviceEvidence: [photo("denied-before", "before", "denied"), photo("plain-after", "after")] }),
    booking("one-cleared-photo", 0, "completed", -7, { serviceEvidence: [photo("lone-before", "before", "granted"), photo("lone-after", "after", "revoked")] }),
    booking("unverified-provider", 2, "completed", -6, { serviceEvidence: [photo("unverified-before", "before", "granted"), photo("unverified-after", "after", "granted")] }),
    booking("upcoming", 0, "confirmed", 5),
    booking("cancelled", 1, "cancelled", -4)
  ];
  const tie = new Date(now - 3 * day).toISOString();
  const review = (name: string, providerIndex: number, bookingName: string, createdAt: string): ProviderReview => ({
    id: `${prefix}-review-${name}`, bookingId: `${prefix}-booking-${bookingName}`, providerId: providers[providerIndex]!.id, customerId,
    overallRating: 5, timelinessRating: 5, attentionToDetailRating: 4, reviewText: `Review ${name}`, responseStatus: "pending", createdAt
  });
  // Seven reviews for a top six: sixth place is a tie between the two verified providers, and the
  // unverified provider holds the newest review of all.
  const reviews = [
    review("unverified-newest", 2, "unverified-provider", new Date(now).toISOString()),
    review("1", 0, "old", new Date(now - 1 * day).toISOString()),
    review("2", 1, "other-area", new Date(now - 2 * day).toISOString()),
    review("3", 0, "recent", new Date(now - 2.2 * day).toISOString()),
    review("4", 1, "other-area-same-city", new Date(now - 2.4 * day).toISOString()),
    review("5", 0, "recent-other-category", new Date(now - 2.6 * day).toISOString()),
    review("tie-b", 1, "no-completion-time", tie),
    review("tie-a", 0, "photos-not-cleared", tie),
    review("older", 1, "cancelled", new Date(now - 30 * day).toISOString())
  ];
  const own = (row: { id: string }) => row.id.startsWith(prefix);
  try {
    for (const row of providers) await repository.createProvider(row);
    await repository.createCustomer({ ...template!, id: customerId, email: `${customerId}@example.invalid`, role: "customer", properties: [],
      defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    for (const row of bookings) await repository.createBooking(row);
    for (const row of reviews) await repository.createProviderReview(row);

    const allProviders = await repository.listProviders();
    const allBookings = await repository.listBookings();
    for (const status of ["verified", "pending-review"] as const) {
      const scoped = await repository.listProvidersByVerificationStatus(status);
      assert.deepEqual(scoped, allProviders.filter((row) => row.verificationStatus === status));
      assert.ok(scoped.some(own));
    }

    const photoRows = await repository.listCompletedBookingsWithMarketingPhotos();
    assert.deepEqual(photoRows, allBookings.filter((row) => row.status === "completed" && Boolean(row.completedAt) &&
      row.serviceEvidence.some((evidence) => evidence.marketingUseStatus === "granted")));
    assert.deepEqual(photoRows.filter(own).map((row) => row.id), ["other-area", "recent", "one-cleared-photo", "unverified-provider"].map((name) => `${prefix}-booking-${name}`));

    const recentSinceIso = new Date(now - 90 * day).toISOString();
    const bySummaryKey = (rows: CompletedBookingAreaSummary[]) => rows.map((row) => JSON.stringify(row)).sort();
    const summary = await repository.summarizeCompletedBookingsByArea(recentSinceIso);
    assert.deepEqual(bySummaryKey(summary), bySummaryKey(summarizeByArea(allBookings, recentSinceIso)));
    assert.deepEqual(summary.map((row) => row.firstScheduledStartIso), summary.map((row) => row.firstScheduledStartIso).sort());
    const ownSummary = summary.filter((row) => row.providerId === providers[1]!.id);
    assert.deepEqual(ownSummary.map((row) => [row.city, row.state, row.completedBookingCount, row.recentCompletedBookingCount]),
      [["  forked   river ", "nj", 1, 1], ["Forked River", "NJ", 1, 1], [template!.address.city, template!.address.state, 1, 1]]);

    const verifiedIds = allProviders.filter((row) => row.verificationStatus === "verified").map((row) => row.id);
    const everyReview = (await Promise.all(verifiedIds.map((id) => repository.listProviderReviews(id)))).flat();
    const latest = await repository.listLatestProviderReviews(verifiedIds, 6);
    const sixthNewest = everyReview.map((row) => row.createdAt).sort().reverse()[5]!;
    assert.deepEqual(latest.map((row) => row.id).sort(), everyReview.filter((row) => row.createdAt >= sixthNewest).map((row) => row.id).sort());
    assert.deepEqual(latest.map((row) => row.createdAt), latest.map((row) => row.createdAt).sort().reverse());
    assert.deepEqual(await repository.listLatestProviderReviews([], 6), []);

    const scopedPlatform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTablePlatform = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());
    const [scoped, wholeTable] = await Promise.all([scopedPlatform.getPublicMarketplaceOverview(), wholeTablePlatform.getPublicMarketplaceOverview()]);
    assert.deepEqual({ ...scoped, generatedAt: "" }, { ...wholeTable, generatedAt: "" });
    assert.deepEqual(scoped.beforeAfterProjects.filter((project) => project.bookingId.startsWith(prefix)).map((project) => project.bookingId),
      [`${prefix}-booking-recent`, `${prefix}-booking-other-area`]);
    const ownHighlights = scoped.highlightedReviews.filter((row) => row.reviewId.startsWith(prefix)).map((row) => row.reviewId);
    assert.ok(!ownHighlights.includes(`${prefix}-review-unverified-newest`));
    assert.ok(!ownHighlights.includes(`${prefix}-review-older`));
  } finally {
    await prisma.providerReview.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
