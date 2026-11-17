import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { bookingScheduleStartIso } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking, createWorkflowRecurringPlan } from "./helpers/workflowBooking";

const HOUR = 3_600_000;
const day = new Date(Date.now() + 20 * 24 * HOUR).toISOString().slice(0, 10);
const afternoon = bookingScheduleStartIso(day, 16);
const earlier = new Date(Date.parse(bookingScheduleStartIso(day, 12)) + 90 * 60_000).toISOString();
const plusHour = (iso: string) => new Date(Date.parse(iso) + HOUR).toISOString();

async function fixture(earlyArrivalOk?: boolean) {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ role: "customer", fullName: "Early Customer", email: `${randomUUID()}@example.invalid`, address: provider.address, propertyLabel: "Home" });
  const booking = await createWorkflowBooking(platform, repository, customer.id, {
    providerId: provider.id, serviceAddress: customer.properties[0]!.address, servicePropertyId: customer.properties[0]!.id, category: "lawn-mowing",
    scheduledStartIso: afternoon, scheduledEndIso: plusHour(afternoon), notes: "", totalCents: 6_000, ...(earlyArrivalOk === undefined ? {} : { earlyArrivalOk })
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  return { repository, platform, provider, customer, booking };
}

const offer = (bookingId: string, startIso = earlier) => ({
  bookingId, kind: "early-arrival" as const, reason: "We finished the job before yours early.", nextUpdateByIso: startIso,
  proposedStartIso: startIso, proposedEndIso: plusHour(startIso)
});

test("early arrival is off unless the customer says yes, and a plan passes it to every visit", async () => {
  const off = await fixture();
  assert.equal((await off.repository.findBookingById(off.booking.id))!.earlyArrivalOk, undefined);
  const on = await fixture(true);
  assert.equal((await on.repository.findBookingById(on.booking.id))!.earlyArrivalOk, true);

  const plan = await createWorkflowRecurringPlan(on.platform, on.repository, on.customer.id, {
    providerId: on.provider.id, serviceAddress: on.customer.properties[0]!.address, servicePropertyId: on.customer.properties[0]!.id, category: "lawn-mowing",
    scheduledStartIso: plusHour(plusHour(afternoon)), scheduledEndIso: plusHour(plusHour(plusHour(afternoon))), notes: "", totalCents: 6_000, frequency: "weekly", earlyArrivalOk: true
  });
  assert.equal(plan.plan.plan.earlyArrivalOk, true);
  assert.equal(plan.initialBooking.earlyArrivalOk, true);
});

test("an earlier arrival must be earlier, later than now, and on the same day", async () => {
  const f = await fixture();
  await assert.rejects(f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id, plusHour(afternoon))), /earlier than the current visit/);
  const nextDay = new Date(Date.parse(afternoon) - 24 * HOUR).toISOString();
  await assert.rejects(f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id, nextDay)), /same day/);
  await assert.rejects(f.platform.updateBookingSchedule(f.provider.id, { ...offer(f.booking.id), nextUpdateByIso: new Date(Date.now() - 1000).toISOString() }), /next 24 hours|reply deadline/);
});

test("without the opt-in, the customer gets a one-tap offer; accepting moves the visit and keeps the price", async () => {
  const f = await fixture();
  const offered = await f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id));
  const update = offered.scheduleUpdates!.at(-1)!;
  assert.equal(update.kind, "early-arrival");
  assert.equal(update.state, "active");
  assert.equal(offered.scheduledStartIso, afternoon, "nothing moves until the customer answers");
  assert.ok((await f.repository.listNotificationsByRecipient(f.customer.id)).some(n => n.title === "Your provider can come earlier"));

  const accepted = await f.platform.respondBookingSchedule(f.customer.id, { bookingId: f.booking.id, updateId: update.id, action: "accept" });
  assert.equal(accepted.scheduledStartIso, earlier);
  assert.equal(accepted.totalCents, f.booking.totalCents);
  assert.ok((await f.repository.listNotificationsByRecipient(f.provider.id)).some(n => n.title === "Earlier arrival confirmed"));
});

test("declining keeps the original window and does not trigger an overdue-update alert", async () => {
  const f = await fixture();
  const offered = await f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id));
  const declined = await f.platform.respondBookingSchedule(f.customer.id, { bookingId: f.booking.id, updateId: offered.scheduleUpdates!.at(-1)!.id, action: "decline" });
  assert.equal(declined.scheduledStartIso, afternoon);
  assert.ok((await f.repository.listNotificationsByRecipient(f.provider.id)).some(n => n.title === "Original window kept"));
  const ops = (await f.repository.listOpsUsers())[0]!;
  const actor = (await f.repository.findAuthIdentityByUserId(ops.id))!;
  // After the offered time but well before the original window ends: nothing is overdue.
  const result = await f.platform.runDueOpsAutomation(actor, { sweepKeys: ["booking-schedule-follow-ups"], asOfIso: plusHour(earlier) });
  assert.equal(result.sentNotificationCount, 0);
});

test("with the opt-in, the offer applies at once and the customer is told when to expect them", async () => {
  const f = await fixture(true);
  const applied = await f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id));
  assert.equal(applied.scheduledStartIso, earlier);
  assert.equal(applied.scheduleUpdates!.at(-1)!.state, "accepted");
  const notices = await f.repository.listNotificationsByRecipient(f.customer.id);
  assert.ok(notices.some(n => n.title === "Earlier arrival confirmed"));
  assert.equal(notices.some(n => n.title === "Your provider can come earlier"), false);
});

test("accepted crew who are free at the earlier time stay on the job", async () => {
  const f = await fixture();
  await f.platform.updateProviderSettings(f.provider.id, { serviceRadiusMiles: 20, staffingMode: "review-first" });
  const member = await f.platform.registerUser({ role: "crew-member", fullName: "Early Crew", email: `${randomUUID()}@example.invalid`, address: f.provider.address,
    categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 60 });
  await f.platform.updateBookingSchedule(f.provider.id, { bookingId: f.booking.id, kind: "running-late", reason: "Placeholder to trigger staffing.", nextUpdateByIso: plusHour(new Date().toISOString()), expectedArrivalIso: plusHour(afternoon) }).catch(() => undefined);
  const job = (await f.platform.getProviderStaffingOverview(f.provider.id)).jobs.find(item => item.bookingId === f.booking.id)!;
  const match = job.matches.find(item => item.crewMemberId === member.id)!;
  await f.platform.reviewCrewMatch(f.provider.id, { crewMatchId: match.id, action: "accept" });

  const offered = await f.platform.updateBookingSchedule(f.provider.id, offer(f.booking.id));
  await f.platform.respondBookingSchedule(f.customer.id, { bookingId: f.booking.id, updateId: offered.scheduleUpdates!.at(-1)!.id, action: "accept" });
  assert.equal((await f.repository.findCrewMatchById(match.id))!.status, "accepted");
  assert.ok((await f.repository.listNotificationsByRecipient(member.id)).some(n => /still on this job/.test(n.body)));
});

test("a visit that hasn't started nudges the provider in its last hour, then tells the customer when the window ends", async () => {
  const f = await fixture();
  const ops = (await f.repository.listOpsUsers())[0]!;
  const actor = (await f.repository.findAuthIdentityByUserId(ops.id))!;
  const windowEnd = Date.parse(bookingScheduleStartIso(day, 16)) + 4 * HOUR;
  const run = (ms: number) => f.platform.runDueOpsAutomation(actor, { sweepKeys: ["booking-schedule-follow-ups"], asOfIso: new Date(ms).toISOString() });
  await run(windowEnd - 30 * 60_000);
  assert.ok((await f.repository.listNotificationsByRecipient(f.provider.id)).some(n => n.title === "A visit hasn't started"));
  assert.equal((await f.repository.listNotificationsByRecipient(f.customer.id)).some(n => n.title === "Your visit hasn't started yet"), false);
  await run(windowEnd);
  const notice = (await f.repository.listNotificationsByRecipient(f.customer.id)).find(n => n.title === "Your visit hasn't started yet");
  assert.ok(notice);
  assert.match(notice.body, /hasn't started your visit and the arrival window has ended/);
});
