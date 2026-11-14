import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, ProviderProfile, ProviderReview, SupportTicket } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository, OpsOverviewBookingSummary } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

/** The counting the ops overview did in memory over every booking, before the query existed. */
function summarize(bookings: Booking[], requestedSinceIso: string): OpsOverviewBookingSummary {
  const pockets = new Map<string, OpsOverviewBookingSummary["pockets"][number]>();
  for (const booking of bookings) {
    const { city, state, postalCode } = booking.serviceAddress;
    const key = JSON.stringify([city, state, postalCode, booking.category]);
    const pocket = pockets.get(key) ?? { city, state, postalCode, category: booking.category, completedCount: 0, activeCount: 0, activeExceptionCount: 0 };
    if (booking.status === "completed" || booking.status === "refunded") pocket.completedCount += 1;
    else if (booking.status !== "cancelled") pocket.activeCount += 1;
    if (booking.activeExceptionType) pocket.activeExceptionCount += 1;
    pockets.set(key, pocket);
  }
  return {
    totalBookings: bookings.length,
    requestedBookings: bookings.filter((booking) => booking.status === "requested").length,
    requestedSinceCount: bookings.filter((booking) => Date.parse(booking.requestedAt) >= Date.parse(requestedSinceIso)).length,
    activeExceptionCount: bookings.filter((booking) => Boolean(booking.activeExceptionType)).length,
    disputedAfterCompletionCount: bookings.filter((booking) => booking.status === "disputed" && Boolean(booking.completedAt)).length,
    pockets: [...pockets.values()]
  };
}

/** Answers the overview's booking queries from the whole booking table, as it loaded before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    summarizeBookingsForOpsOverview: async (requestedSinceIso) => summarize(await repository.listBookings(), requestedSinceIso),
    listBookingsByIds: async () => await repository.listBookings()
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

test("Postgres ops observability overview counts bookings the same way as loading all of them", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `observability-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const provider: ProviderProfile = { ...template!, id: `${prefix}-provider`, email: `${prefix}-provider@example.invalid`, companyName: "Observability Provider",
    credentials: [], address: { ...template!.address, city: "Barnegat", state: "NJ", postalCode: "08005" } };
  const customerId = `${prefix}-customer`;
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const at = (city: string, state: string, postalCode: string) => ({ ...template!.address, city, state, postalCode });
  const booking = (name: string, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: bookingId(name), customerId, providerId: provider.id, serviceAddress: at("Barnegat", "NJ", "08005"), category: "lawn-mowing",
    requestedAt: new Date(now - 10 * day).toISOString(), scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(),
    scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status, notes: "Observability integration test", totalCents: 7_500,
    serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" || status === "refunded" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const bookings = [
    booking("done", "completed", -20), booking("refunded", "refunded", -18), booking("cancelled", "cancelled", -16, { category: "aeration" }),
    booking("requested-today", "requested", 3, { requestedAt: new Date(now - 3_600_000).toISOString() }),
    booking("confirmed", "confirmed", 4, { serviceAddress: at(" barnegat ", "nj", "08005-1234") }),
    booking("exception", "in-progress", -0.01, { activeExceptionType: "weather-delay", activeExceptionReportedAt: new Date(now - 3_600_000).toISOString() }),
    booking("done-with-exception", "completed", -12, { activeExceptionType: "weather-delay", serviceAddress: at("Waretown", "NJ", "08758") }),
    booking("disputed-done", "disputed", -5, { completedAt: new Date(now - 5 * day).toISOString(), disputedAt: new Date(now - 4 * day).toISOString(),
      serviceAddress: at("Waretown", "NJ", "08758"), category: "leaf-blowing" }),
    booking("disputed-early", "disputed", 2, { disputedAt: new Date(now - day).toISOString(), serviceAddress: at("Waretown", "NJ", "08758") })
  ];
  const review = (name: string, bookingName: string, responseStatus: ProviderReview["responseStatus"], ageDays: number): ProviderReview => ({
    id: `${prefix}-review-${name}`, bookingId: bookingId(bookingName), providerId: provider.id, customerId, overallRating: 2, timelinessRating: 3,
    attentionToDetailRating: 2, reviewText: `Review ${name}`, responseStatus, createdAt: new Date(now - ageDays * day).toISOString()
  });
  const ticket = (name: string, bookingName: string | undefined, issueType: SupportTicket["issueType"], status: SupportTicket["status"]): SupportTicket => ({
    id: `${prefix}-ticket-${name}`, bookingId: bookingName ? bookingId(bookingName) : undefined, requesterId: customerId, subject: `Ticket ${name}`,
    description: "Observability integration test", issueType, status, createdAt: new Date(now - day).toISOString(), updatedAt: new Date(now - day).toISOString()
  });
  const strip = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, item) => (key === "generatedAt" ? "" : item)));
  try {
    await repository.createProvider(provider);
    await repository.createCustomer({ ...template!, id: customerId, email: `${customerId}@example.invalid`, role: "customer", properties: [], defaultPropertyId: "",
      propertyNotes: "", lawnSizeSqFt: 1000 });
    for (const row of bookings) await repository.createBooking(row);
    for (const row of [review("pending", "done", "pending", 1), review("pending-old", "refunded", "pending", 9)]) await repository.createProviderReview(row);
    for (const row of [ticket("quality-open", "done-with-exception", "service-quality", "open"), ticket("quality-resolved", "confirmed", "service-quality", "resolved"),
      ticket("billing-open", "exception", "billing", "open"), ticket("quality-no-booking", undefined, "service-quality", "open")]) await repository.createSupportTicket(row);

    const sinceIso = new Date(now - day).toISOString();
    const everyBooking = await repository.listBookings();
    const summary = await repository.summarizeBookingsForOpsOverview(sinceIso);
    const expected = summarize(everyBooking, sinceIso);
    const byKey = (rows: OpsOverviewBookingSummary["pockets"]) => rows.map((row) => JSON.stringify(row)).sort();
    assert.deepEqual({ ...summary, pockets: byKey(summary.pockets) }, { ...expected, pockets: byKey(expected.pockets) });
    const ownRows = summary.pockets.filter((row) => ["08005-1234", "08758"].includes(row.postalCode));
    assert.deepEqual(ownRows.map((row) => [row.city, row.state, row.postalCode, row.category, row.completedCount, row.activeCount, row.activeExceptionCount]), [
      ["Waretown", "NJ", "08758", "lawn-mowing", 1, 1, 1], ["Waretown", "NJ", "08758", "leaf-blowing", 0, 1, 0], [" barnegat ", "nj", "08005-1234", "lawn-mowing", 0, 1, 0]
    ]);

    const scoped = await new MarketplacePlatformService(repository, new DataEngineeringLogger()).getObservabilityOverview();
    const wholeTable = await new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger()).getObservabilityOverview();
    assert.deepEqual(strip(scoped), strip(wholeTable));
    assert.ok(scoped.totalBookings >= bookings.length);
    assert.ok(scoped.bookingsLast24Hours >= 1);
    const pocket = (postalCode: string, city: string) => scoped.launchOperationsPolicy.coveragePockets.find((row) => row.postalCode === postalCode && row.city.toLowerCase() === city)!;
    assert.ok(pocket("08758", "waretown").activeBookingCount >= 2 && pocket("08758", "waretown").completedBookingCount >= 1);
    assert.ok(pocket("08758", "waretown").openServiceQualityTicketCount >= 1);
    assert.ok(pocket("08005", "barnegat").supportedCategories.includes("aeration"));
    assert.ok(scoped.recentReviewResponses.some((item) => item.reviewId === `${prefix}-review-pending`));
  } finally {
    await prisma.supportTicket.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.providerReview.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
