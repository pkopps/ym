import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import test from "node:test";
import { resolveRequestId, sendErrorJson } from "../src/http";
import {
  ApiRuntimeObservability,
  OVERFLOW_ROUTE_LABEL,
  UNMATCHED_ROUTE_LABEL,
  normalizeRouteLabel
} from "../src/observability/ApiRuntimeObservability";

function captureLogs() {
  const warnings: string[] = [];
  const errors: string[] = [];
  return {
    warnings,
    errors,
    sink: { warn: (message: string) => warnings.push(message), error: (message: string) => errors.push(message) }
  };
}

class FakeResponse extends EventEmitter {
  public headersSent = false;
  public writableEnded = false;
  public destroyed = false;
  public statusCode = 200;
  public body = "";
  private readonly headers = new Map<string, unknown>();
  public hasHeader(name: string) { return this.headers.has(name.toLowerCase()); }
  public getHeader(name: string) { return this.headers.get(name.toLowerCase()); }
  public setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); }
  public writeHead(statusCode: number) {
    if (this.headersSent) throw new Error("ERR_HTTP_HEADERS_SENT");
    this.statusCode = statusCode;
    this.headersSent = true;
  }
  public end(payload = "") { this.body += payload; this.writableEnded = true; }
  public destroy() { this.destroyed = true; }
}

test("route labels collapse IDs and tokens so metrics stay low-cardinality", () => {
  assert.equal(normalizeRouteLabel("/api/bookings"), "/api/bookings");
  assert.equal(normalizeRouteLabel("/api/ops/pricing/minimums"), "/api/ops/pricing/minimums");
  assert.equal(
    normalizeRouteLabel("/api/media/evidence/3f2a9c1e-8b7d-4e6f-9a0b-1c2d3e4f5a6b"),
    "/api/media/evidence/:id"
  );
  assert.equal(normalizeRouteLabel("/api/media/marketing/photo_8F3kq92LmZpQ7xYt"), "/api/media/marketing/:id");
  assert.equal(normalizeRouteLabel("/api/items/12345?x=1"), "/api/items/:id");
  assert.equal(normalizeRouteLabel("/api/customers/review-opportunities"), "/api/customers/review-opportunities");
});

test("route metrics are bounded even under scanner traffic", () => {
  const logs = captureLogs();
  const runtime = new ApiRuntimeObservability({ logSink: logs.sink });
  runtime.recordRequest({ requestId: "unmatched", method: "GET", route: UNMATCHED_ROUTE_LABEL, statusCode: 404, durationMs: 1 });
  runtime.recordRequest({ requestId: "bad-method", method: "M-SEARCH-WITH-LONG-NAME", route: "/", statusCode: 404, durationMs: 1 });
  for (let index = 0; index < 500; index += 1) {
    runtime.recordRequest({
      requestId: `probe-${index}`,
      method: "GET",
      route: `/probe/${index}a/admin.php`,
      statusCode: 404,
      durationMs: 1
    });
  }

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.requestCount, 502);
  // The internal map is capped; overflow traffic is still counted under one label.
  const internalRoutes = (runtime as unknown as { routes: Map<string, unknown> }).routes;
  // 200 tracked routes plus one overflow bucket per method seen after the cap.
  assert.ok(internalRoutes.size <= 201, `expected bounded routes, got ${internalRoutes.size}`);
  assert.ok(internalRoutes.has(`GET ${UNMATCHED_ROUTE_LABEL}`));
  assert.ok(internalRoutes.has(`GET ${OVERFLOW_ROUTE_LABEL}`));
  assert.ok(internalRoutes.has("OTHER /"));
});

test("background job failures raise an alert and log with throttling and redaction", () => {
  const logs = captureLogs();
  const runtime = new ApiRuntimeObservability({ logSink: logs.sink });
  const failure = new Error("Delivery to jane@example.com failed: Bearer sk_live_abc123");
  failure.name = "NotificationSweepError";

  for (let index = 0; index < 30; index += 1) {
    runtime.recordBackgroundFailure("notification-delivery", failure);
  }

  assert.equal(logs.errors.length, 1, "repeated failures inside the window are logged once");
  const logged = JSON.parse(logs.errors[0] ?? "{}") as Record<string, unknown>;
  assert.equal(logged.event, "api_background_job_failed");
  assert.equal(logged.job, "notification-delivery");
  assert.equal(logged.errorType, "NotificationSweepError");
  assert.equal(String(logged.errorMessage).includes("jane@example.com"), false);
  assert.equal(String(logged.errorMessage).includes("sk_live_abc123"), false);

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.status, "critical");
  assert.ok(snapshot.alerts.some((alert) => alert.title === "Background job failures detected" && alert.detail.startsWith("30 ")));
  assert.equal(snapshot.errorCountsByType.NotificationSweepError, 30);
  assert.equal(snapshot.recentFailures.filter((item) => item.method === "JOB").length, 1);
  assert.equal(snapshot.requestCount, 0, "background failures do not inflate request metrics");
});

test("error responses never write headers twice", () => {
  const fresh = new FakeResponse();
  assert.equal(sendErrorJson(fresh as unknown as ServerResponse, 500, { message: "boom" }), true);
  assert.equal(fresh.statusCode, 500);
  assert.match(fresh.body, /boom/);

  const partial = new FakeResponse();
  partial.writeHead(200);
  assert.doesNotThrow(() => sendErrorJson(partial as unknown as ServerResponse, 500, { message: "late" }));
  assert.equal(partial.destroyed, true, "a half-written response is aborted instead of corrupted");
  assert.equal(partial.body.includes("late"), false);

  const finished = new FakeResponse();
  finished.writeHead(200);
  finished.end("{}");
  assert.equal(sendErrorJson(finished as unknown as ServerResponse, 500, { message: "late" }), false);
  assert.equal(finished.destroyed, false);
});

test("request IDs reuse a well-formed upstream ID and reject unsafe ones", () => {
  assert.equal(resolveRequestId({ "x-request-id": "web-1a2b3c4d5e" }), "web-1a2b3c4d5e");
  const generated = resolveRequestId({ "x-request-id": "bad id\nwith newline" });
  assert.match(generated, /^[0-9a-f-]{36}$/);
  assert.match(resolveRequestId({}), /^[0-9a-f-]{36}$/);
  assert.match(resolveRequestId({ "x-request-id": "short" }), /^[0-9a-f-]{36}$/);
});
