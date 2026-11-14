import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { Booking, PaymentRecord, ProviderProfile, SupportTicket } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";
const newestFirst = (payments: PaymentRecord[]) =>
  [...payments].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));

/** Answers the payment and photo lookups by loading whole tables and scanning them, as the service did before. */
function wholeTableRepository(repository: MarketplaceRepository): MarketplaceRepository {
  const overrides: Partial<MarketplaceRepository> = {
    listPaymentsForBookingIds: async (bookingIds) => newestFirst((await repository.listPayments()).filter((payment) => bookingIds.includes(payment.bookingId))),
    findPaymentByProcessorPaymentIntentId: async (paymentIntentId) => (await repository.listPayments()).find((payment) => payment.processorPaymentIntentId === paymentIntentId),
    findBookingByEvidenceId: async (evidenceId) => (await repository.listBookings()).find((booking) => booking.serviceEvidence.some((evidence) => evidence.id === evidenceId))
  };
  return new Proxy(repository, {
    get(target, property) {
      const override = (overrides as Record<string | symbol, unknown>)[property];
      if (override) return override;
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

test("Postgres payment and evidence photo lookups find the same rows as scanning whole tables", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `payments-photos-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const now = Date.now();
  const day = 86_400_000;
  const provider: ProviderProfile = { ...template!, id: `${prefix}-provider`, email: `${prefix}-provider@example.invalid`, companyName: "Payments Provider", credentials: [] };
  const customerId = `${prefix}-customer`;
  const crewId = `${prefix}-crew`;
  const bookingId = (name: string) => `${prefix}-booking-${name}`;
  const booking = (name: string, status: Booking["status"], startOffsetDays: number, extra: Partial<Booking> = {}): Booking => ({
    id: bookingId(name), customerId, providerId: provider.id, serviceAddress: template!.address, category: "lawn-mowing", requestedAt: new Date(now - 60 * day).toISOString(),
    scheduledStartIso: new Date(now + startOffsetDays * day).toISOString(), scheduledEndIso: new Date(now + startOffsetDays * day + 3_600_000).toISOString(), status,
    notes: "Payments and photos integration test", totalCents: 7_500, serviceEvidence: [], interventions: [], addressChangeHistory: [],
    ...(status === "completed" || status === "refunded" ? { completedAt: new Date(now + startOffsetDays * day + 3_600_000).toISOString() } : {}), ...extra
  });
  const photo = (name: string) => ({ id: `${prefix}-evidence-${name}`, phase: "after" as const, evidenceType: "photo" as const,
    capturedAt: new Date(now - day).toISOString(), capturedByRole: "provider" as const, capturedByUserId: provider.id });
  const bookings = [
    booking("refunded", "refunded", -9, { serviceEvidence: [photo("old")] }), booking("retried", "completed", -6, { serviceEvidence: [photo("a"), photo("b")] }),
    booking("unpaid", "completed", -3), booking("upcoming", "confirmed", 4)
  ];
  const payment = (name: string, bookingName: string, status: PaymentRecord["status"], ageHours: number, extra: Partial<PaymentRecord> = {}): PaymentRecord => ({
    id: `${prefix}-payment-${name}`, bookingId: bookingId(bookingName), amountCents: 7_500, currency: "usd", status, processor: "stripe", refundable: false,
    processorPaymentIntentId: `pi_${prefix}_${name}`, createdAt: new Date(now - ageHours * 3_600_000).toISOString(), updatedAt: new Date(now - ageHours * 3_600_000).toISOString(), ...extra
  });
  const payments = [
    payment("refunded", "refunded", "refunded", 200, { refundReviewedAt: new Date(now - 8 * day).toISOString() }),
    payment("retried-failed", "retried", "failed", 150), payment("retried-pending", "retried", "pending", 140),
    payment("upcoming", "upcoming", "pending", 2)
  ];
  const ticket = (name: string, bookingName: string): SupportTicket => ({ id: `${prefix}-ticket-${name}`, bookingId: bookingId(bookingName), requesterId: customerId,
    subject: `Ticket ${name}`, description: "Payments and photos integration test", issueType: "billing", status: "open",
    createdAt: new Date(now - 5 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() });
  const opsId = `${prefix}-ops`;
  const ops = { userId: opsId, email: `${opsId}@example.invalid`, role: "ops" as const, sessionVersion: 0 };
  const userIds = [customerId, provider.id, crewId, opsId];
  const failure = async (work: Promise<unknown>) => work.then(() => "resolved", (error: Error) => error.message);
  const unstamped = <T extends { generatedAt?: string }>(result: T) => ({ ...result, generatedAt: "" });
  try {
    await repository.createProvider(provider);
    await repository.createCustomer({ ...template!, id: customerId, email: `${customerId}@example.invalid`, role: "customer", properties: [], defaultPropertyId: "",
      propertyNotes: "", lawnSizeSqFt: 1000 });
    await repository.createCrewMember({ id: crewId, fullName: "Payments Crew", email: `${crewId}@example.invalid`, phone: "555-0300", role: "crew-member",
      address: template!.address, createdAt: new Date(now).toISOString(), bio: "Payments and photos integration test", yearsExperience: 2, categories: ["lawn-mowing"],
      availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 5, preferredSchedule: "flex", hasOwnEquipment: false,
      winterWorkEnabled: false, rating: 4.5, completedJobs: 10, cancellationCount: 0, status: "available" });
    for (const row of bookings) await repository.createBooking(row);
    for (const row of payments) await repository.createPayment(row);
    for (const row of [ticket("retried", "retried"), ticket("refunded", "refunded")]) await repository.createSupportTicket(row);
    for (const name of ["refunded", "retried"]) await repository.createCrewMatch({ id: `${bookingId(name)}-match`, bookingId: bookingId(name), providerId: provider.id,
      crewMemberId: crewId, crewMemberName: "Payments Crew", crewMemberPhone: "555-0300", categories: ["lawn-mowing"], availableWeekdays: ["Mon"], preferredSchedule: "flex",
      willingToTravelMiles: 5, hasOwnEquipment: false, winterWorkEnabled: false, status: "accepted", autoAccepted: false, distanceMiles: 0, hourlyRateCents: 2_500,
      createdAt: new Date(now - day).toISOString() });

    const everyPayment = await repository.listPayments();
    const everyBooking = await repository.listBookings();
    const ids = ["retried", "refunded", "unpaid"].map(bookingId);
    const scopedPayments = await repository.listPaymentsForBookingIds(ids);
    assert.deepEqual(scopedPayments, newestFirst(everyPayment.filter((row) => ids.includes(row.bookingId))));
    assert.deepEqual(scopedPayments.map((row) => row.id), ["retried-pending", "retried-failed", "refunded"].map((name) => `${prefix}-payment-${name}`));
    for (const name of ["retried-failed", "upcoming", "missing"]) {
      assert.deepEqual(await repository.findPaymentByProcessorPaymentIntentId(`pi_${prefix}_${name}`),
        everyPayment.find((row) => row.processorPaymentIntentId === `pi_${prefix}_${name}`));
    }
    assert.equal((await repository.findPaymentByProcessorPaymentIntentId(`pi_${prefix}_upcoming`))?.id, `${prefix}-payment-upcoming`);
    for (const name of ["old", "a", "b", "missing"]) {
      assert.deepEqual(await repository.findBookingByEvidenceId(`${prefix}-evidence-${name}`),
        everyBooking.find((row) => row.serviceEvidence.some((evidence) => evidence.id === `${prefix}-evidence-${name}`)));
    }
    assert.equal((await repository.findBookingByEvidenceId(`${prefix}-evidence-b`))?.id, bookingId("retried"));
    assert.equal(await repository.findBookingByEvidenceId(`${prefix}-evidence`), undefined);

    const scoped = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const wholeTable = new MarketplacePlatformService(wholeTableRepository(repository), new DataEngineeringLogger());
    assert.deepEqual(await scoped.getProviderPayoutLedger(provider.id), await wholeTable.getProviderPayoutLedger(provider.id));
    assert.deepEqual((await scoped.getProviderPayoutLedger(provider.id)).entries.map((entry) => [entry.bookingId.split("-booking-")[1], entry.paymentId?.split("-payment-")[1], entry.status]), [
      ["unpaid", undefined, "awaiting-customer-payment"], ["retried", "retried-pending", "awaiting-customer-payment"], ["refunded", "refunded", "reversed"]
    ]);
    assert.deepEqual(await scoped.getCrewPayoutLedger(crewId), await wholeTable.getCrewPayoutLedger(crewId));
    assert.equal((await scoped.getCrewPayoutLedger(crewId)).performanceSummary.refundedAssignmentCount, 1);
    const tickets = await scoped.listOpsSupportTickets();
    assert.deepEqual(tickets, await wholeTable.listOpsSupportTickets());
    assert.equal(tickets.find((item) => item.ticket.id === `${prefix}-ticket-retried`)?.payment?.id, `${prefix}-payment-retried-pending`);
    const asOfIso = new Date(now).toISOString();
    assert.deepEqual(unstamped(await scoped.escalateStaleOpsSupportTickets(ops, { dryRun: true, asOfIso })),
      unstamped(await wholeTable.escalateStaleOpsSupportTickets(ops, { dryRun: true, asOfIso })));
    // These photos are not in private storage, so both paths find the booking and then refuse to serve the photo.
    assert.match(await failure(scoped.getEvidencePhoto(`${prefix}-evidence-a`, undefined, false)), /Photo not found/);
    assert.equal(await failure(wholeTable.getEvidencePhoto(`${prefix}-evidence-a`, undefined, false)), await failure(scoped.getEvidencePhoto(`${prefix}-evidence-a`, undefined, false)));
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.supportTicket.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.paymentRecord.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.crewMatch.deleteMany({ where: { bookingId: { startsWith: prefix } } });
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
