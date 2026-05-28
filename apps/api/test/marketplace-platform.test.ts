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
