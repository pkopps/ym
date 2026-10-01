import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { parsePriceDollars, type ProviderServicePrice, type ServiceCategory } from "@yardmatch/contracts";
import { ProviderPricingService } from "../src/services/ProviderPricingService";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { signSessionToken } from "../src/auth";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-tests-secret-32-characters-long";
for (const key of ["GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[key];
async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const service = new ProviderPricingService(repository);
  const provider = (await repository.listProviders())[0]!;
  const admin = await platform.registerUser({ fullName: "Price Admin", email: `${randomUUID()}@example.com`, phone: "5550100", role: "ops", internalScope: "admin", address: provider.address });
  const floor = (postalCode = "11215", category: ServiceCategory = "lawn-mowing", minimumStartingPriceCents = 3500) => service.setMinimum(admin.id, { postalCode, category, minimumStartingPriceCents, reason: "Approved test pricing" });
  const row = (startingPriceCents = 4000, postalCode = "11215", category: ServiceCategory = "lawn-mowing"): ProviderServicePrice => ({ startingPriceCents, postalCode, category });
  return { repository, platform, service, provider, admin, floor, row };
}

test("ZIP and service minimums validate amounts, service eligibility, missing policies, and all rows before saving", async () => {
  const { service, provider, floor, row, repository } = await fixture();
  await assert.rejects(service.save(provider.id, [row()]), /not available/);
  await floor();
  await assert.rejects(service.save(provider.id, [row(3499)]), /at least \$35.00/);
  for (const invalid of [0, -1, 3500.1, NaN, Infinity, 1_000_001, "4000", null]) {
    await assert.rejects(service.save(provider.id, [row(invalid as number)]), /whole cents/);
  }
  for (const zip of ["1234", "123456", "abcd5", "", null]) await assert.rejects(service.minimums(zip as string), /ZIP/);
  for (const invalid of [null, {}, [], [null]]) await assert.rejects(service.save(provider.id, invalid as ProviderServicePrice[]));
  await assert.rejects(service.save(provider.id, [row(4000), row(5000)]), /only once/);
  await assert.rejects(service.save(provider.id, [row(4000, "11215", "hedge-trimming")]), /business provides/);
  await assert.rejects(service.save(provider.id, [row(4000), row(4000, "99999")]), /not available/);
  assert.deepEqual((await repository.findProviderById(provider.id))?.servicePrices ?? [], []);
  const saved = await service.save(provider.id, [row(3500, "11215-1234")]);
  assert.equal(saved.postalCode, "11215");
  assert.equal(saved.prices[0]!.savedStartingPriceCents, 3500);
  await assert.rejects(floor("11215", "__proto__" as ServiceCategory), /supported/);
  await assert.rejects(floor("11215", "lawn-mowing", 0), /whole cents/);
});

test("providers can set onboarding prices and edit different ZIPs concurrently without losing prior prices", async () => {
  const { platform, service, provider, floor, row, repository } = await fixture();
  await floor(); await floor("08005"); await floor("11215", "seasonal-cleanup", 5000);
  const input = { role: "provider" as const, fullName: "Price Provider", companyName: "Local Lawn", email: `${randomUUID()}@example.com`, phone: "5550100", address: provider.address, categories: ["lawn-mowing"] as ServiceCategory[], servicePrices: [row()] };
  const registered = await platform.registerUser(input);
  assert.equal((await service.overview(registered.id, "11215")).prices[0]!.savedStartingPriceCents, 4000);
  await assert.rejects(platform.registerUser({ ...input, email: `${randomUUID()}@example.com`, servicePrices: [row(1)] }), /at least/);
  await Promise.all([service.save(provider.id, [row(4500)]), service.save(provider.id, [row(5500, "08005")]), service.save(provider.id, [row(6000, "11215", "seasonal-cleanup")])]);
  assert.equal((await repository.findProviderById(provider.id))?.servicePrices?.length, 3);
  assert.equal((await service.overview(provider.id, "08005")).prices[0]!.savedStartingPriceCents, 5500);
});

test("minimum edits require an admin and retain an ordered audit with old amounts under concurrency", async () => {
  const { repository, platform, provider, service, admin, floor } = await fixture();
  const staff = await platform.registerUser({ fullName: "Price Staff", email: `${randomUUID()}@example.com`, phone: "5550100", role: "ops", internalScope: "operations", address: provider.address });
  const payload = { postalCode: "11215", category: "lawn-mowing" as const, minimumStartingPriceCents: 3500, reason: "Approved test minimum" };
  for (const actor of [provider.id, staff.id, "missing"]) await assert.rejects(service.setMinimum(actor, payload), /admins/);
  await assert.rejects(service.setMinimum(admin.id, { ...payload, reason: "" }), /reason/);
  await Promise.all([floor(), floor("11215", "lawn-mowing", 4000), floor("11215", "lawn-mowing", 4500)]);
  const record = (await repository.listZipServiceMinimums("11215"))[0]!;
  assert.equal(record.history.length, 3);
  for (let index = 1; index < record.history.length; index++) assert.equal(record.history[index]!.previousMinimumCents, record.history[index - 1]!.minimumStartingPriceCents);
  assert.ok(record.history.every(item => item.changedBy === admin.id));
});

test("quotes use the service property's ZIP and provider starting price, preserve size adjustments, and honor raised minimums", async () => {
  const { platform, service, provider, floor, row } = await fixture();
  const address = { ...provider.address, postalCode: "08005" };
  const request = { providerId: provider.id, address, category: "lawn-mowing" as const };
  const baseline = await platform.createInstantQuote(request);
  await floor("11215", "lawn-mowing", 15000); await floor("08005");
  await service.save(provider.id, [row(5000, "08005")]);
  const priced = await platform.createInstantQuote(request);
  assert.equal(priced.startingPriceCents, 5000);
  assert.equal(priced.estimatedPriceCents - baseline.estimatedPriceCents, 2200);
  const large = await platform.createInstantQuote({ ...request, followUpAnswers: [{ questionId: "turf_sq_ft", value: "11000" }] });
  const small = await platform.createInstantQuote({ ...request, followUpAnswers: [{ questionId: "turf_sq_ft", value: "1800" }] });
  assert.ok(large.estimatedPriceCents > small.estimatedPriceCents);
  await floor("08005", "lawn-mowing", 6000);
  assert.equal((await platform.createInstantQuote(request)).startingPriceCents, 6000);
  assert.equal((await service.overview(provider.id, "08005")).prices[0]!.savedStartingPriceCents, 5000);
  assert.equal((await platform.createInstantQuote({ ...request, providerId: undefined })).startingPriceCents, 6000);
});

test("booking rejects provider swaps, generic quote bypass, stale rates and floor increases; existing bookings remain unchanged", async () => {
  const { repository, platform, service, provider, floor, row } = await fixture();
  const customer = await platform.registerUser({ fullName: "Price Customer", email: `${randomUUID()}@example.com`, phone: "5550100", role: "customer", address: provider.address });
  const request = { address: provider.address, customerId: customer.id, category: "lawn-mowing" as const };
  const generic = await platform.createInstantQuote(request);
  await floor(); await service.save(provider.id, [row(5000)]);
  const quote = await platform.createInstantQuote({ ...request, providerId: provider.id });
  const slots = await platform.getProviderAvailability({ providerId: provider.id, address: provider.address, categories: [request.category] });
  const payload = { providerId: provider.id, serviceAddress: provider.address, category: request.category, quoteToken: quote.quoteToken, totalCents: quote.estimatedPriceCents, notes: "", scheduledStartIso: slots[0]!.startIso, scheduledEndIso: slots[0]!.endIso };
  await assert.rejects(platform.createBooking(customer.id, { ...payload, quoteToken: generic.quoteToken, totalCents: generic.estimatedPriceCents }), /price has changed/);
  const other = (await repository.listProviders())[1]!;
  await service.save(other.id, [row(5000)]);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, providerId: other.id }), /price has changed/);
  await service.save(provider.id, [row(5500)]);
  await assert.rejects(platform.createBooking(customer.id, payload), /price has changed/);
  const refreshed = await platform.createInstantQuote({ ...request, providerId: provider.id });
  const booking = await platform.createBooking(customer.id, { ...payload, totalCents: refreshed.estimatedPriceCents, quoteToken: refreshed.quoteToken });
  await floor("11215", "lawn-mowing", 7000);
  assert.equal((await repository.findBookingById(booking.id))!.totalCents, refreshed.estimatedPriceCents);
  await assert.rejects(platform.createBooking(customer.id, { ...payload, scheduledStartIso: slots[1]!.startIso, scheduledEndIso: slots[1]!.endIso, totalCents: refreshed.estimatedPriceCents, quoteToken: refreshed.quoteToken }), /price has changed/);
});

test("pricing routes protect ownership, require admin writes, and never expose minimum audit notes publicly", async () => {
  const { platform, repository, provider, admin, floor, row } = await fixture();
  await floor();
  const controller = new MarketplaceController(platform);
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    let json: unknown;
    const response = { writeHead() {}, setHeader() {}, end(value: string) { json = JSON.parse(value); } };
    const context = { method, path, query: new URLSearchParams({ postalCode: "11215" }), body, headers: token ? { authorization: `Bearer ${token}` } : {} };
    assert.equal(controller.canHandle(context), true);
    await controller.handle(context, response as never); return json;
  };
  await assert.rejects(call("GET", "/api/providers/pricing"), /auth|token|session/i);
  await assert.rejects(call("POST", "/api/ops/pricing/minimums", signSessionToken({userId: provider.id, role: "provider", email: provider.email, sessionVersion: 1}), { postalCode: "11215", category: "lawn-mowing", minimumStartingPriceCents: 1, reason: "Bypass attempt" }), /ops/);
  assert.doesNotMatch(JSON.stringify(await call("GET", "/api/pricing/minimums")), /history|changedBy|Approved test/);
  const other = (await repository.listProviders())[1]!;
  await call("POST", "/api/providers/pricing", signSessionToken({userId: provider.id, role: "provider", email: provider.email, sessionVersion: 1}), { providerId: other.id, prices: [row()] });
  assert.equal((await platform.getProviderPricing(provider.id, "11215")).prices[0]!.savedStartingPriceCents, 4000);
  assert.equal((await platform.getProviderPricing(other.id, "11215")).prices[0]!.savedStartingPriceCents, undefined);
  assert.match(JSON.stringify(await call("GET", "/api/ops/pricing/minimums", signSessionToken({userId: admin.id, role: "ops", email: admin.email, sessionVersion: 1}))), /Approved test/);
});

test("dollar inputs reject excess decimals and coercion instead of rounding below the minimum", () => {
  for (const value of ["", "1.001", "-1", "1e3", "NaN", "Infinity", "0", "10000.01"]) assert.equal(parsePriceDollars(value), undefined);
  assert.equal(parsePriceDollars("35.01"), 3501);
  assert.equal(parsePriceDollars("35.1"), 3510);
});
