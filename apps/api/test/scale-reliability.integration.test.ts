import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { AnalyticsEvent, Booking } from "@yardmatch/contracts";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { summarizeNotificationHealth } from "../src/repositories/notificationHealth";
import { bookingMetrics } from "../src/repositories/searchQueries";
import { buildProviderClientProperties } from "../src/services/providerClients";
import { readAnalyticsReport } from "../src/observability/analyticsReport";
import { buildAnalyticsFunnel } from "../src/observability/analyticsFunnel";

const url = process.env.TEST_DATABASE_URL;
const options = { skip: !url };

test("Postgres workers claim each notification once, recover crashes, fence old acknowledgements, and roll back outbox writes", options, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const a = new PrismaMarketplaceRepository(prisma), b = new PrismaMarketplaceRepository(prisma);
  const prefix = `scale-notification-${crypto.randomUUID()}`;
  const now = new Date(), later = new Date(now.getTime() + 61_000);
  try {
    // Use a non-UTC database session: raw SQL must compare UTC timestamp columns correctly.
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'America/New_York'`;
      const repository = new PrismaMarketplaceRepository(tx as unknown as PrismaClient);
      await repository.createNotificationDelivery({ id: prefix, notificationId: prefix, recipientId: prefix,
        recipientRole: "customer", category: "booking", channel: "email", destination: "fixture@example.invalid",
        provider: "queued", status: "failed", nextRetryAt: now.toISOString(), title: "Test", bodyPreview: "Test",
        attemptCount: 0, createdAt: new Date(0).toISOString() });
      const first = (await repository.claimNotificationDeliveries(1, now.toISOString(), 60))[0];
      assert.equal(first.id, prefix);
    });
    assert.equal((await a.claimNotificationDeliveries(1, now.toISOString(), 60)).some(row => row.id === prefix), false);
    const claims = await Promise.all([a, b].map(repository => repository.claimNotificationDeliveries(1, later.toISOString(), 60)));
    const claimed = claims.flat().filter(row => row.id === prefix);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].attemptCount, 2);
    assert.equal(await b.completeNotificationDelivery(prefix, "stale-token", { status: "sent" }), undefined);
    const third = (await a.claimNotificationDeliveries(1, new Date(now.getTime() + 122_000).toISOString(), 60)).find(row => row.id === prefix)!;
    assert.equal(third.attemptCount, 3);
    assert.equal(await a.completeNotificationDelivery(prefix, claimed[0].leaseToken, { status: "sent" }), undefined);
    await b.claimNotificationDeliveries(1, new Date(now.getTime() + 183_000).toISOString(), 60);
    const exhausted = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: prefix } });
    assert.equal(exhausted.status, "failed"); assert.equal(exhausted.nextRetryAt, null);
    assert.match(exhausted.errorMessage!, /manual review/);
    assert.deepEqual(await a.getNotificationHealth(now.toISOString()), summarizeNotificationHealth(await a.listAllNotificationDeliveries(), +now));
    await assert.rejects(a.withLock(prefix, async repository => {
      await repository.createNotification({ id: prefix, recipientId: prefix, recipientRole: "customer", category: "booking",
        title: "Atomic", body: "Atomic", isRead: false, createdAt: now.toISOString() });
      throw new Error("simulated outbox failure");
    }), /simulated/);
    assert.equal(await a.findNotificationById(prefix), undefined);
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.appNotification.deleteMany({ where: { id: prefix } });
    await prisma.$disconnect();
  }
});

test("Postgres search pages and client summaries match domain rules without loading booking history", options, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const repository = new PrismaMarketplaceRepository(prisma), fixtures = new InMemoryMarketplaceRepository();
  const prefix = `scale-query-${crypto.randomUUID()}`;
  const [template] = await fixtures.listProviders();
  const provider = { ...template, id: `${prefix}-provider`, email: `${prefix}@example.invalid`, credentials: [], minimumBookingLeadHours: 0 };
  const customer = { ...template, role: "customer" as const, propertyNotes: "", lawnSizeSqFt: 1000, id: `${prefix}-customer`, email: `${prefix}-customer@example.invalid`, properties: [], defaultPropertyId: "" };
  const now = Date.now(), address = { ...template.address, line1: " 12   Scale Way ", line2: "Unit 1" };
  const bookings: Booking[] = Array.from({ length: 2000 }, (_, index) => ({ id: `${prefix}-${String(index).padStart(5, "0")}`,
    customerId: customer.id, providerId: provider.id, serviceAddress: index % 2 ? address : { ...address, line1: "12 scale way", line2: "unit 1" },
    category: "lawn-mowing", requestedAt: new Date(now - 86400_000).toISOString(),
    scheduledStartIso: new Date(now + (index - 1990) * 3600_000).toISOString(),
    scheduledEndIso: new Date(now + (index - 1989) * 3600_000).toISOString(),
    status: index < 1990 ? "completed" : "confirmed", notes: "Isolated scale fixture", totalCents: 7500,
    serviceEvidence: [], interventions: [], addressChangeHistory: [] }));
  bookings.push({ ...bookings[0], id: `${prefix}-unit2`, serviceAddress: { ...address, line2: "Unit 2" } });
  bookings.push({ ...bookings[0], id: `${prefix}-cancelled`, status: "cancelled", serviceAddress: { ...address, line1: "Private cancelled address" } });
  try {
    await repository.createCustomer(customer); await repository.createProvider(provider);
    for (let offset = 0; offset < bookings.length; offset += 500) await prisma.booking.createMany({ data: bookings.slice(offset, offset + 500).map(booking => ({
      id: booking.id, customerId: booking.customerId, providerId: booking.providerId, serviceAddress: booking.serviceAddress as unknown as Prisma.InputJsonValue,
      category: booking.category, requestedAt: new Date(booking.requestedAt), scheduledStartIso: new Date(booking.scheduledStartIso),
      scheduledEndIso: new Date(booking.scheduledEndIso), status: booking.status, notes: booking.notes, totalCents: booking.totalCents,
      serviceEvidence: [], interventions: [], addressChangeHistory: [] })) });
    const actual = await repository.getProviderClientProperties(provider.id, new Date(now).toISOString());
    assert.equal(actual.length, 2);
    assert.deepEqual(actual, buildProviderClientProperties(provider.id, bookings, [customer], [], now));
    assert.deepEqual(await repository.getProviderBookingMetrics([provider.id], address), [bookingMetrics(provider.id, bookings, address)]);
    const blockedStart = new Date(now + 86400_000), blockedEnd = new Date(now + 2 * 86400_000);
    await repository.updateProvider(provider.id, { calendarConnection: { ...provider.calendarConnection, externalEventsBlockingEnabled: true,
      externalBlocks: [{ id: prefix, title: "External work", blockType: "busy", startIso: blockedStart.toISOString(), endIso: blockedEnd.toISOString(), source: "manual", createdAt: new Date(now).toISOString() }] } });
    await prisma.availabilitySlot.createMany({ data: Array.from({ length: 30 }, (_, index) => ({ id: `${prefix}-slot-${index}`,
      providerId: provider.id, startIso: new Date(now + index * 3 * 3600_000), endIso: new Date(now + (index * 3 + 1) * 3600_000) })) });
    const slots = await repository.listSearchSlots([provider.id], 60);
    assert.equal(slots.length, 3);
    assert.ok(slots.every(slot => Date.parse(slot.startIso) > now && !(Date.parse(slot.startIso) < +blockedEnd && Date.parse(slot.endIso) > +blockedStart)));
    assert.ok((await repository.searchProvidersPage({ address, categories: provider.categories })).items.some(item => item.id === provider.id));
    assert.equal((await repository.searchProvidersPage({ address: { ...address, point: { latitude: 0, longitude: 0 } }, categories: provider.categories })).items.some(item => item.id === provider.id), false);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: [provider.id, customer.id] } } });
    await prisma.$disconnect();
  }
});

test("Postgres analytics preserves ordered identity-linked funnels and counts beyond 50,000 events", options, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const environment = `scale-${crypto.randomUUID()}`, now = Date.now();
  const event = (name: string, index: number, actorId?: string, properties: AnalyticsEvent["properties"] = {}): AnalyticsEvent => ({
    id: `${environment}-${index}`, name, occurredAt: new Date(now - 60000 + index * 10).toISOString(), actorId, properties });
  const events = [event("page_viewed", 0, undefined, { anonymousId: "visitor", origin: "client", source: "local", platform: "web", locale: "en" }),
    event("journey_identified", 1, "customer", { anonymousId: "visitor" }), event("instant_quote_generated", 2, "customer", { serviceCategory: "lawn-mowing" }),
    event("provider_search_performed", 3, "customer"), event("recommendation_presented", 4, "customer"),
    event("booking_requested", 5, "customer", { bookingId: "booking" }), event("booking_confirmed", 6, "provider", { bookingId: "booking" }),
    event("payment_captured", 7, "booking"), event("booking_completed", 8, "provider", { bookingId: "booking" }),
    event("booking_completed", 9, undefined, { customerId: "customer", bookingId: "booking-2" }),
    event("screen_viewed", 10, "other"), event("payment_captured", 11, "other", { origin: "client" }),
    event("journey_feedback", 12, "other", { reason: "too-early" }), event("web_vital", 13, "customer", { metric: "LCP", value: 123 })];
  try {
    await prisma.productAnalyticsEvent.createMany({ data: events.map(item => ({ ...item, occurredAt: new Date(item.occurredAt), environment, source: "server", properties: item.properties as Prisma.InputJsonValue })) });
    const report = await readAnalyticsReport(prisma, environment, new Date(now - 86400_000));
    assert.deepEqual(report.funnel, buildAnalyticsFunnel(events));
    assert.deepEqual(report.performance, { LCP: { samples: 1, p75: 123 } });
    await prisma.$executeRaw`INSERT INTO "ProductAnalyticsEvent" (id, name, "occurredAt", environment, source, properties)
      SELECT ${environment} || '-bulk-' || n, 'action_clicked', CURRENT_TIMESTAMP AT TIME ZONE 'UTC', ${environment}, 'client',
        '{"anonymousId":"bulk-visitor","action":"continue","origin":"client"}'::jsonb FROM generate_series(1, 50001) n`;
    const large = await readAnalyticsReport(prisma, environment, new Date(now - 86400_000));
    assert.equal(large.events, 50001 + events.length); assert.equal(large.truncated, false);
    assert.equal(large.actions.continue, 50001);
    assert.deepEqual(large.funnel, report.funnel);
  } finally { await prisma.productAnalyticsEvent.deleteMany({ where: { environment } }); await prisma.$disconnect(); }
});
