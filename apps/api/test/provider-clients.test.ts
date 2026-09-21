import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Booking, RecurringServicePlan } from "@yardmatch/contracts";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { buildProviderClientProperties } from "../src/services/providerClients";

const address: Address = { line1: "12 Oak Lane", city: "Barnegat", state: "NJ", postalCode: "08005", country: "US", point: { latitude: 39.758, longitude: -74.231 } };
function booking(id: string, changes: Partial<Booking> = {}): Booking {
  return { id, customerId: "customer", providerId: "provider", serviceAddress: address, category: "lawn-mowing", requestedAt: "2026-09-01T12:00:00Z", scheduledStartIso: "2026-09-22T12:00:00Z", scheduledEndIso: "2026-09-22T14:00:00Z", status: "confirmed", notes: "private notes", totalCents: 5000, serviceEvidence: [], interventions: [], addressChangeHistory: [], ...changes };
}
function plan(changes: Partial<RecurringServicePlan> = {}): RecurringServicePlan {
  return { id: "plan", customerId: "customer", providerId: "provider", serviceAddress: address, category: "lawn-mowing", frequency: "weekly", requestedAt: "2026-09-01T12:00:00Z", notes: "private", totalCents: 5000, status: "active", anchorScheduledStartIso: "2026-09-22T12:00:00Z", anchorScheduledEndIso: "2026-09-22T14:00:00Z", ...changes };
}
const now = Date.parse("2026-09-20T12:00:00Z");

test("client properties deduplicate history, preserve booked units and customers, and omit cancelled-only properties", () => {
  const rows = buildProviderClientProperties("provider", [
    booking("past", { status: "completed", scheduledStartIso: "2026-09-01T12:00:00Z", scheduledEndIso: "2026-09-01T14:00:00Z", completedAt: "2026-09-01T13:30:00Z" }),
    booking("next", { serviceAddress: { ...address, line1: " 12 OAK   Lane " } }),
    booking("unit", { serviceAddress: { ...address, line2: "Unit 2" } }),
    booking("other-customer", { customerId: "neighbor" }),
    booking("cancelled", { status: "cancelled", serviceAddress: { ...address, line1: "8 Pine Street" } }),
    booking("foreign", { providerId: "other-provider", serviceAddress: { ...address, line1: "Secret property" } })
  ], [], [plan()], now);
  assert.equal(rows.length, 3);
  const primary = rows.find((row) => row.id === "past")!;
  assert.equal(primary.completedVisitCount, 1);
  assert.equal(primary.lastCompletedAt, "2026-09-01T13:30:00Z");
  assert.equal(primary.recurring, true);
  assert.deepEqual(primary.upcomingVisits.map((visit) => visit.bookingId), ["next"]);
  assert.equal(rows.find((row) => row.id === "unit")?.recurring, false);
  assert.equal(rows.find((row) => row.id === "other-customer")?.recurring, false);
  assert.ok(!JSON.stringify(rows).includes("private"));
});

test("recurring status follows active owned plans at the booked address, never frequency guesses or old links", () => {
  const visits = [booking("repeat", { recurringPlanId: "plan" }), booking("repeat-again")];
  for (const inactive of [plan({ status: "cancelled" }), plan({ providerId: "foreign" }), plan({ serviceAddress: { ...address, line1: "Moved home" } })]) {
    assert.equal(buildProviderClientProperties("provider", visits, [], [inactive], now)[0]?.recurring, false);
  }
});

test("past clients remain visible, expired requests are not upcoming, and active work stays visible", () => {
  const rows = buildProviderClientProperties("provider", [
    booking("old-request", { scheduledStartIso: "2026-09-01T12:00:00Z", scheduledEndIso: "2026-09-01T14:00:00Z" }),
    booking("active", { status: "in-progress", scheduledStartIso: "2026-09-02T12:00:00Z", scheduledEndIso: "2026-09-02T14:00:00Z" }),
    booking("past-client", { status: "completed", customerId: "past", scheduledStartIso: "2026-09-01T12:00:00Z", scheduledEndIso: "2026-09-01T14:00:00Z" })
  ], [], [], now);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find((row) => row.id === "old-request")?.upcomingVisits.map((visit) => visit.bookingId), ["active"]);
  assert.equal(rows.find((row) => row.id === "past-client")?.upcomingVisits.length, 0);
});

test("provider clients loads every page and returns only owned booked addresses", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ fullName: "Map Client", email: "map-client@example.com", password: "Password123!", phone: "555-0149", role: "customer", address: { ...address, line1: "Unbooked home" } });
  for (let index = 0; index < 205; index++) {
    await repository.createBooking(booking(`map-${index}`, { providerId: provider.id, customerId: customer.id, serviceAddress: { ...address, line1: `${index} Oak Lane` } }));
  }
  await repository.createBooking(booking("someone-else", { providerId: "other", customerId: customer.id, serviceAddress: { ...address, line1: "Other business client" } }));
  const overview = await platform.getProviderClients(provider.id);
  assert.equal(overview.properties.length, 205);
  assert.ok(overview.properties.every((property) => property.customerName === "Map Client"));
  assert.ok(!JSON.stringify(overview).includes("Unbooked home"));
  assert.ok(!JSON.stringify(overview).includes("Other business client"));
  assert.ok(!JSON.stringify(overview).includes("map-client@example.com"));
});
