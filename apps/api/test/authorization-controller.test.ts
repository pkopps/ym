import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { AuthController } from "../src/controllers/AuthController";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { SupportController } from "../src/controllers/SupportController";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

function createAddress() {
  return {
    line1: "112 Garden Row",
    city: "Austin",
    state: "TX",
    postalCode: "78704",
    country: "US",
    point: {
      latitude: 30.2435,
      longitude: -97.7638
    }
  };
}

function createMockResponse() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let payload = "";

  return {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    writeHead(nextStatusCode: number) {
      statusCode = nextStatusCode;
    },
    end(chunk?: string) {
      payload = chunk ?? "";
    },
    readJson() {
      return JSON.parse(payload);
    },
    getStatusCode() {
      return statusCode;
    }
  };
}

async function registerUser(
  controller: AuthController,
  payload: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    role: "customer" | "provider" | "crew-member";
  }
) {
  const response = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        ...payload,
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 201);
  return response.readJson() as {
    session: { token: string };
    user: { id: string; role: string };
  };
}

test("provider settings reject customer tokens", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer"
  });

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/settings",
      body: {
        serviceRadiusMiles: 20,
        sponsoredListingEnabled: true
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    response as never
  ).catch((error: Error) => {
    response.writeHead(403);
    response.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(response.getStatusCode(), 403);
});

test("support tickets are attributed to the authenticated requester", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const supportController = new SupportController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "jordan2@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer"
  });

  const response = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/tickets",
      body: {
        subject: "Billing issue",
        description: "I was charged twice.",
        issueType: "billing"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 201);
  const ticket = response.readJson();
  assert.equal(ticket.requesterId, customer.user.id);
  assert.equal(ticket.issueType, "billing");
});

test("support tickets list only the authenticated user's tickets and reject unrelated bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);
  const supportController = new SupportController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "support-owner@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer"
  });
  const otherCustomer = await registerUser(authController, {
    fullName: "Robin Stone",
    email: "support-other@example.com",
    password: "Password123!",
    phone: "555-0202",
    role: "customer"
  });

  const customerIdentity = await platform.findAuthIdentityByUserId(customer.user.id);
  const otherIdentity = await platform.findAuthIdentityByUserId(otherCustomer.user.id);
  assert.ok(customerIdentity);
  assert.ok(otherIdentity);
  const customerProfile = await platform.getUserByIdentity(customerIdentity);
  const otherProfile = await platform.getUserByIdentity(otherIdentity);
  assert.ok(customerProfile && customerProfile.role === "customer");
  assert.ok(otherProfile && otherProfile.role === "customer");

  const [provider] = await repository.listProviders();
  assert.ok(provider);
  const booking = await platform.createBooking(customer.user.id, {
    providerId: provider.id,
    serviceAddress: customerProfile.address,
    servicePropertyId: customerProfile.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString(),
    notes: "Support linkage test",
    totalCents: 9500
  });

  const createResponse = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/tickets",
      body: {
        bookingId: booking.id,
        subject: "Need access update",
        description: "The side gate code changed.",
        issueType: "general"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    createResponse as never
  );
  assert.equal(createResponse.getStatusCode(), 201);

  const listResponse = createMockResponse();
  await supportController.handle(
    {
      method: "GET",
      path: "/api/support/tickets",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    listResponse as never
  );
  assert.equal(listResponse.getStatusCode(), 200);
  const tickets = listResponse.readJson();
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].bookingId, booking.id);

  const blockedResponse = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/tickets",
      body: {
        bookingId: booking.id,
        subject: "Wrong booking",
        description: "This should not be allowed.",
        issueType: "general"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${otherCustomer.session.token}`
      }
    },
    blockedResponse as never
  ).catch((error: Error) => {
    blockedResponse.writeHead(403);
    blockedResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(blockedResponse.getStatusCode(), 403);

  const otherListResponse = createMockResponse();
  await supportController.handle(
    {
      method: "GET",
      path: "/api/support/tickets",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${otherCustomer.session.token}`
      }
    },
    otherListResponse as never
  );
  assert.equal(otherListResponse.getStatusCode(), 200);
  assert.equal(otherListResponse.readJson().length, 0);
});

test("protected booking routes reject missing bearer tokens", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const marketplaceController = new MarketplaceController(platform);
  const response = createMockResponse();

  await marketplaceController.handle(
    {
      method: "GET",
      path: "/api/bookings",
      body: undefined,
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  ).catch((error: Error) => {
    response.writeHead(401);
    response.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(response.getStatusCode(), 401);
});

test("authenticated customers can build instant quotes with their saved property ids", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "jordan3@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer"
  });

  const identity = await platform.findAuthIdentityByUserId(customer.user.id);
  assert.ok(identity);
  const customerProfile = await platform.getUserByIdentity(identity);
  assert.ok(customerProfile);
  assert.equal(customerProfile.role, "customer");

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/quotes/instant",
      body: {
        address: customerProfile.address,
        propertyId: customerProfile.defaultPropertyId,
        category: "lawn-mowing"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const quote = response.readJson();
  assert.equal(quote.category, "lawn-mowing");
  assert.ok(quote.estimatedPriceCents > 0);
});
