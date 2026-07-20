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
    internalScope: "operations" | "admin";
  }>
) {
  const fullName = overrides?.fullName ?? "Casey Ops";
  const email = overrides?.email ?? "casey-ops@example.com";
  const password = overrides?.password ?? "Password123!";
  const phone = overrides?.phone ?? "555-0310";
  const internalScope = overrides?.internalScope ?? "operations";

  await platform.registerUser(
    {
      fullName,
      email,
      password,
      phone,
      role: "ops",
      address: createAddress(),
      internalScope
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

  const staleMeResponse = createMockResponse();
  await authController.handle(
    {
      method: "GET",
      path: "/api/auth/me",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${staleProvider.session.token}`
      }
    },
    staleMeResponse as never
  );

  assert.equal(staleMeResponse.getStatusCode(), 200);
  const staleMe = staleMeResponse.readJson();
  const payoutSettingsPolicy = staleMe.sensitiveActionPolicy.actions.find(
    (action: { key: string }) => action.key === "provider-payout-settings"
  );
  const bankAccountPolicy = staleMe.sensitiveActionPolicy.actions.find(
    (action: { key: string }) => action.key === "provider-bank-account"
  );
  const payoutAccountPolicy = staleMe.sensitiveActionPolicy.actions.find(
    (action: { key: string }) => action.key === "provider-payout-account"
  );
  assert.equal(staleMe.sensitiveActionPolicy.actions.length, 3);
  assert.ok(payoutSettingsPolicy);
  assert.equal(payoutSettingsPolicy.maxSessionAgeSeconds, 15 * 60);
  assert.equal(payoutSettingsPolicy.isCurrentSessionFresh, false);
  assert.equal(payoutSettingsPolicy.enforcementStatus, "enforced");
  assert.equal(payoutSettingsPolicy.currentBackendSurface, "POST /api/providers/settings");
  assert.ok(bankAccountPolicy);
  assert.equal(bankAccountPolicy.enforcementStatus, "contract-ready");
  assert.equal(bankAccountPolicy.isCurrentSessionFresh, false);
  assert.match(bankAccountPolicy.futureBackendSurface ?? "", /bank-account update route/i);
  assert.ok(payoutAccountPolicy);
  assert.equal(payoutAccountPolicy.enforcementStatus, "contract-ready");
  assert.equal(payoutAccountPolicy.isCurrentSessionFresh, false);
  assert.match(payoutAccountPolicy.rationale, /external payout account/i);

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

test("seeded in-memory ops account can log in", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const response = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "ops@example.com",
        password: "YardMatch123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const envelope = response.readJson();
  assert.equal(envelope.user.role, "ops");
  assert.equal(envelope.user.email, "ops@example.com");
  assert.equal(envelope.user.internalScope, "admin");
});

test("repeated failed ops logins trigger a temporary lock until password recovery succeeds", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  await platform.registerUser(
    {
      fullName: "Locked Ops",
      email: "locked-ops@example.com",
      password: "StrongPass123!",
      phone: "555-0318",
      role: "ops",
      address: createAddress(),
      internalScope: "operations"
    },
    hashPassword("StrongPass123!")
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedResponse = createMockResponse();
    await withMockedNow(Date.parse(`2026-06-24T09:${String(10 + attempt).padStart(2, "0")}:00.000Z`), async () => {
      await authController.handle(
        {
          method: "POST",
          path: "/api/auth/login",
          body: {
            email: "locked-ops@example.com",
            password: "WrongPass123!"
          },
          query: new URLSearchParams(),
          headers: {}
        },
        failedResponse as never
      ).catch((error: Error) => {
        failedResponse.writeHead(401);
        failedResponse.end(JSON.stringify({ message: error.message }));
      });
    });

    assert.equal(failedResponse.getStatusCode(), 401);
  }

  const lockedIdentity = await platform.findAuthIdentityByEmail("locked-ops@example.com");
  assert.equal(lockedIdentity?.failedAuthenticationCount, 5);
  assert.equal(lockedIdentity?.authenticationLockExpiresAt, "2026-06-24T09:44:00.000Z");

  const lockedLoginResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:20:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/login",
        body: {
          email: "locked-ops@example.com",
          password: "StrongPass123!"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      lockedLoginResponse as never
    ).catch((error: Error) => {
      lockedLoginResponse.writeHead(423);
      lockedLoginResponse.end(JSON.stringify({ message: error.message }));
    });
  });

  assert.equal(lockedLoginResponse.getStatusCode(), 423);
  assert.match(lockedLoginResponse.readJson().message, /temporarily locked/i);

  const resetRequestResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:21:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/password-reset/request",
        body: {
          email: "locked-ops@example.com"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      resetRequestResponse as never
    );
  });

  const resetRequest = resetRequestResponse.readJson() as { resetCodePreview?: string };
  assert.ok(resetRequest.resetCodePreview);

  const resetConfirmResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:22:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/password-reset/confirm",
        body: {
          email: "locked-ops@example.com",
          resetCode: resetRequest.resetCodePreview,
          newPassword: "RecoveredPass123!"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      resetConfirmResponse as never
    );
  });

  assert.equal(resetConfirmResponse.getStatusCode(), 200);
  const recoveredIdentity = await platform.findAuthIdentityByEmail("locked-ops@example.com");
  assert.equal(recoveredIdentity?.failedAuthenticationCount, 0);
  assert.equal(recoveredIdentity?.authenticationLockExpiresAt, undefined);
});

test("admin ops users can clear an auth lock with an audit note", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const admin = await createOpsSession(authController, platform, {
    email: "lock-admin@example.com",
    fullName: "Lock Admin",
    password: "Password123!",
    phone: "555-0319",
    internalScope: "admin"
  });

  await platform.registerUser(
    {
      fullName: "Casey Locked",
      email: "casey.locked@example.com",
      password: "StrongPass123!",
      phone: "555-0320",
      role: "ops",
      address: createAddress(),
      internalScope: "operations"
    },
    hashPassword("StrongPass123!")
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedResponse = createMockResponse();
    await withMockedNow(Date.parse(`2026-06-24T10:${String(10 + attempt).padStart(2, "0")}:00.000Z`), async () => {
      await authController.handle(
        {
          method: "POST",
          path: "/api/auth/login",
          body: {
            email: "casey.locked@example.com",
            password: "WrongPass123!"
          },
          query: new URLSearchParams(),
          headers: {}
        },
        failedResponse as never
      ).catch((error: Error) => {
        failedResponse.writeHead(401);
        failedResponse.end(JSON.stringify({ message: error.message }));
      });
    });
  }

  const lockedBeforeClear = await platform.findAuthIdentityByEmail("casey.locked@example.com");
  assert.ok(lockedBeforeClear?.authenticationLockExpiresAt);

  const missingNoteResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/access",
      body: {
        opsUserId: lockedBeforeClear?.userId,
        action: "clear-auth-lock"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    missingNoteResponse as never
  ).catch((error: Error) => {
    missingNoteResponse.writeHead(400);
    missingNoteResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(missingNoteResponse.getStatusCode(), 400);
  assert.match(missingNoteResponse.readJson().message, /notes are required/i);

  const clearResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/access",
      body: {
        opsUserId: lockedBeforeClear?.userId,
        action: "clear-auth-lock",
        notes: "Verified the staff member and cleared the temporary lock."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    clearResponse as never
  );

  assert.equal(clearResponse.getStatusCode(), 200);
  const cleared = clearResponse.readJson();
  assert.equal(cleared.failedAuthenticationCount, 0);
  assert.equal(cleared.isAuthenticationLocked, false);
  assert.equal(cleared.accessHistory.at(-1)?.kind, "auth-lock-cleared");
  assert.match(cleared.accessHistory.at(-1)?.notes ?? "", /verified the staff member/i);
  assert.equal(cleared.authHistory.at(-1)?.kind, "auth-lock-cleared");
  assert.match(cleared.authHistory.at(-1)?.notes ?? "", /verified the staff member/i);

  const successfulLoginResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T10:20:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/login",
        body: {
          email: "casey.locked@example.com",
          password: "StrongPass123!"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      successfulLoginResponse as never
    );
  });

  assert.equal(successfulLoginResponse.getStatusCode(), 200);
});

test("ops account management routes require an admin ops session", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const provider = await registerUser(authController, {
    fullName: "Avery Green",
    email: "provider-no-ops-access@example.com",
    password: "Password123!",
    phone: "555-0208",
    role: "provider"
  });

  const response = createMockResponse();
  await authController.handle(
    {
      method: "GET",
      path: "/api/ops/accounts",
      body: undefined,
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
  assert.match(response.readJson().message, /requires a ops account/i);

  const staffOps = await createOpsSession(authController, platform, {
    email: "staff-ops@example.com",
    fullName: "Staff Ops",
    internalScope: "operations"
  });

  const staffResponse = createMockResponse();
  await authController.handle(
    {
      method: "GET",
      path: "/api/ops/accounts",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${staffOps.session.token}`
      }
    },
    staffResponse as never
  ).catch((error: Error) => {
    staffResponse.writeHead(403);
    staffResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(staffResponse.getStatusCode(), 403);
  assert.match(staffResponse.readJson().message, /admin ops account/i);
});

test("ops users can create, update, and rotate other ops accounts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const admin = await createOpsSession(authController, platform, {
    email: "ops-admin@example.com",
    fullName: "Ops Admin",
    password: "Password123!",
    phone: "555-0312",
    internalScope: "admin"
  });

  const createResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts",
      body: {
        fullName: "Jamie Dispatcher",
        email: "jamie.dispatcher@example.com",
        phone: "555-0313",
        password: "Dispatcher123!"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    createResponse as never
  );

  assert.equal(createResponse.getStatusCode(), 201);
  const created = createResponse.readJson();
  assert.equal(created.account.profile.role, "ops");
  assert.equal(created.account.profile.email, "jamie.dispatcher@example.com");
  assert.equal(created.account.profile.internalScope, "operations");
  assert.equal(created.account.hasPassword, true);
  assert.deepEqual(created.account.accessHistory.map((entry: { kind: string }) => entry.kind), ["created"]);
  assert.equal(created.account.accessHistory[0]?.changedBy, admin.user.id);

  const failedLoginResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:20:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/login",
        body: {
          email: "jamie.dispatcher@example.com",
          password: "WrongDispatcher123!"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      failedLoginResponse as never
    ).catch((error: Error) => {
      failedLoginResponse.writeHead(401);
      failedLoginResponse.end(JSON.stringify({ message: error.message }));
    });
  });

  assert.equal(failedLoginResponse.getStatusCode(), 401);
  const postFailureAccount = (await platform.listOpsAccounts()).find(
    (account) => account.profile.id === created.account.profile.id
  );
  assert.equal(postFailureAccount?.failedAuthenticationCount, 1);
  assert.equal(postFailureAccount?.lastFailedAuthenticationReason, "invalid-password");
  assert.equal(postFailureAccount?.lastFailedAuthenticationAt, "2026-06-24T09:20:00.000Z");

  const createdLoginResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:30:00.000Z"), async () => {
    await authController.handle(
      {
        method: "POST",
        path: "/api/auth/login",
        body: {
          email: "jamie.dispatcher@example.com",
          password: "Dispatcher123!"
        },
        query: new URLSearchParams(),
        headers: {}
      },
      createdLoginResponse as never
    );
  });

  assert.equal(createdLoginResponse.getStatusCode(), 200);
  const createdLogin = createdLoginResponse.readJson() as {
    session: { token: string };
    user: { id: string; role: string; fullName: string };
  };
  assert.equal(createdLogin.user.role, "ops");
  const postLoginAccount = (await platform.listOpsAccounts()).find(
    (account) => account.profile.id === created.account.profile.id
  );
  assert.equal(postLoginAccount?.lastAuthenticatedMethod, "password");
  assert.equal(postLoginAccount?.lastAuthenticatedAt, "2026-06-24T09:30:00.000Z");
  assert.equal(postLoginAccount?.failedAuthenticationCount, 0);
  assert.equal(postLoginAccount?.lastFailedAuthenticationAt, undefined);

  const updateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/update",
      body: {
        opsUserId: created.account.profile.id,
        fullName: "Jamie Dispatch Lead",
        phone: "555-0413",
        internalScope: "admin"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    updateResponse as never
  );

  assert.equal(updateResponse.getStatusCode(), 200);
  const updated = updateResponse.readJson();
  assert.equal(updated.profile.fullName, "Jamie Dispatch Lead");
  assert.equal(updated.profile.phone, "555-0413");
  assert.equal(updated.profile.internalScope, "admin");
  assert.deepEqual(updated.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "profile-updated"
  ]);

  const rotateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/rotate-sessions",
      body: {
        opsUserId: created.account.profile.id,
        newPassword: "NewDispatcher123!"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    rotateResponse as never
  );

  assert.equal(rotateResponse.getStatusCode(), 200);
  const rotated = rotateResponse.readJson();
  assert.equal(rotated.profile.id, created.account.profile.id);
  assert.ok(rotated.sessionVersion > created.account.sessionVersion);
  assert.deepEqual(rotated.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "profile-updated",
    "sessions-rotated"
  ]);
  assert.equal(rotated.authHistory.at(-1)?.kind, "sessions-rotated");
  assert.match(rotated.authHistory.at(-1)?.notes ?? "", /password replaced/i);

  const staleSessionResponse = createMockResponse();
  await withMockedNow(Date.parse("2026-06-24T09:35:00.000Z"), async () => {
    await authController.handle(
      {
        method: "GET",
        path: "/api/ops/accounts",
        body: undefined,
        query: new URLSearchParams(),
        headers: {
          authorization: `Bearer ${createdLogin.session.token}`
        }
      },
      staleSessionResponse as never
    ).catch((error: Error) => {
      staleSessionResponse.writeHead(401);
      staleSessionResponse.end(JSON.stringify({ message: error.message }));
    });
  });

  assert.equal(staleSessionResponse.getStatusCode(), 401);
  assert.match(staleSessionResponse.readJson().message, /Session has been replaced/i);

  const oldPasswordLoginResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "jamie.dispatcher@example.com",
        password: "Dispatcher123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    oldPasswordLoginResponse as never
  ).catch((error: Error) => {
    oldPasswordLoginResponse.writeHead(401);
    oldPasswordLoginResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(oldPasswordLoginResponse.getStatusCode(), 401);

  const newPasswordLoginResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "jamie.dispatcher@example.com",
        password: "NewDispatcher123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    newPasswordLoginResponse as never
  );

  assert.equal(newPasswordLoginResponse.getStatusCode(), 200);

  const selfRotateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/rotate-sessions",
      body: {
        opsUserId: admin.user.id
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    selfRotateResponse as never
  ).catch((error: Error) => {
    selfRotateResponse.writeHead(400);
    selfRotateResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(selfRotateResponse.getStatusCode(), 400);
  assert.match(selfRotateResponse.readJson().message, /your own active ops session/i);
});

test("ops users can prepare invite-style password resets for new and existing ops accounts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const admin = await createOpsSession(authController, platform, {
    email: "ops-admin-invite@example.com",
    fullName: "Ops Invite Admin",
    password: "Password123!",
    phone: "555-0314",
    internalScope: "admin"
  });

  const createResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts",
      body: {
        fullName: "Taylor Coordinator",
        email: "taylor.coordinator@example.com",
        phone: "555-0315",
        sendPasswordResetInvite: true
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    createResponse as never
  );

  assert.equal(createResponse.getStatusCode(), 201);
  const created = createResponse.readJson();
  assert.equal(created.account.profile.email, "taylor.coordinator@example.com");
  assert.equal(created.account.hasPassword, true);
  assert.equal(created.passwordReset.success, true);
  assert.ok(created.passwordReset.expiresAtIso);
  assert.ok(created.passwordReset.resetCodePreview);
  assert.ok(created.passwordReset.resetUrlPreview);
  assert.deepEqual(created.account.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "password-reset-invited"
  ]);

  const identityAfterCreate = await platform.findAuthIdentityByEmail("taylor.coordinator@example.com");
  assert.ok(identityAfterCreate?.resetPasswordRequestedAt);

  const loginBeforeReset = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "taylor.coordinator@example.com",
        password: "Password123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    loginBeforeReset as never
  ).catch((error: Error) => {
    loginBeforeReset.writeHead(401);
    loginBeforeReset.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(loginBeforeReset.getStatusCode(), 401);

  const resetExistingResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/password-reset/request",
      body: {
        opsUserId: created.account.profile.id
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    resetExistingResponse as never
  );

  assert.equal(resetExistingResponse.getStatusCode(), 200);
  const resetExisting = resetExistingResponse.readJson();
  assert.equal(resetExisting.account.profile.id, created.account.profile.id);
  assert.equal(resetExisting.passwordReset.success, true);
  assert.ok(resetExisting.passwordReset.resetCodePreview);
  assert.ok(resetExisting.passwordReset.resetUrlPreview);
  assert.deepEqual(resetExisting.account.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "password-reset-invited",
    "password-reset-invited"
  ]);
  assert.equal(resetExisting.account.authHistory.at(-1)?.kind, "password-reset-requested");
});

test("ops users can deactivate and reactivate other ops accounts with audited access changes", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const authController = new AuthController(platform);

  const admin = await createOpsSession(authController, platform, {
    email: "ops-admin-access@example.com",
    fullName: "Ops Access Admin",
    password: "Password123!",
    phone: "555-0316",
    internalScope: "admin"
  });

  const createdResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts",
      body: {
        fullName: "Morgan Queue",
        email: "morgan.queue@example.com",
        phone: "555-0317",
        password: "QueueStrong123!"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    createdResponse as never
  );

  assert.equal(createdResponse.getStatusCode(), 201);
  const created = createdResponse.readJson();

  const loginResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "morgan.queue@example.com",
        password: "QueueStrong123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    loginResponse as never
  );

  assert.equal(loginResponse.getStatusCode(), 200);
  const activeSession = loginResponse.readJson() as {
    session: { token: string };
    user: { id: string };
  };

  const deactivateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/access",
      body: {
        opsUserId: created.account.profile.id,
        action: "deactivate",
        notes: "Staff member is no longer covering launch ops."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    deactivateResponse as never
  );

  assert.equal(deactivateResponse.getStatusCode(), 200);
  const deactivated = deactivateResponse.readJson();
  assert.equal(deactivated.isActive, false);
  assert.equal(deactivated.lastAccessChangeKind, "deactivated");
  assert.equal(deactivated.accessDisabledBy, admin.user.id);
  assert.match(deactivated.accessChangeNotes ?? "", /no longer covering launch ops/i);
  assert.deepEqual(deactivated.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "deactivated"
  ]);
  assert.match(
    deactivated.accessHistory[1]?.notes ?? "",
    /no longer covering launch ops/i
  );

  const staleSessionResponse = createMockResponse();
  await authController.handle(
    {
      method: "GET",
      path: "/api/ops/accounts",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${activeSession.session.token}`
      }
    },
    staleSessionResponse as never
  ).catch((error: Error) => {
    staleSessionResponse.writeHead(403);
    staleSessionResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(staleSessionResponse.getStatusCode(), 403);
  assert.match(staleSessionResponse.readJson().message, /access has been disabled/i);

  const blockedLoginResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "morgan.queue@example.com",
        password: "QueueStrong123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    blockedLoginResponse as never
  ).catch((error: Error) => {
    blockedLoginResponse.writeHead(403);
    blockedLoginResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(blockedLoginResponse.getStatusCode(), 403);
  assert.match(blockedLoginResponse.readJson().message, /access has been disabled/i);

  const reactivateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/access",
      body: {
        opsUserId: created.account.profile.id,
        action: "reactivate",
        notes: "Restored for weekday launch coverage."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    reactivateResponse as never
  );

  assert.equal(reactivateResponse.getStatusCode(), 200);
  const reactivated = reactivateResponse.readJson();
  assert.equal(reactivated.isActive, true);
  assert.equal(reactivated.lastAccessChangeKind, "reactivated");
  assert.match(reactivated.accessChangeNotes ?? "", /weekday launch coverage/i);
  assert.deepEqual(reactivated.accessHistory.map((entry: { kind: string }) => entry.kind), [
    "created",
    "deactivated",
    "reactivated"
  ]);

  const restoredLoginResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "morgan.queue@example.com",
        password: "QueueStrong123!"
      },
      query: new URLSearchParams(),
      headers: {}
    },
    restoredLoginResponse as never
  );

  assert.equal(restoredLoginResponse.getStatusCode(), 200);

  const selfDeactivateResponse = createMockResponse();
  await authController.handle(
    {
      method: "POST",
      path: "/api/ops/accounts/access",
      body: {
        opsUserId: admin.user.id,
        action: "deactivate"
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${admin.session.token}`
      }
    },
    selfDeactivateResponse as never
  ).catch((error: Error) => {
    selfDeactivateResponse.writeHead(400);
    selfDeactivateResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(selfDeactivateResponse.getStatusCode(), 400);
  assert.match(selfDeactivateResponse.readJson().message, /your own active ops login/i);
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

test("direct email inbound endpoint can derive idempotency from message id and honor reply-to metadata", async () => {
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
          messageId: "<email_msg_999@example.com>",
          threadId: "thread_999",
          senderEmail: "\"Jamie Homeowner\" <forwarder@example.com>",
          replyToEmail: "Jamie Homeowner <jamie.homeowner@example.com>",
          subject: "Question about mowing",
          textBody: "Can you help with mowing in Barnegat?"
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
    assert.equal(firstLead.sourceReferenceId, "email_msg_999@example.com");
    assert.equal(firstLead.email, "jamie.homeowner@example.com");
    assert.equal(firstLead.contactName, "Jamie Homeowner");
    assert.equal(firstLead.channelMetadata?.emailMessageId, "email_msg_999@example.com");
    assert.equal(firstLead.channelMetadata?.emailThreadId, "thread_999");
    assert.equal(firstLead.channelMetadata?.replyToEmail, "jamie.homeowner@example.com");
    assert.equal(firstLead.channelMetadata?.replyToName, "Jamie Homeowner");
    assert.ok(
      firstLead.channelMetadata?.intakeNotes?.some((note: string) =>
        /sourceReferenceId was derived from the inbound email message id/i.test(note)
      )
    );

    const retryResponse = createMockResponse();
    await supportController.handle(
      {
        method: "POST",
        path: "/api/launch/inbound/email",
        body: {
          messageId: "<email_msg_999@example.com>",
          senderEmail: "forwarder@example.com",
          replyToEmail: "jamie.homeowner@example.com",
          subject: "Question about mowing",
          textBody: "Can you help with mowing in Barnegat?"
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

test("direct email inbound endpoint accepts relay-style alias fields and html-only bodies", async () => {
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
          from: "\"Pat Homeowner\" <forwarder@example.com>",
          reply_to: "Pat Homeowner <pat.homeowner@example.com>",
          "message-id": "<relay_msg_123@example.com>",
          "in-reply-to": "<thread_parent_555@example.com>",
          subject: "Need cleanup help",
          html: "<p>Hello GreenRain,</p><p>Can you text me at <strong>(609) 555-0199</strong> about a yard cleanup in Barnegat?</p>"
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
    assert.equal(lead.sourceReferenceId, "relay_msg_123@example.com");
    assert.equal(lead.email, "pat.homeowner@example.com");
    assert.equal(lead.contactName, "Pat Homeowner");
    assert.equal(lead.phone, "6095550199");
    assert.equal(lead.preferredContactMethod, "text");
    assert.equal(lead.areaLabel, "Barnegat, NJ");
    assert.equal(lead.serviceCategory, "seasonal-cleanup");
    assert.equal(lead.channelMetadata?.emailThreadId, "thread_parent_555@example.com");
    assert.ok(
      lead.channelMetadata?.intakeNotes?.some((note: string) =>
        /normalized from HTML/i.test(note)
      )
    );
    assert.match(lead.message, /yard cleanup in Barnegat/i);
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
  const opsUser = await createOpsSession(authController, platform, {
    email: "ops-review-handler@example.com",
    phone: "555-0332"
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

  const invalidResponse = createMockResponse();
  await marketplaceController.handle(
    {
      method: "POST",
      path: "/api/providers/reviews/response",
      body: {
        reviewId: review.id,
        responseStatus: "posted",
        responseHandledBy: "Casey Ops",
        publicReplyBody:
          "Thank you for the feedback. We appreciate the note about the finish details and are using it to keep the next visit tighter."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${opsUser.session.token}`
      }
    },
    invalidResponse as never
  ).catch((error: Error) => {
    invalidResponse.writeHead(400);
    invalidResponse.end(JSON.stringify({ message: error.message }));
  });

  assert.equal(invalidResponse.getStatusCode(), 400);
  assert.match(invalidResponse.readJson().message, /choose where the public reply was posted/i);

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
        responseChannel: "google-business-profile",
        externalResponseId: "gbp_reply_123",
        publicResponseUrl: "https://business.google.com/reviews/reply/gbp_reply_123",
        publicReplyBody:
          "Thank you for the feedback. We appreciate the note about the finish details and are using it to keep the next visit tighter."
      },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${opsUser.session.token}`
      }
    },
    response as never
  );

  assert.equal(response.getStatusCode(), 200);
  const updatedReview = response.readJson();
  assert.equal(updatedReview.responseStatus, "posted");
  assert.equal(updatedReview.responseHandledBy, "Casey Ops");
  assert.equal(updatedReview.responseChannel, "google-business-profile");
  assert.equal(updatedReview.externalResponseId, "gbp_reply_123");
  assert.equal(
    updatedReview.publicResponseUrl,
    "https://business.google.com/reviews/reply/gbp_reply_123"
  );
  assert.match(updatedReview.publicReplyBody, /finish details/i);
});

test("shared inbox inbound review response endpoint is secret-protected, normalizes relay fields, and is idempotent", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const marketplaceController = new MarketplaceController(platform);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const customer = await platform.registerUser({
    fullName: "Inbound Reply Reviewer",
    email: "inbound-review-route@example.com",
    password: "Password123!",
    phone: "555-0334",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress()
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: "booking-inbound-review-route",
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
    notes: "Completed booking for inbound review response route test",
    totalCents: 6200
  });

  await repository.createReviewInvite({
    id: "invite-inbound-review-route",
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
    overallRating: 4,
    timelinessRating: 4,
    attentionToDetailRating: 4,
    reviewText: "Solid visit overall."
  });

  const previousSecret = process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
  process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = "review-secret";

  try {
    const unauthorizedResponse = createMockResponse();
    await marketplaceController.handle(
      {
        method: "POST",
        path: "/api/providers/reviews/response/inbound/shared-inbox",
        body: {
          reviewId: review.id,
          "message-id": "<reply_msg_123>",
          text: "Thank you for the feedback. We appreciate the note and are following up directly."
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
    await marketplaceController.handle(
      {
        method: "POST",
        path: "/api/providers/reviews/response/inbound/shared-inbox",
        body: {
          "review-id": review.id,
          handled_by: "Shared inbox automation",
          notes: "Posted from the shared inbox relay.",
          "message-id": "<reply_msg_123>",
          "thread-id": "<thread_123>",
          "thread-url": "https://inbox.example.com/threads/thread_123",
          mailbox: "GreenRain Reviews",
          from: "reviews@greenrain.example",
          reply_url: "https://reviews.example.com/replies/reply_msg_123",
          text: "Thank you for the feedback. We appreciate the note and are following up directly."
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-review-response-secret": "review-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const postedReview = response.readJson();
    assert.equal(postedReview.responseStatus, "posted");
    assert.equal(postedReview.responseChannel, "shared-inbox");
    assert.equal(postedReview.externalResponseId, "reply_msg_123");
    assert.equal(postedReview.responseChannelMetadata?.emailMessageId, "reply_msg_123");
    assert.equal(postedReview.responseChannelMetadata?.emailThreadId, "thread_123");
    assert.equal(
      postedReview.responseChannelMetadata?.threadUrl,
      "https://inbox.example.com/threads/thread_123"
    );
    assert.equal(postedReview.responseChannelMetadata?.mailboxName, "GreenRain Reviews");
    assert.equal(postedReview.responseChannelMetadata?.senderEmail, "reviews@greenrain.example");
    assert.ok(
      postedReview.responseChannelMetadata?.intakeNotes?.some((note: string) =>
        /derived from the shared inbox message id/i.test(note)
      )
    );

    const retryResponse = createMockResponse();
    await marketplaceController.handle(
      {
        method: "POST",
        path: "/api/providers/reviews/response/inbound/shared-inbox",
        body: {
          reviewId: review.id,
          responseHandledBy: "Shared inbox automation",
          responseNotes: "Posted from the shared inbox relay.",
          messageId: "<reply_msg_123>",
          threadId: "<thread_123>",
          publicResponseUrl: "https://reviews.example.com/replies/reply_msg_123",
          publicReplyBody: "Thank you for the feedback. We appreciate the note and are following up directly."
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-review-response-secret": "review-secret"
        }
      },
      retryResponse as never
    );

    assert.equal(retryResponse.getStatusCode(), 201);
    const retriedReview = retryResponse.readJson();
    assert.equal(retriedReview.responseStatus, "posted");
    assert.equal(retriedReview.externalResponseId, "reply_msg_123");
    assert.equal(retriedReview.responseChannelMetadata?.emailThreadId, "thread_123");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = previousSecret;
    }
  }
});

test("google business profile inbound review response endpoint records reply metadata", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const marketplaceController = new MarketplaceController(platform);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const customer = await platform.registerUser({
    fullName: "GBP Reply Reviewer",
    email: "inbound-gbp-review-route@example.com",
    password: "Password123!",
    phone: "555-0335",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress()
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: "booking-inbound-gbp-review-route",
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
    notes: "Completed booking for GBP inbound review response route test",
    totalCents: 7400
  });

  await repository.createReviewInvite({
    id: "invite-inbound-gbp-review-route",
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
    overallRating: 5,
    timelinessRating: 5,
    attentionToDetailRating: 5,
    reviewText: "Great cleanup and easy follow-up."
  });

  const previousSecret = process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
  process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = "review-secret";

  try {
    const response = createMockResponse();
    await marketplaceController.handle(
      {
        method: "POST",
        path: "/api/providers/reviews/response/inbound/google-business-profile",
        body: {
          "review-id": review.id,
          "reply-id": "gbp_reply_777",
          "thread-url": "https://business.google.com/reviews/reply/gbp_reply_777",
          "location-name": "GreenRain Barnegat",
          text: "Thank you for the kind words. We appreciate you trusting GreenRain with the cleanup.",
          reply_url: "https://business.google.com/reviews/reply/gbp_reply_777"
        },
        query: new URLSearchParams(),
        headers: {
          "x-yardmatch-review-response-secret": "review-secret"
        }
      },
      response as never
    );

    assert.equal(response.getStatusCode(), 201);
    const postedReview = response.readJson();
    assert.equal(postedReview.responseStatus, "posted");
    assert.equal(postedReview.responseChannel, "google-business-profile");
    assert.equal(postedReview.externalResponseId, "gbp_reply_777");
    assert.equal(
      postedReview.responseChannelMetadata?.threadUrl,
      "https://business.google.com/reviews/reply/gbp_reply_777"
    );
    assert.equal(
      postedReview.responseChannelMetadata?.profileLocationName,
      "GreenRain Barnegat"
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = previousSecret;
    }
  }
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
  const opsUser = await createOpsSession(authController, platform, {
    email: "ops-review-escalation-handler@example.com",
    phone: "555-03025"
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
        authorization: `Bearer ${opsUser.session.token}`
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

test("ops overview route requires an ops session", async () => {
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
  ).catch((error: Error) => {
    providerResponse.writeHead(403);
    providerResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(providerResponse.getStatusCode(), 403);

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

  const tasksForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/launch-operations/tasks",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    tasksForbiddenResponse as never
  ).catch((error: Error) => {
    tasksForbiddenResponse.writeHead(403);
    tasksForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(tasksForbiddenResponse.getStatusCode(), 403);

  const tasksOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/launch-operations/tasks",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    tasksOpsResponse as never
  );
  assert.equal(tasksOpsResponse.getStatusCode(), 200);
  assert.deepEqual(tasksOpsResponse.readJson().tasks, []);

  const taskNotifyForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/launch-operations/tasks/notify-due",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    taskNotifyForbiddenResponse as never
  ).catch((error: Error) => {
    taskNotifyForbiddenResponse.writeHead(403);
    taskNotifyForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(taskNotifyForbiddenResponse.getStatusCode(), 403);

  const taskNotifyOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/launch-operations/tasks/notify-due",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    taskNotifyOpsResponse as never
  );
  assert.equal(taskNotifyOpsResponse.getStatusCode(), 200);
  assert.equal(taskNotifyOpsResponse.readJson().taskCount, 0);

  const taskEscalationForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/launch-operations/tasks/escalate-overdue",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    taskEscalationForbiddenResponse as never
  ).catch((error: Error) => {
    taskEscalationForbiddenResponse.writeHead(403);
    taskEscalationForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(taskEscalationForbiddenResponse.getStatusCode(), 403);

  const taskEscalationOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/launch-operations/tasks/escalate-overdue",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    taskEscalationOpsResponse as never
  );
  assert.equal(taskEscalationOpsResponse.getStatusCode(), 200);
  assert.equal(taskEscalationOpsResponse.readJson().taskCount, 0);

  const opsAutomationForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/ops-automation/run-due",
      body: { dryRun: true },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    opsAutomationForbiddenResponse as never
  ).catch((error: Error) => {
    opsAutomationForbiddenResponse.writeHead(403);
    opsAutomationForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(opsAutomationForbiddenResponse.getStatusCode(), 403);

  const opsAutomationOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/ops-automation/run-due",
      body: { sweepKeys: ["support-ticket-escalations"], dryRun: true },
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    opsAutomationOpsResponse as never
  );
  assert.equal(opsAutomationOpsResponse.getStatusCode(), 200);
  assert.equal(opsAutomationOpsResponse.readJson().requestedSweepCount, 1);

  const opsAutomationRunsForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/ops-automation/runs",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    opsAutomationRunsForbiddenResponse as never
  ).catch((error: Error) => {
    opsAutomationRunsForbiddenResponse.writeHead(403);
    opsAutomationRunsForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(opsAutomationRunsForbiddenResponse.getStatusCode(), 403);

  const opsAutomationRunsOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "GET",
      path: "/api/observability/ops-automation/runs",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    opsAutomationRunsOpsResponse as never
  );
  assert.equal(opsAutomationRunsOpsResponse.getStatusCode(), 200);
  assert.equal(opsAutomationRunsOpsResponse.readJson().runs.length, 1);

  const escalateForbiddenResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/inbound-automation/escalate",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    escalateForbiddenResponse as never
  ).catch((error: Error) => {
    escalateForbiddenResponse.writeHead(403);
    escalateForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(escalateForbiddenResponse.getStatusCode(), 403);

  const escalateOpsResponse = createMockResponse();
  await observabilityController.handle(
    {
      method: "POST",
      path: "/api/observability/inbound-automation/escalate",
      body: undefined,
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    escalateOpsResponse as never
  );
  assert.equal(escalateOpsResponse.getStatusCode(), 200);
});

test("support ops routes require an ops session", async () => {
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
  ).catch((error: Error) => {
    providerResponse.writeHead(403);
    providerResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(providerResponse.getStatusCode(), 403);

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

  const escalationForbiddenResponse = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/ops/tickets/escalate-stale",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${customer.session.token}`
      }
    },
    escalationForbiddenResponse as never
  ).catch((error: Error) => {
    escalationForbiddenResponse.writeHead(403);
    escalationForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(escalationForbiddenResponse.getStatusCode(), 403);

  const providerEscalationForbiddenResponse = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/ops/tickets/escalate-stale",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${provider.session.token}`
      }
    },
    providerEscalationForbiddenResponse as never
  ).catch((error: Error) => {
    providerEscalationForbiddenResponse.writeHead(403);
    providerEscalationForbiddenResponse.end(JSON.stringify({ message: error.message }));
  });
  assert.equal(providerEscalationForbiddenResponse.getStatusCode(), 403);

  const escalationOpsResponse = createMockResponse();
  await supportController.handle(
    {
      method: "POST",
      path: "/api/support/ops/tickets/escalate-stale",
      body: {},
      query: new URLSearchParams(),
      headers: {
        authorization: `Bearer ${ops.session.token}`
      }
    },
    escalationOpsResponse as never
  );
  assert.equal(escalationOpsResponse.getStatusCode(), 200);
  assert.equal(escalationOpsResponse.readJson().ticketCount, 0);
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
