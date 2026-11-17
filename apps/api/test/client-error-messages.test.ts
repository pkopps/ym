import assert from "node:assert/strict";
import test from "node:test";
import { MarketplaceApiClient, MarketplaceApiError, MarketplaceApiNetworkError, MarketplaceApiTimeoutError } from "@yardmatch/contracts";

function clientReturning(response: () => Response | Promise<Response>, locale?: string) {
  const client = new MarketplaceApiClient("http://yardmatch.test", {
    requestTimeoutMs: 20,
    fetchImpl: (async () => response()) as typeof fetch
  });
  client.setLocale(locale);
  return client;
}

function json(status: number, body: unknown, requestId = "req-12345678") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId }
  });
}

async function failureOf(promise: Promise<unknown>): Promise<MarketplaceApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof MarketplaceApiError || error instanceof MarketplaceApiTimeoutError, String(error));
    return error as MarketplaceApiError;
  }
  throw new Error("expected the request to fail");
}

test("server errors show a friendly message with a support reference, never internal wording", async () => {
  const error = await failureOf(clientReturning(() => json(500, { message: "Payment record could not be updated" })).searchPlaces("Barnegat"));
  assert.equal(error.kind, "server");
  assert.equal(error.retryable, true);
  assert.match(error.message, /Something went wrong on our end/);
  assert.match(error.message, /Reference: req-12345678/);
  assert.doesNotMatch(error.message, /Payment record/);
});

test("gateway pages and outages say YardMatch is temporarily unavailable", async () => {
  const gateway = await failureOf(clientReturning(() => new Response("<html>Bad gateway</html>", { status: 502 })).searchPlaces("Barnegat"));
  assert.equal(gateway.kind, "unavailable");
  assert.match(gateway.message, /temporarily unavailable/);
  assert.doesNotMatch(gateway.message, /status|html|\/api\//i);

  const htmlOk = await failureOf(clientReturning(() => new Response("<html>Maintenance</html>", { status: 200 })).searchPlaces("Barnegat"));
  assert.equal(htmlOk.kind, "unavailable");

  const busy = await failureOf(clientReturning(() => json(503, { message: "The service is busy. Please try again shortly." })).searchPlaces("Barnegat"));
  assert.match(busy.message, /service is busy/, "specific API guidance is kept");
});

test("validation messages stay readable and carry no reference noise", async () => {
  const error = await failureOf(clientReturning(() => json(400, { message: "Choose a valid availability range of up to 31 days." })).searchPlaces("x"));
  assert.equal(error.message, "Choose a valid availability range of up to 31 days.");
  assert.equal(error.kind, "request");
  assert.equal(error.retryable, false);
  assert.equal(error.requestId, "req-12345678", "the reference is still available for logging");

  const bare = await failureOf(clientReturning(() => new Response("", { status: 404 })).searchPlaces("x"));
  assert.equal(bare.message, "We couldn't complete that request. Please try again.");
});

test("rate limits and expired sessions get specific guidance", async () => {
  const limited = await failureOf(clientReturning(() => new Response("", { status: 429 })).searchPlaces("x"));
  assert.equal(limited.kind, "rate-limited");
  assert.match(limited.message, /Too many attempts/);

  const expired = await failureOf(clientReturning(() => new Response("", { status: 401 })).searchPlaces("x"));
  assert.equal(expired.kind, "session-expired");
  assert.match(expired.message, /sign in again/);

  const wrongPassword = await failureOf(clientReturning(() => json(401, { message: "Invalid email or password" })).login({ email: "a@b.c", password: "x" } as never));
  assert.equal(wrongPassword.message, "Invalid email or password");
});

test("network failures explain the connection problem instead of 'Failed to fetch'", async () => {
  const client = new MarketplaceApiClient("http://yardmatch.test", {
    fetchImpl: (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch
  });
  const error = await failureOf(client.searchPlaces("Barnegat"));
  assert.ok(error instanceof MarketplaceApiNetworkError);
  assert.equal(error.kind, "network");
  assert.match(error.message, /couldn't reach YardMatch/);
  assert.doesNotMatch(error.message, /Failed to fetch/);

  client.setLocale("es");
  assert.match((await failureOf(client.searchPlaces("Barnegat"))).message, /No pudimos conectar/);
});

test("timeouts on changes warn that the change may already be saved", async () => {
  const hanging = () => new Promise<Response>(() => undefined);
  const client = clientReturning(hanging);
  const read = await failureOf(client.searchPlaces("Barnegat"));
  assert.doesNotMatch(read.message, /refresh/);
  const write = await failureOf(client.login({ email: "a@b.c", password: "x" } as never));
  assert.match(write.message, /taking longer than expected/);
  assert.match(write.message, /refresh to check whether it went through/);
});

test("spanish locale localizes client-generated messages", async () => {
  const error = await failureOf(clientReturning(() => new Response("", { status: 503 }), "es").searchPlaces("x"));
  assert.match(error.message, /no esta disponible temporalmente/);
});
