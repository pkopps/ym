// Regression coverage for the bot army findings of November 16, 2026 (reports/explorer/summary-2026-11-16.md).
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { BookingEvidenceEntry } from "@yardmatch/contracts";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ role: "customer", fullName: "Guard Customer", email: `${randomUUID()}@example.invalid`, address: provider.address, propertyLabel: "Home" });
  const other = await platform.registerUser({ role: "customer", fullName: "Other Customer", email: `${randomUUID()}@example.invalid`, address: provider.address, propertyLabel: "Home" });
  // One clock for the fixture, so two identical submissions carry identical times.
  const startedAt = Date.now();
  const at = (hours: number) => new Date(startedAt + hours * 3_600_000).toISOString();
  const book = (owner: typeof customer, startHours: number, extra: { requestId?: string } = {}) => createWorkflowBooking(platform, repository, owner.id, {
    providerId: provider.id, serviceAddress: owner.properties[0]!.address, servicePropertyId: owner.properties[0]!.id, category: "lawn-mowing",
    scheduledStartIso: at(startHours), scheduledEndIso: at(startHours + 1), notes: "", totalCents: 6_000, ...extra
  });
  return { repository, platform, provider, customer, other, book };
}

const photo = (phase: BookingEvidenceEntry["phase"], providerId: string): BookingEvidenceEntry => ({
  id: randomUUID(), phase, evidenceType: "photo", capturedByRole: "provider", capturedByUserId: providerId, capturedAt: new Date().toISOString()
} as BookingEvidenceEntry);

test("a provider confirm racing the owner's cancel never leaves a cancelled visit confirmed", async () => {
  for (let round = 0; round < 10; round += 1) {
    const f = await fixture();
    const booking = await f.book(f.customer, 50);
    const [confirmed, cancelled] = await Promise.allSettled([
      f.platform.confirmBooking(f.provider.id, { bookingId: booking.id }),
      f.platform.cancelBooking(f.customer.id, { bookingId: booking.id })
    ]);
    const final = (await f.repository.findBookingById(booking.id))!;
    if (cancelled.status === "fulfilled") assert.equal(final.status, "cancelled", `round ${round}: the owner's cancel succeeded, so the visit stays cancelled`);
    else assert.equal(confirmed.status, "fulfilled");
  }
});

test("two owners cannot hold the same provider time, at once or one after the other", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([f.book(f.customer, 60), f.book(f.other, 60)]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  await assert.rejects(f.book(f.other, 60.5), /no longer open with this provider/);
  // A different hour is fine.
  assert.ok(await f.book(f.other, 62));
});

test("a confirm rechecks overlap but not against the visit itself", async () => {
  const f = await fixture();
  const booking = await f.book(f.customer, 70);
  assert.equal((await f.platform.confirmBooking(f.provider.id, { bookingId: booking.id })).status, "confirmed");
});

test("a double-tapped submit with one request id returns the first booking", async () => {
  const f = await fixture();
  const requestId = `guard-${randomUUID()}`;
  const [first, second] = await Promise.all([f.book(f.customer, 80, { requestId }), f.book(f.customer, 80, { requestId })]);
  assert.equal(first.id, second.id);
});

test("accepting crew beyond what the job needs is refused", async () => {
  const f = await fixture();
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "review-first" });
  const crew = await Promise.all([0, 1].map(index => f.platform.registerUser({
    role: "crew-member", fullName: `Guard Crew ${index}`, email: `${randomUUID()}@example.invalid`, address: f.provider.address,
    categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 60
  })));
  const booking = await f.book(f.customer, 90);
  const overview = await f.platform.getProviderStaffingOverview(f.provider.id);
  const job = overview.jobs.find(item => item.bookingId === booking.id)!;
  assert.equal(job.requiredCrewMembers, 1);
  const pending = job.matches.filter(match => crew.some(member => member.id === match.crewMemberId) && match.status === "pending-provider-review");
  assert.equal(pending.length, 2);
  const results = await Promise.allSettled(pending.map(match => f.platform.reviewCrewMatch(f.provider.id, { crewMatchId: match.id, action: "accept" })));
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  assert.match(String((results.find(item => item.status === "rejected") as PromiseRejectedResult).reason), /already has the crew it needs/);
  assert.equal((await f.repository.listCrewMatchesForBookings([booking.id])).filter(match => match.status === "accepted").length, 1);
});

test("route, work start and completion open three hours before the visit", async () => {
  const f = await fixture();
  const booking = await f.book(f.customer, 30);
  await f.platform.confirmBooking(f.provider.id, { bookingId: booking.id });
  const providerActor = { userId: f.provider.id, email: f.provider.email, role: "provider" as const };
  await assert.rejects(f.platform.markBookingOnRoute(providerActor, { bookingId: booking.id }), /You can start the route from/);
  await f.repository.updateBooking(booking.id, { serviceEvidence: [photo("after", f.provider.id)] });
  await assert.rejects(f.platform.completeBooking(f.provider.id, { bookingId: booking.id }), /You can mark it complete from/);
  assert.equal((await f.repository.findBookingById(booking.id))!.status, "confirmed");

  await f.repository.updateBooking(booking.id, { scheduledStartIso: future(2), scheduledEndIso: future(3) });
  assert.ok((await f.platform.markBookingOnRoute(providerActor, { bookingId: booking.id })).onRouteConfirmedAt);
});

test("completion keeps no live GPS position", async () => {
  const f = await fixture();
  const booking = await f.book(f.customer, 1);
  await f.platform.confirmBooking(f.provider.id, { bookingId: booking.id });
  await f.repository.updateBooking(booking.id, {
    status: "in-progress", onRouteConfirmedAt: new Date().toISOString(), routeLivePoint: { latitude: 40, longitude: -74 },
    routeLiveUpdatedAt: new Date().toISOString(), routeLiveSpeedMph: 20, serviceEvidence: [photo("before", f.provider.id), photo("after", f.provider.id)]
  });
  const completed = await f.platform.completeBooking(f.provider.id, { bookingId: booking.id });
  assert.equal(completed.status, "completed");
  assert.equal((await f.repository.findBookingById(booking.id))!.routeLivePoint, undefined);
});

test("missing or unauthorized completion is a client error, not a server error", async () => {
  const f = await fixture();
  await assert.rejects(f.platform.completeBooking(f.provider.id, { bookingId: "missing" }), (error: { statusCode?: number }) => error.statusCode === 404);
  const booking = await f.book(f.customer, 40);
  await assert.rejects(f.platform.completeBooking("someone-else", { bookingId: booking.id }), (error: { statusCode?: number }) => error.statusCode === 403);
});

test("asking for another reset code within a minute says to wait, the same for any email", async () => {
  const f = await fixture();
  await f.repository.updateAuthIdentity(f.customer.id, { passwordHash: "x" });
  const first = await f.platform.requestPasswordReset({ email: f.customer.email });
  assert.ok(first.resetCodePreview);
  const again = await f.platform.requestPasswordReset({ email: f.customer.email });
  assert.equal(again.resetCodePreview, undefined);
  assert.match(again.message, /Wait a minute/);
  const nobody = "nobody-guard@example.invalid";
  await f.platform.requestPasswordReset({ email: nobody });
  assert.equal((await f.platform.requestPasswordReset({ email: nobody })).message, again.message);
});

test("a used reset code says it was already used", async () => {
  const f = await fixture();
  await f.repository.updateAuthIdentity(f.customer.id, { passwordHash: "x" });
  const { resetCodePreview } = await f.platform.requestPasswordReset({ email: f.customer.email });
  await f.platform.confirmPasswordReset({ email: f.customer.email, resetCode: resetCodePreview!, newPassword: "Guard-Reset-1a" });
  await assert.rejects(f.platform.confirmPasswordReset({ email: f.customer.email, resetCode: resetCodePreview!, newPassword: "Guard-Reset-2b" }), /already used or has expired/);
});
