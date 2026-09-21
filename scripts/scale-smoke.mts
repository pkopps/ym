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

const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://missing/missing");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/test|scale/i.test(url.pathname)) {
  throw new Error("Use TEST_DATABASE_URL for a disposable local database whose name includes test or scale.");
}
url.searchParams.set("connection_limit", "8"); url.searchParams.set("pool_timeout", "10");
for (const key of ["GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "POSTHOG_API_KEY"]) delete process.env[key];
const prefix = `scale-load-${crypto.randomUUID()}`;
process.env.YARDMATCH_ENV = prefix;
const prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [{ emit: "event", level: "query" }] });
const queryTimes: number[] = [];
prisma.$on("query", event => queryTimes.push(event.duration));
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
  const providerIds = Array.from({ length: 600 }, (_, index) => `${prefix}-provider-${index}`);
  await prisma.userAccount.createMany({ data: providerIds.map((id, index) => ({ ...user, id, email: `${id}@example.invalid`,
    address: index < 200 ? address : { ...address, point: { latitude: 0, longitude: 0 } } })) });
  await prisma.providerBusinessProfile.createMany({ data: providerIds.map(userId => ({ ...business, userId })) });
  for (let offset = 0; offset < 20000; offset += 500) await prisma.booking.createMany({ data: Array.from({ length: 500 }, (_, row) => {
    const index = offset + row;
    return { id: `${prefix}-booking-${index}`, providerId: index < 10000 ? providerId : providerIds[index % 600], customerId,
      serviceAddress: { ...address, line1: `${index % 1000} Scale Street` }, category: "lawn-mowing", requestedAt: new Date(now - 86400_000),
      scheduledStartIso: new Date(now - (20001 - index) * 3600_000), scheduledEndIso: new Date(now - (20000 - index) * 3600_000),
      status: "completed", notes: "Disposable scale fixture", totalCents: 7500, serviceEvidence: [], interventions: [], addressChangeHistory: [] };
  }) });
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
  const password = await hashPassword("ScaleTest123!");
  await platform.searchProviders({ address, categories: ["lawn-mowing"] });
  queryTimes.length = 0; delay.enable();
  const start = performance.now(), latencies: Record<string, number[]> = {}, errors: string[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  const operations = Array.from({ length: 200 }, (_, index) => index);
  const notifications = (async () => { while (await repository.countDueNotificationDeliveries(new Date().toISOString())) await platform.retryDueNotificationDeliveriesForOps(); })();
  await mapConcurrent(operations, 12, async index => {
    const kind = ["search", "clients", "password", "route-write", "analytics"][index % 5], began = performance.now();
    try {
      if (kind === "search") assert.equal((await platform.searchProviders({ address, categories: ["lawn-mowing"] })).providers.length, 3);
      if (kind === "clients") assert.equal((await platform.getProviderClients(providerId)).properties.length, 1000);
      if (kind === "password") assert.equal(await verifyPassword("ScaleTest123!", password), true);
      if (kind === "route-write") await prisma.booking.update({ where: { id: `${prefix}-booking-${index}` }, data: { routeLiveUpdatedAt: new Date(), routeLivePoint: address.point } });
      if (kind === "analytics") { await analytics.collect({ id: `${prefix}-live-${index}`, name: "action_clicked", occurredAt: new Date().toISOString(), properties: { action: "continue" } }); await analytics.report(); }
    } catch (error) { errors.push(`${kind}: ${error instanceof Error ? error.message : String(error)}`); }
    (latencies[kind] ??= []).push(performance.now() - began);
  });
  await notifications; await analytics.drain(); delay.disable();
  const stats = Object.fromEntries(Object.entries(latencies).map(([kind, values]) => [kind, {
    operations: values.length, p95Ms: Math.round(percentile(values, 0.95)), p99Ms: Math.round(percentile(values, 0.99)) }]));
  const result = { dataset: { providers: 601, bookings: 20000, properties: 1000, analyticsEvents: 10000, notifications: 250 },
    concurrency: 12, databaseConnections: 8, operations: operations.length, elapsedMs: Math.round(performance.now() - start),
    latency: stats, queries: { count: queryTimes.length, p95Ms: percentile(queryTimes, 0.95), p99Ms: percentile(queryTimes, 0.99) },
    eventLoopP99Ms: Math.round(delay.percentile(99) / 1e6), heapGrowthMb: Math.round((process.memoryUsage().heapUsed - heapBefore) / 1048576),
    rssMb: Math.round(process.memoryUsage().rss / 1048576), delivered: sends, errors };
  console.log(JSON.stringify(result, null, 2));
  assert.equal(errors.length, 0); assert.equal(sends, 250);
  const maxP95 = Number(process.env.SCALE_MAX_P95_MS ?? 2500);
  assert.ok(Object.values(stats).every(stat => stat.p95Ms <= maxP95), `Operation p95 exceeded ${maxP95}ms`);
  assert.ok(result.eventLoopP99Ms < 500, "Event loop p99 exceeded 500ms");
} finally {
  delay.disable(); await analytics.drain().catch(() => {});
  await prisma.notificationDelivery.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.appNotification.deleteMany({ where: { recipientId: { startsWith: prefix } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { startsWith: prefix } } });
  await prisma.productAnalyticsEvent.deleteMany({ where: { environment: prefix } });
  await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
}
