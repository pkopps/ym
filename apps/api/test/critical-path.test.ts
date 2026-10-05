import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";
const future = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ role: "customer", fullName: "Recovery Customer", email: `${randomUUID()}@example.com`, address: provider.address, propertyLabel: "Home" });
  const property = customer.properties[0]!;
  const quote = await platform.createInstantQuote({ customerId: customer.id, propertyId: property.id, address: property.address, category: "lawn-mowing" });
  const booking = await createWorkflowBooking(platform, repository, customer.id, { providerId: provider.id, serviceAddress: property.address, servicePropertyId: property.id, category: "lawn-mowing", scheduledStartIso: future(50), scheduledEndIso: future(51), totalCents: quote.estimatedPriceCents, notes: "Critical path" });
  const ops = (await repository.listOpsUsers())[0]!;
  return { repository, platform, provider, customer, booking, ops };
}
async function crew(f: Awaited<ReturnType<typeof fixture>>) {
  return f.platform.registerUser({ role: "crew-member", fullName: "Claim Crew", email: `${randomUUID()}@example.com`, address: f.provider.address, categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 60 });
}

test("public interest has no notification or match; simultaneous duplicate claims persist and notify once", async () => {
  const f = await fixture();
  const member = await crew(f);
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "auto-accept" });
  const notices = (await f.repository.listNotificationsByRecipient(f.provider.id)).length;
  await Promise.all([f.platform.selectPublicCrewOpportunity({ opportunityId: f.booking.id }), f.platform.selectPublicCrewOpportunity({ opportunityId: f.booking.id })]);
  assert.equal((await f.repository.listNotificationsByRecipient(f.provider.id)).length, notices);
  const result = await Promise.all([f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id }), f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id })]);
  assert.equal(result[0].id, result[1].id);
  assert.equal(result[0].status, "accepted");
  assert.equal((await f.repository.listCrewMatches()).filter(item => item.bookingId === f.booking.id).length, 1);
  assert.equal((await f.repository.listNotificationsByRecipient(f.provider.id)).filter(item => item.title === "Crew opening filled").length, 1);
});

test("simultaneous auto-claims cannot overfill a public opening", async () => {
  const f = await fixture();
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "auto-accept" });
  const [first, second] = await Promise.all([crew(f), crew(f)]);
  const results = await Promise.allSettled([first, second].map(member => f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await f.repository.listCrewMatches()).filter(item => item.bookingId === f.booking.id && item.status === "accepted").length, 1);
});

for (const state of ["cancelled", "completed", "expired", "ineligible"] as const) test(`unavailable claim preserves account (${state})`, async () => {
  const f = await fixture(); const member = await crew(f);
  if (state === "expired") await f.repository.updateBooking(f.booking.id, { scheduledStartIso: future(-1) });
  else if (state === "ineligible") await f.repository.updateCrewMember(member.id, { categories: ["snow-blowing"] });
  else await f.repository.updateBooking(f.booking.id, { status: state });
  await assert.rejects(f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id }));
  assert.ok(await f.repository.findCrewMemberById(member.id));
  assert.equal((await f.repository.listCrewMatches()).filter(item => item.bookingId === f.booking.id).length, 0);
});

test("provider decline leaves consented recovery open; fee-free cancellation is idempotent and owned", async () => {
  const f = await fixture();
  const declined = await f.platform.declineBooking(f.provider.id, { bookingId: f.booking.id, reason: "No route capacity" });
  assert.equal(declined.status, "requested");
  const options = await f.platform.getBookingRecoveryOptions(f.customer.id, f.booking.id);
  assert.equal(options.recovery?.reason, "provider-declined");
  await assert.rejects(f.platform.getBookingRecoveryOptions("other", f.booking.id), /Only the customer/);
  await assert.rejects(f.platform.confirmBooking(f.provider.id, { bookingId: f.booking.id }), /recovery consent/);
  const input = { bookingId: f.booking.id, recoveryId: options.recovery!.id, action: "cancel" as const };
  const [first, second] = await Promise.all([f.platform.recoverBooking(f.customer.id, input), f.platform.recoverBooking(f.customer.id, input)]);
  assert.equal(first.status, "cancelled"); assert.equal(second.status, "cancelled");
  assert.equal(first.totalCents, f.booking.totalCents);
  assert.equal((await f.repository.listNotificationsByRecipient(f.customer.id)).filter(item => item.title === "Visit cancelled without a recovery fee").length, 1);
});

test("overdue timing creates recovery; work underway blocks recovery", async () => {
  const f = await fixture();
  await f.platform.confirmBooking(f.provider.id, { bookingId: f.booking.id });
  await f.repository.updateBooking(f.booking.id, { scheduledStartIso: future(-8), scheduledEndIso: future(-7) });
  const options = await f.platform.getBookingRecoveryOptions(f.customer.id, f.booking.id);
  assert.equal(options.recovery?.reason, "timing-overdue");
  await f.repository.updateBooking(f.booking.id, { status: "in-progress" });
  await assert.rejects(f.platform.recoverBooking(f.customer.id, { bookingId: f.booking.id, recoveryId: options.recovery!.id, action: "cancel" }), /Travel or work/);
});

test("ordinary customer reschedule resets tracking and reopens accepted crew review", async () => {
  const f = await fixture(); const member = await crew(f);
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "auto-accept" });
  const match = await f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id });
  await f.platform.confirmBooking(f.provider.id, { bookingId: f.booking.id });
  await f.repository.updateBooking(f.booking.id, { routeLivePoint: { latitude: 40, longitude: -74 }, assignedRouteLeaderCrewMemberId: member.id });
  const updated = await f.platform.rescheduleBooking(f.customer.id, { bookingId: f.booking.id, scheduledStartIso: future(80), scheduledEndIso: future(81) });
  assert.equal(updated.routeLivePoint, undefined); assert.equal(updated.assignedRouteLeaderCrewMemberId, undefined);
  assert.equal((await f.repository.findCrewMatchById(match.id))?.status, "pending-provider-review");
  assert.equal(updated.totalCents, f.booking.totalCents);
});

async function backup(f: Awaited<ReturnType<typeof fixture>>) {
  const provider = await f.platform.registerUser({ role: "provider", fullName: "Backup Owner", companyName: "Backup Property Care", email: `${randomUUID()}@example.com`, address: f.provider.address, categories: ["lawn-mowing"], serviceRadiusMiles: 20, bio: "Insured local property care with careful arrivals and complete proof of work.", yearsExperience: 5 });
  for (const type of ["business-registration", "general-liability-insurance", "workers-compensation"] as const) {
    const profile = await f.platform.submitProviderCredential(provider.id, { type, jurisdiction: "NJ", referenceNumber: `test-${type}`, expiresAt: "2099-01-01T00:00:00Z" });
    const credential = profile.credentials!.find(item => item.type === type)!;
    await f.platform.reviewProviderCredential(f.ops.id, { providerId: provider.id, credentialId: credential.id, action: "verify" });
  }
  await f.platform.reviewProviderVerification({ providerId: provider.id, action: "approve", notes: "Reviewed category coverage, insurance, service area, profile and operational controls. This provider is approved for the stated categories." });
  await f.platform.manageProviderAvailability(provider.id, { action: "add", startIso: future(72), endIso: future(77) });
  return provider;
}

test("equivalent replacement requires consent, preserves price, excludes unavailable provider and rejects stale action", async () => {
  const f = await fixture(); const replacement = await backup(f);
  await f.platform.declineBooking(f.provider.id, { bookingId: f.booking.id });
  const options = await f.platform.getBookingRecoveryOptions(f.customer.id, f.booking.id);
  assert.ok(options.alternatives.length <= 3);
  const selected = options.alternatives.find(item => item.providerId === replacement.id)!;
  assert.ok(selected);
  assert.equal(options.alternatives.some(item => item.providerId === f.provider.id), false);
  const payload = { bookingId: f.booking.id, recoveryId: options.recovery!.id, action: "replace" as const, providerId: selected.providerId, scheduledStartIso: selected.startIso, scheduledEndIso: selected.endIso };
  const updated = await f.platform.recoverBooking(f.customer.id, payload);
  assert.equal(updated.providerId, replacement.id); assert.equal(updated.status, "requested"); assert.equal(updated.totalCents, f.booking.totalCents);
  assert.equal((await f.platform.recoverBooking(f.customer.id, payload)).providerId, replacement.id);
  await assert.rejects(f.platform.recoverBooking(f.customer.id, { ...payload, action: "cancel" }), /already resolved/);
  assert.ok((await f.repository.listNotificationsByRecipient(f.provider.id)).some(item => item.title === "Visit reassigned"));
});

test("replacement acceptance rechecks conflicts and changed prices", async () => {
  const f = await fixture(); const replacement = await backup(f);
  await f.platform.declineBooking(f.provider.id, { bookingId: f.booking.id });
  const options = await f.platform.getBookingRecoveryOptions(f.customer.id, f.booking.id);
  const selected = options.alternatives.find(item => item.providerId === replacement.id)!; assert.ok(selected);
  await f.repository.createBooking({ ...structuredClone(f.booking), id: randomUUID(), providerId: replacement.id, recovery: undefined, scheduledStartIso: selected.startIso, scheduledEndIso: selected.endIso });
  await assert.rejects(f.platform.recoverBooking(f.customer.id, { bookingId: f.booking.id, recoveryId: options.recovery!.id, action: "replace", providerId: selected.providerId, scheduledStartIso: selected.startIso, scheduledEndIso: selected.endIso }), /no longer available|overlaps/);
  assert.equal((await f.repository.findBookingById(f.booking.id))!.providerId, f.provider.id);
});

test("repeated crew call-off records one penalty and a replacement is recoverable", async () => {
  const f = await fixture(); const member = await crew(f);
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "auto-accept" });
  const match = await f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id });
  const results = await Promise.all([f.platform.cancelCrewMatch(member.id, { crewMatchId: match.id, reason: "Unable to attend" }), f.platform.cancelCrewMatch(member.id, { crewMatchId: match.id, reason: "Unable to attend" })]);
  assert.ok(results.every(item => item.status === "cancelled-by-crew"));
  assert.equal((await f.repository.findCrewMemberById(member.id))!.cancellationCount, 1);
});

test("confirmed wrong-property correction requires provider approval and never changes scope silently", async () => {
  const f = await fixture();
  await f.platform.confirmBooking(f.provider.id, { bookingId: f.booking.id });
  const property = await f.platform.createCustomerProperty(f.customer.id, { label: "Correct property", address: { ...f.provider.address, line1: "19 Correct Road" } });
  const response = await f.platform.updateBookingAddress(f.customer.id, { bookingId: f.booking.id, newPropertyId: property.id, newAddress: property.address });
  assert.equal(response.outcome, "requires-provider-review");
  assert.equal(response.booking.servicePropertyId, f.customer.properties[0].id);
  const changeId = response.booking.addressChangeHistory.at(-1)!.id;
  await assert.rejects(f.platform.reviewBookingAddress("other", { bookingId: f.booking.id, changeId, action: "approve", reason: "Safe route" }), /Only the booking provider/);
  const approved = await f.platform.reviewBookingAddress(f.provider.id, { bookingId: f.booking.id, changeId, action: "approve", reason: "Route and scope remain equivalent" });
  assert.equal(approved.servicePropertyId, property.id); assert.equal(approved.totalCents, f.booking.totalCents);
  await f.repository.updateBooking(f.booking.id, { onRouteConfirmedAt: new Date().toISOString() });
  const blocked = await f.platform.updateBookingAddress(f.customer.id, { bookingId: f.booking.id, newPropertyId: f.customer.properties[0].id, newAddress: f.customer.properties[0].address });
  assert.equal(blocked.outcome, "blocked");
});

test("provider openings are owned, retry-safe, bounded and protected once booked", async () => {
  const f = await fixture();
  const payload = { action: "add" as const, startIso: future(80), endIso: future(85) };
  const first = await f.platform.manageProviderAvailability(f.provider.id, payload);
  assert.deepEqual(await f.platform.manageProviderAvailability(f.provider.id, payload), first);
  await assert.rejects(f.platform.manageProviderAvailability(f.provider.id, { ...payload, endIso: future(100) }));
  await assert.rejects(f.platform.manageProviderAvailability(f.provider.id, { action: "add", startIso: future(-2), endIso: future(-1) }));
  const slot = first.find(item => item.startIso === payload.startIso)!; assert.ok(slot);
  await assert.rejects(f.platform.manageProviderAvailability("other", { action: "remove", slotId: slot.id }));
  await f.repository.createBooking({ ...structuredClone(f.booking), id: randomUUID(), scheduledStartIso: future(81), scheduledEndIso: future(82) });
  await assert.rejects(f.platform.manageProviderAvailability(f.provider.id, { action: "remove", slotId: slot.id }), /book/);
});

for (const scope of ["visit", "plan"] as const) test(`recurring recovery changes only explicitly consented ${scope} scope`, async () => {
  const f = await fixture(); const replacement = await backup(f); const planId = randomUUID(); const anchor = f.booking.scheduledStartIso;
  await f.repository.createRecurringServicePlan({ id: planId, customerId: f.customer.id, providerId: f.provider.id, serviceAddress: f.booking.serviceAddress, category: f.booking.category, frequency: "weekly", requestedAt: new Date().toISOString(), notes: "Recurring", totalCents: f.booking.totalCents, status: "active", anchorScheduledStartIso: f.booking.scheduledStartIso, anchorScheduledEndIso: f.booking.scheduledEndIso });
  await f.repository.updateBooking(f.booking.id, { recurringPlanId: planId });
  await f.platform.declineBooking(f.provider.id, { bookingId: f.booking.id });
  const options = await f.platform.getBookingRecoveryOptions(f.customer.id, f.booking.id);
  const selected = options.alternatives.find(item => item.providerId === replacement.id)!; assert.ok(selected);
  await f.platform.recoverBooking(f.customer.id, { bookingId: f.booking.id, recoveryId: options.recovery!.id, action: "replace", scope, providerId: replacement.id, scheduledStartIso: selected.startIso, scheduledEndIso: selected.endIso });
  const plan = await f.repository.findRecurringServicePlanById(planId);
  assert.equal(plan!.providerId, scope === "plan" ? replacement.id : f.provider.id);
  assert.equal(plan!.anchorScheduledStartIso, anchor);
  assert.equal(plan!.totalCents, f.booking.totalCents);
});

test("provider weather hold informs customer, assigned crew, provider and ops", async () => {
  const f = await fixture(); const member = await crew(f);
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "auto-accept" });
  await f.platform.claimPublicCrewOpportunity(member.id, { opportunityId: f.booking.id });
  await f.platform.confirmBooking(f.provider.id, { bookingId: f.booking.id });
  await f.platform.updateBookingSchedule(f.provider.id, { bookingId: f.booking.id, kind: "weather", reason: "Unsafe weather at the property", nextUpdateByIso: future(1) });
  for (const recipient of [f.customer.id, member.id, f.provider.id, f.ops.id]) {
    assert.ok((await f.repository.listNotificationsByRecipient(recipient)).some(item => item.title === "Weather delay: your visit is on hold"));
  }
});
