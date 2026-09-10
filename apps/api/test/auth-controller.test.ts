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

test("two-factor setup supports email codes, challenges new devices, and remembers verified devices", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);
  const firstDevice = {
    id: "customer-device-one",
    label: "Jordan's Mac",
    platform: "web"
  } as const;
  const secondDevice = {
    id: "customer-device-two",
    label: "Jordan's iPhone",
    platform: "ios"
  } as const;

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Jordan Secure",
        email: "secure@example.com",
        password: "Password123!",
        phone: "+15550299",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress(),
        device: firstDevice
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );
  const originalSession = registerResponse.readJson().session.token as string;

  const setupResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/setup",
      body: { method: "email", device: firstDevice },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${originalSession}` }
    },
    setupResponse as never
  );
  const setup = setupResponse.readJson();
  assert.equal(setup.twoFactorRequired, true);
  assert.equal(setup.method, "email");
  assert.match(setup.destinationHint, /@example\.com$/);
  assert.match(setup.codePreview, /^\d{6}$/);

  const confirmResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/confirm",
      body: {
        challengeToken: setup.challengeToken,
        code: setup.codePreview,
        rememberDevice: true
      },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${originalSession}` }
    },
    confirmResponse as never
  );
  const settings = confirmResponse.readJson();
  assert.equal(settings.twoFactorEnabled, true);
  assert.equal(settings.method, "email");
  assert.equal(settings.trustedDevices.length, 1);

  const challengedLoginResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "secure@example.com",
        password: "Password123!",
        device: secondDevice
      },
      query: new URLSearchParams(),
      headers: {}
    },
    challengedLoginResponse as never
  );
  assert.equal(challengedLoginResponse.getStatusCode(), 202);
  const challenge = challengedLoginResponse.readJson();
  assert.equal(challenge.twoFactorRequired, true);
  assert.equal(challenge.session, undefined);

  await assert.rejects(
    () =>
      controller.handle(
        {
          method: "POST",
          path: "/api/auth/two-factor/verify",
          body: {
            challengeToken: challenge.challengeToken,
            code: "000000",
            rememberDevice: true
          },
          query: new URLSearchParams(),
          headers: {}
        },
        createMockResponse() as never
      ),
    /security code is incorrect/i
  );

  const verifyResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/two-factor/verify",
      body: {
        challengeToken: challenge.challengeToken,
        code: challenge.codePreview,
        rememberDevice: true
      },
      query: new URLSearchParams(),
      headers: {}
    },
    verifyResponse as never
  );
  assert.ok(verifyResponse.readJson().session.token);

  const trustedLoginResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "secure@example.com",
        password: "Password123!",
        device: secondDevice
      },
      query: new URLSearchParams(),
      headers: {}
    },
    trustedLoginResponse as never
  );
  assert.equal(trustedLoginResponse.getStatusCode(), 200);
  assert.ok(trustedLoginResponse.readJson().session.token);

  const notifications = await repository.listNotificationsByRecipient(
    trustedLoginResponse.readJson().user.id
  );
  assert.ok(notifications.some((notification) => notification.title === "New device signed in"));

  const deliveries = await repository.listNotificationDeliveriesByRecipient(
    trustedLoginResponse.readJson().user.id
  );
  assert.ok(
    deliveries.some(
      (delivery) => delivery.title === "New device signed in" && delivery.channel === "email"
    ),
    "new-device warnings should always include email delivery"
  );

  const securityResponse = createMockResponse();
  await controller.handle(
    {
      method: "GET",
      path: "/api/auth/security",
      body: undefined,
      query: new URLSearchParams({ deviceId: secondDevice.id }),
      headers: { authorization: `Bearer ${verifyResponse.readJson().session.token}` }
    },
    securityResponse as never
  );
  const security = securityResponse.readJson();
  const rememberedSecondDevice = security.trustedDevices.find(
    (device: { label: string }) => device.label === secondDevice.label
  );
  assert.equal(rememberedSecondDevice.isCurrentDevice, true);

  const revokeDeviceResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/devices/revoke",
      body: { trustedDeviceId: rememberedSecondDevice.id },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${verifyResponse.readJson().session.token}` }
    },
    revokeDeviceResponse as never
  );
  assert.equal(
    revokeDeviceResponse
      .readJson()
      .trustedDevices.some((device: { id: string }) => device.id === rememberedSecondDevice.id),
    false
  );

  const revokedDeviceLoginResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "secure@example.com",
        password: "Password123!",
        device: secondDevice
      },
      query: new URLSearchParams(),
      headers: {}
    },
    revokedDeviceLoginResponse as never
  );
  assert.equal(revokedDeviceLoginResponse.getStatusCode(), 202);

  const revokeSessionsResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/sessions/revoke",
      body: {},
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${verifyResponse.readJson().session.token}` }
    },
    revokeSessionsResponse as never
  );
  assert.equal(revokeSessionsResponse.readJson().trustedDevices.length, 0);
  await assert.rejects(
    () =>
      controller.handle(
        {
          method: "GET",
          path: "/api/auth/me",
          body: undefined,
          query: new URLSearchParams(),
          headers: { authorization: `Bearer ${verifyResponse.readJson().session.token}` }
        },
        createMockResponse() as never
      ),
    /session has been replaced/i
  );
});

test("two-factor setup supports text messages and requires the password to disable it", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);
  const device = { id: "sms-device", label: "Sam's phone", platform: "android" } as const;

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Sam Text",
        email: "sam-text@example.com",
        password: "Password123!",
        phone: "+1 (555) 867-5309",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress(),
        device
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );
  const sessionToken = registerResponse.readJson().session.token as string;

  const setupResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/setup",
      body: { method: "sms", device },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${sessionToken}` }
    },
    setupResponse as never
  );
  const challenge = setupResponse.readJson();
  assert.equal(challenge.method, "sms");
  assert.match(challenge.destinationHint, /5309$/);
  assert.match(challenge.codePreview, /^\d{6}$/);

  const confirmResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/confirm",
      body: {
        challengeToken: challenge.challengeToken,
        code: challenge.codePreview,
        rememberDevice: true
      },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${sessionToken}` }
    },
    confirmResponse as never
  );
  assert.equal(confirmResponse.readJson().method, "sms");

  await assert.rejects(
    () =>
      controller.handle(
        {
          method: "POST",
          path: "/api/auth/security/two-factor/disable",
          body: { password: "WrongPass123!" },
          query: new URLSearchParams(),
          headers: { authorization: `Bearer ${sessionToken}` }
        },
        createMockResponse() as never
      ),
    /current password/i
  );

  const disableResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/disable",
      body: { password: "Password123!" },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${sessionToken}` }
    },
    disableResponse as never
  );
  assert.equal(disableResponse.readJson().twoFactorEnabled, false);
  assert.equal(disableResponse.readJson().trustedDevices.length, 0);
});

test("a two-factor challenge cannot mint a session after account access is disabled", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);
  const firstDevice = { id: "race-first-device", label: "First device", platform: "web" } as const;
  const secondDevice = { id: "race-second-device", label: "Second device", platform: "web" } as const;

  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Access Race",
        email: "access-race@example.com",
        password: "Password123!",
        phone: "+15550199",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress(),
        device: firstDevice
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );
  const registered = registerResponse.readJson();

  const setupResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/setup",
      body: { method: "email", device: firstDevice },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${registered.session.token}` }
    },
    setupResponse as never
  );
  const setup = setupResponse.readJson();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/security/two-factor/confirm",
      body: { challengeToken: setup.challengeToken, code: setup.codePreview, rememberDevice: true },
      query: new URLSearchParams(),
      headers: { authorization: `Bearer ${registered.session.token}` }
    },
    createMockResponse() as never
  );

  const loginResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "access-race@example.com", password: "Password123!", device: secondDevice },
      query: new URLSearchParams(),
      headers: {}
    },
    loginResponse as never
  );
  const challenge = loginResponse.readJson();
  await repository.updateAuthIdentity(registered.user.id, { accessDisabledAt: new Date().toISOString() });

  await assert.rejects(
    () =>
      controller.handle(
        {
          method: "POST",
          path: "/api/auth/two-factor/verify",
          body: {
            challengeToken: challenge.challengeToken,
            code: challenge.codePreview,
            rememberDevice: true
          },
          query: new URLSearchParams(),
          headers: {}
        },
        createMockResponse() as never
      ),
    /account access has been disabled/i
  );
});

test("repeated invalid passwords lock customer accounts as well as internal accounts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const controller = new AuthController(platform);
  const registerResponse = createMockResponse();
  await controller.handle(
    {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Taylor Lock",
        email: "lock@example.com",
        password: "Password123!",
        phone: "555-0210",
        role: "customer",
        propertyLabel: "Primary home",
        address: createAddress()
      },
      query: new URLSearchParams(),
      headers: {}
    },
    registerResponse as never
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(() =>
      controller.handle(
        {
          method: "POST",
          path: "/api/auth/login",
          body: { email: "lock@example.com", password: "WrongPass123!" },
          query: new URLSearchParams(),
          headers: {}
        },
        createMockResponse() as never
      )
    );
  }

  await assert.rejects(
    () =>
      controller.handle(
        {
          method: "POST",
          path: "/api/auth/login",
          body: { email: "lock@example.com", password: "Password123!" },
          query: new URLSearchParams(),
          headers: {}
        },
        createMockResponse() as never
      ),
    /temporarily locked/i
  );
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
      emailVerified: true,
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
      emailVerified: true,
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
