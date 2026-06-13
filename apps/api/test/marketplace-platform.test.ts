import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { getBookingServiceWindow } from "@yardmatch/contracts";
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

function availabilityDayForIso(iso: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso).getDay()] as
    | "Sun"
    | "Mon"
    | "Tue"
    | "Wed"
    | "Thu"
    | "Fri"
    | "Sat";
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

async function attachEvidence(
  platform: MarketplacePlatformService,
  actor: { userId: string; email: string; role: "provider" | "crew-member" },
  bookingId: string,
  phase: "before" | "after"
) {
  return platform.addBookingEvidence(actor, {
    bookingId,
    phase,
    imageDataUrl: `data:image/jpeg;base64,${phase}-photo`
  });
}

test("instant quotes normalize addresses and explain confidence sources", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const quote = await platform.createInstantQuote({
    address: {
      line1: "  112   garden row ",
      city: " austin ",
      state: " tx ",
      postalCode: "787041234 ",
      country: " us ",
      point: {
        latitude: 30.2435,
        longitude: -97.7638
      }
    },
    category: "lawn-mowing",
    followUpAnswers: [
      { questionId: "turf_sq_ft", value: 3500 },
      { questionId: "shrub_sq_ft", value: 300 }
    ]
  });

  assert.equal(quote.address.line1, "112 Garden Row");
  assert.equal(quote.address.city, "Austin");
  assert.equal(quote.address.state, "TX");
  assert.equal(quote.address.postalCode, "78704-1234");
  assert.equal(quote.address.country, "US");
  assert.equal(quote.normalizedAddress.wasNormalized, true);
  assert.ok(quote.normalizedAddress.normalizedFields.includes("line1"));
  assert.ok(quote.normalizedAddress.normalizedFields.includes("postalCode"));
  assert.equal(quote.measurementSources.turfSqFt, "customer-follow-up");
  assert.equal(quote.measurementSources.shrubBedSqFt, "customer-follow-up");
  assert.ok(quote.confidenceReasons.some((reason) => reason.label === "Your answers sharpened the quote"));
  assert.ok(
    quote.confidenceReasons.some((reason) => /modeled from the address|fallback assumptions/i.test(reason.label))
  );
});

test("customer addresses are normalized before properties and booking snapshots are saved", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-normalized-address@example.com",
    password: "Password123!",
    phone: "555-0199",
    role: "customer",
    propertyLabel: "Primary home",
    address: {
      line1: "  112   garden row ",
      city: " austin ",
      state: " tx ",
      postalCode: "787041234 ",
      country: " us ",
      point: {
        latitude: 30.2435,
        longitude: -97.7638
      }
    }
  });
  assert.equal(customer.role, "customer");
  assert.equal(customer.address.line1, "112 Garden Row");
  assert.equal(customer.address.city, "Austin");
  assert.equal(customer.address.state, "TX");
  assert.equal(customer.address.postalCode, "78704-1234");

  const addedProperty = await platform.createCustomerProperty(customer.id, {
    label: "Rental house",
    address: {
      line1: "  45  maple avenue ",
      city: " nashville ",
      state: " tn ",
      postalCode: " 372035555 ",
      country: " us ",
      point: {
        latitude: 36.1627,
        longitude: -86.7816
      }
    },
    setAsDefault: false
  });
  assert.equal(addedProperty.address.line1, "45 Maple Avenue");
  assert.equal(addedProperty.address.city, "Nashville");
  assert.equal(addedProperty.address.postalCode, "37203-5555");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: {
      line1: "  77  elm street ",
      city: " austin ",
      state: " tx ",
      postalCode: "78704 ",
      country: " us ",
      point: {
        latitude: 30.2439,
        longitude: -97.7632
      }
    },
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Normalization snapshot test",
    totalCents: 6200
  });

  assert.equal(booking.serviceAddress.line1, "77 Elm Street");
  assert.equal(booking.serviceAddress.city, "Austin");
  assert.equal(booking.serviceAddress.state, "TX");
  assert.equal(booking.serviceAddress.country, "US");
});

test("provider search returns ranked results with score reasons and reliability-aware ordering", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const [nearProvider, farProvider] = (await repository.listProviders()).slice(0, 2);
  assert.ok(nearProvider);
  assert.ok(farProvider);

  await repository.updateProvider(nearProvider.id, {
    companyName: "Near Reliable Lawn",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    serviceRadiusMiles: 20,
    sponsoredListingEnabled: false,
    categories: ["lawn-mowing"],
    rating: 4.9,
    timelinessRating: 4.9,
    attentionToDetailRating: 4.9,
    reviewCount: 220,
    yearsExperience: 12,
    verificationStatus: "verified"
  });

  await repository.updateProvider(farProvider.id, {
    companyName: "Sponsored Route Co.",
    address: createAddress("2200 Outer Loop", 30.305, -97.82),
    serviceRadiusMiles: 50,
    sponsoredListingEnabled: true,
    categories: ["lawn-mowing"],
    rating: 4.1,
    timelinessRating: 3.8,
    attentionToDetailRating: 4,
    reviewCount: 12,
    yearsExperience: 4,
    verificationStatus: "verified"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ranking@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const problemBooking = await platform.createBooking(customer.id, {
    providerId: farProvider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ranking penalty coverage",
    totalCents: 6200
  });

  await repository.updateBooking(problemBooking.id, {
    status: "disputed",
    disputedAt: new Date().toISOString(),
    disputeReason: "Customer reported a missed service window."
  });

  const results = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60
  });

  assert.ok(results.rankedProviders.length >= 2);
  assert.equal(results.providers[0]?.id, nearProvider.id);
  assert.equal(results.rankedProviders[0]?.provider.id, nearProvider.id);
  assert.ok(results.rankedProviders[0]!.score > results.rankedProviders[1]!.score);
  assert.ok(results.rankedProviders[0]!.reasons.length > 0);
  assert.ok(results.rankedProviders[0]!.reasons.includes("Close to the property"));

  const sponsoredResult = results.rankedProviders.find((result) => result.provider.id === farProvider.id);
  assert.ok(sponsoredResult);
  assert.ok((sponsoredResult?.factors.sponsorship ?? 0) > 0);
  assert.ok((sponsoredResult?.factors.issuePenalty ?? 0) > 0);
});

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

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

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

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

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

test("customer reschedules must still respect provider booking conflicts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-reschedule-conflict@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];

  const blockedStart = futureIso(96);
  const blockedEnd = futureIso(99);
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: blockedStart,
    scheduledEndIso: blockedEnd,
    notes: "Existing provider job",
    totalCents: 6200
  });

  const bookingToReschedule = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("117 Garden Row", 30.2437, -97.7634),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(120),
    scheduledEndIso: futureIso(123),
    notes: "Try to move into a conflict",
    totalCents: 8200
  });

  await assert.rejects(
    platform.rescheduleBooking(customer.id, {
      bookingId: bookingToReschedule.id,
      scheduledStartIso: blockedStart,
      scheduledEndIso: blockedEnd
    }),
    /overlaps another YardMatch job/
  );
});

test("customers can start recurring service plans and future visits are generated after completion", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-recurring@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("145 Prospect Ave", 40.6681, -73.9836)
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const slot = (await repository.listSlotsByProvider(provider.id))[1];
  assert.ok(slot);

  const recurring = await platform.createRecurringServicePlan(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: slot.startIso,
    scheduledEndIso: slot.endIso,
    notes: "Recurring weekly mow",
    totalCents: 6200,
    frequency: "weekly"
  });

  assert.equal(recurring.plan.plan.frequency, "weekly");
  assert.equal(recurring.initialBooking.recurringPlanId, recurring.plan.plan.id);
  assert.equal(recurring.initialBooking.recurringOccurrenceIndex, 1);

  const beforePlans = await platform.listRecurringServicePlansForCustomer(customer.id);
  assert.equal(beforePlans.plans.length, 1);
  assert.equal(beforePlans.plans[0]?.upcomingBooking?.id, recurring.initialBooking.id);

  await platform.confirmBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    recurring.initialBooking.id,
    "after"
  );

  await platform.completeBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  const recurringBookings = (await repository.listBookings()).filter(
    (booking) => booking.recurringPlanId === recurring.plan.plan.id
  );
  assert.equal(recurringBookings.length, 2);

  const nextBooking = recurringBookings.find((booking) => booking.id !== recurring.initialBooking.id);
  assert.ok(nextBooking);
  assert.equal(nextBooking?.status, "requested");
  assert.equal(nextBooking?.recurringOccurrenceIndex, 2);
  assert.equal(nextBooking?.scheduledStartIso, new Date(new Date(slot.startIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());

  const cancelledPlan = await platform.cancelRecurringServicePlan(customer.id, {
    planId: recurring.plan.plan.id,
    reason: "Customer paused recurring mowing for the season."
  });

  assert.equal(cancelledPlan.plan.status, "cancelled");
  const cancelledNextBooking = await repository.findBookingById(nextBooking!.id);
  assert.equal(cancelledNextBooking?.status, "cancelled");
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

test("provider payout ledger shows completed jobs waiting on customer payment", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-pending@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Pending payout state test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  const ledger = await platform.getProviderPayoutLedger(provider.id);
  const entry = ledger.entries.find((candidate) => candidate.bookingId === booking.id);

  assert.ok(entry);
  assert.equal(entry?.status, "awaiting-customer-payment");
  assert.equal(entry?.grossAmountCents, 7200);
  assert.equal(ledger.pendingCustomerPaymentCents, 7200);
});

test("refund review requests hold payouts until ops approves the refund", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0300",
    role: "provider",
    companyName: "Ledger Lawn Co.",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const crewMember = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Ready payout state test",
    totalCents: 9600
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const acceptedMatch = staffing.jobs
    .find((job) => job.bookingId === booking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(acceptedMatch);
  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: acceptedMatch?.id ?? "",
    action: "accept"
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  const providerEntry = providerLedger.entries.find((candidate) => candidate.bookingId === booking.id);
  assert.ok(providerEntry);
  assert.equal(providerEntry?.status, "scheduled");
  assert.ok((providerEntry?.crewShareCents ?? 0) > 0);
  assert.ok((providerEntry?.providerNetAmountCents ?? 0) >= 0);
  assert.ok(providerLedger.totalNetScheduledCents >= (providerEntry?.providerNetAmountCents ?? 0));

  const crewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  const crewEntry = crewLedger.entries.find((candidate) => candidate.bookingId === booking.id);
  assert.ok(crewEntry);
  assert.equal(crewEntry?.status, "scheduled");
  assert.ok((crewEntry?.amountCents ?? 0) > 0);

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Customer requested a refund review."
    }
  );

  const heldProviderLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    heldProviderLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "on-hold"
  );

  const heldCrewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(
    heldCrewLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "on-hold"
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);

  await platform.updateSupportTicketForOps({
    ticketId: refundTicket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "approve-refund",
    resolutionNotes: "Support approved the refund review after checking the booking."
  });

  const reversedProviderLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    reversedProviderLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "reversed"
  );

  const reversedCrewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(
    reversedCrewLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "reversed"
  );
});

test("ops can deny a refund review and return payouts to the normal schedule", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-denied@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Refund denial test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Please review this payment."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);

  await platform.updateSupportTicketForOps({
    ticketId: refundTicket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "deny-refund",
    resolutionNotes: "Support verified the work and kept the payment captured."
  });

  const updatedPayment = await repository.findPaymentById(payment?.id ?? "");
  assert.equal(updatedPayment?.status, "captured");
  assert.equal(updatedPayment?.refundReviewStatus, "denied");
  assert.equal(updatedPayment?.refundable, true);

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    providerLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "scheduled"
  );
});

test("provider payout ledger exposes weekly and instant payout schedule details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-schedule@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: provider.routeLeaderMode,
    weeklyPayoutDay: "Tue",
    instantPayoutsEnabled: true,
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Provider payout schedule test",
    totalCents: 12800
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, { checkoutSessionId: "cs_test_123" });
  await repository.updateBooking(booking.id, {
    completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  });

  const ledger = await platform.getProviderPayoutLedger(provider.id);
  const entry = ledger.entries.find((candidate) => candidate.bookingId === booking.id);

  assert.ok(entry);
  assert.equal(entry?.status, "ready");
  assert.equal(ledger.payoutSchedule.weeklyPayoutDay, "Tue");
  assert.equal(ledger.payoutSchedule.instantPayoutsEnabled, true);
  assert.equal(ledger.payoutSchedule.instantPayoutMinimumCents, 10000);
  assert.equal(ledger.payoutSchedule.instantPayoutEligibleCents, entry?.providerNetAmountCents ?? 0);
  assert.equal(ledger.payoutSchedule.holdPeriodHours, 48);
});

test("ops payout preview groups ready balances into upcoming payout runs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-payout-preview@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  assert.ok(providers.length >= 2);

  await platform.updateProviderSettings(providers[0]!.id, {
    serviceRadiusMiles: providers[0]!.serviceRadiusMiles,
    staffingMode: providers[0]!.staffingMode,
    crewReviewLeadHours: providers[0]!.crewReviewLeadHours,
    departureReminderLeadMinutes: providers[0]!.departureReminderLeadMinutes,
    routeLeaderMode: providers[0]!.routeLeaderMode,
    weeklyPayoutDay: "Tue",
    instantPayoutsEnabled: true,
    sponsoredListingEnabled: providers[0]!.sponsoredListingEnabled
  });
  await platform.updateProviderSettings(providers[1]!.id, {
    serviceRadiusMiles: providers[1]!.serviceRadiusMiles,
    staffingMode: providers[1]!.staffingMode,
    crewReviewLeadHours: providers[1]!.crewReviewLeadHours,
    departureReminderLeadMinutes: providers[1]!.departureReminderLeadMinutes,
    routeLeaderMode: providers[1]!.routeLeaderMode,
    weeklyPayoutDay: "Fri",
    instantPayoutsEnabled: false,
    sponsoredListingEnabled: providers[1]!.sponsoredListingEnabled
  });

  const firstBooking = await platform.createBooking(customer.id, {
    providerId: providers[0]!.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops payout preview first provider",
    totalCents: 14200
  });
  const secondBooking = await platform.createBooking(customer.id, {
    providerId: providers[1]!.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "hedge-trimming",
    scheduledStartIso: futureIso(80),
    scheduledEndIso: futureIso(81),
    notes: "Ops payout preview second provider",
    totalCents: 8600
  });

  for (const current of [
    { booking: firstBooking, provider: providers[0]! },
    { booking: secondBooking, provider: providers[1]! }
  ]) {
    await platform.confirmBooking(current.provider.id, { bookingId: current.booking.id });
    await attachEvidence(
      platform,
      { userId: current.provider.id, email: current.provider.email, role: "provider" },
      current.booking.id,
      "after"
    );
    await platform.completeBooking(current.provider.id, { bookingId: current.booking.id });
    const checkout = await platform.createCheckoutSession(customer.id, { bookingId: current.booking.id });
    await repository.updatePayment(checkout.payment.id, {
      status: "captured",
      paymentIntentId: checkout.payment.paymentIntentId ?? "pi_test_123",
      updatedAt: new Date().toISOString()
    });
    await repository.updateBooking(current.booking.id, {
      completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    });
  }

  const preview = await platform.getOpsPayoutPreview();

  assert.equal(preview.providerRuns.length, 2);
  assert.equal(preview.providerInstantEligibleCount, 1);
  assert.ok(preview.totalProviderReadyCents >= 22800);
  assert.ok(preview.providerRuns.some((run) => run.providerCount === 1 && run.providerNetCents >= 14200));
});

test("customer service can open a refund review override from a billing ticket", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-override@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops refund override coverage",
    totalCents: 7100
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  const ticket = await repository.createSupportTicket({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    requesterId: customer.id,
    subject: "Billing question",
    description: "Customer called support about this charge.",
    issueType: "billing",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const overriddenPayment = await platform.createOpsRefundOverride({
    ticketId: ticket.id,
    paymentId: payment.id,
    reason: "Customer service opened a refund review after validating the billing complaint."
  });

  assert.equal(overriddenPayment.refundReviewStatus, "requested");
  assert.equal(overriddenPayment.refundRequestedByRole, "ops");

  const updatedTicket = (await repository.listSupportTickets()).find((item) => item.id === ticket.id);
  assert.ok(updatedTicket?.description.includes("Customer service opened a refund review override."));

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    providerLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "on-hold"
  );
});

test("ops can reschedule a booking, append an intervention audit trail, and touch the linked support ticket", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-intervention@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops intervention coverage",
    totalCents: 6900
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Storm reschedule",
      description: "Customer called support to move the job after a storm.",
      issueType: "general"
    }
  );

  const nextStartIso = futureIso(96);
  const nextEndIso = futureIso(97);
  const updatedBooking = await platform.createOpsBookingIntervention({
    bookingId: booking.id,
    ticketId: ticket.id,
    action: "reschedule-booking",
    note: "Customer approved moving the job to tomorrow afternoon after weather delays.",
    scheduledStartIso: nextStartIso,
    scheduledEndIso: nextEndIso
  });

  assert.equal(updatedBooking.scheduledStartIso, nextStartIso);
  assert.equal(updatedBooking.scheduledEndIso, nextEndIso);
  assert.equal(updatedBooking.status, "confirmed");
  assert.equal(updatedBooking.interventions.length, 1);
  assert.equal(updatedBooking.interventions[0]?.action, "reschedule-booking");
  assert.equal(updatedBooking.interventions[0]?.ticketId, ticket.id);

  const updatedTicket = (await repository.listSupportTickets()).find((candidate) => candidate.id === ticket.id);
  assert.ok(updatedTicket);
  assert.equal(updatedTicket?.status, "triaged");
  assert.match(updatedTicket?.description ?? "", /Ops intervention: reschedule-booking/);
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

test("crew members can cancel accepted assignments and future staffing penalizes repeat call-offs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5300",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5310",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const targetDayStartIso = futureIso(72);
  const targetDay = availabilityDayForIso(targetDayStartIso);

  const cancellingCrew = await platform.registerUser({
    fullName: "Taylor Cancel",
    email: "crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5320",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const steadyCrew = await platform.registerUser({
    fullName: "Casey Steady",
    email: "crew-steady@example.com",
    password: "Password123!",
    phone: "555-5330",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  await repository.updateCrewMember(cancellingCrew.id, {
    rating: 4.9,
    completedJobs: 26
  });
  await repository.updateCrewMember(steadyCrew.id, {
    rating: 4.8,
    completedJobs: 24
  });

  const firstBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: targetDayStartIso,
    scheduledEndIso: futureIso(73),
    notes: "First staffing target",
    totalCents: 6200
  });

  const firstOverview = await platform.getProviderStaffingOverview(provider.id);
  const firstJob = firstOverview.jobs.find((job) => job.bookingId === firstBooking.id);
  assert.ok(firstJob);
  const firstMatch = firstJob?.matches.find((match) => match.crewMemberId === cancellingCrew.id);
  assert.ok(firstMatch);

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: firstMatch!.id,
    action: "accept"
  });

  const cancelledSummary = await platform.cancelCrewMatch(cancellingCrew.id, {
    crewMatchId: firstMatch!.id,
    reason: "Had to back out this time."
  });
  assert.equal(cancelledSummary.status, "cancelled-by-crew");
  assert.equal(cancelledSummary.cancellationReason, "Had to back out this time.");

  const updatedCrew = await repository.findCrewMemberById(cancellingCrew.id);
  assert.equal(updatedCrew?.cancellationCount, 1);

  const providerNotifications = await repository.listNotificationsByRecipient(provider.id);
  assert.ok(providerNotifications.some((notification) => notification.title === "Crew member cancelled"));

  const secondBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(240),
    scheduledEndIso: futureIso(241),
    notes: "Second staffing target",
    totalCents: 6200
  });

  const secondOverview = await platform.getProviderStaffingOverview(provider.id);
  const secondJob = secondOverview.jobs.find((job) => job.bookingId === secondBooking.id);
  assert.ok(secondJob);
  assert.ok(secondJob!.matches.length >= 2);
  assert.equal(secondJob!.matches[0]?.crewMemberId, steadyCrew.id);
  const cancellingCrewMatch = secondJob!.matches.find((match) => match.crewMemberId === cancellingCrew.id);
  assert.ok(cancellingCrewMatch);
  assert.ok(
    cancellingCrewMatch!.recommendationReasons?.some((reason) => /call-offs lower future match priority/i.test(reason))
  );
});

test("staffing recommendations rank the best-fit crew first and exclude overlapping accepted jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const primaryProvider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-staffing-rank@example.com",
    password: "Password123!",
    phone: "555-4500",
    role: "provider",
    companyName: "Ranking Lawn Co.",
    categories: ["lawn-mowing", "leaf-blowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const otherProvider = await platform.registerUser({
    fullName: "Marcus Hale",
    email: "provider-staffing-other@example.com",
    password: "Password123!",
    phone: "555-4510",
    role: "provider",
    companyName: "Conflict Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1900 Outer Route", 30.275, -97.79)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-staffing-rank@example.com",
    password: "Password123!",
    phone: "555-4520",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const targetStartIso = futureIso(72);
  const targetEndIso = futureIso(73);
  const targetDay = availabilityDayForIso(targetStartIso);

  const bestCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-best-fit@example.com",
    password: "Password123!",
    phone: "555-4530",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const conflictCrew = await platform.registerUser({
    fullName: "Jordan Conflict",
    email: "crew-conflict@example.com",
    password: "Password123!",
    phone: "555-4540",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const backupCrew = await platform.registerUser({
    fullName: "Casey Backup",
    email: "crew-backup@example.com",
    password: "Password123!",
    phone: "555-4550",
    role: "crew-member",
    address: createAddress("500 Far Route", 30.31, -97.84),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 50,
    preferredSchedule: "part-time",
    hasOwnEquipment: false
  });

  await repository.updateCrewMember(bestCrew.id, {
    assignedProviderId: primaryProvider.id,
    rating: 4.9,
    completedJobs: 48
  });
  await repository.updateCrewMember(conflictCrew.id, {
    rating: 4.8,
    completedJobs: 30
  });
  await repository.updateCrewMember(backupCrew.id, {
    rating: 4.4,
    completedJobs: 8
  });

  const overlappingBooking = await platform.createBooking(customer.id, {
    providerId: otherProvider.id,
    serviceAddress: createAddress("220 Conflict Ave", 30.265, -97.782),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: targetStartIso,
    scheduledEndIso: targetEndIso,
    notes: "Conflict booking",
    totalCents: 6200
  });

  await repository.createCrewMatch({
    id: "accepted-conflict-match",
    bookingId: overlappingBooking.id,
    providerId: otherProvider.id,
    crewMemberId: conflictCrew.id,
    crewMemberName: conflictCrew.fullName,
    crewMemberPhone: conflictCrew.phone,
    categories: conflictCrew.categories,
    availableWeekdays: conflictCrew.availableWeekdays ?? [targetDay],
    preferredSchedule: conflictCrew.preferredSchedule,
    willingToTravelMiles: conflictCrew.willingToTravelMiles,
    hasOwnEquipment: conflictCrew.hasOwnEquipment,
    winterWorkEnabled: conflictCrew.winterWorkEnabled ?? true,
    status: "accepted",
    autoAccepted: true,
    distanceMiles: 1.5,
    hourlyRateCents: 3200,
    createdAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString()
  });

  const targetBooking = await platform.createBooking(customer.id, {
    providerId: primaryProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: targetStartIso,
    scheduledEndIso: targetEndIso,
    notes: "Target booking",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(primaryProvider.id);
  const targetJob = overview.jobs.find((job) => job.bookingId === targetBooking.id);
  assert.ok(targetJob);
  assert.ok(targetJob!.matches.length >= 2);
  assert.ok(!targetJob!.matches.some((match) => match.crewMemberId === conflictCrew.id));
  assert.equal(targetJob!.matches[0]?.crewMemberId, bestCrew.id);
  assert.equal(targetJob!.matches[0]?.recommendationLabel, "best-fit");
  assert.ok((targetJob!.matches[0]?.recommendationScore ?? 0) > (targetJob!.matches[1]?.recommendationScore ?? 0));
  assert.ok(
    targetJob!.matches[0]?.recommendationReasons?.some(
      (reason) => /window|business|reliability|capacity/i.test(reason)
    )
  );
});

test("automated day-load balancing rotates crew recommendations across same-day jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-load-balance@example.com",
    password: "Password123!",
    phone: "555-4600",
    role: "provider",
    companyName: "Balanced Route Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-load-balance@example.com",
    password: "Password123!",
    phone: "555-4610",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  const jobStarts = [8, 10, 12, 14].map((hour) => {
    const start = new Date(serviceDay);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  });
  const availableDay = availabilityDayForIso(jobStarts[0].startIso);

  const crewConfigs = [
    ["crew-load-a@example.com", "Taylor A", "111 Garden Row", 30.24355, -97.76385],
    ["crew-load-b@example.com", "Taylor B", "112 Garden Row", 30.2436, -97.7639],
    ["crew-load-c@example.com", "Taylor C", "113 Garden Row", 30.24365, -97.76395],
    ["crew-load-d@example.com", "Taylor D", "114 Garden Row", 30.2437, -97.764]
  ] as const;

  const crewMembers = [];
  for (const [email, fullName, line1, latitude, longitude] of crewConfigs) {
    const crew = await platform.registerUser({
      fullName,
      email,
      password: "Password123!",
      phone: "555-4620",
      role: "crew-member",
      address: createAddress(line1, latitude, longitude),
      categories: ["lawn-mowing"],
      availableWeekdays: [availableDay],
      willingToTravelMiles: 25,
      preferredSchedule: "full-time",
      hasOwnEquipment: true
    });

    await repository.updateCrewMember(crew.id, {
      rating: 4.8,
      completedJobs: 20
    });
    crewMembers.push(crew);
  }

  const createdBookings = [];
  for (const [index, slot] of jobStarts.entries()) {
    const booking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(`20${index} Garden Row`, 30.2435 + index * 0.001, -97.7638 - index * 0.001),
      servicePropertyId: undefined,
      category: "lawn-mowing",
      scheduledStartIso: slot.startIso,
      scheduledEndIso: slot.endIso,
      notes: `Job ${index + 1}`,
      totalCents: 6200
    });
    createdBookings.push(booking);
  }

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const fourthJob = overview.jobs.find((job) => job.bookingId === createdBookings[3]?.id);
  assert.ok(fourthJob);
  assert.ok(fourthJob!.matches.length > 0);

  const firstThreeCrewIds = new Set(
    overview.jobs
      .filter((job) => createdBookings.slice(0, 3).some((booking) => booking.id === job.bookingId))
      .flatMap((job) => job.matches.slice(0, 1).map((match) => match.crewMemberId))
  );

  assert.ok(firstThreeCrewIds.size <= 3);
  assert.ok(
    fourthJob!.matches.some((match) => !firstThreeCrewIds.has(match.crewMemberId)),
    "expected the fourth job to include a fresher crew option after earlier same-day load stacked up"
  );
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
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
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

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
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

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
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

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

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

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "before"
  );

  const inProgressBooking = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.equal(inProgressBooking.status, "in-progress");
});

test("before and after photos gate booking start and completion, and accepted crew can add them", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-evidence@example.com",
    password: "Password123!",
    phone: "555-1500",
    role: "provider",
    companyName: "Proof Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-evidence@example.com",
    password: "Password123!",
    phone: "555-1600",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const crewMember = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-evidence@example.com",
    password: "Password123!",
    phone: "555-1700",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  const unrelatedCrew = await platform.registerUser({
    fullName: "Other Crew",
    email: "other-crew-evidence@example.com",
    password: "Password123!",
    phone: "555-1710",
    role: "crew-member",
    address: createAddress("119 Garden Row", 30.2438, -97.7633),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Evidence workflow coverage",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = overview.jobs[0]?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(pendingMatch);
  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );

  await assert.rejects(
    platform.startBooking(
      { userId: provider.id, email: provider.email, role: "provider" },
      { bookingId: booking.id }
    ),
    /before photo/
  );

  await assert.rejects(
    attachEvidence(
      platform,
      { userId: unrelatedCrew.id, email: unrelatedCrew.email, role: "crew-member" },
      booking.id,
      "before"
    ),
    /accepted crew members/
  );

  const bookingWithBeforeEvidence = await attachEvidence(
    platform,
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    booking.id,
    "before"
  );
  assert.equal(bookingWithBeforeEvidence.serviceEvidence.filter((photo) => photo.phase === "before").length, 1);

  const startedBooking = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  assert.equal(startedBooking.status, "in-progress");

  await assert.rejects(
    platform.completeBooking(provider.id, { bookingId: booking.id }),
    /after photo/
  );

  const bookingWithAfterEvidence = await attachEvidence(
    platform,
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    booking.id,
    "after"
  );
  assert.equal(bookingWithAfterEvidence.serviceEvidence.filter((photo) => photo.phase === "after").length, 1);

  const completedBooking = await platform.completeBooking(provider.id, { bookingId: booking.id });
  assert.equal(completedBooking.status, "completed");
});

test("ops can annotate booking evidence for disputes and refund reviews", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-evidence-review@example.com",
    password: "Password123!",
    phone: "555-1750",
    role: "provider",
    companyName: "Proof Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-evidence-review@example.com",
    password: "Password123!",
    phone: "555-1760",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Evidence review workflow coverage",
    totalCents: 6200
  });

  const bookingWithEvidence = await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "before"
  );
  const evidenceId = bookingWithEvidence.serviceEvidence[0]?.id;
  assert.ok(evidenceId);

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      issueType: "service-quality",
      subject: "Need evidence review",
      description: "Please review the before-work photo."
    }
  );

  const updatedBooking = await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: ticket.id,
    evidenceId: evidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "Before-work photo clearly shows the uncut lawn."
  });

  assert.equal(updatedBooking.serviceEvidence[0]?.reviewStatus, "supports-provider");
  assert.equal(updatedBooking.serviceEvidence[0]?.reviewedByRole, "ops");
  assert.match(updatedBooking.serviceEvidence[0]?.reviewNotes ?? "", /uncut lawn/i);

  const updatedTicket = (await repository.listSupportTickets()).find((candidate) => candidate.id === ticket.id);
  assert.ok(updatedTicket);
  assert.equal(updatedTicket?.status, "triaged");
  assert.match(updatedTicket?.description ?? "", /Ops evidence review: before supports-provider/i);
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
    servicePropertyId: undefined,
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
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
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

test("configured Resend email delivery uses the real email provider path", async () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalFetch = globalThis.fetch;

  process.env.RESEND_API_KEY = "re_test_123";
  process.env.NOTIFICATION_EMAIL_FROM = "YardMatch <alerts@yardmatch.example>";

  let recordedAuthorization = "";
  let recordedBody = "";

  globalThis.fetch = (async (_input, init) => {
    recordedAuthorization = String(init?.headers && "Authorization" in init.headers ? init.headers.Authorization : "");
    recordedBody = String(init?.body ?? "");
    return {
      ok: true,
      json: async () => ({
        id: "email_123"
      })
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const provider = await platform.registerUser({
      fullName: "Ariana Flores",
      email: "provider-email@example.com",
      password: "Password123!",
      phone: "555-3830",
      role: "provider",
      companyName: "Inbox Lawn Co.",
      categories: ["lawn-mowing"],
      serviceRadiusMiles: 25,
      address: createAddress("1400 Provider Way", 30.244, -97.764)
    });

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-email@example.com",
      password: "Password123!",
      phone: "555-3840",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress("112 Garden Row", 30.2435, -97.7638)
    });

    await platform.updateNotificationPreferences(
      {
        userId: provider.id,
        email: provider.email,
        role: "provider"
      },
      {
        pushEnabled: false,
        smsEnabled: false,
        emailEnabled: true
      }
    );

    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Resend delivery test",
      totalCents: 6200
    });

    const deliveries = await platform.listNotificationDeliveries({
      userId: provider.id,
      email: provider.email,
      role: "provider"
    });
    const emailDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "email");

    assert.ok(emailDelivery);
    assert.equal(emailDelivery?.provider, "resend");
    assert.equal(emailDelivery?.status, "sent");
    assert.equal(emailDelivery?.attemptCount, 1);
    assert.equal(emailDelivery?.sentAt ? typeof emailDelivery.sentAt : "undefined", "string");
    assert.match(recordedAuthorization, /^Bearer re_test_123$/);
    assert.match(recordedBody, /alerts@yardmatch\.example/);
    assert.match(recordedBody, /New booking request/);
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.NOTIFICATION_EMAIL_FROM = originalNotificationEmailFrom;
    globalThis.fetch = originalFetch;
  }
});

test("configured Twilio SMS delivery failures create retryable records", async () => {
  const originalTwilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const originalTwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const originalTwilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  const originalFetch = globalThis.fetch;

  process.env.TWILIO_ACCOUNT_SID = "AC123456789";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret";
  process.env.TWILIO_FROM_NUMBER = "+15555550100";

  globalThis.fetch = (async () => {
    throw new Error("twilio unavailable");
  }) as typeof globalThis.fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const provider = await platform.registerUser({
      fullName: "Ariana Flores",
      email: "provider-sms@example.com",
      password: "Password123!",
      phone: "+15555550330",
      role: "provider",
      companyName: "Text Lawn Co.",
      categories: ["lawn-mowing"],
      serviceRadiusMiles: 25,
      address: createAddress("1400 Provider Way", 30.244, -97.764)
    });

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-sms@example.com",
      password: "Password123!",
      phone: "+15555550340",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress("112 Garden Row", 30.2435, -97.7638)
    });

    await platform.updateNotificationPreferences(
      {
        userId: provider.id,
        email: provider.email,
        role: "provider"
      },
      {
        pushEnabled: false,
        emailEnabled: false,
        smsEnabled: true
      }
    );

    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Twilio delivery retry test",
      totalCents: 6200
    });

    const deliveries = await platform.listNotificationDeliveries({
      userId: provider.id,
      email: provider.email,
      role: "provider"
    });
    const smsDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "sms");

    assert.ok(smsDelivery);
    assert.equal(smsDelivery?.provider, "twilio");
    assert.equal(smsDelivery?.status, "failed");
    assert.equal(smsDelivery?.attemptCount, 1);
    assert.ok(smsDelivery?.nextRetryAt);
    assert.match(smsDelivery?.errorMessage ?? "", /twilio unavailable/i);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = originalTwilioAccountSid;
    process.env.TWILIO_AUTH_TOKEN = originalTwilioAuthToken;
    process.env.TWILIO_FROM_NUMBER = originalTwilioFromNumber;
    globalThis.fetch = originalFetch;
  }
});

test("ops notification health surfaces overdue retries and can run a retry sweep", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const now = Date.now();

  await repository.createNotificationDelivery({
    id: "delivery_sent_1",
    notificationId: "notification_sent_1",
    recipientId: "customer-1",
    recipientRole: "customer",
    category: "booking",
    channel: "email",
    destination: "customer@example.com",
    provider: "mock-email",
    status: "sent",
    title: "Your booking is confirmed",
    bodyPreview: "Your booking is confirmed.",
    errorMessage: undefined,
    attemptCount: 1,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    nextRetryAt: undefined,
    sentAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
  });

  await repository.createNotificationDelivery({
    id: "delivery_failed_retry",
    notificationId: "notification_failed_retry",
    recipientId: "provider-1",
    recipientRole: "provider",
    category: "booking",
    channel: "sms",
    destination: "+15555550123",
    provider: "twilio",
    status: "failed",
    title: "Route should start soon",
    bodyPreview: "Time to head out soon.",
    errorMessage: "twilio unavailable",
    attemptCount: 1,
    createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 30 * 60 * 1000).toISOString(),
    nextRetryAt: new Date(now - 5 * 60 * 1000).toISOString(),
    sentAt: undefined
  });

  await repository.createNotificationDelivery({
    id: "delivery_failed_exhausted",
    notificationId: "notification_failed_exhausted",
    recipientId: "crew-1",
    recipientRole: "crew-member",
    category: "staffing",
    channel: "push",
    destination: "local-device",
    provider: "mock-push",
    status: "failed",
    title: "You have a new crew match",
    bodyPreview: "Open the app to review it.",
    errorMessage: "device offline",
    attemptCount: 3,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 70 * 60 * 1000).toISOString(),
    nextRetryAt: undefined,
    sentAt: undefined
  });

  const health = await platform.getNotificationOpsHealth();
  assert.equal(health.totalDeliveries, 3);
  assert.equal(health.deliveriesLast24Hours, 3);
  assert.equal(health.overdueRetryCount, 1);
  assert.equal(health.exhaustedFailureCount, 1);
  assert.ok(health.channels.some((channel) => channel.channel === "sms" && channel.overdueRetryCount === 1));
  assert.ok(
    health.alerts.some(
      (alert) => alert.severity === "critical" && /overdue notification retries/i.test(alert.title)
    )
  );

  const retrySweep = await platform.retryDueNotificationDeliveriesForOps();
  assert.equal(retrySweep.retriedCount, 1);
  assert.equal(retrySweep.sentCount + retrySweep.failedCount, 1);
  assert.equal(retrySweep.remainingOverdueCount, 0);

  const refreshedHealth = await platform.getNotificationOpsHealth();
  assert.equal(refreshedHealth.overdueRetryCount, 0);
  const retriedSmsDelivery = (await repository.listAllNotificationDeliveries()).find(
    (delivery) => delivery.id === "delivery_failed_retry"
  );
  assert.equal(retriedSmsDelivery?.attemptCount, 2);
  assert.ok(
    !retriedSmsDelivery?.nextRetryAt || Date.parse(retriedSmsDelivery.nextRetryAt) > Date.now()
  );
});

test("ops notification health can escalate external alerts to configured contacts", async () => {
  const originalFetch = globalThis.fetch;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalNotificationAlertEmails = process.env.NOTIFICATION_ALERT_EMAILS;

  process.env.RESEND_API_KEY = "resend_test_key";
  process.env.NOTIFICATION_EMAIL_FROM = "ops@yardmatch.test";
  process.env.NOTIFICATION_ALERT_EMAILS = "alerts@yardmatch.test";

  try {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({ id: "email_alert_123" })
      }) as Response) as typeof fetch;

    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const now = Date.now();

    await repository.createNotificationDelivery({
      id: "delivery_failed_retry_ops",
      notificationId: "notification_failed_retry_ops",
      recipientId: "provider-1",
      recipientRole: "provider",
      category: "booking",
      channel: "sms",
      destination: "+15555550123",
      provider: "twilio",
      status: "failed",
      title: "Route should start soon",
      bodyPreview: "Time to head out soon.",
      errorMessage: "twilio unavailable",
      attemptCount: 1,
      createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
      lastAttemptAt: new Date(now - 30 * 60 * 1000).toISOString(),
      nextRetryAt: new Date(now - 5 * 60 * 1000).toISOString(),
      sentAt: undefined
    });

    const escalation = await platform.escalateNotificationOpsAlerts();
    assert.equal(escalation.escalated, true);
    assert.equal(escalation.targetCount, 1);
    assert.equal(escalation.sentCount, 1);
    assert.equal(escalation.failedCount, 0);

    const deliveries = await repository.listAllNotificationDeliveries();
    assert.ok(
      deliveries.some(
        (delivery) =>
          delivery.destination === "alerts@yardmatch.test" &&
          delivery.provider === "resend" &&
          delivery.status === "sent"
      )
    );
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.NOTIFICATION_EMAIL_FROM = originalNotificationEmailFrom;
    process.env.NOTIFICATION_ALERT_EMAILS = originalNotificationAlertEmails;
    globalThis.fetch = originalFetch;
  }
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
  assert.equal(subscription.actions.length, 3);
  assert.equal(subscription.actions[0]?.platform, "apple-calendar");
  assert.equal(subscription.actions[0]?.href, subscription.webcalUrl);
  assert.equal(subscription.actions[1]?.platform, "google-calendar");
  assert.ok(subscription.actions[1]?.href.includes(encodeURIComponent(subscription.feedUrl)));
  assert.equal(subscription.actions[2]?.platform, "ical");
  assert.equal(subscription.actions[2]?.href, subscription.feedUrl);

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.yardmatchJobCount, 1);
  assert.equal(overview.externalBlockCount, 1);
  assert.equal(overview.syncHealth.externalBlockingEnabled, true);
  assert.equal(overview.syncHealth.manualBlockCount, 1);
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
  assert.equal(imports.syncHealth.status, "healthy");
  assert.equal(imports.syncHealth.subscriptionCount, 1);
  assert.equal(imports.subscriptions[0]?.importedEventCount, 1);

  const providerAfterImport = await platform.getProviderProfile(provider.id);
  const importedBlock = providerAfterImport.calendarConnection.externalBlocks?.find(
    (block) => block.source === "calendar-import"
  );
  assert.ok(importedBlock);
  assert.equal(importedBlock?.title, "Outside cleanup route");

  await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes: "Calendar import test provider can be shown in search."
  });

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
  assert.equal(synced.syncHealth.status, "healthy");

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

test("calendar import sync failures persist provider-facing health state", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-import-error@example.com",
    password: "Password123!",
    phone: "555-3940",
    role: "provider",
    companyName: "Error Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("calendar unavailable", {
      status: 503
    })) as typeof fetch;

  try {
    const imports = await platform.createProviderCalendarImport(provider.id, {
      title: "Google Calendar - Broken feed",
      provider: "google",
      feedUrl: "https://calendar.example.com/broken.ics"
    });

    assert.equal(imports.subscriptions.length, 1);
    assert.equal(imports.subscriptions[0]?.syncStatus, "error");
    assert.match(imports.subscriptions[0]?.lastError ?? "", /503/);
    assert.equal(imports.syncHealth.status, "at-risk");
    assert.equal(imports.syncHealth.erroredSubscriptionCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("providers can bulk-refresh stale or errored calendar feeds", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-sync-stale@example.com",
    password: "Password123!",
    phone: "555-3945",
    role: "provider",
    companyName: "Recover Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const brokenFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("calendar unavailable", {
      status: 503
    })) as typeof fetch;

  let imports;
  try {
    imports = await platform.createProviderCalendarImport(provider.id, {
      title: "Google Calendar - Recoverable feed",
      provider: "google",
      feedUrl: "https://calendar.example.com/recoverable.ics"
    });
  } finally {
    globalThis.fetch = brokenFetch;
  }

  assert.equal(imports.subscriptions[0]?.syncStatus, "error");

  const importStart = futureIso(96);
  const importEnd = futureIso(97);
  const rawFeed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:outside-client-recovered@example.com",
    `DTSTART:${importStart.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    `DTEND:${importEnd.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    "SUMMARY:Recovered outside route",
    "DESCRIPTION:Recovered from stale feed sync",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");

  globalThis.fetch = (async () =>
    new Response(rawFeed, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar"
      }
    })) as typeof fetch;

  try {
    const refreshed = await platform.syncStaleProviderCalendarImports(provider.id);
    assert.equal(refreshed.attemptedSubscriptionCount, 1);
    assert.equal(refreshed.syncedSubscriptionCount, 1);
    assert.equal(refreshed.failedSubscriptionCount, 0);
    assert.equal(refreshed.subscriptions[0]?.syncStatus, "active");
    assert.equal(refreshed.syncHealth.status, "healthy");
    assert.ok(refreshed.subscriptions[0]?.lastSyncedAt);
  } finally {
    globalThis.fetch = brokenFetch;
  }
});

test("calendar health warns when outside blocks are saved but not reducing availability", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-risk@example.com",
    password: "Password123!",
    phone: "555-3950",
    role: "provider",
    companyName: "Risk Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: false,
    externalCalendarBlocks: [
      {
        title: "Direct client visit",
        blockType: "off-platform-client",
        startIso: futureIso(12),
        endIso: futureIso(13),
        source: "manual"
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.syncHealth.status, "at-risk");
  assert.equal(overview.syncHealth.externalBlockingEnabled, false);
  assert.equal(overview.syncHealth.upcomingExternalBlockCount, 1);
  assert.ok(overview.syncHealth.notes.some((note) => /not reducing YardMatch availability/i.test(note)));
});

test("calendar health flags outside blocks that overlap real YardMatch jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-conflict@example.com",
    password: "Password123!",
    phone: "555-3960",
    role: "provider",
    companyName: "Conflict Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-conflict@example.com",
    password: "Password123!",
    phone: "555-3961",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(18),
    scheduledEndIso: futureIso(19),
    notes: "Calendar conflict visibility test",
    totalCents: 6200
  });
  assert.ok(booking.id);

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: false,
    externalCalendarBlocks: [
      {
        title: "Direct client overlap",
        blockType: "off-platform-client",
        startIso: futureIso(18.25),
        endIso: futureIso(19.25),
        source: "manual"
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.syncHealth.status, "at-risk");
  assert.equal(overview.syncHealth.conflictingYardmatchJobCount, 1);
  assert.ok(overview.syncHealth.notes.some((note) => /overlaps an outside calendar block/i.test(note)));
});

test("provider calendar overview includes dispatch load summaries for route planning", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Casey Green",
    email: "provider-dispatch@example.com",
    password: "Password123!",
    phone: "555-4400",
    role: "provider",
    companyName: "Dispatch Lawn Co.",
    categories: ["lawn-mowing", "mulch-installation", "leaf-blowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispatch@example.com",
    password: "Password123!",
    phone: "555-4410",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);

  const atHour = (hour: number, durationHours: number) => {
    const start = new Date(serviceDay);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  };

  const morning = atHour(8, 1);
  const afternoon = atHour(13, 2);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: morning.startIso,
    scheduledEndIso: morning.endIso,
    notes: "Morning stop",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("210 Mulch Lane", 30.255, -97.78),
    servicePropertyId: undefined,
    category: "mulch-installation",
    scheduledStartIso: afternoon.startIso,
    scheduledEndIso: afternoon.endIso,
    notes: "Afternoon stop",
    totalCents: 9800
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Outside estimate visit",
        blockType: "off-platform-client",
        startIso: atHour(16, 2).startIso,
        endIso: atHour(16, 2).endIso
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id, {
    fromIso: atHour(6, 1).startIso,
    toIso: atHour(20, 1).startIso
  });

  assert.ok(overview.dispatchDays.length >= 1);
  const day = overview.dispatchDays[0];
  assert.ok(day);
  assert.equal(day.yardmatchJobCount, 2);
  assert.equal(day.externalBlockCount, 1);
  assert.equal(day.totalCrewRequired, 3);
  assert.equal(day.totalCrewAssigned, 0);
  assert.equal(day.crewGap, 3);
  assert.equal(day.routeStatus, "overloaded");
  assert.ok(day.estimatedDriveMiles > 0);
  assert.ok(day.recommendations.some((item) => /crew/i.test(item)));
  assert.equal(day.windowSummaries.find((window) => window.windowKey === "morning")?.yardmatchJobCount, 1);
  assert.equal(day.windowSummaries.find((window) => window.windowKey === "afternoon")?.yardmatchJobCount, 1);
  assert.ok(
    (day.windowSummaries.find((window) => window.windowKey === "late-afternoon-night")?.blockedMinutes ?? 0) > 0
  );
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

test("provider dispatch controls tune reminder timing and route-leader permissions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4350",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4360",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crewMember = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4370",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const updatedProvider = await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });
  assert.equal(updatedProvider.crewReviewLeadHours, 6);
  assert.equal(updatedProvider.departureReminderLeadMinutes, 30);
  assert.equal(updatedProvider.routeLeaderMode, "accepted-crew-fallback");

  const upcomingBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(0.4),
    scheduledEndIso: futureIso(1.4),
    notes: "Dispatch controls departure reminder",
    totalCents: 6400
  });

  const staffingOverview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = staffingOverview.jobs
    .find((job) => job.bookingId === upcomingBooking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(pendingMatch);

  await platform.confirmBooking(provider.id, { bookingId: upcomingBooking.id });

  const notificationList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.ok(
    notificationList.notifications.some((notification) => notification.title === "Time to head out soon")
  );
  assert.ok(
    notificationList.notifications.some((notification) => notification.title === "Review crew staffing soon")
  );

  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: pendingMatch!.id,
    action: "accept"
  });

  const crewStartedRoute = await platform.markBookingOnRoute(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    { bookingId: upcomingBooking.id }
  );
  assert.ok(crewStartedRoute.onRouteConfirmedAt);
  assert.equal(crewStartedRoute.onRouteConfirmedByCrewMemberId, crewMember.id);
  const crewTracking = await platform.updateBookingRouteLocation(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    {
      bookingId: upcomingBooking.id,
      point: {
        latitude: 30.2437,
        longitude: -97.76395
      },
      speedMph: 18
    }
  );
  assert.equal(crewTracking.source, "crew-device");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "provider-only",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const secondBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Dispatch controls route leader",
    totalCents: 6400
  });
  const secondOverview = await platform.getProviderStaffingOverview(provider.id);
  const secondPendingMatch = secondOverview.jobs
    .find((job) => job.bookingId === secondBooking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(secondPendingMatch);
  await platform.reviewCrewMatch(provider.id, {
    crewMatchId: secondPendingMatch!.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: secondBooking.id });

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      { bookingId: secondBooking.id }
    ),
    /handles route start personally/
  );
  await assert.rejects(
    platform.updateBookingRouteLocation(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      {
        bookingId: secondBooking.id,
        point: {
          latitude: 30.24375,
          longitude: -97.76398
        },
        speedMph: 12
      }
    ),
    /handles route tracking personally/
  );
});

test("provider assistant previews and executes a reschedule command with customer notification", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant@example.com",
    password: "Password123!",
    phone: "555-4380",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant@example.com",
    password: "Password123!",
    phone: "555-4381",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant reschedule test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.executed, false);
  assert.equal(preview.targetWindowKey, "late-afternoon-night");
  assert.match(preview.previewMessage, /Move Jordan Rivera to Late afternoon \/ evening/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.ok(executed.updatedBooking);
  assert.equal(getBookingServiceWindow(executed.updatedBooking!.scheduledStartIso).key, "late-afternoon-night");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-reschedule");

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some((notification) => notification.title === "Your service window was updated")
  );
});

test("provider assistant asks for booking selection when more than one booking matches the command", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-ambiguous@example.com",
    password: "Password123!",
    phone: "555-4382",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-ambiguous@example.com",
    password: "Password123!",
    phone: "555-4383",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() + 4);
  firstDay.setHours(13, 0, 0, 0);
  const secondDay = new Date(firstDay.getTime() + 24 * 60 * 60 * 1000);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstDay.toISOString(),
    scheduledEndIso: new Date(firstDay.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "First afternoon booking",
    totalCents: 6200
  });
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondDay.toISOString(),
    scheduledEndIso: new Date(secondDay.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Second afternoon booking",
    totalCents: 6200
  });

  const response = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    execute: false
  });

  assert.equal(response.understood, true);
  assert.equal(response.requiresBookingSelection, true);
  assert.equal(response.executed, false);
  assert.equal(response.bookingCandidates.length, 2);
});

test("new providers stay out of public search until ops approves verification", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Casey Warner",
    email: "provider-verification@example.com",
    password: "Password123!",
    phone: "555-4400",
    role: "provider",
    companyName: "Warner Grounds",
    categories: ["lawn-mowing", "leaf-blowing"],
    serviceRadiusMiles: 20,
    address: createAddress("118 Maple Ave", 30.2438, -97.7639)
  });
  assert.equal(provider.role, "provider");
  assert.equal(provider.verificationStatus, "pending-review");

  const queueBeforeReview = await platform.listProviderVerificationQueue();
  assert.ok(queueBeforeReview.some((item) => item.provider.id === provider.id));

  const searchBeforeApproval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: futureIso(48),
    estimatedDurationMinutes: 45
  });
  assert.equal(searchBeforeApproval.providers.some((item) => item.id === provider.id), false);

  const approvedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes: "Business profile is complete and ready to go live."
  });
  assert.equal(approvedProvider.verificationStatus, "verified");
  assert.ok(approvedProvider.verificationReviewedAt);

  const queueAfterReview = await platform.listProviderVerificationQueue();
  assert.equal(queueAfterReview.some((item) => item.provider.id === provider.id), false);

  const searchAfterApproval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: futureIso(48),
    estimatedDurationMinutes: 45
  });
  assert.equal(searchAfterApproval.providers.some((item) => item.id === provider.id), true);
});

test("ops summary reports refund reviews and active booking exceptions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const provider = await platform.registerUser({
    fullName: "Dana Green",
    email: "provider-ops-summary@example.com",
    password: "Password123!",
    phone: "555-4700",
    role: "provider",
    companyName: "Green Ops Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("180 Service Ln", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-summary@example.com",
    password: "Password123!",
    phone: "555-4800",
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
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops summary coverage",
    totalCents: 6800
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  const checkoutPayment = await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  const finalizedPayment = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: checkoutPayment.payment.checkoutSessionId ?? ""
  });

  const exceptionBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("114 Garden Row", 30.2437, -97.7637),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Ops summary exception coverage",
    totalCents: 6900
  });

  await platform.confirmBooking(provider.id, { bookingId: exceptionBooking.id });

  await platform.createRefund(
    { userId: customer.id, email: customer.email, role: "customer" },
    { paymentId: finalizedPayment.id, reason: "Service quality review requested." }
  );

  await platform.markBookingException(provider.id, {
    bookingId: exceptionBooking.id,
    exceptionType: "service-could-not-be-completed",
    notes: "Rain interrupted the service before completion."
  });

  const summary = await platform.getOpsFinancialExceptionSummary();
  assert.equal(summary.refundReviewOpenCount, 1);
  assert.equal(summary.payoutHoldCount, 1);
  assert.equal(summary.activeBookingExceptionCount, 1);
  assert.equal(summary.openBillingTicketCount, 1);
  assert.ok(summary.refundReviews.some((item) => item.bookingId === booking.id));
  assert.ok(summary.activeExceptions.some((item) => item.bookingId === exceptionBooking.id));
});
