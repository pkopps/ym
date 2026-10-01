import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { AppNotification } from "@yardmatch/contracts";
import type { NotificationDeliveryService } from "../src/services/NotificationDeliveryService";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { hashPassword, verifyPassword } from "../src/auth";
import { BoundedExecutor } from "../src/concurrency";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

type TestHooks = { notificationDelivery: NotificationDeliveryService; calendarFeedLoader: (url: string) => Promise<string>;
  createNotification: (payload: Omit<AppNotification, "id" | "isRead" | "createdAt">) => Promise<AppNotification> };

test("password work preserves the hash format and leaves the event loop responsive", async () => {
  const hash = await hashPassword("ScaleReady123!");
  assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await verifyPassword("ScaleReady123!", hash), true);
  assert.equal(await verifyPassword("Wrong123!", hash), false);
  assert.equal(await verifyPassword("ScaleReady123!", "broken:hash"), false);
  let finished = false;
  const work = Promise.all(Array.from({ length: 20 }, () => verifyPassword("ScaleReady123!", hash))).then(() => { finished = true; });
  await delay(0);
  assert.equal(finished, false, "timers must run while expensive password work is outstanding");
  await work;
});

test("password admission bounds waiting work and releases capacity after failure", async () => {
  const executor = new BoundedExecutor(1, 1);
  let release!: () => void;
  const first = executor.run(() => new Promise<void>(resolve => { release = resolve; }));
  const second = executor.run(async () => { throw new Error("expected failure"); });
  const rejected = assert.rejects(second, /expected failure/);
  await assert.rejects(executor.run(async () => 3), /service is busy/);
  release(); await first; await rejected;
  assert.equal(await executor.run(async () => 4), 4);
});

test("notification leases recover abandoned work and reject a stale worker completion", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const now = new Date().toISOString();
  await repository.createNotificationDelivery({ id: "lease", notificationId: "notice", recipientId: "customer",
    recipientRole: "customer", category: "booking", channel: "email", destination: "local@example.invalid",
    provider: "queued", status: "queued", title: "Test", bodyPreview: "Test", attemptCount: 0, createdAt: now });
  const [first] = await repository.claimNotificationDeliveries(5, now, 60);
  assert.equal((await repository.claimNotificationDeliveries(5, now, 60)).length, 0);
  const later = new Date(Date.parse(now) + 61_000).toISOString();
  const [second] = await repository.claimNotificationDeliveries(5, later, 60);
  assert.equal(second.attemptCount, 2);
  assert.equal(await repository.completeNotificationDelivery("lease", first.leaseToken, { status: "sent" }), undefined);
  assert.equal((await repository.completeNotificationDelivery("lease", second.leaseToken, { status: "sent" }))?.status, "sent");
});

test("notification creation queues atomically without vendor work and sweeps cap concurrency", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  let sends = 0, active = 0, peak = 0;
  (platform as unknown as TestHooks).notificationDelivery.dispatch = async () => {
    sends++; peak = Math.max(peak, ++active); await delay(2); active--;
    return { provider: "local-test", sentAt: new Date().toISOString() };
  };
  const [provider] = await repository.listProviders();
  for (let i = 0; i < 12; i++) await (platform as unknown as TestHooks).createNotification({ recipientId: provider.id,
    recipientRole: "provider", category: "booking", title: "Test", body: "Test" });
  assert.equal(sends, 0);
  assert.ok(await repository.countDueNotificationDeliveries(new Date().toISOString()) > 5);
  const [result, concurrent] = await Promise.all([platform.retryDueNotificationDeliveriesForOps(), platform.retryDueNotificationDeliveriesForOps()]);
  assert.equal(result.sentCount, sends);
  assert.equal(concurrent.sentCount, sends);
  assert.ok(peak <= 5);
  assert.equal(result.remainingOverdueCount, 0);
  assert.equal((await platform.retryDueNotificationDeliveriesForOps()).retriedCount, 0);
});

test("search scans bounded provider pages and never requests marketplace booking history", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const [template] = await repository.listProviders();
  for (let index = 0; index < 205; index++) await repository.createProvider({ ...template,
    id: `scale-provider-${String(index).padStart(3, "0")}`, email: `scale-${index}@example.invalid` });
  const search = repository.searchProvidersPage.bind(repository);
  const pageSizes: number[] = [];
  repository.searchProvidersPage = async query => { const page = await search(query); pageSizes.push(page.items.length); return page; };
  repository.listProviders = async () => { throw new Error("Unscoped provider read"); };
  repository.listBookings = async () => { throw new Error("Unscoped booking read"); };
  repository.listAllSlots = async () => { throw new Error("Unscoped slot read"); };
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const result = await platform.searchProviders({ address: template.address, categories: template.categories });
  assert.equal(result.providers.length, 3);
  assert.ok(result.totalMatches >= 206);
  assert.ok(result.suggestedSlots.length <= 9);
  assert.ok(pageSizes.length >= 3);
  assert.ok(pageSizes.every(size => size <= 100));

  const firstDirectoryPage = await platform.searchProviders({
    address: template.address, categories: template.categories, directory: { offset: 0, limit: 12 }
  });
  const secondDirectoryPage = await platform.searchProviders({
    address: template.address, categories: template.categories, directory: { offset: 12, limit: 12 }
  });
  assert.equal(firstDirectoryPage.totalMatches, result.totalMatches);
  assert.equal(secondDirectoryPage.totalMatches, result.totalMatches);
  assert.equal(firstDirectoryPage.rankedProviders.length, 12);
  assert.equal(secondDirectoryPage.rankedProviders.length, 12);
  assert.deepEqual(firstDirectoryPage.providers.slice(0, 3).map(provider => provider.id), result.providers.map(provider => provider.id));
  assert.equal(new Set([...firstDirectoryPage.providers, ...secondDirectoryPage.providers].map(provider => provider.id)).size, 24);
  assert.equal("email" in secondDirectoryPage.providers[0], false);
  await assert.rejects(platform.searchProviders({
    address: template.address, categories: template.categories, directory: { offset: 0, limit: 25 }
  }), /limit from 1 to 24/);
});

test("calendar fetch releases the calendar lock and a late fetch cannot overwrite a newer sync or deleted feed", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const [provider] = await repository.listProviders();
  (platform as unknown as TestHooks).calendarFeedLoader = async () => "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
  const created = await platform.createProviderCalendarImport(provider.id, { title: "Scale feed", provider: "other", feedUrl: "https://calendar.example.invalid/feed.ics" });
  const subscriptionId = created.subscriptions[0].id;
  let unblock!: (value: string) => void, started!: () => void;
  const fetching = new Promise<void>(resolve => { started = resolve; });
  (platform as unknown as TestHooks).calendarFeedLoader = () => { started(); return new Promise<string>(resolve => { unblock = resolve; }); };
  const pending = platform.syncProviderCalendarImport(provider.id, { subscriptionId });
  const rejected = assert.rejects(pending, /changed during synchronization/);
  await fetching;
  await Promise.race([repository.withLock(`calendar:${provider.id}`, async locked => {
    const current = (await locked.findProviderById(provider.id))!;
    await locked.updateProvider(provider.id, { calendarConnection: { ...current.calendarConnection,
      externalSubscriptions: current.calendarConnection.externalSubscriptions!.map(item => ({ ...item, syncRevision: "newer-sync" })) } });
  }), delay(500).then(() => { throw new Error("Calendar lock held during network fetch"); })]);
  unblock("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"); await rejected;
  const deleted = platform.syncProviderCalendarImport(provider.id, { subscriptionId });
  const missing = assert.rejects(deleted, /Calendar import not found/);
  await delay(0);
  await repository.withLock(`calendar:${provider.id}`, async locked => {
    const current = (await locked.findProviderById(provider.id))!;
    await locked.updateProvider(provider.id, { calendarConnection: { ...current.calendarConnection, externalSubscriptions: [] } });
  });
  unblock("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"); await missing;
  assert.equal((await repository.findProviderById(provider.id))!.calendarConnection.externalSubscriptions!.length, 0);
});


test("provider profile, client overview, and reminder polling use scoped reads and deduplicate concurrent reminders", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const [provider] = await repository.listProviders();
  const now = Date.now();
  await repository.createBooking({ id: "scale-upcoming", providerId: provider.id, customerId: "scale-customer", category: "lawn-mowing",
    serviceAddress: provider.address, requestedAt: new Date(now).toISOString(), scheduledStartIso: new Date(now + 300_000).toISOString(),
    scheduledEndIso: new Date(now + 3600_000).toISOString(), status: "confirmed", notes: "", totalCents: 7500,
    serviceEvidence: [], interventions: [], addressChangeHistory: [] });
  repository.listBookings = async () => { throw new Error("Unscoped booking read"); };
  repository.listCrewMatches = async () => { throw new Error("Unscoped crew read"); };
  const customers = repository.listCustomers.bind(repository);
  repository.listCustomers = async ids => { assert.ok(ids); return customers(ids); };
  assert.equal((await platform.getProviderProfile(provider.id)).id, provider.id);
  assert.equal((await platform.getProviderClients(provider.id)).properties.length, 1);
  await Promise.all(Array.from({ length: 8 }, () => platform.listNotifications({ userId: provider.id, role: "provider" })));
  const notices = (await repository.listNotificationsByRecipient(provider.id)).filter(item => item.actionHref?.includes("reminder=departure"));
  assert.equal(notices.length, 1);
});

test("analytics acknowledges persisted events while new events continue to arrive", async () => {
  const { ProductAnalytics } = await import("../src/observability/ProductAnalytics");
  const saved = new Set<string>();
  let continuous = true, counter = 0;
  const database = { productAnalyticsEvent: { createMany: async ({data}: {data: Array<{id: string}>}) => {
    data.forEach(item => saved.add(item.id));
    if (continuous) analytics.record({ id: `arriving-${counter++}`, name: "page_viewed", occurredAt: new Date().toISOString(), properties: {} });
  } } };
  const analytics: InstanceType<typeof ProductAnalytics> = new ProductAnalytics(database as unknown as import("@prisma/client").PrismaClient);
  await analytics.collect({ id: "acknowledge-me", name: "page_viewed", occurredAt: new Date().toISOString(), properties: {} });
  assert.equal(saved.has("acknowledge-me"), true);
  assert.equal(counter, 1, "later arrivals must not extend the current flush indefinitely");
  continuous = false;
  await analytics.drain();
  assert.equal(saved.has("arriving-0"), true);
});
