import assert from "node:assert/strict";
import test from "node:test";
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
});
