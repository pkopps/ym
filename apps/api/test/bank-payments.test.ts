import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { StripeCheckoutService } from "../src/services/StripeCheckoutService";

// Disposable vendor stubs: no bank accounts, charges, or network calls.
async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  let sessions = 0;
  let reconciliations = 0;
  const gateway = {
    isConfigured: () => true,
    createCheckoutSession: async () => {
      const id = `cs_bank_${++sessions}`;
      return { checkoutSessionId: id, checkoutUrl: `https://checkout.example/${id}`, paymentIntentId: `pi_${id}` };
    },
    verifyCheckoutSession: async id => ({ checkoutSessionId: id, paymentIntentId: `pi_${id}`, paid: false, processing: true }),
    retrieveChargeFinancials: async () => { reconciliations++; return { chargeId: "ch_bank", actualProcessorFeeCents: 50 }; },
    parseWebhookEvent: async raw => JSON.parse(raw),
    createRefund: async () => ({ refundId: "re_bank", status: "succeeded" })
  };
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger(), gateway);
  const provider = (await repository.listProviders())[0];
  await repository.updateProvider(provider.id, { minimumBookingLeadHours: 0 });
  const customer = await platform.registerUser({ fullName: "Bank Customer", email: "bank-fixture@example.com", phone: "555-0200", role: "customer", address: provider.address });
  const quote = await platform.createInstantQuote({ customerId: customer.id, address: provider.address, category: "lawn-mowing" });
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id, serviceAddress: provider.address, category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 3600000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 74 * 3600000).toISOString(),
    totalCents: quote.estimatedPriceCents, quoteToken: quote.quoteToken
  });
  const checkout = await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  const event = (type, extra = {}) => platform.processStripeWebhook(JSON.stringify({
    id: `evt_${type}`, type, checkoutSessionId: checkout.payment.checkoutSessionId,
    paymentIntentId: checkout.payment.processorPaymentIntentId, ...extra
  }), "stub");
  return { repository, platform, customer, booking, checkout, gateway, event, reconciliations: () => reconciliations };
}

test("bank checkout return remains processing, blocks duplicate payment, and settles only after success", async () => {
  const f = await fixture();
  await assert.rejects(f.platform.finalizeCheckoutSession("another-customer", { checkoutSessionId: f.checkout.payment.checkoutSessionId }), /own bookings/);
  const processing = await f.platform.finalizeCheckoutSession(f.customer.id, { checkoutSessionId: f.checkout.payment.checkoutSessionId });
  assert.equal(processing.status, "processing");
  assert.equal(processing.refundable, false);
  assert.equal(processing.paidAt, undefined);
  assert.equal(f.reconciliations(), 0);
  await assert.rejects(f.platform.createCheckoutSession(f.customer.id, { bookingId: f.booking.id }), /still processing/);
  assert.equal((await f.repository.listPayments()).length, 1);
  await f.event("checkout.session.completed", { paid: false, processing: true });
  assert.equal((await f.repository.findPaymentById(processing.id)).status, "processing");
  await f.event("checkout.session.async_payment_succeeded", { paid: true });
  await f.event("checkout.session.async_payment_succeeded", { paid: true });
  await f.event("checkout.session.completed", { id: "evt_late_complete", paid: false, processing: true });
  const captured = await f.repository.findPaymentById(processing.id);
  assert.equal(captured.status, "captured");
  assert.equal(captured.actualProcessorFeeCents, 50);
  assert.ok(captured.paidAt);
  assert.equal(f.reconciliations(), 1);
  await assert.rejects(f.platform.createCheckoutSession(f.customer.id, { bookingId: f.booking.id }), /already been paid/);
});

test("delayed bank failure permits a new attempt without resurrecting the failed attempt", async () => {
  const f = await fixture();
  await f.event("payment_intent.processing", { processing: true });
  await f.event("checkout.session.async_payment_failed", { failureReason: "Bank declined" });
  const failed = await f.repository.findPaymentById(f.checkout.payment.id);
  assert.equal(failed.status, "failed");
  assert.ok(failed.checkoutSessionExpiredAt);
  await f.event("checkout.session.completed", { paid: false, processing: true });
  assert.equal((await f.repository.findPaymentById(failed.id)).status, "failed");
  const retry = await f.platform.createCheckoutSession(f.customer.id, { bookingId: f.booking.id });
  assert.notEqual(retry.payment.id, failed.id);
  assert.notEqual(retry.payment.checkoutSessionId, failed.checkoutSessionId);
  await f.event("checkout.session.async_payment_failed", { id: "evt_old_failure_again" });
  assert.equal((await f.repository.findPaymentById(retry.payment.id)).status, "pending");
  assert.equal(f.reconciliations(), 0);
});

test("an open checkout is not reported as failed; a declined card can be retried with bank in the same session", async () => {
  const f = await fixture();
  f.gateway.verifyCheckoutSession = async id => ({ checkoutSessionId: id, paid: false });
  assert.equal((await f.platform.finalizeCheckoutSession(f.customer.id, { checkoutSessionId: f.checkout.payment.checkoutSessionId })).status, "pending");
  await f.event("payment_intent.payment_failed", { failureReason: "Card declined" });
  await f.event("payment_intent.processing", { processing: true });
  assert.equal((await f.repository.findPaymentById(f.checkout.payment.id)).status, "processing");
  await f.repository.updatePayment(f.checkout.payment.id, { status: "refunded" });
  await f.event("checkout.session.completed", { paid: false, processing: true });
  await f.event("checkout.session.async_payment_succeeded", { paid: true });
  assert.equal((await f.repository.findPaymentById(f.checkout.payment.id)).status, "refunded");
});

test("hosted checkout uses dynamic wallet/card/bank configuration without automatic future charging", async () => {
  const f = await fixture();
  const service = new StripeCheckoutService("sk_test_fixture", "whsec_fixture", "pmc_fixture");
  let params;
  service.stripe.checkout.sessions.create = async input => { params = input; return { id: "cs_fixture", url: "https://checkout.example/test" }; };
  await service.createCheckoutSession({ booking: f.booking, customer: f.customer, paymentId: "payment_fixture", appBaseUrl: "https://yardmatch.example", successPath: "/customer/dashboard", cancelPath: "/customer/dashboard" });
  assert.equal(params.mode, "payment");
  assert.equal(params.payment_method_configuration, "pmc_fixture");
  assert.equal(params.payment_method_types, undefined);
  assert.equal(params.payment_method_options.us_bank_account.verification_method, "automatic");
  assert.equal(params.payment_intent_data.setup_future_usage, undefined);
  assert.equal(params.setup_intent_data, undefined);
  assert.equal(params.payment_intent_data.metadata.paymentId, "payment_fixture");
});

test("signed Stripe events distinguish submitted bank payments from settled and failed payments", async () => {
  const service = new StripeCheckoutService("sk_test_fixture", "whsec_fixture");
  const signer = new Stripe("sk_test_fixture");
  for (const [type, object, expected] of [
    ["checkout.session.completed", { id: "cs_signed", payment_status: "unpaid", payment_intent: "pi_signed", metadata: { paymentId: "payment_signed" } }, { processing: true, paid: false }],
    ["checkout.session.async_payment_succeeded", { id: "cs_signed", payment_status: "paid", payment_intent: "pi_signed" }, { processing: false, paid: true }],
    ["checkout.session.async_payment_failed", { id: "cs_signed", payment_status: "unpaid" }, { processing: false, paid: false }],
    ["payment_intent.processing", { id: "pi_signed", metadata: { paymentId: "payment_signed" } }, { processing: true }]
  ]) {
    const raw = JSON.stringify({ id: `evt_${type}`, type, data: { object } });
    const signature = signer.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_fixture" });
    const parsed = await service.parseWebhookEvent(raw, signature);
    for (const [key, value] of Object.entries(expected)) assert.equal(parsed[key], value);
    if (type.endsWith("async_payment_failed")) assert.match(parsed.failureReason, /bank payment did not complete/);
    if (object.metadata) assert.equal(parsed.paymentId, "payment_signed");
    await assert.rejects(service.parseWebhookEvent(raw, signature.replace("v1=", "v1=bad")));
  }
});

test("checkout verification distinguishes open, processing, paid and expired sessions", async () => {
  const service = new StripeCheckoutService("sk_test_fixture");
  for (const [status, paymentStatus, processing, paid, failed] of [
    ["open", "unpaid", false, false, false],
    ["complete", "unpaid", true, false, false],
    ["complete", "paid", false, true, false],
    ["expired", "unpaid", false, false, true]
  ]) {
    service.stripe.checkout.sessions.retrieve = async () => ({ id: "cs_fixture", status, payment_status: paymentStatus });
    const verified = await service.verifyCheckoutSession("cs_fixture");
    assert.equal(verified.processing, processing);
    assert.equal(verified.paid, paid);
    assert.equal(Boolean(verified.failureReason), failed);
  }
});

test("a completed visit cannot settle or release provider funds while bank payment is processing", async () => {
  const f = await fixture();
  await f.repository.updateBooking(f.booking.id, { status: "completed", completedAt: new Date().toISOString() });
  await f.event("checkout.session.completed", { paid: false, processing: true });
  assert.equal(await f.repository.findBookingFinancialSettlement(f.booking.id), undefined);
  assert.deepEqual(await f.repository.listFinancialLedgerEntries(f.booking.id), []);
  assert.deepEqual(await f.repository.listProviderTransferRecords(), []);
  await f.event("checkout.session.async_payment_succeeded", { paid: true });
  const settlement = await f.repository.findBookingFinancialSettlement(f.booking.id);
  assert.ok(settlement);
  const ledger = await f.repository.listFinancialLedgerEntries(f.booking.id);
  assert.ok(ledger.length > 0);
  await f.event("checkout.session.async_payment_succeeded", { id: "evt_second_success", paid: true });
  assert.deepEqual(await f.repository.listFinancialLedgerEntries(f.booking.id), ledger);
});
