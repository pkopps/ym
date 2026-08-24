import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { AnalyticsEvent, Booking } from "@yardmatch/contracts";
import { ApiRuntimeObservability } from "../src/observability/ApiRuntimeObservability";
import {
  decodePageCursor,
  encodePageCursor,
  parsePaginationInput
} from "../src/pagination";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";

function makeBooking(id: string, customerId: string, dayOffset: number): Booking {
  const scheduledStartIso = new Date(Date.UTC(2026, 7, 23 + dayOffset, 14)).toISOString();
  return {
    id,
    customerId,
    providerId: "provider-pagination",
    serviceAddress: {
      line1: "1 Test Lane",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US"
    },
    category: "lawn-mowing",
    requestedAt: scheduledStartIso,
    scheduledStartIso,
    scheduledEndIso: new Date(new Date(scheduledStartIso).getTime() + 60 * 60 * 1000).toISOString(),
    status: "completed",
    completedAt: scheduledStartIso,
    notes: "Pagination regression fixture",
    totalCents: 5_000,
    serviceEvidence: [],
    interventions: [],
    addressChangeHistory: []
  };
}

test("booking history uses stable bounded cursor pages scoped to the authenticated actor", async () => {
  const repository = new InMemoryMarketplaceRepository();
  for (let index = 0; index < 45; index += 1) {
    await repository.createBooking(makeBooking(`booking-${String(index).padStart(2, "0")}`, "customer-a", index));
  }
  await repository.createBooking(makeBooking("booking-other", "customer-b", 100));

  const first = await repository.listBookingsPage({
    actorId: "customer-a",
    actorRole: "customer",
    scope: "history",
    limit: 20
  });
  assert.equal(first.items.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(first.items[0]?.id, "booking-44");

  const second = await repository.listBookingsPage({
    actorId: "customer-a",
    actorRole: "customer",
    scope: "history",
    limit: 20,
    cursorId: first.nextCursorId
  });
  assert.equal(second.items.length, 20);
  assert.equal(second.hasMore, true);
  assert.equal(new Set([...first.items, ...second.items].map((booking) => booking.id)).size, 40);

  const third = await repository.listBookingsPage({
    actorId: "customer-a",
    actorRole: "customer",
    scope: "history",
    limit: 20,
    cursorId: second.nextCursorId
  });
  assert.equal(third.items.length, 5);
  assert.equal(third.hasMore, false);
  assert.equal(third.items.some((booking) => booking.customerId !== "customer-a"), false);
});

test("pagination input bounds page size and keeps cursors opaque", () => {
  const cursor = encodePageCursor("booking-123");
  assert.notEqual(cursor, "booking-123");
  assert.equal(decodePageCursor(cursor), "booking-123");
  assert.equal(parsePaginationInput(new URLSearchParams("limit=100")).limit, 100);
  assert.throws(() => parsePaginationInput(new URLSearchParams("limit=101")), /between 1 and 100/);
  assert.throws(() => decodePageCursor("not-a-valid-cursor"), /invalid or expired/);
});

test("runtime observability classifies failures, slow requests, and emits privacy-safe structured logs", () => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const runtime = new ApiRuntimeObservability({
    slowRequestThresholdMs: 100,
    logSink: {
      warn: (message) => warnings.push(message),
      error: (message) => errors.push(message)
    }
  });

  runtime.recordRequest({
    requestId: "request-slow",
    method: "GET",
    route: "/api/bookings",
    statusCode: 200,
    durationMs: 125
  });
  runtime.recordRequest({
    requestId: "request-failed",
    method: "POST",
    route: "/api/payments/webhook",
    statusCode: 500,
    durationMs: 25,
    category: "server-error",
    errorType: "SettlementInvariantError",
    errorFrames: ["at settlement.ts:10:2"]
  });

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.requestCount, 2);
  assert.equal(snapshot.serverErrorCount, 1);
  assert.equal(snapshot.slowRequestCount, 1);
  assert.equal(snapshot.status, "critical");
  assert.equal(snapshot.recentFailures[0]?.requestId, "request-failed");
  assert.equal(snapshot.errorCountsByType.SettlementInvariantError, 1);
  assert.equal(warnings.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.includes("SettlementInvariantError"), true);
  assert.equal(errors[0]?.includes("customer"), false);
});

test("in-memory analytics retention is bounded", () => {
  const analytics = new DataEngineeringLogger(3);
  for (let index = 0; index < 5; index += 1) {
    analytics.record({
      id: `event-${index}`,
      name: "bounded_test",
      occurredAt: new Date().toISOString(),
      properties: { index }
    } satisfies AnalyticsEvent);
  }
  assert.deepEqual(analytics.listEvents().map((event) => event.id), ["event-2", "event-3", "event-4"]);
});
