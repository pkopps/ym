import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { hashPassword } from "../src/auth";
import { AuthController } from "../src/controllers/AuthController";
import { MarketplaceController } from "../src/controllers/MarketplaceController";
import { ObservabilityController } from "../src/controllers/ObservabilityController";
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

async function createOpsSession(
  controller: AuthController,
  platform: MarketplacePlatformService,
  overrides?: Partial<{
    fullName: string;
    email: string;
    password: string;
    phone: string;
  }>
) {
  const fullName = overrides?.fullName ?? "Casey Ops";
  const email = overrides?.email ?? "casey-ops@example.com";
  const password = overrides?.password ?? "Password123!";
  const phone = overrides?.phone ?? "555-0310";

  await platform.registerUser(
    {
      fullName,
      email,
      password,
      phone,
      role: "ops",
      address: createAddress()
    },
    hashPassword(password)
  );

  const response = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email,
        password
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  return response.readJson() as {
    session: { token: string };
    user: { id: string; role: string };
  };
}

async function withMockedNow<T>(nowMs: number, run: () => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  try {
    return await run();
  } finally {
    Date.now = originalNow;
  }
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

test("provider profile updates reject customer tokens", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "jordan-profile-update@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer"
  });

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/profile",
      body: {
        companyName: "Should Not Work",
        bio: "Trying to update a provider profile with a customer token.",
        yearsExperience: 4,
        categories: ["lawn-mowing"]
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

test("provider payout setting changes require a fresh provider session", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);

  const staleProvider = await withMockedNow(Date.now() - 31 * 60 * 1000, () =>
    registerUser(authController, {
      fullName: "Avery Green",
      email: "avery-stale@example.com",
      password: "Password123!",
      phone: "555-0203",
      role: "provider"
    })
  );

  const staleResponse = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/settings",
      body: {
        serviceRadiusMiles: 20,
        weeklyPayoutDay: "Tue"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${staleProvider.session.token}`
      }
    },
    staleResponse as never
  ).catch((error: Error) => {
    staleResponse.writeHead(401);
    staleResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(staleResponse.getStatusCode(), 401);
  assert.match(
    staleResponse.readJson().message,
    /Re-authentication required for payout settings/i
  );

  const staleNonSensitiveResponse = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/settings",
      body: {
        serviceRadiusMiles: 25
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${staleProvider.session.token}`
      }
    },
    staleNonSensitiveResponse as never
  );

  assert.equal(staleNonSensitiveResponse.getStatusCode(), 200);

  const freshProvider = await registerUser(authController, {
    fullName: "Morgan Fresh",
    email: "morgan-fresh@example.com",
    password: "Password123!",
    phone: "555-0204",
    role: "provider"
  });

  const freshResponse = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/settings",
      body: {
        serviceRadiusMiles: 20,
        instantPayoutsEnabled: true
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${freshProvider.session.token}`
      }
    },
    freshResponse as never
  );

  assert.equal(freshResponse.getStatusCode(), 200);
  const updatedProvider = freshResponse.readJson();
  assert.equal(updatedProvider.instantPayoutsEnabled, true);
});

test("public signup rejects ops accounts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const response = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Casey Ops",
        email: "public-ops-signup@example.com",
        password: "Password123!",
        phone: "555-0311",
        role: "ops",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  ).catch((error: Error) => {
    response.writeHead(403);
    response.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(response.getStatusCode(), 403);
  assert.match(response.readJson().message, /Ops accounts cannot be created through the public signup flow/i);
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
  assert.equal(ticket.launchLeadId, undefined);
});

test("no-booking customer general support tickets also enter the launch follow-up queue", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const supportController = new SupportController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "support-followup@example.com",
    password: "Password123!",
    phone: "555-0299",
    role: "customer"
  });

  const response = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/tickets",
      body: {
        subject: "Need help understanding launch coverage",
        description: "I have not booked yet and want a person to confirm what area GreenRain serves.",
        issueType: "general"
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
  assert.ok(ticket.launchLeadId);

  const leads = await platform.listOpsLaunchLeads();
  const linkedLead = leads.find((item) => item.lead.id === ticket.launchLeadId);
  assert.ok(linkedLead);
  assert.equal(linkedLead?.lead.requestSource, "customer-support-no-booking-ticket");
  assert.equal(linkedLead?.lead.sourceChannel, "email");
  assert.equal(linkedLead?.lead.contactName, "Jordan Rivera");
  assert.match(linkedLead?.lead.message ?? "", /launch coverage/i);
});

test("customer retention opportunities reject provider tokens", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);

  const provider = await registerUser(authController, {
    fullName: "Avery Green",
    email: "provider-retention-route@example.com",
    password: "Password123!",
    phone: "555-0202",
    role: "provider"
  });

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "GET",
      path: "/api/customers/retention-opportunities",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${provider.session.token}`
      }
    },
    response as never
  ).catch((error: Error) => {
    response.writeHead(403);
    response.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(response.getStatusCode(), 403);
});

test("inbound launch lead endpoint is secret-protected and idempotent by source reference", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const supportController = new SupportController(platform);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const unauthorizedResponse = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound",
        body: {
          sourceChannel: "email",
          sourceReferenceId: "msg_123",
          email: "jamie@example.com",
          subject: "Coverage question",
          message: "Do you serve Barnegat yet?"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      unauthorizedResponse as never
    ).catch((error: Error) => {
      unauthorizedResponse.writeHead(401);
      unauthorizedResponse.end(JSON.stringify({ message: error.message }));
    });

    assert.equal(unauthorizedResponse.getStatusCode(), 401);

    const response = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound",
        body: {
          sourceChannel: "email",
          requestSource: "direct-email-forward",
          sourceReferenceId: "msg_123",
          email: "jamie@example.com",
          subject: "Coverage question",
          message: "Do you serve Barnegat yet?"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const firstLead = response.readJson();
    assert.equal(firstLead.sourceReferenceId, "msg_123");
    assert.equal(firstLead.requestSource, "direct-email-forward");
    assert.equal(firstLead.areaLabel, "Barnegat, NJ");
    assert.equal(firstLead.contactName, "Jamie");
    assert.ok(
      firstLead.channelMetadata?.intakeNotes?.some((note: string) =>
        /Area was inferred from the inbound message as Barnegat, NJ/i.test(note)
      )
    );

    const retryResponse = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound",
        body: {
          sourceChannel: "email",
          requestSource: "direct-email-forward",
          sourceReferenceId: "msg_123",
          email: "jamie@example.com",
          subject: "Coverage question",
          message: "Do you serve Barnegat yet?"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      retryResponse as never
    );

    assert.equal(retryResponse.getStatusCode(), 201);
    const retryLead = retryResponse.readJson();
    assert.equal(retryLead.id, firstLead.id);
    assert.equal((await platform.listOpsLaunchLeads()).length, 1);
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("direct email inbound endpoint maps sender payloads into launch leads", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const supportController = new SupportController(platform);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const response = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound/email",
        body: {
          sourceReferenceId: "email_msg_456",
          senderEmail: "sam.homeowner@example.com",
          senderName: "Sam Homeowner",
          subject: "Need mowing help in Barnegat",
          textBody: "Can GreenRain handle weekly mowing starting next Tuesday?",
          areaLabel: "Barnegat, NJ"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const lead = response.readJson();
    assert.equal(lead.sourceChannel, "email");
    assert.equal(lead.requestSource, "direct-email-forward");
    assert.equal(lead.sourceReferenceId, "email_msg_456");
    assert.equal(lead.contactName, "Sam Homeowner");
    assert.equal(lead.email, "sam.homeowner@example.com");
    assert.equal(lead.preferredContactMethod, "email");
    assert.equal(lead.areaLabel, "Barnegat, NJ");
    assert.match(lead.message, /weekly mowing/i);
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("direct email inbound endpoint infers service, area, and text follow-up from the message body", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const supportController = new SupportController(platform);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const response = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound/email",
        body: {
          sourceReferenceId: "email_msg_789",
          senderEmail: "jamie.homeowner@example.com",
          senderName: "Jamie Homeowner",
          subject: "Question about weekly mowing",
          textBody: "Can you text me at (609) 555-0100 about weekly mowing in Barnegat next week?"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const lead = response.readJson();
    assert.equal(lead.sourceChannel, "email");
    assert.equal(lead.areaLabel, "Barnegat, NJ");
    assert.equal(lead.serviceCategory, "lawn-mowing");
    assert.equal(lead.phone, "6095550100");
    assert.equal(lead.preferredContactMethod, "text");
    assert.ok(
      lead.channelMetadata?.intakeNotes?.some((note: string) => /Area was inferred from the inbound message/i.test(note))
    );
    assert.ok(
      lead.channelMetadata?.intakeNotes?.some((note: string) => /Service was inferred from the inbound message/i.test(note))
    );
    assert.ok(
      lead.channelMetadata?.intakeNotes?.some((note: string) => /phone number was inferred/i.test(note))
    );
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("google business profile inbound endpoint supports platform-message leads without direct contact details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const supportController = new SupportController(platform);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const response = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound/google-business-profile",
        body: {
          sourceReferenceId: "gbp_thread_789",
          customerName: "Pat Homeowner",
          messageText: "Do you service Barnegat for weekly mowing?",
          threadUrl: "https://business.google.com/messages/thread/gbp_thread_789",
          profileLocationName: "GreenRain Barnegat",
          areaLabel: "Barnegat, NJ",
          serviceCategory: "lawn-mowing"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const lead = response.readJson();
    assert.equal(lead.sourceChannel, "google-business-profile");
    assert.equal(lead.requestSource, "google-business-profile-message");
    assert.equal(lead.sourceReferenceId, "gbp_thread_789");
    assert.equal(lead.contactName, "Pat Homeowner");
    assert.equal(lead.email, undefined);
    assert.equal(lead.phone, undefined);
    assert.equal(lead.preferredContactMethod, "platform-message");
    assert.equal(lead.channelMetadata?.profileLocationName, "GreenRain Barnegat");
    assert.equal(lead.channelMetadata?.threadUrl, "https://business.google.com/messages/thread/gbp_thread_789");
    assert.match(lead.message, /GreenRain Barnegat/i);
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("referral inbound endpoint can fall back to the referrer's contact details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const supportController = new SupportController(platform);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const response = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound/referral",
        body: {
          sourceReferenceId: "ref_123",
          referrerName: "Alex Neighbor",
          referrerEmail: "alex@example.com",
          referredCustomerName: "Jamie Homeowner",
          areaLabel: "Barnegat, NJ",
          serviceCategory: "lawn-mowing",
          messageText: "Neighbor wants help getting weekly mowing started."
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-inbound-secret": "launch-webhook-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const lead = response.readJson();
    assert.equal(lead.sourceChannel, "referral");
    assert.equal(lead.requestSource, "referral-forwarder");
    assert.equal(lead.sourceReferenceId, "ref_123");
    assert.equal(lead.contactName, "Jamie Homeowner");
    assert.equal(lead.email, "alex@example.com");
    assert.equal(lead.preferredContactMethod, "email");
    assert.equal(lead.channelMetadata?.referrerName, "Alex Neighbor");
    assert.equal(lead.channelMetadata?.referrerEmail, "alex@example.com");
    assert.equal(lead.channelMetadata?.referralFollowUpTarget, "referrer");
    assert.match(lead.message, /Referral from Alex Neighbor/i);
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("ops review response endpoint records posted public replies", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);
  const opsProvider = await registerUser(authController, {
    fullName: "Casey Ops",
    email: "ops-review-handler@example.com",
    password: "Password123!",
    phone: "555-0332",
    role: "provider"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Reviewer",
    email: "ops-review-route@example.com",
    password: "Password123!",
    phone: "555-0333",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress()
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: "booking-review-route",
    customerId: customer.id,
    providerId: seededProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    status: "completed",
    requestedAt: nowIso,
    scheduledStartIso: nowIso,
    scheduledEndIso: nowIso,
    completedAt: nowIso,
    notes: "Completed booking for review response route test",
    totalCents: 6200
  });

  await repository.createReviewInvite({
    id: "invite-review-route",
    bookingId: booking.id,
    customerId: customer.id,
    providerId: seededProvider.id,
    email: customer.email,
    status: "sent",
    channels: ["email"],
    scheduledSendIso: nowIso,
    sentAt: nowIso,
    expiresAtIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    deepLinkPath: `/bookings/${booking.id}/review`
  });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 3,
    timelinessRating: 3,
    attentionToDetailRating: 3,
    reviewText: "Solid overall, but we wanted a slightly cleaner finish."
  });

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/reviews/response",
      body: {
        reviewId: review.id,
        responseStatus: "posted",
        responseHandledBy: "Casey Ops",
        responseNotes: "Posted after checking the support context.",
        publicReplyBody:
          "Thank you for the feedback. We appreciate the note about the finish details and are using it to keep the next visit tighter."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${opsProvider.session.token}`
      }
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const updatedReview = response.readJson();
  assert.equal(updatedReview.responseStatus, "posted");
  assert.equal(updatedReview.responseHandledBy, "Casey Ops");
  assert.match(updatedReview.publicReplyBody, /finish details/i);
});

test("ops review escalation endpoint opens a linked support follow-up", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const marketplaceController = new MarketplaceController(platform);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "review-escalation-route@example.com",
    password: "Password123!",
    phone: "555-0302",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress("18 Cedar Lane", 39.7536, -74.2219)
  });
  const opsProvider = await registerUser(authController, {
    fullName: "Casey Ops",
    email: "ops-review-escalation-handler@example.com",
    password: "Password123!",
    phone: "555-03025",
    role: "provider"
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: "booking-review-escalate-route",
    customerId: customer.id,
    providerId: seededProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "yard-cleanup",
    status: "completed",
    requestedAt: nowIso,
    scheduledStartIso: nowIso,
    scheduledEndIso: nowIso,
    completedAt: nowIso,
    notes: "Completed booking for review escalation route test",
    totalCents: 8100
  });

  await repository.createReviewInvite({
    id: "invite-review-escalate-route",
    bookingId: booking.id,
    customerId: customer.id,
    providerId: seededProvider.id,
    email: customer.email,
    status: "sent",
    channels: ["email"],
    scheduledSendIso: nowIso,
    sentAt: nowIso,
    expiresAtIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    deepLinkPath: `/bookings/${booking.id}/review`
  });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 2,
    timelinessRating: 3,
    attentionToDetailRating: 2,
    reviewText: "The cleanup missed debris by the gate and needs service-quality follow-up."
  });

  const response = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/reviews/escalate",
      body: {
        reviewId: review.id,
        escalatedBy: "Casey Ops",
        escalationNotes: "Open a service-quality follow-up before we treat this like a public-reply-only issue."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${opsProvider.session.token}`
      }
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const escalatedItem = response.readJson();
  assert.ok(escalatedItem.supportTicketId);
  assert.equal(escalatedItem.supportTicketStatus, "open");
  assert.equal(escalatedItem.escalatedBy, "Casey Ops");
  assert.equal(escalatedItem.supportFollowUpRecommended, false);
});

test("ops overview route requires an ops or provider session", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const observabilityController = new ObservabilityController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "ops-overview-customer@example.com",
    password: "Password123!",
    phone: "555-0303",
    role: "customer"
  });
  const provider = await registerUser(authController, {
    fullName: "Ariana Flores",
    email: "ops-overview-provider@example.com",
    password: "Password123!",
    phone: "555-0304",
    role: "provider"
  });
  const ops = await createOpsSession(authController, platform, {
    email: "ops-overview-ops@example.com",
    phone: "555-0307"
  });

  const unauthorizedResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/overview",
      body: undefined,
      query: new URLSearchParams(),
      headers: {}
    },
    unauthorizedResponse as never
  ).catch((error: Error) => {
    unauthorizedResponse.writeHead(401);
    unauthorizedResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(unauthorizedResponse.getStatusCode(), 401);

  const forbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/overview",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    forbiddenResponse as never
  ).catch((error: Error) => {
    forbiddenResponse.writeHead(403);
    forbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(forbiddenResponse.getStatusCode(), 403);

  const providerResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/overview",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${provider.session.token}`
      }
    },
    providerResponse as never
  );
  assert.equal(providerResponse.getStatusCode(), 200);

  const opsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/overview",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    opsResponse as never
  );
  assert.equal(opsResponse.getStatusCode(), 200);
});

test("support ops routes require an ops or provider session", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);
  const supportController = new SupportController(platform);

  const customer = await registerUser(authController, {
    fullName: "Jordan Rivera",
    email: "support-ops-customer@example.com",
    password: "Password123!",
    phone: "555-0305",
    role: "customer"
  });
  const provider = await registerUser(authController, {
    fullName: "Ariana Flores",
    email: "support-ops-provider@example.com",
    password: "Password123!",
    phone: "555-0306",
    role: "provider"
  });
  const ops = await createOpsSession(authController, platform, {
    email: "support-ops-ops@example.com",
    phone: "555-0308"
  });

  const forbiddenResponse = createMockResponse();
  await supportController.handle(
    {
      method: "GET",
      path: "/api/support/ops/tickets",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    forbiddenResponse as never
  ).catch((error: Error) => {
    forbiddenResponse.writeHead(403);
    forbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(forbiddenResponse.getStatusCode(), 403);

  const providerResponse = createMockResponse();
  await supportController.handle(
    {
      method: "GET",
      path: "/api/support/ops/tickets",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${provider.session.token}`
      }
    },
    providerResponse as never
  );
  assert.equal(providerResponse.getStatusCode(), 200);

  const opsResponse = createMockResponse();
  await supportController.handle(
    {
      method: "GET",
      path: "/api/support/ops/tickets",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    opsResponse as never
  );
  assert.equal(opsResponse.getStatusCode(), 200);
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
