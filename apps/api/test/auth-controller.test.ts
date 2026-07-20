import assert from "node:assert/strict";
import test from "node:test";
import { signScopedToken } from "../src/auth";
import { AuthController } from "../src/controllers/AuthController";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { DataEngineeringLogger } from "@yardmatch/analytics";

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
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    }
  };
}

test("auth controller registers, logs in, and returns the current user", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Jordan Rivera",
        email: "jordan@example.com",
        password: "Password123!",
        phone: "555-0200",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );

  assert.equal(registerResponse.getStatusCode(), 201);
  const registered = registerResponse.readJson();
  assert.equal(registered.user.email, "jordan@example.com");
  assert.ok(registered.session.token);
  assert.ok(registered.session.expiresAtIso);

  const loginResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "jordan@example.com",
        password: "Password123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    loginResponse as never
  );

  assert.equal(loginResponse.getStatusCode(), 200);
  const loggedIn = loginResponse.readJson();
  assert.ok(loggedIn.session.token);
  assert.ok(loggedIn.session.expiresAtIso);

  const meResponse = createMockResponse();
  await controller.handle(
    {
      method: "GET",
      path: "/api/auth/me",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${loggedIn.session.token}`
      }
    },
    meResponse as never
  );

  assert.equal(meResponse.getStatusCode(), 200);
  const currentUser = meResponse.readJson();
  assert.equal(currentUser.user.email, "jordan@example.com");
  assert.equal(currentUser.user.role, "customer");
  assert.ok(currentUser.sensitiveActionPolicy);
  assert.equal(currentUser.sensitiveActionPolicy.actions.length, 1);
  const paymentMethodPolicy = currentUser.sensitiveActionPolicy.actions[0];
  assert.equal(paymentMethodPolicy.key, "customer-payment-method");
  assert.equal(paymentMethodPolicy.ownerRole, "customer");
  assert.equal(paymentMethodPolicy.requiresFreshSession, true);
  assert.equal(paymentMethodPolicy.maxSessionAgeSeconds, 15 * 60);
  assert.equal(paymentMethodPolicy.enforcementStatus, "contract-ready");
  assert.equal(paymentMethodPolicy.isCurrentSessionFresh, true);
  assert.match(paymentMethodPolicy.rationale, /payment-method changes/i);
});

test("password reset rotates sessions and signs the user back in", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Jordan Rivera",
        email: "jordan@example.com",
        password: "Password123!",
        phone: "555-0200",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );

  const originalSession = registerResponse.readJson().session.token as string;

  const requestResetResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/password-reset/request",
      body: {
        email: "jordan@example.com"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    requestResetResponse as never
  );

  assert.equal(requestResetResponse.getStatusCode(), 200);
  const resetRequest = requestResetResponse.readJson();
  assert.ok(resetRequest.resetCodePreview);

  const confirmResetResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/password-reset/confirm",
      body: {
        email: "jordan@example.com",
        resetCode: resetRequest.resetCodePreview,
        newPassword: "BetterPass123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    confirmResetResponse as never
  );

  assert.equal(confirmResetResponse.getStatusCode(), 200);
  const resetEnvelope = confirmResetResponse.readJson();
  assert.ok(resetEnvelope.session.token);
  assert.notEqual(resetEnvelope.session.token, originalSession);

  const oldMeResponse = createMockResponse();
  await assert.rejects(() =>
    controller.handle(
      {
        method: "GET",
        path: "/api/auth/me",
        body: undefined,
        query: new URLSearchParams(),
        headers: {
          authorization: `Bearer ${originalSession}`
        }
      },
      oldMeResponse as never
    )
  );

  const newMeResponse = createMockResponse();
  await controller.handle(
    {
      method: "GET",
      path: "/api/auth/me",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${resetEnvelope.session.token}`
      }
    },
    newMeResponse as never
  );

  assert.equal(newMeResponse.getStatusCode(), 200);
  assert.equal(newMeResponse.readJson().user.email, "jordan@example.com");
});

test("social signup completion creates a new customer account", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);
  const pendingToken = signScopedToken(
    "yardmatch-social-signup",
    {
      provider: "google",
      subject: "google-subject-123",
      email: "social@example.com",
      fullName: "Jordan Social",
      role: "customer",
      mode: "signup"
    },
    60 * 30
  );

  const response = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/social/complete",
      body: {
        pendingToken,
        role: "customer",
        fullName: "Jordan Social",
        phone: "555-0222",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 201);
  const envelope = response.readJson();
  assert.equal(envelope.user.email, "social@example.com");
  assert.equal(envelope.user.role, "customer");
  assert.ok(envelope.session.token);

  const identity = await platform.findAuthIdentityByProvider("google", "google-subject-123");
  assert.ok(identity);
  assert.equal(identity?.email, "social@example.com");
});

test("social signup completion links an existing account with the same email", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Jordan Rivera",
        email: "jordan@example.com",
        password: "Password123!",
        phone: "555-0200",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );

  const pendingToken = signScopedToken(
    "yardmatch-social-signup",
    {
      provider: "apple",
      subject: "apple-subject-456",
      email: "jordan@example.com",
      fullName: "Jordan Rivera",
      role: "customer",
      mode: "signup"
    },
    60 * 30
  );

  const response = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/social/complete",
      body: {
        pendingToken,
        role: "customer",
        fullName: "Jordan Rivera",
        phone: "555-0200",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const envelope = response.readJson();
  assert.equal(envelope.user.email, "jordan@example.com");

  const identity = await platform.findAuthIdentityByProvider("apple", "apple-subject-456");
  assert.ok(identity);
  assert.equal(identity?.email, "jordan@example.com");
});
