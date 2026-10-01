import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { CreateBookingRequest, ServiceCategory } from "@yardmatch/contracts";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { signSessionToken } from "../src/auth";

for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[key];
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "booking-journey-tests-secret-32-characters";
const answers = [{ questionId: "turf_sq_ft", value: "1800" }, { questionId: "shrub_sq_ft", value: "120" }, { questionId: "lot_complexity", value: "low" }];
async function fixture(categories: ServiceCategory[] = ["lawn-mowing", "leaf-blowing"]) {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ fullName: "Booking Journey", email: `${randomUUID()}@example.com`, phone: "555-0200", role: "customer", address: provider.address });
  const quotes = await Promise.all(categories.map(category => platform.createInstantQuote({ customerId: customer.id, address: provider.address, category, followUpAnswers: answers })));
  assert.ok(quotes.every(quote => quote.quoteReadyForCheckout));
  const duration = quotes.reduce((sum, quote) => sum + quote.estimatedDurationMinutes, 0);
  const slots = await platform.getProviderAvailability({ providerId: provider.id, address: provider.address, categories, estimatedDurationMinutes: duration });
  const payload: CreateBookingRequest = {
    requestId: randomUUID(), providerId: provider.id, serviceAddress: quotes[0]!.address, category: categories[0]!,
    services: quotes.map(quote => ({ category: quote.category, quoteToken: quote.quoteToken! })), notes: "",
    totalCents: quotes.reduce((sum, quote) => sum + quote.estimatedPriceCents, 0), scheduledStartIso: slots[0]!.startIso,
    scheduledEndIso: new Date(Date.parse(slots[0]!.startIso) + duration * 60000).toISOString()
  };
  return { repository, platform, provider, customer, quotes, payload, slots, duration };
}

test("one visit stores every priced service, retries once, sends a customer email receipt, and can be rescheduled", async () => {
  const { platform, repository, customer, payload, slots, duration } = await fixture();
  const attempts = await Promise.all(Array.from({ length: 4 }, () => platform.createBooking(customer.id, payload)));
  assert.equal(new Set(attempts.map(item => item.id)).size, 1);
  const booking = attempts[0]!;
  assert.equal((await repository.listBookings()).length, 1);
  assert.deepEqual(booking.services?.map(item => item.category), ["lawn-mowing", "leaf-blowing"]);
  assert.equal(booking.totalCents, booking.services!.reduce((sum, item) => sum + item.totalCents, 0));
  assert.match(booking.notes, /Leaf Blowing/);
  const deliveries = await repository.listNotificationDeliveriesByRecipient(customer.id);
  assert.equal(deliveries.filter(item => item.channel === "email" && item.title === "Booking request received").length, 1);
  assert.equal((await platform.getCustomerBooking(customer.id, booking.id)).id, booking.id);
  assert.equal((await platform.getCustomerBookingForRequest(customer.id, payload.requestId!))?.id, booking.id);
  assert.equal(await platform.getCustomerBookingForRequest("other-customer", payload.requestId!), null);
  await assert.rejects(platform.getCustomerBooking("other-customer", booking.id), /not found/);
  const rescheduled = await platform.rescheduleBooking(customer.id, { bookingId: booking.id, scheduledStartIso: slots[1]!.startIso, scheduledEndIso: new Date(Date.parse(slots[1]!.startIso) + duration * 60000).toISOString() });
  assert.equal(rescheduled.scheduledStartIso, slots[1]!.startIso);
  assert.deepEqual(rescheduled.services, booking.services);
});

test("service bundle rejects altered prices, stale quotes, incomplete property answers, duplicate services and unsupported categories", async () => {
  const { platform, provider, customer, payload } = await fixture();
  await assert.rejects(platform.createBooking(customer.id, { ...payload, totalCents: 1 }), /price does not match/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, services: [{ ...payload.services![0]!, quoteToken: "invalid" }] }), /expired/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, services: [payload.services![0]!, payload.services![0]!] }), /distinct services/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, services: [...payload.services!, { category: "hedge-trimming", quoteToken: payload.services![0]!.quoteToken }] }), /not currently approved/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, serviceAddress: { ...payload.serviceAddress, line1: "99 Other Street" } }), /quote does not match/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, serviceAddress: { ...payload.serviceAddress, line2: "Another unit" } }), /quote does not match/);
  const incomplete = await platform.createInstantQuote({ address: provider.address, category: "seasonal-cleanup" });
  assert.equal(incomplete.quoteReadyForCheckout, false);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, category: incomplete.category, services: [{ category: incomplete.category, quoteToken: incomplete.quoteToken! }], totalCents: incomplete.estimatedPriceCents }), /property questions/);
  assert.equal((await platform.getProviderAvailability({ providerId: provider.id, address: provider.address, categories: ["lawn-mowing"], estimatedDurationMinutes: 1440 })).length, 0);
});

test("booked, expired, short and fabricated openings cannot be booked; concurrent different requests reserve a window once", async () => {
  const { platform, customer, payload } = await fixture();
  await assert.rejects(platform.createBooking(customer.id, { ...payload, scheduledEndIso: new Date(Date.parse(payload.scheduledStartIso) + 60000).toISOString() }), /long enough/);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, scheduledStartIso: new Date(Date.parse(payload.scheduledStartIso) + 60000).toISOString() }), /long enough|no longer available/);
  const attempts = await Promise.allSettled([platform.createBooking(customer.id, payload), platform.createBooking(customer.id, { ...payload, requestId: randomUUID() })]);
  assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(item => item.status === "rejected").length, 1);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, totalCents: payload.totalCents + 1 }), /already used/);
});

test("date filtering happens before the slot limit, and excludes reserved slots and external-calendar blocks", async () => {
  const { platform, provider, customer, payload, slots, repository } = await fixture();
  const slot = slots[2]!;
  const range = { startIso: slot.startIso, endIso: new Date(Date.parse(slot.startIso) + 3600000).toISOString() };
  const request = { address: provider.address, categories: ["lawn-mowing"] as ServiceCategory[], dateIso: slot.startIso, availability: range };
  const search = await platform.searchProviders(request);
  assert.ok(search.suggestedSlots.some(item => item.id === slot.id));
  assert.ok(search.suggestedSlots.every(item => item.startIso >= range.startIso && item.startIso < range.endIso));
  await platform.createBooking(customer.id, payload);
  assert.ok(!(await platform.getProviderAvailability({ providerId: provider.id, address: provider.address, categories: ["lawn-mowing"] })).some(item => item.startIso === payload.scheduledStartIso));
  await repository.updateProvider(provider.id, { calendarConnection: { ...provider.calendarConnection, externalEventsBlockingEnabled: true, externalBlocks: [{ id: "blocked", title: "Private calendar event", startIso: slot.startIso, endIso: slot.endIso, source: "manual" }] } });
  const filtered = await platform.searchProviders(request);
  assert.ok(!filtered.suggestedSlots.some(item => item.id === slot.id));
});

test("booking detail requires an authenticated customer and does not reveal another customer's address", async () => {
  const { platform, customer, payload } = await fixture(["lawn-mowing"]);
  const booking = await platform.createBooking(customer.id, payload);
  const controller = new MarketplaceController(platform);
  const context = { method: "GET", path: "/api/bookings/detail", headers: {}, body: undefined, query: new URLSearchParams({ bookingId: booking.id }) };
  assert.ok(controller.canHandle(context));
  const response = { writeHead() {}, end() {}, setHeader() {} };
  await assert.rejects(controller.handle(context, response as never), /auth|token|session/i);
  const other = await platform.registerUser({ fullName: "Other Customer", email: `${randomUUID()}@example.com`, phone: "555-0201", role: "customer", address: payload.serviceAddress });
  await assert.rejects(controller.handle({ ...context, headers: { authorization: `Bearer ${signSessionToken({ userId: other.id, email: other.email, role: "customer", sessionVersion: 1 })}` } }, response as never), /not found/);
});
