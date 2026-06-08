import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { PaymentCheckoutGateway } from "../src/services/StripeCheckoutService";

function createAddress(
  line1 = "112 Garden Row",
  latitude = 30.2435,
  longitude = -97.7638
) {
  return {
    line1,
    city: "Austin",
    state: "TX",
    postalCode: "78704",
    country: "US",
    point: {
      latitude,
      longitude
    }
  };
}

function futureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function createFakeStripeGateway(): PaymentCheckoutGateway {
  return {
    isConfigured() {
      return true;
    },
    async createCheckoutSession() {
      return {
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.test/session/cs_test_123",
        paymentIntentId: "pi_test_123"
      };
    },
    async verifyCheckoutSession() {
      return {
        checkoutSessionId: "cs_test_123",
        paymentIntentId: "pi_test_123",
        paid: true
      };
    },
    async parseWebhookEvent() {
      return {
        type: "checkout.session.completed",
        checkoutSessionId: "cs_test_123",
        paymentIntentId: "pi_test_123",
        paid: true
      };
    }
  };
}

test("completed bookings unlock review invites and reject duplicate reviews", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Mow and edge",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  await platform.completeBooking(provider.id, {
    bookingId: booking.id
  });

  const opportunitiesBeforeSend = await platform.listCustomerReviewOpportunities(customer.id);
  assert.equal(opportunitiesBeforeSend.opportunities[0]?.inviteStatus, "scheduled");
  assert.equal(opportunitiesBeforeSend.opportunities[0]?.canReviewNow, false);

  await platform.processReviewInvites({
    nowIso: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString()
  });

  const opportunitiesAfterSend = await platform.listCustomerReviewOpportunities(customer.id);
  assert.equal(opportunitiesAfterSend.opportunities[0]?.inviteStatus, "sent");
  assert.equal(opportunitiesAfterSend.opportunities[0]?.canReviewNow, true);

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 5,
    timelinessRating: 5,
    attentionToDetailRating: 4,
    reviewText: "Fast, neat, and on time."
  });
  assert.equal(review.providerId, provider.id);

  await assert.rejects(
    platform.createProviderReview(customer.id, {
      bookingId: booking.id,
      overallRating: 5,
      timelinessRating: 5,
      attentionToDetailRating: 5,
      reviewText: "Duplicate review"
    }),
    /already been submitted/
  );
});

test("customers can change addresses only when the booking state allows it", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer2@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("145 Prospect Ave", 40.6681, -73.9836)
  });
  assert.equal(customer.role, "customer");

  const providers = await repository.listProviders();
  const provider = providers[0];

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: provider.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    notes: "Front and back yard",
    totalCents: 5500
  });

  const response = await platform.updateBookingAddress(customer.id, {
    bookingId: booking.id,
    newAddress: createAddress("150 Prospect Ave", 40.6692, -73.9827),
    newPropertyId: undefined
  });

  assert.equal(response.outcome, "updated");

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const completed = await platform.completeBooking(provider.id, {
    bookingId: booking.id
  });

  const blockedResponse = await platform.updateBookingAddress(customer.id, {
    bookingId: completed.id,
    newAddress: createAddress("111 New Address", 40.6701, -73.982),
    newPropertyId: undefined
  });

  assert.equal(blockedResponse.outcome, "blocked");
  assert.match(blockedResponse.reason, /no longer be changed/);
});

test("customers can cancel and reschedule future requested bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer3@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];

  const bookingToReschedule = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 75 * 60 * 60 * 1000).toISOString(),
    notes: "Front beds",
    totalCents: 8200
  });
  const nextStartIso = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
  const nextEndIso = new Date(Date.now() + 99 * 60 * 60 * 1000).toISOString();

  const rescheduledBooking = await platform.rescheduleBooking(customer.id, {
    bookingId: bookingToReschedule.id,
    scheduledStartIso: nextStartIso,
    scheduledEndIso: nextEndIso
  });
  assert.equal(rescheduledBooking.scheduledStartIso, nextStartIso);
  assert.equal(rescheduledBooking.scheduledEndIso, nextEndIso);

  const bookingToCancel = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 121 * 60 * 60 * 1000).toISOString(),
    notes: "Cancel this one",
    totalCents: 6200
  });

  const cancelledBooking = await platform.cancelBooking(customer.id, {
    bookingId: bookingToCancel.id
  });
  assert.equal(cancelledBooking.status, "cancelled");

  await assert.rejects(
    platform.rescheduleBooking(customer.id, {
      bookingId: cancelledBooking.id,
      scheduledStartIso: new Date(Date.now() + 140 * 60 * 60 * 1000).toISOString(),
      scheduledEndIso: new Date(Date.now() + 141 * 60 * 60 * 1000).toISOString()
    }),
    /Only future requested or confirmed bookings/
  );
});

test("providers can send one-tap late updates to customers for active bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-late@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Backyard and edging",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const lateEtaIso = futureIso(6.5);
  const updatedBooking = await platform.markBookingLate(provider.id, {
    bookingId: booking.id,
    lateEtaIso,
    reason: "Finishing the prior property."
  });

  assert.equal(updatedBooking.lateEtaIso, lateEtaIso);
  assert.equal(updatedBooking.lateReason, "Finishing the prior property.");

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some(
      (notification) =>
        notification.title === "Your provider is running late" &&
        /Finishing the prior property/.test(notification.body)
    )
  );
});

test("outside calendar blocks remove overlapping availability from provider search", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = (await repository.listProviders())[0];
  const providerSlots = await repository.listSlotsByProvider(provider.id);
  const blockedSlot = providerSlots[0];
  const fallbackSlot = providerSlots[1];

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Direct client visit",
        blockType: "off-platform-client",
        startIso: blockedSlot.startIso,
        endIso: blockedSlot.endIso
      }
    ]
  });

  const response = await platform.searchProviders({
    address: provider.address,
    categories: [provider.categories[0]],
    dateIso: blockedSlot.startIso,
    estimatedDurationMinutes: 45
  });

  assert.ok(response.providers.some((item) => item.id === provider.id));
  assert.ok(!response.suggestedSlots.some((slot) => slot.id === blockedSlot.id));
  assert.ok(response.suggestedSlots.some((slot) => slot.id === fallbackSlot.id));
});

test("customers cannot book a provider window blocked by an outside calendar event", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-block@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const blockedSlot = (await repository.listSlotsByProvider(provider.id))[0];

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Family appointment",
        blockType: "personal-time",
        startIso: blockedSlot.startIso,
        endIso: blockedSlot.endIso
      }
    ]
  });

  await assert.rejects(
    platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: customer.address,
      servicePropertyId: customer.defaultPropertyId,
      category: provider.categories[0],
      scheduledStartIso: blockedSlot.startIso,
      scheduledEndIso: blockedSlot.endIso,
      notes: "Try to book during a blocked window",
      totalCents: 6900
    }),
    /outside calendar event/
  );
});

test("providers can log active booking exceptions and notify customers", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-exception@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const updatedBooking = await platform.markBookingException(provider.id, {
    bookingId: booking.id,
    exceptionType: "unable-to-access-property",
    notes: "The side gate is locked and there is no alternate entry."
  });

  assert.equal(updatedBooking.activeExceptionType, "unable-to-access-property");
  assert.equal(updatedBooking.activeExceptionNotes, "The side gate is locked and there is no alternate entry.");
  assert.ok(updatedBooking.activeExceptionReportedAt);

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some(
      (notification) =>
        notification.title === "Unable to access property" &&
        /side gate is locked/i.test(notification.body)
    )
  );
});

test("customers can dispute a booking and automatically create support context", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const disputedBooking = await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "The agreed scope changed and I need YardMatch to review the booking."
    }
  );

  assert.equal(disputedBooking.status, "disputed");
  assert.equal(disputedBooking.disputedByRole, "customer");
  assert.match(disputedBooking.disputeReason ?? "", /scope changed/i);
  assert.ok(disputedBooking.disputedAt);

  const supportTickets = await platform.listSupportTicketsForRequester({
    userId: customer.id,
    role: "customer"
  });
  assert.ok(
    supportTickets.some(
      (ticket) =>
        ticket.bookingId === booking.id &&
        ticket.issueType === "service-quality" &&
        /scope changed/i.test(ticket.description)
    )
  );

  const providerNotifications = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.ok(
    providerNotifications.notifications.some(
      (notification) =>
        notification.title === "Customer opened a dispute" &&
        /support can now step in/i.test(notification.body)
    )
  );
});

test("ops can resolve a disputed booking and restore it to the active schedule", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-resolve@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Dispute resolution test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const disputedBooking = await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Need a support review before the visit continues."
    }
  );
  assert.equal(disputedBooking.status, "disputed");

  const opsQueue = await platform.listOpsSupportTickets();
  const disputeTicket = opsQueue.find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.status === "open"
  );
  assert.ok(disputeTicket);

  const resolvedTicket = await platform.updateSupportTicketForOps({
    ticketId: disputeTicket.ticket.id,
    status: "resolved",
    resolutionAction: "restore-active-booking",
    resolutionNotes: "Support reviewed the dispute and restored the booking."
  });

  assert.equal(resolvedTicket.status, "resolved");
  assert.equal(resolvedTicket.resolutionAction, "restore-active-booking");
  assert.match(resolvedTicket.resolutionNotes ?? "", /restored the booking/i);

  const restoredBooking = await repository.findBookingById(booking.id);
  assert.equal(restoredBooking?.status, "confirmed");
  assert.equal(restoredBooking?.disputeReason, undefined);
  assert.equal(restoredBooking?.activeExceptionType, undefined);
});

test("customers can create and finalize Stripe checkout for their own bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payments@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Stripe payment test",
    totalCents: 7200
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.status, "pending");
  assert.equal(checkout.payment.processor, "stripe");
  assert.equal(checkout.checkoutUrl, "https://checkout.stripe.test/session/cs_test_123");

  const beforeFinalize = await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(beforeFinalize.length, 1);
  assert.equal(beforeFinalize[0]?.status, "pending");

  const finalized = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });
  assert.equal(finalized.status, "captured");
  assert.equal(finalized.processorPaymentIntentId, "pi_test_123");
  assert.ok(finalized.paidAt);
  assert.equal(finalized.refundable, true);
});

test("stripe webhook capture updates pending payments without a customer redirect", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-webhook@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Webhook payment test",
    totalCents: 9800
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.status, "pending");

  const webhook = await platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "checkout.session.completed");
  assert.equal(webhook.paymentId, checkout.payment.id);

  const payments = await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(payments[0]?.status, "captured");
});

test("review-first staffing creates pending crew matches that providers can approve", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-staffing@example.com",
    password: "Password123!",
    phone: "555-0300",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation", "lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-staffing@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  const crewMatch = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-match@example.com",
    password: "Password123!",
    phone: "555-0400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation", "lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25,
    winterWorkEnabled: true
  });
  assert.equal(crewMatch.role, "crew-member");

  await platform.registerUser({
    fullName: "Nina Snow",
    email: "crew-nonmatch@example.com",
    password: "Password123!",
    phone: "555-0401",
    role: "crew-member",
    address: createAddress("400 Far Away Rd", 35.0, -100.0),
    categories: ["snow-shoveling"],
    availableWeekdays: ["Sun"],
    willingToTravelMiles: 5,
    winterWorkEnabled: false
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(staffing.provider.staffingMode, "review-first");
  assert.ok(job.matches.some((match) => match.crewMemberId === crewMatch.id));
  assert.ok(job.matches.every((match) => match.status === "pending-provider-review"));
  assert.ok(job.matches.every((match) => !match.autoAccepted));

  const pendingMatch = job.matches.find((match) => match.crewMemberId === crewMatch.id);
  assert.ok(pendingMatch);

  const acceptedMatch = await platform.reviewCrewMatch(provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });
  assert.equal(acceptedMatch.status, "accepted");

  const crewMatches = await platform.getCrewMatchesForCrew(crewMatch.id);
  assert.ok(crewMatches.matches.some((match) => match.id === acceptedMatch.id && match.status === "accepted"));
});

test("auto-accept staffing immediately creates accepted crew matches", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Riley Bishop",
    email: "provider-auto@example.com",
    password: "Password123!",
    phone: "555-0500",
    role: "provider",
    companyName: "Bishop Outdoor",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("200 Provider Way", 30.2438, -97.7635)
  });
  assert.equal(provider.role, "provider");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "auto-accept",
    sponsoredListingEnabled: false
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-auto@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 7000
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Alex Mower",
    email: "crew-auto@example.com",
    password: "Password123!",
    phone: "555-0600",
    role: "crew-member",
    address: createAddress("110 Garden Row", 30.2433, -97.7636),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    willingToTravelMiles: 30
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Weekly service",
    totalCents: 6200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(staffing.provider.staffingMode, "auto-accept");
  assert.ok(job.matches.some((match) => match.crewMemberId === crew.id && match.status === "accepted"));
});

test("provider and crew can chat on a valid crew match while unrelated users are blocked", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-chat@example.com",
    password: "Password123!",
    phone: "555-0700",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-chat@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-chat@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const otherCrew = await platform.registerUser({
    fullName: "Chris Unrelated",
    email: "crew-other@example.com",
    password: "Password123!",
    phone: "555-0801",
    role: "crew-member",
    address: createAddress("120 Garden Row", 30.2439, -97.7632),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(otherCrew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const crewMatch = job.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const providerThread = await platform.sendProviderCrewMessage(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      crewMatchId: crewMatch.id,
      body: "Can you meet at the property 15 minutes early?"
    }
  );
  assert.equal(providerThread.messages.length, 1);
  assert.equal(providerThread.messages[0]?.senderRole, "provider");

  const crewThread = await platform.sendProviderCrewMessage(
    { userId: crew.id, email: crew.email, role: "crew-member" },
    {
      threadId: providerThread.thread.id,
      body: "Yes, I can be there early."
    }
  );
  assert.equal(crewThread.messages.length, 2);
  assert.equal(crewThread.messages[1]?.senderRole, "crew-member");

  await assert.rejects(
    platform.getProviderCrewConversationThread(
      { userId: otherCrew.id, email: otherCrew.email, role: "crew-member" },
      providerThread.thread.id
    ),
    /cannot access this conversation/
  );
});

test("customer-provider chat unlocks only after an accepted crew member is on route", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-customer-chat@example.com",
    password: "Password123!",
    phone: "555-0900",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-customer-chat@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  const otherCustomer = await platform.registerUser({
    fullName: "Casey Blocked",
    email: "customer-blocked@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Rental",
    address: createAddress("210 Other St", 30.2501, -97.759)
  });
  assert.equal(otherCustomer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-on-route@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const otherCrew = await platform.registerUser({
    fullName: "Chris Backup",
    email: "crew-backup@example.com",
    password: "Password123!",
    phone: "555-0801",
    role: "crew-member",
    address: createAddress("120 Garden Row", 30.2439, -97.7632),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(otherCrew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const crewMatch = job.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });

  await assert.rejects(
    platform.sendCustomerProviderMessage(
      { userId: customer.id, email: customer.email, role: "customer" },
      {
        bookingId: booking.id,
        body: "Are you still on schedule?"
      }
    ),
    /unlocks only after the crew is on route/
  );

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: otherCrew.id, email: otherCrew.email, role: "crew-member" },
      {
        bookingId: booking.id
      }
    ),
    /Only accepted crew members can confirm they are on route/
  );

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);
  assert.equal(onRouteBooking.onRouteConfirmedByCrewMemberId, undefined);

  const customerThread = await platform.sendCustomerProviderMessage(
    { userId: customer.id, email: customer.email, role: "customer" },
    {
      bookingId: booking.id,
      body: "Thanks for the update. The side gate will be open."
    }
  );
  assert.equal(customerThread.messages.length, 1);
  assert.equal(customerThread.messages[0]?.senderRole, "customer");

  const providerThread = await platform.sendCustomerProviderMessage(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      threadId: customerThread.thread.id,
      body: "Perfect. Our crew is 10 minutes away."
    }
  );
  assert.equal(providerThread.messages.length, 2);
  assert.equal(providerThread.messages[1]?.senderRole, "provider");

  await assert.rejects(
    platform.getCustomerProviderConversationThread(
      { userId: otherCustomer.id, email: otherCustomer.email, role: "customer" },
      providerThread.thread.id
    ),
    /cannot access this conversation/
  );
});

test("arrival tracking shows a live route once the crew is on route", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-tracking@example.com",
    password: "Password123!",
    phone: "555-0900",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-tracking@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-tracking@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const crewMatch = staffing.jobs[0]?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);

  const oneMinuteLater = new Date(
    new Date(onRouteBooking.onRouteConfirmedAt as string).getTime() + 1 * 60 * 1000
  ).toISOString();
  const liveTracking = await platform.updateBookingRouteLocation(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      point: {
        latitude: 30.2438,
        longitude: -97.76395
      },
      speedMph: 18,
      capturedAtIso: oneMinuteLater
    }
  );
  assert.equal(liveTracking.source, "provider-device");
  assert.equal(liveTracking.isLiveLocationStale, false);

  const tracking = await platform.getBookingArrivalTracking(
    { userId: customer.id, email: customer.email, role: "customer" },
    booking.id,
    oneMinuteLater
  );

  assert.equal(tracking.status, "on-route");
  assert.ok(tracking.currentPoint);
  assert.ok((tracking.etaMinutes ?? 0) > 0);
  assert.ok(tracking.progressPercent > 0);
  assert.equal(tracking.source, "provider-device");
  assert.equal(tracking.message.includes("live location"), true);
});

test("providers confirm bookings before crew can go on route or start work", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1300",
    role: "provider",
    companyName: "Route Ready Lawn",
    categories: ["lawn-mowing", "mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  const crewMember = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["lawn-mowing", "mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25,
    winterWorkEnabled: true
  });
  assert.equal(crewMember.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(99),
    notes: "Front beds",
    totalCents: 9100
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = overview.jobs[0]?.matches[0];
  assert.ok(pendingMatch);

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      {
        bookingId: booking.id
      }
    ),
    /must be confirmed/
  );

  const confirmedBooking = await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });
  assert.equal(confirmedBooking.status, "confirmed");

  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);

  const inProgressBooking = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.equal(inProgressBooking.status, "in-progress");
});

test("providers cannot complete requested bookings before confirmation", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-precomplete@example.com",
    password: "Password123!",
    phone: "555-2200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await assert.rejects(
    platform.completeBooking(provider.id, {
      bookingId: booking.id
    }),
    /must be confirmed/
  );
});

test("notifications track booking, staffing, and review milestones across roles", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-notify@example.com",
    password: "Password123!",
    phone: "555-3300",
    role: "provider",
    companyName: "Signal Lawn Co.",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-notify@example.com",
    password: "Password123!",
    phone: "555-3200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-notify@example.com",
    password: "Password123!",
    phone: "555-3400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const providerNotifications = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.equal(providerNotifications.unreadCount, 1);
  assert.equal(providerNotifications.notifications[0]?.title, "New booking request");

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const customerNotifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(customerNotifications.notifications.some((notification) => notification.title === "Your booking is confirmed"));

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const crewMatch = staffing.jobs[0]?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const crewPendingNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.ok(crewPendingNotifications.notifications.some((notification) => notification.title === "You have a new crew match"));

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });

  const crewAcceptedNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.ok(crewAcceptedNotifications.notifications.some((notification) => notification.title === "You were accepted for a job"));

  await platform.markNotificationsRead(
    {
      userId: crew.id,
      email: crew.email,
      role: "crew-member"
    },
    {}
  );
  const crewReadNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.equal(crewReadNotifications.unreadCount, 0);
});

test("notifications generate external delivery records for push, email, and sms", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-delivery@example.com",
    password: "Password123!",
    phone: "555-3500",
    role: "provider",
    companyName: "Signal Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-delivery@example.com",
    password: "Password123!",
    phone: "555-3600",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Delivery fanout test",
    totalCents: 6200
  });

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });

  const channels = deliveries.deliveries.map((delivery) => delivery.channel).sort();
  assert.deepEqual(channels, ["email", "push", "sms"]);
  assert.ok(deliveries.deliveries.every((delivery) => delivery.status === "sent"));
});

test("notification preferences can disable sms and review reminder delivery", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-pref@example.com",
    password: "Password123!",
    phone: "555-3700",
    role: "provider",
    companyName: "Review Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-pref@example.com",
    password: "Password123!",
    phone: "555-3800",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.updateNotificationPreferences(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      smsEnabled: false,
      reviewRemindersEnabled: false
    }
  );

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Notification preference test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.processReviewInvites({
    nowIso: futureIso(96)
  });

  const deliveries = await platform.listNotificationDeliveries({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });

  assert.ok(!deliveries.deliveries.some((delivery) => delivery.channel === "sms"));
  assert.ok(!deliveries.deliveries.some((delivery) => delivery.category === "review" && delivery.channel === "push"));
});

test("registered Expo push devices create retryable push deliveries", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-push@example.com",
    password: "Password123!",
    phone: "555-3810",
    role: "provider",
    companyName: "Push Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-push@example.com",
    password: "Password123!",
    phone: "555-3820",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.registerPushDevice(
    {
      userId: provider.id,
      email: provider.email,
      role: "provider"
    },
    {
      platform: "ios",
      provider: "expo",
      token: "ExponentPushToken[providerpush123]"
    }
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("push delivery offline");
  }) as typeof globalThis.fetch;

  try {
    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Push delivery retry test",
      totalCents: 6200
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const pushDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "push");

  assert.ok(pushDelivery);
  assert.equal(pushDelivery?.destination, "ExponentPushToken[providerpush123]");
  assert.equal(pushDelivery?.provider, "expo-push");
  assert.equal(pushDelivery?.status, "failed");
  assert.equal(pushDelivery?.attemptCount, 1);
  assert.ok(pushDelivery?.nextRetryAt);
});

test("providers can get a subscribable calendar feed and merged overview for mixed schedule management", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar@example.com",
    password: "Password123!",
    phone: "555-3900",
    role: "provider",
    companyName: "Calendar Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar@example.com",
    password: "Password123!",
    phone: "555-3910",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Calendar export test",
    totalCents: 6200
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Direct client cleanup",
        blockType: "off-platform-client",
        startIso: futureIso(28),
        endIso: futureIso(29),
        notes: "Neighbor referral cleanup",
        source: "manual"
      }
    ]
  });

  const subscription = await platform.getProviderCalendarSubscription(provider.id);
  assert.ok(subscription.feedUrl.includes("/api/calendar/feed?token="));
  assert.ok(subscription.webcalUrl.startsWith("webcal://"));

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.yardmatchJobCount, 1);
  assert.equal(overview.externalBlockCount, 1);
  assert.equal(overview.events.length, 2);
  assert.equal(overview.events[0].source, "yardmatch-booking");
  assert.equal(overview.events[1].source, "external-block");

  const token = new URL(subscription.feedUrl).searchParams.get("token");
  assert.ok(token);

  const feed = await platform.buildCalendarFeedByToken(token as string);
  assert.match(feed, /BEGIN:VCALENDAR/);
  assert.match(feed, /Calendar Lawn Co.: Lawn Mowing for Jordan Rivera/);
  assert.match(feed, /Calendar export test/);
  assert.match(feed, /Calendar Lawn Co.: Direct client cleanup/);
  assert.match(feed, /Neighbor referral cleanup/);
});

test("providers can import an external iCal feed and use it to block YardMatch availability", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-import@example.com",
    password: "Password123!",
    phone: "555-3920",
    role: "provider",
    companyName: "Import Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-import@example.com",
    password: "Password123!",
    phone: "555-3930",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const importStart = futureIso(48);
  const importEnd = futureIso(49);
  const rawFeed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:outside-client-1@example.com",
    `DTSTART:${importStart.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    `DTEND:${importEnd.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    "SUMMARY:Outside cleanup route",
    "DESCRIPTION:Imported from Google Calendar",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");
  const feedUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(rawFeed)}`;

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const imports = await platform.createProviderCalendarImport(provider.id, {
    title: "Google Calendar - Outside work",
    provider: "google",
    feedUrl
  });
  assert.equal(imports.subscriptions.length, 1);
  assert.equal(imports.importedBlockCount, 1);
  assert.equal(imports.subscriptions[0]?.importedEventCount, 1);

  const providerAfterImport = await platform.getProviderProfile(provider.id);
  const importedBlock = providerAfterImport.calendarConnection.externalBlocks?.find(
    (block) => block.source === "calendar-import"
  );
  assert.ok(importedBlock);
  assert.equal(importedBlock?.title, "Outside cleanup route");

  const matchingSlots = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: importStart,
    estimatedDurationMinutes: 45
  });

  assert.ok(matchingSlots.providers.some((item) => item.id === provider.id));
  assert.ok(
    !matchingSlots.suggestedSlots.some(
      (slot) =>
        slot.providerId === provider.id &&
        slot.startIso === importStart &&
        slot.endIso === importEnd
    )
  );

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.ok(
    overview.events.some((event) => event.source === "external-block" && event.title === "Outside cleanup route")
  );

  const synced = await platform.syncProviderCalendarImport(provider.id, {
    subscriptionId: imports.subscriptions[0].id
  });
  assert.equal(synced.subscriptions[0]?.importedEventCount, 1);

  const removed = await platform.removeProviderCalendarImport(provider.id, {
    subscriptionId: imports.subscriptions[0].id
  });
  assert.equal(removed.subscriptions.length, 0);

  const matchingSlotsAfterRemoval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: importStart,
    estimatedDurationMinutes: 45
  });

  assert.ok(matchingSlotsAfterRemoval.providers.some((item) => item.id === provider.id));
});

test("providers receive one timed departure reminder for confirmed upcoming jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-reminder@example.com",
    password: "Password123!",
    phone: "555-4300",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-reminder@example.com",
    password: "Password123!",
    phone: "555-4200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(0.5),
    scheduledEndIso: futureIso(1.5),
    notes: "Departure reminder test",
    totalCents: 6400
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const firstList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const departureReminders = firstList.notifications.filter(
    (notification) => notification.title === "Time to head out soon"
  );
  assert.equal(departureReminders.length, 1);

  const secondList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const secondDepartureReminders = secondList.notifications.filter(
    (notification) => notification.title === "Time to head out soon"
  );
  assert.equal(secondDepartureReminders.length, 1);
});
