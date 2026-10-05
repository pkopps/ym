import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const future = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0];
  const customer = await platform.registerUser({ role: "customer", fullName: "Schedule Customer", email: `schedule-${crypto.randomUUID()}@example.com`, password: "Password123!", phone: "555-0112", propertyLabel: "Home", address: provider.address });
  const booking = await createWorkflowBooking(platform, repository, customer.id, { providerId: provider.id, serviceAddress: provider.address, category: "lawn-mowing", scheduledStartIso: future(4), scheduledEndIso: future(6), totalCents: 6200, notes: "Schedule regression" });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const ops = (await repository.listOpsUsers())[0];
  const actor = (await repository.findAuthIdentityByUserId(ops.id))!;
  return { repository, platform, provider, customer, booking: structuredClone(booking), actor };
}
const weather = (id: string) => ({ bookingId: id, kind: "weather" as const, reason: "Saturated ground after heavy rain.", nextUpdateByIso: future(1) });
const proposal = (id: string) => ({ bookingId: id, kind: "reschedule" as const, reason: "Rain makes the lawn unsafe to mow.", nextUpdateByIso: future(1), proposedStartIso: future(48), proposedEndIso: future(50) });

test("weather holds tell the customer what is uncertain and when the next update is due", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  const updated = await platform.updateBookingSchedule(provider.id, weather(booking.id));
  assert.equal(updated.scheduleUpdates?.at(-1)?.kind, "weather");
  assert.equal(updated.scheduledStartIso, booking.scheduledStartIso);
  assert.equal(updated.lateEtaIso, undefined);
  const notice = (await repository.listNotificationsByRecipient(customer.id)).at(-1)!;
  assert.match(notice.body, /Arrival is not confirmed/);
  assert.match(notice.body, /Next update by/);
  assert.match(notice.body, /E[DS]T/);
  assert.ok((await repository.listNotificationDeliveriesByRecipient(customer.id)).some(d => d.notificationId === notice.id));
});

test("same-day recovery accepts a proposal inside the usual 24-hour lock without changing price or recurrence", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  await repository.updateBooking(booking.id, { recurringPlanId: "preserved-plan", recurringOccurrenceIndex: 2, routeLivePoint: { latitude: 40, longitude: -74 } });
  const update = await platform.updateBookingSchedule(provider.id, proposal(booking.id));
  const id = update.scheduleUpdates!.at(-1)!.id;
  assert.equal(update.scheduledStartIso, booking.scheduledStartIso);
  const [first, second] = await Promise.allSettled([
    platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: id, action: "accept" }),
    platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: id, action: "accept" })
  ]);
  assert.equal(first.status, "fulfilled");
  assert.ok(second.status === "rejected" || second.value.scheduleUpdates?.at(-1)?.state === "accepted");
  const accepted = (await repository.findBookingById(booking.id))!;
  assert.equal(accepted.scheduledStartIso, update.scheduleUpdates!.at(-1)!.proposedStartIso);
  assert.equal(accepted.totalCents, booking.totalCents);
  assert.equal(accepted.recurringPlanId, "preserved-plan");
  assert.equal(accepted.recurringOccurrenceIndex, 2);
  assert.equal(accepted.routeLivePoint, undefined);
  assert.equal(accepted.status, "confirmed");
  await platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: id, action: "accept" });
  assert.equal((await repository.listNotificationsByRecipient(customer.id)).filter(n => n.title === "New service window confirmed").length, 1);
});

test("declining asks for another window, keeps the visit open, and rejects replaced or unauthorized proposals", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  const updated = await platform.updateBookingSchedule(provider.id, proposal(booking.id));
  const id = updated.scheduleUpdates!.at(-1)!.id;
  await assert.rejects(platform.respondBookingSchedule("another-customer", { bookingId: booking.id, updateId: id, action: "accept" }), /Only the customer/);
  const declined = await platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: id, action: "decline" });
  assert.equal(declined.scheduledStartIso, booking.scheduledStartIso);
  assert.equal(declined.status, "confirmed");
  assert.equal(declined.scheduleUpdates!.at(-1)!.state, "declined");
  await platform.updateBookingSchedule(provider.id, proposal(booking.id));
  await assert.rejects(platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: id, action: "accept" }), /replaced/);
  assert.equal((await repository.findBookingById(booking.id))!.scheduleUpdates!.length, 2);
});

test("proposal acceptance rechecks provider conflicts and does not resurrect terminal bookings", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  const updated = await platform.updateBookingSchedule(provider.id, proposal(booking.id));
  const current = structuredClone(updated.scheduleUpdates!.at(-1)!);
  await repository.createBooking({ ...booking, id: "conflicting-job", scheduledStartIso: current.proposedStartIso!, scheduledEndIso: current.proposedEndIso! });
  await assert.rejects(platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: current.id, action: "accept" }), /overlaps/);
  await repository.updateBooking("conflicting-job", { status: "cancelled" });
  await repository.updateBooking(booking.id, { status: "cancelled" });
  await assert.rejects(platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: current.id, action: "accept" }), /no longer/);
  assert.equal((await repository.findBookingById(booking.id))!.status, "cancelled");
});

test("schedule updates reject invalid dates, missing reasons, distant deadlines, and unauthorized providers", async () => {
  const { platform, provider, booking } = await fixture();
  for (const payload of [ { ...weather(booking.id), nextUpdateByIso: "invalid" }, { ...weather(booking.id), nextUpdateByIso: future(25) }, { ...weather(booking.id), reason: "" }, { ...proposal(booking.id), proposedEndIso: future(49) } ]) {
    await assert.rejects(platform.updateBookingSchedule(provider.id, payload));
  }
  await assert.rejects(platform.updateBookingSchedule("other-provider", weather(booking.id)), /Only the booking provider/);
  await assert.rejects(platform.markBookingLate(provider.id, { bookingId: booking.id, lateEtaIso: "invalid" }), /valid updated ETA/);
  await assert.rejects(platform.markBookingLate(provider.id, { bookingId: booking.id, lateEtaIso: future(50) }), /different service day/);
});

test("late notifications use the new ETA without repeating the original arrival window", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  // Keep the ETA on the service day, independent of the machine timezone.
  const updated = await platform.markBookingLate(provider.id, { bookingId: booking.id, lateEtaIso: booking.scheduledStartIso, reason: "Traffic is slowing the route." });
  assert.equal(updated.scheduleUpdates!.at(-1)!.expectedArrivalIso, booking.scheduledStartIso);
  const notice = (await repository.listNotificationsByRecipient(customer.id)).at(-1)!;
  assert.match(notice.body, /estimated arrival/);
  assert.doesNotMatch(notice.body, /in the .* window/);
});

test("due sweeps alert customers, providers, and ops once; dry runs and terminal visits do not notify", async () => {
  const { repository, platform, provider, customer, booking, actor } = await fixture();
  const updated = await platform.updateBookingSchedule(provider.id, weather(booking.id));
  const asOfIso = updated.scheduleUpdates!.at(-1)!.nextUpdateByIso;
  const request = { sweepKeys: ["booking-schedule-follow-ups" as const], asOfIso };
  const preview = await platform.runDueOpsAutomation(actor, { ...request, dryRun: true });
  assert.equal(preview.sentNotificationCount, 0);
  const first = await platform.runDueOpsAutomation(actor, request);
  assert.equal(first.sentNotificationCount, 3);
  const repeat = await platform.runDueOpsAutomation(actor, request);
  assert.equal(repeat.sentNotificationCount, 0);
  assert.equal(repeat.alreadySentCount, 3);
  assert.ok((await repository.listNotificationsByRecipient(customer.id)).some(n => n.body.includes("Arrival is not confirmed")));
  await repository.updateBooking(booking.id, { status: "completed" });
  assert.equal((await platform.runDueOpsAutomation(actor, request)).sentNotificationCount, 0);
  await assert.rejects(platform.runDueOpsAutomation({ ...actor, role: "provider" }, request), /Only operations/);
});

test("unannounced missed windows escalate even without a provider delay notice", async () => {
  const { repository, platform, booking, actor } = await fixture();
  await repository.updateBooking(booking.id, { scheduledStartIso: "2026-07-10T16:00:00Z", scheduledEndIso: "2026-07-10T18:00:00Z" });
  const request = { sweepKeys: ["booking-schedule-follow-ups" as const] };
  assert.equal((await platform.runDueOpsAutomation(actor, { ...request, asOfIso: "2026-07-10T19:59:00Z" })).sentNotificationCount, 0);
  assert.equal((await platform.runDueOpsAutomation(actor, { ...request, asOfIso: "2026-07-10T20:00:00Z" })).sentNotificationCount, 3);
});

test("overlapping schedule sweeps claim each recipient notification once", async () => {
  const { platform, provider, booking, actor, repository, customer } = await fixture();
  const update = await platform.updateBookingSchedule(provider.id, weather(booking.id));
  const request = { sweepKeys: ["booking-schedule-follow-ups" as const], asOfIso: update.scheduleUpdates!.at(-1)!.nextUpdateByIso };
  const results = await Promise.all([platform.runDueOpsAutomation(actor, request), platform.runDueOpsAutomation(actor, request)]);
  assert.equal(results.reduce((sum, result) => sum + result.sentNotificationCount, 0), 3);
  assert.equal((await repository.listNotificationsByRecipient(customer.id)).filter(n => n.actionHref?.includes("schedule-follow-up=")).length, 1);
});

test("late updates remain visible while en route and legacy rescheduling resolves their history", async () => {
  const { repository, platform, provider, booking, customer } = await fixture();
  await repository.updateBooking(booking.id, { onRouteConfirmedAt: new Date().toISOString() });
  const late = await platform.markBookingLate(provider.id, { bookingId: booking.id, lateEtaIso: booking.scheduledStartIso, reason: "Traffic is slowing arrival." });
  assert.equal(late.scheduleUpdates!.at(-1)!.state, "active");
  assert.ok(late.onRouteConfirmedAt);
  // A legacy/support schedule mutation cannot leave an obsolete active ETA on the new visit.
  await repository.updateBooking(booking.id, { scheduledStartIso: future(72), scheduledEndIso: future(74) });
  assert.equal((await repository.findBookingById(booking.id))!.scheduleUpdates!.at(-1)!.state, "resolved");
  await assert.rejects(platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: late.scheduleUpdates!.at(-1)!.id, action: "accept" }), /replaced/);
});

test("external notification delivery preserves the next-update deadline and a booking link beyond the ops preview", async (context) => {
  const { NotificationDeliveryService } = await import("../src/services/NotificationDeliveryService");
  const { platform, provider, booking } = await fixture();
  await platform.retryDueNotificationDeliveriesForOps();
  const sent: Array<{ body: string; data?: Record<string, unknown>; channel: string }> = [];
  context.mock.method(NotificationDeliveryService.prototype, "dispatch", async (input: { body: string; data?: Record<string, unknown>; channel: string }) => {
    sent.push(input);
    return { provider: "test", sentAt: new Date().toISOString(), externalId: crypto.randomUUID() };
  });
  await platform.updateBookingSchedule(provider.id, { ...weather(booking.id), reason: "The soil is saturated and we are checking safe working conditions before bringing equipment onto the lawn. We want to avoid rutting the ground or damaging the property while the storm passes." });
  await platform.retryDueNotificationDeliveriesForOps();
  assert.ok(sent.length > 0);
  assert.ok(sent.every(input => input.body.includes("Next update by")));
  const customerHref = `/customer/dashboard?bookingId=${booking.id}`;
  const allowedHrefs = new Set([customerHref, "/provider/management", "/crew/schedule", "/ops"]);
  assert.ok(sent.some(input => input.data?.actionHref === customerHref));
  assert.ok(sent.every(input => allowedHrefs.has(String(input.data?.actionHref))));
  assert.ok(sent.filter(input => input.channel === "email").every(input => input.body.includes(String(input.data?.actionHref))));
});

test("concurrent acceptances cannot allocate the same provider window to two different visits", async () => {
  const { repository, platform, provider, customer, booking } = await fixture();
  const other = await repository.createBooking({ ...booking, id: "second-visit", scheduledStartIso: future(24), scheduledEndIso: future(26) });
  const target = proposal(booking.id);
  const first = await platform.updateBookingSchedule(provider.id, target);
  const second = await platform.updateBookingSchedule(provider.id, { ...target, bookingId: other.id });
  const results = await Promise.allSettled([
    platform.respondBookingSchedule(customer.id, { bookingId: booking.id, updateId: first.scheduleUpdates!.at(-1)!.id, action: "accept" }),
    platform.respondBookingSchedule(customer.id, { bookingId: other.id, updateId: second.scheduleUpdates!.at(-1)!.id, action: "accept" })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
});

test("service-date conversion respects both Eastern daylight-saving offsets", async () => {
  const { bookingScheduleStartIso, bookingScheduleWindowHour } = await import("@yardmatch/contracts");
  assert.equal(bookingScheduleStartIso("2027-01-15", 12), "2027-01-15T17:00:00.000Z");
  assert.equal(bookingScheduleStartIso("2027-07-15", 12), "2027-07-15T16:00:00.000Z");
  assert.equal(bookingScheduleWindowHour("2027-07-15T16:00:00.000Z"), 12);
  assert.throws(() => bookingScheduleStartIso("2027-02-30", 12));
});
