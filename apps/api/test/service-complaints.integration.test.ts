import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { ServiceComplaintService } from "../src/services/ServiceComplaintService";
import { PartialRefundService } from "../src/services/PartialRefundService";
import { PhotoStorageService } from "../src/services/PhotoStorageService";
import type { PaymentCheckoutGateway } from "../src/services/StripeCheckoutService";

const databaseUrl = process.env.TEST_DATABASE_URL;
test("Postgres preserves complaints and refund reservations across instances and restarts, with one ledger posting", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const secondClient = new PrismaClient({ datasourceUrl: databaseUrl });
  const repository = new PrismaMarketplaceRepository(client);
  const otherRepository = new PrismaMarketplaceRepository(secondClient);
  const suffix = randomUUID();
  const now = new Date().toISOString();
  const provider = { ...(await new InMemoryMarketplaceRepository().listProviders())[0], id: `provider-${suffix}`, email: `provider-${suffix}@example.com`, credentials: [] };
  const customerId = `customer-${suffix}`;
  const bookingId = `booking-${suffix}`;
  const paymentId = `payment-${suffix}`;
  try {
    await repository.createProvider(provider);
    await repository.createCustomer({ id: customerId, fullName: "Database Complaint", email: `${customerId}@example.com`, phone: "555-0100", role: "customer", address: provider.address, createdAt: now, propertyNotes: "", lawnSizeSqFt: 1000, properties: [], defaultPropertyId: "" });
    await repository.createBooking({ id: bookingId, customerId, providerId: provider.id, serviceAddress: provider.address, category: "lawn-mowing", requestedAt: now, scheduledStartIso: now, scheduledEndIso: now, status: "completed", completedAt: now, notes: "", totalCents: 10000, serviceEvidence: [], interventions: [], addressChangeHistory: [] });
    await repository.createPayment({ id: paymentId, bookingId, amountCents: 10000, currency: "usd", status: "captured", processor: "stripe", processorPaymentIntentId: `pi_${suffix}`, refundable: true, createdAt: now, updatedAt: now });
    await repository.settleBookingFinancials({ bookingId, paymentId, customerId, providerId: provider.id, customerChargeCents: 10000, currency: "usd", actualProcessorFeeCents: 150 });
    const service = new ServiceComplaintService(repository, new PhotoStorageService());
    const ticket = await service.create(customerId, { bookingId, kind: "quality", affectedArea: "Backyard", description: "The cleanup was not completed to the booked scope.", preferredRemedy: "refund", noPhotoReason: "I cannot access the yard today." });
    const keys = new Set<string>();
    const gateway = { isConfigured: () => true, createRefund: async input => { keys.add(input.idempotencyKey); return { refundId: `re_${suffix}`, status: "pending" }; } } as PaymentCheckoutGateway;
    const input = { ticketId: ticket.id, paymentId, amountCents: 1200, reason: "YardMatch-funded goodwill for cleanup concerns.", idempotencyKey: `request-${suffix}` };
    await Promise.all([new PartialRefundService(repository, gateway).issue("ops-a", input), new PartialRefundService(otherRepository, gateway).issue("ops-b", input)]);
    assert.equal(keys.size, 1);
    const saved = (await otherRepository.findPaymentById(paymentId))!;
    assert.equal(saved.partialRefunds!.length, 1); assert.equal(saved.partialRefunds![0].status, "pending");
    assert.equal((await otherRepository.listSupportTickets()).find(item => item.id === ticket.id)!.complaint!.noPhotoReason, "I cannot access the yard today.");
    await otherRepository.withLock(`payment:${bookingId}`, repo => new PartialRefundService(repo, gateway).reconcile(paymentId, saved.partialRefunds![0].id, `re_${suffix}`, "succeeded"));
    await repository.withLock(`payment:${bookingId}`, repo => new PartialRefundService(repo, gateway).reconcile(paymentId, saved.partialRefunds![0].id, `re_${suffix}`, "succeeded"));
    assert.equal((await repository.findPaymentById(paymentId))!.refundedAmountCents, 1200);
    assert.equal((await repository.listFinancialLedgerEntries(bookingId)).filter(item => item.source === "partial-refund").length, 2);
    assert.equal((await repository.findBookingFinancialSettlement(bookingId))!.providerNetCents, 6301);
    assert.equal((await repository.findBookingById(bookingId))!.status, "completed");
    // A rolled-back transaction must leave neither an audit mutation nor an extra ledger entry.
    await assert.rejects(repository.withLock(`payment:${bookingId}`, async repo => { await repo.updatePayment(paymentId, { refundedAmountCents: 9999 }); throw new Error("rollback"); }), /rollback/);
    assert.equal((await otherRepository.findPaymentById(paymentId))!.refundedAmountCents, 1200);
  } finally {
    await client.financialLedgerEntry.deleteMany({ where: { bookingId } });
    await client.bookingFinancialSettlement.deleteMany({ where: { bookingId } });
    await client.customerProviderRelationship.deleteMany({ where: { customerId } });
    await client.paymentRecord.deleteMany({ where: { id: paymentId } });
    await client.supportTicket.deleteMany({ where: { bookingId } });
    await client.booking.deleteMany({ where: { id: bookingId } });
    await client.userAccount.deleteMany({ where: { id: { in: [customerId, provider.id] } } });
    await Promise.all([client.$disconnect(), secondClient.$disconnect()]);
  }
});
