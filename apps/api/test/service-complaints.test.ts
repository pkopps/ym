import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { ComplaintAssessmentService } from "../src/services/ComplaintAssessmentService";
import { PhotoStorageService } from "../src/services/PhotoStorageService";
import { createWorkflowBooking } from "./helpers/workflowBooking";
import type { PaymentCheckoutGateway } from "../src/services/StripeCheckoutService";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDXsAAAAASUVORK5CYII=";
export async function complaintFixture() {
  const repository = new InMemoryMarketplaceRepository();
  let calls = 0;
  const gateway: PaymentCheckoutGateway = {
    isConfigured: () => true, createCheckoutSession: async () => ({ checkoutSessionId: "cs_complaint", checkoutUrl: "https://example.com" }),
    verifyCheckoutSession: async () => ({ checkoutSessionId: "cs_complaint", paid: true }),
    retrieveChargeFinancials: async () => ({ chargeId: "ch_complaint", actualProcessorFeeCents: 150 }),
    parseWebhookEvent: async raw => JSON.parse(raw),
    createRefund: async () => { calls++; return { refundId: "re_complaint", status: "succeeded" }; }
  };
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger(), gateway);
  const provider = (await repository.listProviders())[0];
  const customer = await platform.registerUser({ fullName: "Complaint Customer", email: "complaint@example.com", role: "customer", phone: "555-0100", address: provider.address });
  const booking = await createWorkflowBooking(platform, repository, customer.id, { providerId: provider.id, serviceAddress: provider.address, category: "lawn-mowing", totalCents: 10000,
    scheduledStartIso: new Date(Date.now() + 72 * 3600000).toISOString(), scheduledEndIso: new Date(Date.now() + 74 * 3600000).toISOString() });
  await repository.updateBooking(booking.id, { status: "completed", completedAt: new Date().toISOString() });
  const payment = await platform.createPaymentIntent({ bookingId: booking.id, amountCents: 10000, currency: "usd" });
  await repository.updatePayment(payment.id, { status: "captured", processor: "stripe", processorPaymentIntentId: "pi_complaint" });
  await repository.settleBookingFinancials({ bookingId: booking.id, paymentId: payment.id, customerId: customer.id, providerId: provider.id, customerChargeCents: 10000, currency: "usd", actualProcessorFeeCents: 150 });
  const input = { bookingId: booking.id, kind: "incomplete-work" as const, affectedArea: "Backyard edges", description: "The edging beside the fence was not completed.", preferredRemedy: "refund" as const, photos: [photo] };
  const ticket = await platform.createServiceComplaint(customer.id, input);
  const refund = { paymentId: payment.id, ticketId: ticket.id, amountCents: 1500, reason: "Goodwill for the missed edging, funded by YardMatch.", idempotencyKey: "request-complaint-1" };
  const review = () => platform.reviewBookingEvidenceForOps({ bookingId: booking.id, ticketId: ticket.id, evidenceId: ticket.complaint!.evidenceIds[0], reviewStatus: "supports-customer", reviewNotes: "The customer photo shows untrimmed grass beside the fence." });
  return { repository, platform, customer, booking, payment, ticket, input, refund, review, gateway, calls: () => calls };
}

test("complaints require ownership and relevant photos or an explanation; duplicates reuse the saved report", async () => {
  const f = await complaintFixture();
  await assert.rejects(f.platform.createServiceComplaint("other-customer", f.input), /own bookings/);
  await assert.rejects(f.platform.createServiceComplaint(f.customer.id, { ...f.input, photos: [] }), /photo or explain/);
  await assert.rejects(f.platform.createServiceComplaint(f.customer.id, { ...f.input, photos: [42] as never }), /Photo/);
  await assert.rejects(f.platform.createServiceComplaint(f.customer.id, { ...f.input, kind: "missed-visit" }), /window has not ended/);
  const duplicates = await Promise.all([f.platform.createServiceComplaint(f.customer.id, f.input), f.platform.createServiceComplaint(f.customer.id, f.input)]);
  assert.ok(duplicates.every(ticket => ticket.id === f.ticket.id));
  assert.equal((await f.repository.findBookingById(f.booking.id))!.serviceEvidence.length, 1);
  assert.equal(f.ticket.complaint!.assessment, undefined, "Internal AI drafts must not be delivered to the customer");
  assert.equal((await f.platform.listOpsSupportTickets())[0].ticket.complaint!.assessment!.source, "rules");
  await f.repository.updateSupportTicket(f.ticket.id, { status: "resolved" });
  const noPhoto = await f.platform.createServiceComplaint(f.customer.id, { ...f.input, photos: [], noPhotoReason: "I am away from the property." });
  assert.equal(noPhoto.complaint!.noPhotoReason, "I am away from the property.");
});

test("customers can request human review and reopen their report, never somebody else's", async () => {
  const f = await complaintFixture();
  await assert.rejects(f.platform.replyServiceComplaint("other", { ticketId: f.ticket.id, message: "Please review" }), /own service reports/);
  await f.repository.updateSupportTicket(f.ticket.id, { status: "resolved" });
  const reply = await f.platform.replyServiceComplaint(f.customer.id, { ticketId: f.ticket.id, message: "Please have a person review these details.", requestHumanReview: true });
  assert.equal(reply.status, "open"); assert.equal(reply.complaint!.humanReviewRequested, true);
  assert.equal(reply.complaint!.replies.length, 1);
});

test("partial refunds require reviewed customer evidence, preserve provider economics and post balanced entries once", async () => {
  const f = await complaintFixture();
  await assert.rejects(f.platform.issuePartialRefund("ops-1", f.refund), /Review/);
  await f.review();
  const before = await f.repository.findBookingFinancialSettlement(f.booking.id);
  const results = await Promise.all([f.platform.issuePartialRefund("ops-1", f.refund), f.platform.issuePartialRefund("ops-1", f.refund)]);
  assert.ok(results.every(payment => payment.refundedAmountCents === 1500));
  const saved = await f.repository.findPaymentById(f.payment.id);
  assert.equal(saved!.status, "captured"); assert.equal(saved!.partialRefunds!.length, 1);
  assert.equal(saved!.partialRefunds![0].actorUserId, "ops-1");
  assert.equal((await f.repository.findBookingById(f.booking.id))!.status, "completed");
  assert.deepEqual(await f.repository.findBookingFinancialSettlement(f.booking.id), before);
  const entries = (await f.repository.listFinancialLedgerEntries(f.booking.id)).filter(entry => entry.source === "partial-refund");
  assert.equal(entries.length, 2);
  assert.equal(entries.reduce((sum, entry) => sum + (entry.direction === "debit" ? 1 : -1) * entry.amountCents, 0), 0);
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, amountCents: 1600 }), /request key/);
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, idempotencyKey: "duplicate-new-key" }), /already issued/);
});

test("pending and uncertain refunds reserve funds, recover with the same key, and reconcile out-of-order events", async () => {
  const f = await complaintFixture(); await f.review();
  f.gateway.createRefund = async () => { throw new Error("network timeout"); };
  await assert.rejects(f.platform.issuePartialRefund("ops-1", f.refund), /timeout/);
  const record = (await f.repository.findPaymentById(f.payment.id))!.partialRefunds![0];
  assert.equal(record.status, "submitting");
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, idempotencyKey: "different-request-key" }), /still processing/);
  await assert.rejects(f.platform.updateSupportTicketForOps({ ticketId: f.ticket.id, status: "resolved", resolutionNotes: "This case should remain open while the refund is pending." }), /still processing/);
  let key: string | undefined;
  f.gateway.createRefund = async input => { key = input.idempotencyKey; return { refundId: "re_pending", status: "pending" }; };
  const pending = await f.platform.issuePartialRefund("ops-1", f.refund);
  assert.equal(key, `partial-refund:${record.id}`); assert.equal(pending.refundedAmountCents, 0);
  const event = (id: string, status: string) => f.platform.processStripeWebhook(JSON.stringify({ id, type: "refund.updated", paymentId: f.payment.id, refundId: "re_pending", partialRefundId: record.id, refundStatus: status }), "stub");
  await event("evt_success", "succeeded"); await event("evt_success", "succeeded"); await event("evt_late_pending", "pending");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.refundedAmountCents, 1500);
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.partialRefunds![0].status, "succeeded");
  assert.equal((await f.repository.listFinancialLedgerEntries(f.booking.id)).filter(entry => entry.source === "partial-refund").length, 2);
});

test("partial charge webhooks never reverse an entire provider transfer or mark the booking refunded", async () => {
  const f = await complaintFixture();
  await f.platform.processStripeWebhook(JSON.stringify({ id: "evt_external_partial", type: "charge.refunded", paymentIntentId: "pi_complaint", refundedAmountCents: 500 }), "stub");
  assert.equal((await f.repository.findBookingById(f.booking.id))!.status, "completed");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.status, "captured");
  await f.review();
  const result = await f.platform.issuePartialRefund("ops-1", f.refund);
  assert.equal(result.refundedAmountCents, 2000, "Include existing external refunds");
  await f.platform.processStripeWebhook(JSON.stringify({ id: "evt_stale_partial", type: "charge.refunded", paymentIntentId: "pi_complaint", refundedAmountCents: 500 }), "stub");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.refundedAmountCents, 2000);
});

test("failed refunds do not consume refundable balance or post expense; damage and full amounts are blocked", async () => {
  const f = await complaintFixture(); await f.review();
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, amountCents: 10000 }), /less than/);
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, amountCents: 0.5 }), /positive number of cents/);
  f.gateway.createRefund = async () => ({ refundId: "re_failed", status: "failed" });
  const result = await f.platform.issuePartialRefund("ops-1", f.refund);
  assert.equal(result.refundedAmountCents, 0); assert.equal(result.partialRefunds![0].status, "failed");
  assert.equal((await f.repository.listFinancialLedgerEntries(f.booking.id)).filter(entry => entry.source === "partial-refund").length, 0);
  await f.repository.updateSupportTicket(f.ticket.id, { status: "resolved" });
  const damage = await f.platform.createServiceComplaint(f.customer.id, { ...f.input, kind: "property-damage" });
  assert.equal(damage.complaint!.humanReviewRequested, true);
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, ticketId: damage.id, idempotencyKey: "damage-request-key" }), /incident review/);
});

test("AI is advisory, consent gated, does not fetch arbitrary URLs, and falls back on invalid output", async () => {
  const f = await complaintFixture();
  let body: Record<string, unknown> | undefined;
  let calls = 0;
  const request = async (_url: unknown, options: RequestInit) => { calls++; body = JSON.parse(options.body as string); return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ summary: "The fence edge is visible.", observations: ["Untrimmed grass appears beside the fence."], limitations: ["The photos may show different times."], suggestedQuestion: "Was the fence edge included?" }) }] }] }), { status: 200 }); };
  const service = new ComplaintAssessmentService(new PhotoStorageService(), "fake-key", "configured-test-model", request as typeof fetch);
  const booking = (await f.repository.findBookingById(f.booking.id))!;
  await service.assess(booking, f.ticket.complaint!, f.ticket.description); assert.equal(calls, 0);
  const assessed = await service.assess(booking, { ...f.ticket.complaint!, aiConsent: true }, f.ticket.description);
  assert.equal(assessed.source, "ai"); assert.equal(calls, 1); assert.equal(body!.store, false); assert.equal(body!.tools, undefined);
  assert.ok(!JSON.stringify(body).includes("Complaint Customer"));
  const broken = new ComplaintAssessmentService(new PhotoStorageService(), "fake-key", "test", (async () => new Response("{}")) as typeof fetch);
  const fallback = await broken.assess(booking, { ...f.ticket.complaint!, aiConsent: true }, f.ticket.description);
  assert.equal(fallback.source, "rules"); assert.equal(fallback.status, "unavailable");
});

test("a full refund after goodwill refunds only the remaining amount, with pending and uncertain states kept open", async () => {
  const f = await complaintFixture(); await f.review();
  await f.platform.issuePartialRefund("ops-1", f.refund);
  await f.platform.createOpsRefundOverride({ ticketId: f.ticket.id, paymentId: f.payment.id, reason: "Reviewed remaining incomplete work and approved the remaining payment." });
  let fullInput;
  f.gateway.createRefund = async input => { fullInput = input; return { refundId: "re_remaining", status: "pending" }; };
  const result = await f.platform.updateSupportTicketForOps({ ticketId: f.ticket.id, status: "resolved", resolutionAction: "approve-refund", resolutionNotes: "Customer evidence confirms the remainder of the booked work was not delivered." });
  assert.equal(fullInput.amountCents, 8500);
  assert.equal(result.status, "triaged");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.status, "captured");
  assert.equal((await f.repository.findBookingById(f.booking.id))!.status, "completed");
  await assert.rejects(f.platform.issuePartialRefund("ops-1", { ...f.refund, idempotencyKey: "additional-refund" }), /full refund/);
  await assert.rejects(f.platform.updateSupportTicketForOps({ ticketId: f.ticket.id, status: "resolved", resolutionAction: "deny-refund", resolutionNotes: "Denying an already submitted refund would misstate the payment." }), /submitted full refund/);
  await f.platform.processStripeWebhook(JSON.stringify({ id: "evt_full_success", type: "refund.updated", paymentId: f.payment.id, refundId: "re_remaining", fullRefundKey: fullInput.fullRefundKey, refundStatus: "succeeded" }), "stub");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.refundedAmountCents, 10000);
  assert.equal((await f.repository.findBookingById(f.booking.id))!.status, "refunded");
});

test("an uncertain full refund blocks additional money movement and retries with the same processor key", async () => {
  const f = await complaintFixture(); await f.review();
  await f.platform.createOpsRefundOverride({ ticketId: f.ticket.id, paymentId: f.payment.id, reason: "Support is reviewing all of the unfinished work." });
  const keys = new Set();
  f.gateway.createRefund = async input => { keys.add(input.idempotencyKey); throw new Error("network timeout"); };
  const resolution = { ticketId: f.ticket.id, status: "resolved" as const, resolutionAction: "approve-refund" as const, resolutionNotes: "The submitted photos show that the included service was not completed." };
  await f.platform.updateSupportTicketForOps(resolution);
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.fullRefundAttempt!.status, "submitting");
  await assert.rejects(f.platform.issuePartialRefund("ops-1", f.refund), /full refund/);
  f.gateway.createRefund = async input => { keys.add(input.idempotencyKey); return { refundId: "re_recovered", status: "succeeded" }; };
  await f.platform.updateSupportTicketForOps(resolution);
  assert.equal(keys.size, 1);
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.status, "refunded");
});

test("complaint photos cannot be included in public marketing consent", async () => {
  const f = await complaintFixture();
  const booking = (await f.repository.findBookingById(f.booking.id))!;
  await f.repository.updateBooking(booking.id, { serviceEvidence: [...booking.serviceEvidence,
    { ...booking.serviceEvidence[0], id: "provider-before", phase: "before", capturedByRole: "provider", capturedByUserId: booking.providerId, complaintTicketId: undefined },
    { ...booking.serviceEvidence[0], id: "provider-after", capturedByRole: "provider", capturedByUserId: booking.providerId, complaintTicketId: undefined }] });
  const changed = await f.platform.updateBookingPhotoMarketingUse(f.customer.id, { bookingId: booking.id, status: "granted" });
  assert.equal(changed.serviceEvidence.find(item => item.complaintTicketId)!.marketingUseStatus, "denied");
  assert.equal(changed.serviceEvidence.find(item => item.id === "provider-after")!.marketingUseStatus, "granted");
});

test("a charge event containing a pending refund does not declare the payment fully refunded", async () => {
  const f = await complaintFixture();
  await f.platform.processStripeWebhook(JSON.stringify({ id: "evt_pending_charge", type: "charge.refunded", paymentIntentId: "pi_complaint", refundedAmountCents: 10000, chargeRefunds: [{ id: "re_pending_full", status: "pending" }] }), "stub");
  assert.equal((await f.repository.findPaymentById(f.payment.id))!.status, "captured");
  assert.equal((await f.repository.findBookingById(f.booking.id))!.status, "completed");
});
