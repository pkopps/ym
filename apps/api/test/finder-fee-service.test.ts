import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { FinderFeeRelationshipConflictError } from "../src/repositories/finderFeeRecords";
import {
  FINDER_FEE_MAX_DECLINED_ATTEMPTS,
  FinderFeeService,
  finderFeeIdempotencyKey,
  resolveFinderFeeDisputeWindowHours
} from "../src/services/FinderFeeService";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { validateRuntimeConfiguration } from "../src/config/productionConfig";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { ApiRoutes, launchFeatureForApiPath } from "@yardmatch/contracts";
import { createCompletedBooking, FakeProviderBilling, hoursAfter, seedFinderFeeParties } from "./helpers/finderFeeFixtures";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "finder-fee-tests-secret-32-characters";
for (const key of ["GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "STRIPE_SECRET_KEY", "FINDER_FEE_DISPUTE_WINDOW_HOURS"]) delete process.env[key];

const COMPLETED_AT = "2026-11-02T15:00:00.000Z";

async function fixture(lawnSizes: Array<number | undefined> = [3_000, 3_000], options: { cardOnFile?: boolean } = {}) {
  const repository = new InMemoryMarketplaceRepository();
  const billing = new FakeProviderBilling();
  const service = new FinderFeeService(repository, billing, { appBaseUrl: "https://yardmatch.test" });
  const parties = await seedFinderFeeParties(repository, lawnSizes);
  if (options.cardOnFile !== false) await saveCard(service, parties.provider.id);
  return { repository, billing, service, ...parties };
}

async function saveCard(service: FinderFeeService, providerId: string) {
  const setup = await service.startCardSetup(providerId, "/provider/management");
  return service.completeCardSetup(providerId, setup.setupSessionId);
}

/** Completes a waived first relationship so later ones in the test are billable. */
async function useWaiver(ctx: Awaited<ReturnType<typeof fixture>>) {
  const booking = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[0]!, COMPLETED_AT);
  const charge = await ctx.service.recordCompletion(booking);
  assert.equal(charge?.waived, true);
  return charge!;
}

test("provider completion records one relationship fee sized by the property, with the first relationship waived", async () => {
  const ctx = await fixture([3_000, 1_500, 4_800, 7_000, 12_000, undefined]);
  const charges = [];
  for (const customer of ctx.customers) {
    charges.push(await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, customer, COMPLETED_AT)));
  }
  assert.deepEqual(charges.map(charge => [charge!.tier, charge!.listFeeCents, charge!.feeCents, charge!.waived]), [
    ["typical", 7_500, 0, true],
    ["typical", 7_500, 7_500, false],
    ["typical", 7_500, 7_500, false],
    ["large", 11_000, 11_000, false],
    ["very-large", 15_000, 15_000, false],
    ["typical", 7_500, 7_500, false]
  ]);
  for (const charge of charges) {
    assert.equal(charge!.policyVersion, "2026-10-finder-fee-v1");
    assert.equal(charge!.status, "awaiting-customer");
    assert.equal(charge!.windowEndsAt, "2026-11-05T15:00:00.000Z");
  }

  // A repeat job for an existing relationship never starts a second fee.
  const repeat = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, hoursAfter(COMPLETED_AT, 24 * 7));
  assert.equal((await ctx.service.recordCompletion(repeat))!.id, charges[1]!.id);
  assert.equal((await ctx.repository.listFinderFeeCharges({ providerId: ctx.provider.id })).length, 6);

  const result = await ctx.service.processDue(hoursAfter(COMPLETED_AT, 72));
  assert.deepEqual([result.paid, result.waived], [5, 1]);
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.amountCents).sort(), [11_000, 15_000, 7_500, 7_500, 7_500].sort());
  assert.ok(ctx.billing.chargeCalls.every(call => call.paymentMethodId === `pm_${call.customerId}`));
});

test("the fee waits for the dispute window and charges once it closes", async () => {
  const ctx = await fixture();
  await useWaiver(ctx);
  const charge = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 1));
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 71.99));
  assert.equal(ctx.billing.chargeCalls.length, 0);
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "awaiting-customer");

  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 72));
  const paid = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([paid.status, paid.stripePaymentIntentId, paid.feeCents], ["paid", "pi_test_1", 7_500]);
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 200));
  assert.equal(ctx.billing.chargeCalls.length, 1);
});

test("the dispute window is configurable and invalid values fail closed", async () => {
  assert.equal(resolveFinderFeeDisputeWindowHours({}), 72);
  assert.equal(resolveFinderFeeDisputeWindowHours({ FINDER_FEE_DISPUTE_WINDOW_HOURS: "48" }), 48);
  for (const value of ["0", "-1", "1.5", "721", "soon"]) {
    assert.throws(() => resolveFinderFeeDisputeWindowHours({ FINDER_FEE_DISPUTE_WINDOW_HOURS: value }), /whole number of hours/);
  }
  assert.throws(() => validateRuntimeConfiguration({ YARDMATCH_ENV: "local", FINDER_FEE_DISPUTE_WINDOW_HOURS: "never" }), /FINDER_FEE_DISPUTE_WINDOW_HOURS/);

  const repository = new InMemoryMarketplaceRepository();
  const billing = new FakeProviderBilling();
  const service = new FinderFeeService(repository, billing, { disputeWindowHours: 24 });
  const { provider, customers } = await seedFinderFeeParties(repository, [3_000, 3_000]);
  await saveCard(service, provider.id);
  await service.recordCompletion(await createCompletedBooking(repository, provider, customers[0]!, COMPLETED_AT));
  const charge = (await service.recordCompletion(await createCompletedBooking(repository, provider, customers[1]!, COMPLETED_AT)))!;
  assert.equal(charge.windowEndsAt, hoursAfter(COMPLETED_AT, 24));
  await service.processDue(hoursAfter(COMPLETED_AT, 24));
  assert.equal((await repository.findFinderFeeChargeById(charge.id))!.status, "paid");
});

test("customer confirmation makes the fee billable before the window closes and is owner-only", async () => {
  const ctx = await fixture();
  await useWaiver(ctx);
  const completedAt = new Date().toISOString();
  const booking = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, completedAt);
  await assert.rejects(ctx.service.confirmCompletion(ctx.customers[0]!.id, booking.id), /Booking not found/);
  await assert.rejects(ctx.service.confirmCompletion(ctx.customers[1]!.id, ""), /Choose a booking/);

  // Confirmation also records the relationship if the completion hook had not run yet.
  const first = await ctx.service.confirmCompletion(ctx.customers[1]!.id, booking.id);
  const again = await ctx.service.confirmCompletion(ctx.customers[1]!.id, booking.id);
  assert.equal(again.confirmedAt, first.confirmedAt);
  await ctx.service.processDue(hoursAfter(completedAt, 1));
  const charge = (await ctx.repository.findFinderFeeChargeByRelationship(ctx.customers[1]!.id, ctx.provider.id))!;
  assert.deepEqual([charge.status, charge.customerConfirmedAt], ["paid", first.confirmedAt]);

  const scheduled = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, completedAt, { status: "confirmed", completedAt: undefined });
  await assert.rejects(ctx.service.confirmCompletion(ctx.customers[1]!.id, scheduled.id), /after the provider marks it complete/);
});

test("an open dispute or service complaint blocks the fee until it resolves", async () => {
  const ctx = await fixture([3_000, 3_000, 3_000]);
  await useWaiver(ctx);
  const disputed = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT, {
    status: "disputed", disputedAt: hoursAfter(COMPLETED_AT, 2), disputeReason: "Missed the back yard", disputedByRole: "customer"
  });
  // Recorded at completion, disputed afterwards.
  await ctx.repository.updateBooking(disputed.id, { status: "completed" });
  const charge = (await ctx.service.recordCompletion({ ...disputed, status: "completed" }))!;
  await ctx.repository.updateBooking(disputed.id, { status: "disputed" });
  await assert.rejects(ctx.service.confirmCompletion(ctx.customers[1]!.id, disputed.id), /open dispute/);

  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 500));
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "blocked-by-dispute");
  assert.equal(ctx.billing.chargeCalls.length, 0);

  // Support restores the booking: the dispute is resolved and the fee is billed.
  await ctx.repository.updateBooking(disputed.id, { status: "completed", disputedAt: undefined, disputeReason: undefined, disputedByRole: undefined });
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 501));
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "paid");

  // An unresolved service complaint on the qualifying job also blocks billing.
  const complained = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[2]!, COMPLETED_AT);
  const second = (await ctx.service.recordCompletion(complained))!;
  const ticket = await ctx.repository.createSupportTicket({
    id: "complaint-1", bookingId: complained.id, requesterId: ctx.customers[2]!.id, subject: "Service problem", description: "Edges were not trimmed at all.",
    issueType: "service-quality", status: "open", createdAt: COMPLETED_AT, updatedAt: COMPLETED_AT,
    complaint: { kind: "quality", affectedArea: "Edges", preferredRemedy: "return-visit", evidenceIds: [], aiConsent: false, humanReviewRequested: false, replies: [], nextUpdateDueAt: COMPLETED_AT, customerMessage: "Saved" }
  } as Parameters<InMemoryMarketplaceRepository["createSupportTicket"]>[0]);
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 100));
  assert.equal((await ctx.repository.findFinderFeeChargeById(second.id))!.status, "blocked-by-dispute");
  await ctx.repository.updateSupportTicket(ticket.id, { status: "resolved" });
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 101));
  assert.equal((await ctx.repository.findFinderFeeChargeById(second.id))!.status, "paid");
  assert.equal(ctx.billing.chargeCalls.length, 2);
});

test("a dispute that ends in cancellation voids the relationship, and the next completed job starts it again", async () => {
  const ctx = await fixture([3_000, 8_000]);
  const waived = await useWaiver(ctx);
  const first = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT);
  const charge = (await ctx.service.recordCompletion(first))!;
  await ctx.repository.updateBooking(first.id, { status: "cancelled" });
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 72));
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "void");
  assert.equal(ctx.billing.chargeCalls.length, 0);

  const later = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, hoursAfter(COMPLETED_AT, 240));
  const rearmed = (await ctx.service.recordCompletion(later))!;
  assert.deepEqual([rearmed.id, rearmed.bookingId, rearmed.status, rearmed.tier, rearmed.feeCents], [charge.id, later.id, "awaiting-customer", "large", 11_000]);
  assert.equal((await ctx.repository.findFinderFeeChargeById(waived.id))!.waived, true);
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 240 + 72));
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.amountCents), [11_000]);
});

test("concurrent completions and workers cannot create or charge a second fee", async () => {
  const ctx = await fixture([3_000, 3_000]);
  await useWaiver(ctx);
  const bookings = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, hoursAfter(COMPLETED_AT, index))));
  const results = await Promise.all(bookings.map(booking => ctx.service.recordCompletion(booking)));
  assert.equal(new Set(results.map(row => row!.id)).size, 1);
  assert.equal((await ctx.repository.listFinderFeeCharges({ providerId: ctx.provider.id })).length, 2);

  ctx.billing.delayMs = 20;
  const workers = [ctx.service, new FinderFeeService(ctx.repository, ctx.billing), new FinderFeeService(ctx.repository, ctx.billing)];
  await Promise.all(workers.flatMap(worker => [worker.processDue(hoursAfter(COMPLETED_AT, 80)), worker.processDue(hoursAfter(COMPLETED_AT, 80))]));
  assert.equal(ctx.billing.chargeCalls.length, 1);
  assert.equal(ctx.billing.succeededIntentIds.length, 1);
  assert.equal((await ctx.repository.findFinderFeeChargeById(results[0]!.id))!.status, "paid");

  // The repository itself refuses a second row for the pair, a second waiver, or a reused booking.
  const existing = results[0]!;
  await assert.rejects(ctx.repository.createFinderFeeCharge({ ...existing, id: "dup-pair", bookingId: "other-booking" }), FinderFeeRelationshipConflictError);
  await assert.rejects(ctx.repository.createFinderFeeCharge({ ...existing, id: "dup-waiver", customerId: "someone-else", bookingId: "other", waived: true, feeCents: 0 }), FinderFeeRelationshipConflictError);
  await assert.rejects(ctx.repository.createFinderFeeCharge({ ...existing, id: "dup-booking", customerId: "someone-else" }), FinderFeeRelationshipConflictError);
});

test("declined charges retry on a schedule with a new idempotency key per attempt and appear in the ops exception view", async () => {
  const ctx = await fixture();
  await useWaiver(ctx);
  const platform = new MarketplacePlatformService(ctx.repository, new DataEngineeringLogger(), undefined, undefined, undefined, undefined, ctx.billing);
  const charge = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  ctx.billing.script.push("decline", "decline");

  const t0 = hoursAfter(COMPLETED_AT, 72);
  await ctx.service.processDue(t0);
  let row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.attemptCount, row.nextAttemptAt], ["retry-scheduled", 1, hoursAfter(t0, 1)]);
  assert.match(row.lastFailureReason!, /insufficient_funds/);

  const summary = await platform.getOpsFinancialExceptionSummary();
  assert.equal(summary.finderFeeExceptionCount, 1);
  assert.deepEqual(
    [summary.finderFeeExceptions[0]!.chargeId, summary.finderFeeExceptions[0]!.providerName, summary.finderFeeExceptions[0]!.customerName, summary.finderFeeExceptions[0]!.feeCents],
    [charge.id, "Finder Fee Lawn Co", "Customer 1", 7_500]
  );

  await ctx.service.processDue(hoursAfter(t0, 0.5)); // before the retry time
  assert.equal(ctx.billing.chargeCalls.length, 1);
  await ctx.service.processDue(hoursAfter(t0, 1));
  row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.attemptCount, row.nextAttemptAt], ["retry-scheduled", 2, hoursAfter(t0, 7)]);
  await ctx.service.processDue(hoursAfter(t0, 7));
  row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.attemptCount, row.lastFailureReason], ["paid", 2, undefined]);
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.idempotencyKey), [1, 2, 3].map(n => `finder-fee:${charge.id}:attempt:${n}`));
  assert.equal(ctx.billing.succeededIntentIds.length, 1);
  assert.equal((await platform.getOpsFinancialExceptionSummary()).finderFeeExceptionCount, 0);
});

test("an unknown charge result retries with the same idempotency key, so a lost success is not charged twice", async () => {
  const ctx = await fixture();
  await useWaiver(ctx);
  const charge = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  ctx.billing.script.push("lost-success");
  const t0 = hoursAfter(COMPLETED_AT, 72);
  await ctx.service.processDue(t0);
  let row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.attemptCount], ["retry-scheduled", 0]);
  await ctx.service.processDue(hoursAfter(t0, 0.25));
  row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.stripePaymentIntentId], ["paid", "pi_test_1"]);
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.idempotencyKey), [finderFeeIdempotencyKey(charge.id, 0), finderFeeIdempotencyKey(charge.id, 0)]);
  assert.equal(ctx.billing.succeededIntentIds.length, 1);
});

test("a stale in-flight attempt is resumed with the same key after its lease expires", async () => {
  const ctx = await fixture();
  await useWaiver(ctx);
  const charge = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  const t0 = hoursAfter(COMPLETED_AT, 72);
  await ctx.repository.updateFinderFeeCharge(charge.id, { status: "charging", chargeLeaseExpiresAt: hoursAfter(t0, 5 / 60), lastAttemptAt: t0 });
  await ctx.service.processDue(hoursAfter(t0, 1 / 60));
  assert.equal(ctx.billing.chargeCalls.length, 0, "lease still held");
  assert.equal((await new FinderFeeService(ctx.repository, ctx.billing).listExceptions(hoursAfter(t0, 1 / 60))).length, 0);
  assert.equal((await new FinderFeeService(ctx.repository, ctx.billing).listExceptions(hoursAfter(t0, 6 / 60))).length, 1);
  await ctx.service.processDue(hoursAfter(t0, 6 / 60));
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.idempotencyKey), [finderFeeIdempotencyKey(charge.id, 0)]);
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "paid");
});

test("without a card on file the charge waits, stops after the attempt limit, and a new card retries it", async () => {
  const ctx = await fixture([3_000, 3_000], { cardOnFile: false });
  await useWaiver(ctx);
  const charge = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  let at = hoursAfter(COMPLETED_AT, 72);
  for (let attempt = 1; attempt <= FINDER_FEE_MAX_DECLINED_ATTEMPTS; attempt++) {
    await ctx.service.processDue(at);
    at = hoursAfter(at, 49);
  }
  let row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.deepEqual([row.status, row.attemptCount, row.lastFailureReason], ["failed", FINDER_FEE_MAX_DECLINED_ATTEMPTS, "No card on file for this business."]);
  assert.equal(ctx.billing.chargeCalls.length, 0);
  assert.equal((await ctx.service.listExceptions())[0]!.status, "failed");
  await ctx.service.processDue(hoursAfter(at, 500));
  assert.equal((await ctx.repository.findFinderFeeChargeById(charge.id))!.status, "failed");

  const status = await saveCard(ctx.service, ctx.provider.id);
  assert.deepEqual([status.hasCardOnFile, status.card?.last4], [true, "4242"]);
  await ctx.service.processDue(new Date(Date.now() + 1000).toISOString());
  row = (await ctx.repository.findFinderFeeChargeById(charge.id))!;
  assert.equal(row.status, "paid");
  assert.equal(ctx.billing.chargeCalls[0]!.idempotencyKey, finderFeeIdempotencyKey(charge.id, FINDER_FEE_MAX_DECLINED_ATTEMPTS));
});

test("card setup creates one Stripe customer per provider and validates the return path and setup session", async () => {
  const ctx = await fixture([3_000], { cardOnFile: false });
  ctx.billing.delayMs = 10;
  const [first, second] = await Promise.all([
    ctx.service.startCardSetup(ctx.provider.id, "/provider/management?tab=billing"),
    ctx.service.startCardSetup(ctx.provider.id, undefined)
  ]);
  assert.deepEqual(ctx.billing.createdCustomers, [ctx.provider.id]);
  assert.equal(first.setupSessionId, second.setupSessionId);
  assert.match(decodeURIComponent(first.url), /https:\/\/yardmatch\.test\/provider\/management\?tab=billing&billing=card-saved&setup_session_id=\{CHECKOUT_SESSION_ID\}/);
  for (const path of ["https://evil.test", "//evil.test", "provider", 5]) {
    await assert.rejects(ctx.service.startCardSetup(ctx.provider.id, path), /valid return page/);
  }
  await assert.rejects(ctx.service.completeCardSetup(ctx.provider.id, "cs_test_someone_else"), /another customer/);
  await assert.rejects(ctx.service.completeCardSetup(ctx.provider.id, "bad id!"), /invalid/);
  assert.equal((await ctx.service.billingStatus(ctx.provider.id)).hasCardOnFile, false);
  ctx.billing.configured = false;
  const unconfigured = await seedFinderFeeParties(ctx.repository, []);
  await assert.rejects(ctx.service.startCardSetup(unconfigured.provider.id, undefined), /not configured/);
});

test("a relationship already billed under the 2026-07 settlement policy is not billed again or counted toward a waiver", async () => {
  const ctx = await fixture([3_000, 3_000]);
  const legacyBooking = await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[0]!, COMPLETED_AT);
  const settlement = await ctx.repository.settleBookingFinancials({
    bookingId: legacyBooking.id, paymentId: "legacy-payment", customerId: ctx.customers[0]!.id, providerId: ctx.provider.id,
    customerChargeCents: 7_500, currency: "usd", actualProcessorFeeCents: 248
  });
  assert.deepEqual([settlement.policyVersion, settlement.finderFeeCents, settlement.completedJobFeeCents], ["2026-07-provider-funded-v1", 3_000, 699]);

  const covered = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[0]!, hoursAfter(COMPLETED_AT, 168))))!;
  assert.deepEqual([covered.status, covered.feeCents, covered.policyVersion], ["covered-by-prior-policy", 0, "2026-07-provider-funded-v1"]);
  // The provider already had a relationship, so the next new one is not waived.
  const next = (await ctx.service.recordCompletion(await createCompletedBooking(ctx.repository, ctx.provider, ctx.customers[1]!, COMPLETED_AT)))!;
  assert.deepEqual([next.waived, next.feeCents], [false, 7_500]);
  await ctx.service.processDue(hoursAfter(COMPLETED_AT, 400));
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.amountCents), [7_500]);
  assert.equal((await ctx.repository.findBookingFinancialSettlement(legacyBooking.id))!.finderFeeCents, 3_000);
});

test("marking a job complete through the platform starts the relationship and the customer can confirm it", async () => {
  const ctx = await fixture([3_000, 9_500]);
  const platform = new MarketplacePlatformService(ctx.repository, new DataEngineeringLogger(), undefined, undefined, undefined, undefined, ctx.billing);
  const now = new Date().toISOString();
  const bookings = [];
  for (const customer of ctx.customers) {
    bookings.push(await createCompletedBooking(ctx.repository, ctx.provider, customer, now, {
      status: "confirmed", completedAt: undefined,
      serviceEvidence: [{ id: `after-${customer.id}`, phase: "after", evidenceType: "photo", capturedAt: now, capturedByRole: "provider", capturedByUserId: ctx.provider.id }]
    }));
  }
  for (const booking of bookings) await platform.completeBooking(ctx.provider.id, { bookingId: booking.id });
  const charges = await ctx.repository.listFinderFeeCharges({ providerId: ctx.provider.id });
  assert.deepEqual(charges.map(row => [row.bookingId, row.waived, row.tier, row.feeCents]), [
    [bookings[0]!.id, true, "typical", 0],
    [bookings[1]!.id, false, "very-large", 15_000]
  ]);
  await platform.confirmBookingCompletion(ctx.customers[1]!.id, bookings[1]!.id);
  await platform.processDueFinderFees(new Date(Date.now() + 1000).toISOString());
  assert.deepEqual(ctx.billing.chargeCalls.map(call => call.amountCents), [15_000]);
  assert.equal((await platform.getProviderBilling(ctx.provider.id)).hasCardOnFile, true);
});

test("finder-fee routes are served by the marketplace controller and are not behind the YardMatch payments flag", () => {
  const controller = new MarketplaceController(new MarketplacePlatformService(new InMemoryMarketplaceRepository(), new DataEngineeringLogger()));
  const routes: Array<["GET" | "POST", string]> = [
    ["GET", ApiRoutes.providerBilling],
    ["POST", ApiRoutes.providerBillingCardSetup],
    ["POST", ApiRoutes.providerBillingCardSetupComplete],
    ["POST", ApiRoutes.bookingCompletionConfirm]
  ];
  for (const [method, path] of routes) {
    assert.equal(controller.canHandle({ method, path, body: undefined, query: new URLSearchParams(), headers: {} }), true, path);
    assert.equal(launchFeatureForApiPath(path), undefined, path);
  }
});
