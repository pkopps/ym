import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL;
test("Postgres persists bundled services, serializes booking retries, queues one receipt and filters reserved openings", { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const repository = new PrismaMarketplaceRepository(prisma);
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const prefix = `booking-journey-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const provider = { ...template!, id: `${prefix}-provider`, email: `${prefix}-provider@example.invalid`, credentials: [], minimumBookingLeadHours: 0 };
  const customerId = `${prefix}-customer`;
  const now = Date.now();
  const slots = Array.from({ length: 6 }, (_, index) => ({ id: `${prefix}-slot-${index}`, providerId: provider.id, startIso: new Date(now + (index + 2) * 86400000), endIso: new Date(now + (index + 2) * 86400000 + 4 * 3600000) }));
  try {
    await repository.createProvider(provider);
    for (const credential of template!.credentials) await repository.upsertProviderCredential({ ...credential, id: randomUUID(), providerId: provider.id });
    await repository.createCustomer({ ...template!, id: customerId, email: `${prefix}-customer@example.invalid`, role: "customer", properties: [], defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    await prisma.availabilitySlot.createMany({ data: slots });
    const quotes = await Promise.all((["lawn-mowing", "leaf-blowing"] as const).map(category => platform.createInstantQuote({ customerId, address: provider.address, category, followUpAnswers: [{ questionId: "turf_sq_ft", value: "1800" }, { questionId: "shrub_sq_ft", value: "120" }, { questionId: "lot_complexity", value: "low" }] })));
    const duration = quotes.reduce((sum, item) => sum + item.estimatedDurationMinutes, 0);
    const input = { requestId: randomUUID(), providerId: provider.id, serviceAddress: quotes[0]!.address, category: quotes[0]!.category, services: quotes.map(quote => ({ category: quote.category, quoteToken: quote.quoteToken! })), totalCents: quotes.reduce((sum, item) => sum + item.estimatedPriceCents, 0), notes: "", scheduledStartIso: slots[0]!.startIso.toISOString(), scheduledEndIso: new Date(+slots[0]!.startIso + duration * 60000).toISOString() };
    const secondPlatform = new MarketplacePlatformService(new PrismaMarketplaceRepository(prisma), new DataEngineeringLogger());
    const results = await Promise.all([platform, secondPlatform].map(instance => instance.createBooking(customerId, input)));
    assert.equal(results[0]!.id, results[1]!.id);
    const persisted = await secondPlatform.getCustomerBooking(customerId, results[0]!.id);
    assert.deepEqual(persisted.services?.map(item => item.category), ["lawn-mowing", "leaf-blowing"]);
    assert.equal(persisted.totalCents, input.totalCents);
    assert.equal(await prisma.booking.count({ where: { customerId } }), 1);
    assert.equal(await prisma.notificationDelivery.count({ where: { recipientId: customerId, channel: "email", title: "Booking request received" } }), 1);
    assert.ok(!(await repository.listSearchSlots([provider.id], duration)).some(slot => slot.id === slots[0]!.id));
    const range = { startIso: slots[5]!.startIso.toISOString(), endIso: slots[5]!.endIso.toISOString() };
    assert.deepEqual((await repository.listSearchSlots([provider.id], duration, range)).map(slot => slot.id), [slots[5]!.id]);
    const rescheduled = await secondPlatform.rescheduleBooking(customerId, { bookingId: persisted.id, scheduledStartIso: slots[1]!.startIso.toISOString(), scheduledEndIso: new Date(+slots[1]!.startIso + duration * 60000).toISOString() });
    assert.deepEqual(rescheduled.services, persisted.services);
    assert.equal((await repository.findBookingById(persisted.id))!.scheduledStartIso, slots[1]!.startIso.toISOString());
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: [customerId, provider.id] } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: [customerId, provider.id] } } });
    await prisma.booking.deleteMany({ where: { customerId } });
    await prisma.userAccount.deleteMany({ where: { id: { in: [customerId, provider.id] } } });
    await prisma.$disconnect();
  }
});
