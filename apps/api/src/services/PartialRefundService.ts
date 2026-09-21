import { randomUUID } from "node:crypto";
import type { FinancialLedgerEntry, IssuePartialRefundRequest, PartialRefundRecord, PaymentRecord } from "@yardmatch/contracts";
import { HttpError } from "../http";
import type { MarketplaceRepository } from "../repositories/MarketplaceRepository";
import type { PaymentCheckoutGateway } from "./StripeCheckoutService";

export function hasPendingPartialRefund(payment: PaymentRecord): boolean {
  return Boolean(payment.partialRefunds?.some(refund => refund.status === "submitting" || refund.status === "pending"));
}

export class PartialRefundService {
  constructor(private readonly repository: MarketplaceRepository, private readonly gateway: PaymentCheckoutGateway) {}

  async issue(actorUserId: string, input: IssuePartialRefundRequest): Promise<PaymentRecord> {
    if (!input || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new HttpError(400, "Refund amount must be a positive number of cents.");
    if (typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.length > 2000) throw new HttpError(400, "Explain the refund and its amount in 20–2000 characters.");
    if (typeof input.idempotencyKey !== "string" || !/^[\w-]{8,100}$/.test(input.idempotencyKey)) throw new HttpError(400, "A valid refund request key is required.");
    const payment = await this.repository.findPaymentById(input.paymentId);
    if (!payment) throw new HttpError(404, "Payment not found.");
    // Commit a reservation before calling Stripe. An uncertain network result never frees this amount.
    const reservation = await this.repository.withLock(`payment:${payment.bookingId}`, async repository => {
      const current = (await repository.findPaymentById(payment.id))!;
      const records = current.partialRefunds ?? [];
      const previous = records.find(record => record.idempotencyKey === input.idempotencyKey);
      if (previous) {
        if (previous.amountCents !== input.amountCents || previous.ticketId !== input.ticketId || previous.reason !== input.reason.trim()) throw new HttpError(409, "This request key was already used for a different refund.");
        if (previous.status === "submitting" && Date.now() - Date.parse(previous.createdAt) > 23 * 3600000) throw new HttpError(409, "Reconcile this uncertain refund with Stripe before retrying. Its safe retry window has expired.");
        return { payment: current, refund: previous };
      }
      const booking = await repository.findBookingById(current.bookingId);
      const ticket = (await repository.listSupportTickets()).find(item => item.id === input.ticketId);
      if (!booking || !ticket || ticket.bookingId !== booking.id || ticket.status === "resolved") throw new HttpError(409, "An open support case for this booking is required.");
      if (ticket.complaint?.kind === "property-damage") throw new HttpError(409, "Property damage must be handled through human incident review, outside the goodwill refund flow.");
      if (current.status !== "captured" || booking.status !== "completed") throw new HttpError(409, "Partial goodwill refunds require a completed booking with a captured payment and no active dispute.");
      if (current.fullRefundAttempt && current.fullRefundAttempt.status !== "failed") throw new HttpError(409, "A full refund has already been submitted. Reconcile it before issuing another refund.");
      if (current.refundReviewStatus === "requested") throw new HttpError(409, "Finish or deny the full refund review before issuing a goodwill refund.");
      if (hasPendingPartialRefund(current)) throw new HttpError(409, "Another refund is still processing. Retry that request or wait for reconciliation.");
      if (records.some(record => record.ticketId === ticket.id && record.status === "succeeded")) throw new HttpError(409, "A partial refund was already issued for this case. Review the existing result.");
      const refunded = current.refundedAmountCents ?? 0;
      if (input.amountCents >= current.amountCents - refunded) throw new HttpError(400, "A partial refund must be less than the remaining payment. Use the full refund review for the remainder.");
      if (booking.serviceEvidence.length && !booking.serviceEvidence.some(item => item.reviewStatus)) throw new HttpError(409, "Review the submitted service evidence before issuing a refund.");
      if (ticket.complaint?.evidenceIds.length && !booking.serviceEvidence.some(item => ticket.complaint!.evidenceIds.includes(item.id) && item.reviewStatus)) throw new HttpError(409, "Review at least one customer complaint photo before issuing a refund.");
      if (!await repository.findBookingFinancialSettlement(booking.id)) throw new HttpError(409, "Reconcile this booking's financial settlement before refunding.");
      if (current.processor !== "stripe" && (process.env.NODE_ENV === "production" || ["staging", "production"].includes(process.env.YARDMATCH_ENV ?? ""))) throw new HttpError(409, "Local refund simulation is unavailable in deployed environments.");
      if (current.processor === "stripe" && (!this.gateway.isConfigured() || !current.processorPaymentIntentId)) throw new HttpError(503, "Stripe and the original payment intent are required to refund this payment.");
      const now = new Date().toISOString();
      const refund: PartialRefundRecord = { refundedBeforeCents: refunded, id: randomUUID(), ticketId: ticket.id, amountCents: input.amountCents, funding: "platform", status: "submitting",
        actorUserId, reason: input.reason.trim(), idempotencyKey: input.idempotencyKey, createdAt: now, updatedAt: now };
      const updated = (await repository.updatePayment(current.id, { partialRefunds: [...records, refund], updatedAt: now }))!;
      return { payment: updated, refund };
    });
    if (reservation.refund.status !== "submitting") return reservation.payment;
    const result = reservation.payment.processor === "stripe"
      ? await this.gateway.createRefund({ paymentIntentId: reservation.payment.processorPaymentIntentId!, amountCents: reservation.refund.amountCents,
          reason: reservation.refund.reason, bookingId: payment.bookingId, paymentId: payment.id,
          idempotencyKey: `partial-refund:${reservation.refund.id}`, partialRefundId: reservation.refund.id })
      : { refundId: `local_${reservation.refund.id}`, status: "succeeded" };
    return this.repository.withLock(`payment:${payment.bookingId}`, repository =>
      new PartialRefundService(repository, this.gateway).reconcile(payment.id, reservation.refund.id, result.refundId, result.status));
  }

  /** Caller holds the booking payment lock, including for webhook delivery. */
  async reconcile(paymentId: string, id: string | undefined, processorRefundId: string, status: string): Promise<PaymentRecord> {
    const payment = (await this.repository.findPaymentById(paymentId))!;
    const record = payment.partialRefunds?.find(item => item.id === id || item.processorRefundId === processorRefundId);
    if (!record) return payment;
    if (record.status === "succeeded" || record.status === "failed") return payment;
    const nextStatus: PartialRefundRecord["status"] = status === "succeeded" ? "succeeded" : ["failed", "canceled"].includes(status) ? "failed" : "pending";
    const now = new Date().toISOString();
    const records = payment.partialRefunds!.map(item => item.id === record.id ? { ...item, processorRefundId, status: nextStatus, updatedAt: now } : item);
    if (nextStatus === "succeeded") {
      const settlement = await this.repository.findBookingFinancialSettlement(payment.bookingId);
      if (!settlement) throw new HttpError(409, "Missing settlement for refund reconciliation.");
      const ledger: FinancialLedgerEntry[] = (["customer-remedy-expense", "stripe-clearing"] as const).map((account, index) => ({
        id: `${record.id}:${index}`, settlementId: settlement.id, bookingId: payment.bookingId, paymentId,
        account, direction: index === 0 ? "debit" : "credit", amountCents: record.amountCents, currency: payment.currency,
        idempotencyKey: `partial-refund:${record.id}:${account}`, source: "partial-refund", createdAt: now
      }));
      await this.repository.appendFinancialLedgerEntries(ledger);
    }
    // The charge webhook may have delivered the cumulative amount before refund.updated.
    const total = Math.max(payment.refundedAmountCents ?? 0, nextStatus === "succeeded" ? record.refundedBeforeCents + record.amountCents : 0);
    const updated = (await this.repository.updatePayment(paymentId, { partialRefunds: records, refundedAmountCents: total, updatedAt: now }))!;
    const ticket = (await this.repository.listSupportTickets()).find(item => item.id === record.ticketId);
    if (ticket) {
      const message = nextStatus === "succeeded"
        ? `A ${(record.amountCents / 100).toFixed(2)} ${payment.currency.toUpperCase()} partial refund has been processed to your original payment method. Your bank may take additional time to display it. Contact us here if the issue is not resolved.`
        : nextStatus === "failed" ? "The refund could not be completed. Your report remains open for support to help." : "Your partial refund has been submitted and is awaiting payment-provider confirmation. Your report remains open.";
      if (record.status !== nextStatus) {
        const booking = await this.repository.findBookingById(payment.bookingId);
        if (booking) await this.repository.createNotification({ id: `refund:${record.id}:${nextStatus}`, recipientId: booking.customerId, recipientRole: "customer", category: "support",
          title: nextStatus === "succeeded" ? "Partial refund processed" : nextStatus === "failed" ? "Refund needs support review" : "Refund processing",
          body: message, actionHref: `/help?bookingId=${booking.id}`, isRead: false, createdAt: now });
      }
      await this.repository.updateSupportTicket(ticket.id, { updatedAt: now, status: "triaged",
        ...(ticket.complaint ? { complaint: { ...ticket.complaint, customerMessage: message } } : {}),
        resolutionNotes: message });
    }
    return updated;
  }
}
