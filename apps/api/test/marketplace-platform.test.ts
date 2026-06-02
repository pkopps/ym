import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

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
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
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
    scheduledStartIso: "2026-06-01T15:00:00.000Z",
    scheduledEndIso: "2026-06-01T18:00:00.000Z",
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
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    willingToTravelMiles: 30
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: "2026-06-01T15:00:00.000Z",
    scheduledEndIso: "2026-06-01T16:00:00.000Z",
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
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
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
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(otherCrew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: "2026-06-01T15:00:00.000Z",
    scheduledEndIso: "2026-06-01T18:00:00.000Z",
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
