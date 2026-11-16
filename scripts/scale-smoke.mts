/** Destructive only to its own synthetic rows. Requires a disposable, loopback test/scale database. */
import assert from "node:assert/strict";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { InMemoryMarketplaceRepository } from "../apps/api/src/repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "../apps/api/src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../apps/api/src/services/MarketplacePlatformService";
import { ProductAnalytics } from "../apps/api/src/observability/ProductAnalytics";
import { hashPassword, verifyPassword } from "../apps/api/src/auth";
import { mapConcurrent } from "../apps/api/src/concurrency";
import { assertLocalTestDatabase } from "./lib/local-database-guard.mts";

const url = assertLocalTestDatabase(process.env.TEST_DATABASE_URL);
// SCALE_LARGE=1 runs the larger dataset and concurrency. It is for local before and after comparisons, not for CI.
// Its pool timeout is off (0), so an operation that cannot get a connection waits and the wait shows up as latency.
const large = process.env.SCALE_LARGE === "1";
const size = large
  ? { providers: 1999, history: 200_000, crew: 500, perKind: 100, concurrency: 300, connections: 20, poolTimeoutSeconds: 0 }
  : { providers: 600, history: 20_000, crew: 200, perKind: 40, concurrency: 12, connections: 8, poolTimeoutSeconds: 10 };
// SCALE_CONCURRENCY overrides how many operations are in flight. At 300 the large run mostly measures time spent
// queued for a connection; a run at 12 shows what each operation costs on the large dataset by itself.
if (process.env.SCALE_CONCURRENCY) size.concurrency = Number(process.env.SCALE_CONCURRENCY);
// The recurring workload needs three nearby providers per turn, one for each kind of write.
const nearProviders = Math.max(200, size.perKind * 3), upcomingCount = 500;
url.searchParams.set("connection_limit", String(size.connections)); url.searchParams.set("pool_timeout", String(size.poolTimeoutSeconds));
for (const key of ["GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "POSTHOG_API_KEY"]) delete process.env[key];
const prefix = `scale-load-${crypto.randomUUID()}`;
process.env.YARDMATCH_ENV = prefix;
const prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [{ emit: "event", level: "query" }] });
const queryTimes: number[] = [];
// SCALE_PROFILE=1 (with SCALE_CONCURRENCY=1, so statements can be attributed) prints, per kind of operation, how many
// statements one operation runs and which statements take the time. SCALE_KINDS=a,b limits the run to those kinds.
const profiling = process.env.SCALE_PROFILE === "1";
const queryLog: Array<{ ms: number; sql: string }> = [];
const profile: Record<string, { operations: number; totalMs: number; queryMs: number; statements: Map<string, { count: number; ms: number }> }> = {};
// The slowest statements are reported so a failed gate names the query to look at.
let slowestQueries: Array<{ ms: number; sql: string }> = [];
prisma.$on("query", event => {
  queryTimes.push(event.duration);
  if (profiling) queryLog.push({ ms: event.duration, sql: event.query.replace(/\s+/g, " ").trim() });
  if (slowestQueries.length < 3 || event.duration > slowestQueries[2].ms) {
    slowestQueries = [...slowestQueries, { ms: event.duration, sql: event.query.replace(/\s+/g, " ").slice(0, 400) }].sort((a, b) => b.ms - a.ms).slice(0, 3);
  }
});
const repository = new PrismaMarketplaceRepository(prisma), fixtures = new InMemoryMarketplaceRepository();
const analytics = new ProductAnalytics(prisma), platform = new MarketplacePlatformService(repository, analytics);
const [template] = await fixtures.listProviders();
const providerId = `${prefix}-provider`, customerId = `${prefix}-customer`, now = Date.now();
const address = template.address;
const percentile = (values: number[], quantile: number) => [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length * quantile) - 1)] ?? 0;
const delay = monitorEventLoopDelay({ resolution: 10 });
try {
  await repository.createProvider({ ...template, id: providerId, email: `${providerId}@example.invalid`, credentials: [] });
  await repository.createCustomer({ ...template, id: customerId, email: `${customerId}@example.invalid`, role: "customer",
    propertyNotes: "", lawnSizeSqFt: 1000, properties: [], defaultPropertyId: "" });
  const business = await prisma.providerBusinessProfile.findUniqueOrThrow({ where: { userId: providerId } });
  const user = await prisma.userAccount.findUniqueOrThrow({ where: { id: providerId } });
  const providerIds = Array.from({ length: size.providers }, (_, index) => `${prefix}-provider-${index}`);
  await prisma.userAccount.createMany({ data: providerIds.map((id, index) => ({ ...user, id, email: `${id}@example.invalid`,
    address: index < nearProviders ? address : { ...address, point: { latitude: 0, longitude: 0 } } })) });
  await prisma.providerBusinessProfile.createMany({ data: providerIds.map(userId => ({ ...business, userId,
    calendarConnection: { ...(business.calendarConnection as object), feedToken: `${userId}-feed` } })) });
  const historyProviderId = (index: number) => index < 10000 ? providerId : providerIds[index % size.providers];
  for (let offset = 0; offset < size.history; offset += 500) await prisma.booking.createMany({ data: Array.from({ length: 500 }, (_, row) => {
    const index = offset + row;
    return { id: `${prefix}-booking-${index}`, providerId: historyProviderId(index), customerId,
      serviceAddress: { ...address, line1: `${index % 1000} Scale Street` }, category: "lawn-mowing", requestedAt: new Date(now - 86400_000),
      scheduledStartIso: new Date(now - (size.history + 1 - index) * 3600_000), scheduledEndIso: new Date(now - (size.history - index) * 3600_000),
      status: "completed", notes: "Disposable scale fixture", totalCents: 7500, serviceEvidence: [], interventions: [], addressChangeHistory: [] };
  }) });
  // Crew workload: crew members, 500 upcoming confirmed bookings on the far-away providers, and one accepted
  // match per booking. Every upcoming booking is already fully staffed, so crew
  // reconciliation reads the tables but never creates matches or notifications during the run.
  const crewIds = Array.from({ length: size.crew }, (_, index) => `${prefix}-crew-${index}`);
  await prisma.userAccount.createMany({ data: crewIds.map(id => ({ ...user, id, email: `${id}@example.invalid`, role: "crew-member" })) });
  await prisma.crewMemberProfile.createMany({ data: crewIds.map(userId => ({ userId, bio: "Disposable scale fixture", yearsExperience: 2,
    categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"], willingToTravelMiles: 10, preferredSchedule: "flex",
    hasOwnEquipment: false, rating: 4.5, completedJobs: 10, status: "assigned" })) });
  const upcomingProviderId = (index: number) => providerIds[nearProviders + (index % 400)];
  await prisma.booking.createMany({ data: Array.from({ length: upcomingCount }, (_, index) => ({ id: `${prefix}-upcoming-${index}`,
    providerId: upcomingProviderId(index), customerId, serviceAddress: { ...address, line1: `${index} Upcoming Street` }, category: "lawn-mowing",
    requestedAt: new Date(now - 86400_000), scheduledStartIso: new Date(now + (30 + index % 30) * 86400_000),
    scheduledEndIso: new Date(now + (30 + index % 30) * 86400_000 + 3600_000), status: "confirmed", notes: "Disposable scale fixture",
    totalCents: 7500, onRouteConfirmedAt: new Date(now), serviceEvidence: [], interventions: [], addressChangeHistory: [] })) });
  const matchRow = (bookingId: string, matchProviderId: string, index: number) => ({ id: `${bookingId}-match`, bookingId, providerId: matchProviderId,
    crewMemberId: crewIds[index % size.crew], crewMemberName: "Scale Crew", crewMemberPhone: user.phone, categories: ["lawn-mowing"],
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"], preferredSchedule: "flex", willingToTravelMiles: 10, hasOwnEquipment: false,
    winterWorkEnabled: false, status: "accepted", distanceMiles: 1, hourlyRateCents: 2500, createdAt: new Date(now - index * 1000) });
  for (let offset = 0; offset < size.history; offset += 1000) await prisma.crewMatch.createMany({ data: Array.from({ length: 1000 }, (_, row) => {
    const index = offset + row;
    return matchRow(`${prefix}-booking-${index}`, historyProviderId(index), index);
  }) });
  await prisma.crewMatch.createMany({ data: Array.from({ length: upcomingCount }, (_, index) => matchRow(`${prefix}-upcoming-${index}`, upcomingProviderId(index), index)) });
  // Recurring workload. Operation i of each kind uses its own nearby provider and customer, so the operations do
  // not contend with each other: "plan-create" quotes and starts a weekly plan, "next-visit" completes the first
  // visit of a seeded plan (which generates the second), and "reschedule" moves a seeded plan visit by a week.
  const recurringKinds = ["plan", "visit", "move"] as const;
  const recurringCustomerId = (kind: typeof recurringKinds[number], index: number) => `${prefix}-customer-${kind}-${index}`;
  const customerUser = await prisma.userAccount.findUniqueOrThrow({ where: { id: customerId } });
  const customerProfile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customerId } });
  const recurringCustomerIds = recurringKinds.flatMap(kind => Array.from({ length: size.perKind }, (_, index) => recurringCustomerId(kind, index)));
  await prisma.userAccount.createMany({ data: recurringCustomerIds.map(id => ({ ...customerUser, id, email: `${id}@example.invalid` })) });
  await prisma.customerProfile.createMany({ data: recurringCustomerIds.map(userId => ({ ...customerProfile, userId })) });
  await prisma.providerCredential.createMany({ data: providerIds.slice(0, size.perKind * 3).flatMap(id => (template.credentials ?? []).map((credential, index) => ({
    id: `${id}-credential-${index}`, providerId: id, type: credential.type, status: credential.status, jurisdiction: credential.jurisdiction,
    referenceNumber: credential.referenceNumber, issuedAt: credential.issuedAt ? new Date(credential.issuedAt) : null,
    expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : null, submittedAt: new Date(credential.submittedAt) }))) });
  const day = 86400_000, hour = 3600_000;
  // Each kind writes to its own provider. Sharing one made the three writes of a turn queue on that provider's locks.
  const recurringProviderId = (kind: typeof recurringKinds[number], index: number) => providerIds[recurringKinds.indexOf(kind) * size.perKind + index];
  const seededVisit = (kind: "visit" | "move", index: number, startMs: number) => ({ id: `${prefix}-${kind}-${index}`, providerId: recurringProviderId(kind, index),
    customerId: recurringCustomerId(kind, index), serviceAddress: address, category: "lawn-mowing", requestedAt: new Date(now - day),
    scheduledStartIso: new Date(startMs), scheduledEndIso: new Date(startMs + hour), status: "confirmed", notes: "Disposable scale fixture",
    totalCents: 7500, recurringPlanId: `${prefix}-plan-${kind}-${index}`, recurringOccurrenceIndex: 1, interventions: [], addressChangeHistory: [],
    serviceEvidence: kind === "visit" ? [{ id: `${prefix}-evidence-${index}`, phase: "after", evidenceType: "photo", capturedAt: new Date(now).toISOString(),
      capturedByRole: "provider", capturedByUserId: recurringProviderId(kind, index) }] : [] });
  const visitStartMs = now + 3 * day, moveStartMs = now + 40 * day, planStartMs = now + 20 * day;
  const seededVisits = Array.from({ length: size.perKind }, (_, index) => [seededVisit("visit", index, visitStartMs), seededVisit("move", index, moveStartMs)]).flat();
  await prisma.recurringServicePlan.createMany({ data: seededVisits.map(visit => ({ id: visit.recurringPlanId, customerId: visit.customerId,
    providerId: visit.providerId, serviceAddress: address, category: "lawn-mowing", frequency: "weekly", requestedAt: visit.requestedAt, notes: visit.notes,
    totalCents: visit.totalCents, status: "active", anchorScheduledStartIso: visit.scheduledStartIso, anchorScheduledEndIso: visit.scheduledEndIso,
    lastGeneratedBookingId: visit.id })) });
  await prisma.booking.createMany({ data: seededVisits });
  await prisma.crewMatch.createMany({ data: seededVisits.map((visit, index) => matchRow(visit.id, visit.providerId, index)) });
  const identity = (userId: string, role: "customer" | "provider" | "crew-member") => ({ userId, email: `${userId}@example.invalid`, role, sessionVersion: 0 });
  await prisma.availabilitySlot.createMany({ data: [providerId, ...providerIds].flatMap(id => Array.from({ length: 5 }, (_, index) => ({
    id: `${id}-slot-${index}`, providerId: id, startIso: new Date(now + (10 + index) * 86400_000), endIso: new Date(now + (10 + index) * 86400_000 + 3600_000)
  }))) });
  await prisma.productAnalyticsEvent.createMany({ data: Array.from({ length: 10000 }, (_, index) => ({ id: `${prefix}-event-${index}`,
    name: "page_viewed", environment: prefix, source: "client", occurredAt: new Date(now), properties: { anonymousId: `${prefix}-person-${index % 500}`, origin: "client" } })) });
  await prisma.notificationDelivery.createMany({ data: Array.from({ length: 250 }, (_, index) => ({ id: `${prefix}-delivery-${index}`,
    notificationId: `${prefix}-notice-${index}`, recipientId: providerId, recipientRole: "provider", category: "booking", channel: "email",
    destination: "scale@example.invalid", provider: "queued", status: "queued", title: "Scale", bodyPreview: "Scale", createdAt: new Date() })) });
  let sends = 0;
  (platform as unknown as { notificationDelivery: { dispatch: () => Promise<{provider: string; sentAt: string}> } }).notificationDelivery.dispatch = async () => { sends++; return { provider: "scale-stub", sentAt: new Date().toISOString() }; };
  // Refresh planner statistics after the bulk load, as autovacuum does in a running database. Without this the
  // plans for the first queries depend on whether autovacuum happened to reach these tables yet.
  await prisma.$executeRawUnsafe(`ANALYZE user_accounts, provider_business_profiles, crew_member_profiles, bookings, crew_matches, availability_slots`);
  const password = await hashPassword("ScaleTest123!");
  await platform.searchProviders({ address, categories: ["lawn-mowing"] });
  queryTimes.length = 0; slowestQueries = []; delay.enable();
  const screenKinds = ["public-overview", "calendar-feed", "provider-calendar", "provider-payouts", "crew-payouts", "staffing-overview",
    "ops-verification-queue", "ops-payout-preview"], screenOperations = 20;
  const start = performance.now(), latencies: Record<string, number[]> = {}, errors: string[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  const kinds = ["search", "clients", "password", "route-write", "analytics", "gps-ping", "arrival-tracking", "crew-matches", "crew-opportunities",
    "plan-create", "next-visit", "reschedule",
    // Screens that still load whole tables are slow enough to fail the default gate, so they run only in the large
    // comparison, and fewer times each: on 200,000 bookings one of them can hold the process for minutes.
    ...(large ? screenKinds : [])];
  const onlyKinds = process.env.SCALE_KINDS?.split(",");
  const operations = Array.from({ length: size.perKind }, (_, turn) => kinds.filter(kind => !onlyKinds || onlyKinds.includes(kind)).filter(kind => !screenKinds.includes(kind) || turn < screenOperations).map(kind => ({ kind, turn })))
    .flat().map((operation, index) => ({ ...operation, index }));
  // Seeded matches a crew member holds: the fixture gives match i to crew member i % crew.
  const seededMatchCount = (crewIndex: number) => [size.history, upcomingCount].reduce((sum, rows) => sum + (crewIndex < rows ? Math.ceil((rows - crewIndex) / size.crew) : 0), 0);
  const isSeededCrewJob = (bookingId: string) => bookingId.startsWith(`${prefix}-booking-`) || bookingId.startsWith(`${prefix}-upcoming-`);
  const notifications = (async () => { while (await repository.countDueNotificationDeliveries(new Date().toISOString())) await platform.retryDueNotificationDeliveriesForOps(); })();
  notifications.catch(() => {}); // Awaited below; this only stops a failure during the run from ending the process first.
  await mapConcurrent(operations, size.concurrency, async ({ kind, turn, index }) => {
    const began = performance.now(), firstStatement = queryLog.length;
    try {
      if (kind === "search") assert.equal((await platform.searchProviders({ address, categories: ["lawn-mowing"] })).providers.length, 3);
      if (kind === "clients") assert.equal((await platform.getProviderClients(providerId)).properties.length, 1000);
      if (kind === "password") assert.equal(await verifyPassword("ScaleTest123!", password), true);
      if (kind === "route-write") await prisma.booking.update({ where: { id: `${prefix}-booking-${index}` }, data: { routeLiveUpdatedAt: new Date(), routeLivePoint: address.point } });
      if (kind === "analytics") { await analytics.collect({ id: `${prefix}-live-${index}`, name: "action_clicked", occurredAt: new Date().toISOString(), properties: { action: "continue" } }); await analytics.report(); }
      if (kind === "gps-ping") assert.equal((await platform.updateBookingRouteLocation(identity(upcomingProviderId(index % upcomingCount), "provider"),
        { bookingId: `${prefix}-upcoming-${index % upcomingCount}`, point: address.point, speedMph: 20, accuracyMeters: 8 })).bookingId, `${prefix}-upcoming-${index % upcomingCount}`);
      if (kind === "arrival-tracking") assert.equal((await platform.getBookingArrivalTracking(
        index % 2 ? identity(customerId, "customer") : identity(crewIds[index % size.crew], "crew-member"), `${prefix}-upcoming-${index % upcomingCount}`)).customerId, customerId);
      // The recurring workload adds and changes matches while this runs, so only the fixed history and upcoming jobs are counted.
      if (kind === "crew-matches") assert.equal((await platform.getCrewMatchesForCrew(crewIds[index % size.crew])).matches.filter(match => isSeededCrewJob(match.bookingId)).length, seededMatchCount(index % size.crew));
      if (kind === "crew-opportunities") assert.equal((await platform.listCrewOpportunities()).filter(item => item.id.startsWith(`${prefix}-upcoming-`)).length, upcomingCount);
      if (kind === "plan-create") {
        const planCustomerId = recurringCustomerId("plan", turn);
        const quote = await platform.createInstantQuote({ customerId: planCustomerId, address, category: "lawn-mowing", providerId: recurringProviderId("plan", turn) });
        const created = await platform.createRecurringServicePlan(planCustomerId, { providerId: recurringProviderId("plan", turn), serviceAddress: address, category: "lawn-mowing",
          scheduledStartIso: new Date(planStartMs).toISOString(), scheduledEndIso: new Date(planStartMs + hour).toISOString(), notes: "Disposable scale fixture",
          totalCents: quote.estimatedPriceCents, quoteToken: quote.quoteToken, frequency: "weekly" });
        assert.equal(created.plan.upcomingBooking?.id, created.initialBooking.id);
      }
      if (kind === "public-overview") assert.ok((await platform.getPublicMarketplaceOverview()).verifiedProviderCount >= size.providers);
      if (kind === "calendar-feed") assert.match(await platform.buildCalendarFeedByToken(`${upcomingProviderId(turn)}-feed`), /BEGIN:VCALENDAR/);
      if (kind === "provider-calendar") assert.ok((await platform.getProviderCalendarOverview(upcomingProviderId(turn),
        { fromIso: new Date(now).toISOString(), toIso: new Date(now + 70 * day).toISOString() })).events.length >= 1);
      if (kind === "provider-payouts") assert.ok(await platform.getProviderPayoutLedger(upcomingProviderId(turn)));
      if (kind === "crew-payouts") assert.ok(await platform.getCrewPayoutLedger(crewIds[turn % size.crew]));
      if (kind === "staffing-overview") assert.ok((await platform.getProviderStaffingOverview(upcomingProviderId(turn))).jobs.length >= 1);
      if (kind === "ops-verification-queue") assert.ok(await platform.listProviderVerificationQueue());
      if (kind === "ops-payout-preview") assert.ok(await platform.getOpsPayoutPreview());
      if (kind === "next-visit") assert.equal((await platform.completeBooking(recurringProviderId("visit", turn), { bookingId: `${prefix}-visit-${turn}` })).status, "completed");
      if (kind === "reschedule") assert.equal((await platform.rescheduleBooking(recurringCustomerId("move", turn), { bookingId: `${prefix}-move-${turn}`,
        scheduledStartIso: new Date(moveStartMs + 7 * day).toISOString(), scheduledEndIso: new Date(moveStartMs + 7 * day + hour).toISOString() })).scheduledStartIso,
        new Date(moveStartMs + 7 * day).toISOString());
    } catch (error) { errors.push(`${kind}: ${error instanceof Error ? error.message : String(error)}`); }
    (latencies[kind] ??= []).push(performance.now() - began);
    if (profiling) {
      const entry = (profile[kind] ??= { operations: 0, totalMs: 0, queryMs: 0, statements: new Map() });
      entry.operations++; entry.totalMs += performance.now() - began;
      for (const statement of queryLog.slice(firstStatement)) {
        const key = statement.sql.replace(/\$\d+/g, "?").replace(/(\?, ?)+\?/g, "?…").slice(0, 150);
        const row = entry.statements.get(key) ?? { count: 0, ms: 0 };
        row.count++; row.ms += statement.ms; entry.statements.set(key, row); entry.queryMs += statement.ms;
      }
    }
  });
  await notifications; await analytics.drain(); delay.disable();
  const stats = Object.fromEntries(Object.entries(latencies).map(([kind, values]) => [kind, {
    operations: values.length, p95Ms: Math.round(percentile(values, 0.95)), p99Ms: Math.round(percentile(values, 0.99)) }]));
  // Each completed first visit generated exactly one second visit, and each new plan has its first.
  const generated = await prisma.booking.groupBy({ by: ["recurringOccurrenceIndex"], where: { customerId: { in: recurringCustomerIds }, id: { not: { startsWith: prefix } } }, _count: true });
  const seededRows = size.history + upcomingCount + seededVisits.length;
  const result = { dataset: { large, providers: size.providers + 1, bookings: seededRows, crewMembers: size.crew, crewMatches: seededRows, properties: 1000,
      recurringPlans: seededVisits.length, analyticsEvents: 10000, notifications: 250 },
    concurrency: size.concurrency, databaseConnections: size.connections, operations: operations.length, elapsedMs: Math.round(performance.now() - start),
    latency: stats, queries: { count: queryTimes.length, p95Ms: percentile(queryTimes, 0.95), p99Ms: percentile(queryTimes, 0.99), slowest: slowestQueries },
    eventLoopP99Ms: Math.round(delay.percentile(99) / 1e6), heapGrowthMb: Math.round((process.memoryUsage().heapUsed - heapBefore) / 1048576),
    rssMb: Math.round(process.memoryUsage().rss / 1048576), delivered: sends, errors };
  console.log(JSON.stringify(result, null, 2));
  if (profiling) console.log(JSON.stringify(Object.fromEntries(Object.entries(profile).map(([kind, entry]) => [kind, {
    msPerOperation: Math.round(entry.totalMs / entry.operations), queryMsPerOperation: Math.round(entry.queryMs / entry.operations),
    statementsPerOperation: Math.round([...entry.statements.values()].reduce((sum, row) => sum + row.count, 0) / entry.operations),
    slowest: [...entry.statements.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 5).map(([sql, row]) =>
      `${(row.ms / entry.operations).toFixed(1)} ms, ${(row.count / entry.operations).toFixed(1)}x: ${sql}`),
    mostRepeated: [...entry.statements.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 18).map(([sql, row]) =>
      `${(row.count / entry.operations).toFixed(1)}x: ${sql}`) }])), null, 2));
  assert.equal(errors.length, 0);
  // The recurring workload queues its own notifications, so the seeded 250 are checked by id.
  assert.equal(await prisma.notificationDelivery.count({ where: { id: { startsWith: prefix }, status: "queued" } }), 0);
  assert.ok(sends >= 250);
  assert.deepEqual(generated.map(row => [row.recurringOccurrenceIndex, row._count]).sort(), [[1, size.perKind], [2, size.perKind]]);
  const maxP95 = Number(process.env.SCALE_MAX_P95_MS ?? 2500);
  assert.ok(Object.values(stats).every(stat => stat.p95Ms <= maxP95), `Operation p95 exceeded ${maxP95}ms`);
  assert.ok(result.eventLoopP99Ms < 500, "Event loop p99 exceeded 500ms");
} finally {
  delay.disable(); await analytics.drain().catch(() => {});
  await prisma.notificationDelivery.deleteMany({ where: { OR: [{ id: { startsWith: prefix } }, { recipientId: { startsWith: prefix } }] } });
  await prisma.appNotification.deleteMany({ where: { recipientId: { startsWith: prefix } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { startsWith: prefix } } });
  await prisma.productAnalyticsEvent.deleteMany({ where: { environment: prefix } });
  await prisma.finderFeeCharge.deleteMany({ where: { providerId: { startsWith: prefix } } });
  await prisma.reviewInvite.deleteMany({ where: { providerId: { startsWith: prefix } } });
  await prisma.crewMatch.deleteMany({ where: { providerId: { startsWith: prefix } } });
  await prisma.booking.deleteMany({ where: { providerId: { startsWith: prefix } } });
  await prisma.recurringServicePlan.deleteMany({ where: { providerId: { startsWith: prefix } } });
  await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
}
