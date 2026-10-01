import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { buildReferralInvitationHref, normalizeReferralPhone, type CreateCustomerReferralRequest } from "@yardmatch/contracts";
import { signSessionToken } from "../src/auth";
import { SupportController } from "../src/controllers/SupportController";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const address = { line1: "12 Oak Lane", city: "Barnegat", state: "NJ", postalCode: "08005", country: "US", point: { latitude: 39.758, longitude: -74.231 } };
const valid: CreateCustomerReferralRequest = { friendName: "Jamie Neighbor", channel: "email", contact: "jamie@example.com", areaLabel: "Barnegat", contactPermission: true };
async function setup() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const customer = await platform.registerUser({ fullName: "Taylor Homeowner", email: "taylor@example.com", phone: "609-555-0100", role: "customer", address });
  const other = await platform.registerUser({ fullName: "Morgan Homeowner", email: "morgan@example.com", phone: "609-555-0102", role: "customer", address });
  return { repository, platform, customer, other };
}

test("referrals capture server-owned provenance, permission and an ops lead without messaging or reward side effects", async () => {
  const { repository, platform, customer, other } = await setup();
  const result = await platform.createCustomerReferral(customer.id, { ...valid, contact: " Jamie@Example.com ", referrerCustomerId: other.id } as CreateCustomerReferralRequest);
  assert.equal(result.created, true);
  assert.equal(result.referral.contact, "jamie@example.com");
  const records = await repository.listCustomerReferrals(customer.id);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.consentVersion, "friend-contact-permission-v1");
  assert.equal(records[0]!.consentedAt, records[0]!.createdAt);
  const leads = await platform.listOpsLaunchLeads();
  assert.equal(leads.length, 1);
  assert.equal(leads[0]!.lead.channelMetadata?.referrerEmail, customer.email);
  assert.equal(leads[0]!.lead.email, "jamie@example.com");
  assert.equal(leads[0]!.lead.requestSource, "customer-referral");
  assert.ok(leads[0]!.lead.channelMetadata?.intakeNotes?.some((note) => note.includes(customer.id)));
  assert.deepEqual((await platform.listCustomerReferrals(other.id)).referrals, []);
  assert.equal((await platform.listCustomerReferrals(customer.id)).shareBaseUrl, "http://localhost:3000/customer");
  for (const field of ["leadId", "referrerCustomerId", "consentedAt", "outcomeSummary", "convertedBookingIds"]) assert.equal(field in result.referral, false);
  await assert.rejects(platform.createLaunchLead({ ...leads[0]!.lead, sourceReferenceId: leads[0]!.lead.sourceReferenceId }), /authenticated customer referral/);
});

test("referral validation rejects malformed payloads, missing permission, self-referrals and unsafe contacts", async () => {
  const { repository, platform, customer } = await setup();
  const invalid: unknown[] = [null, {}, { ...valid, contactPermission: "true" }, { ...valid, contactPermission: false },
    { ...valid, friendName: "A" }, { ...valid, friendName: 10 }, { ...valid, friendName: "a".repeat(81) },
    { ...valid, areaLabel: {} }, { ...valid, channel: "sms" }, { ...valid, contact: "a@x.com,b@y.com" },
    { ...valid, contact: "bad" }, { ...valid, contact: "a@x.com\r\nbcc:private@x.com" },
    { ...valid, contact: customer.email.toUpperCase() }, { ...valid, channel: "phone", contact: "+1 (609) 555-0100" },
    { ...valid, channel: "phone", contact: "abc6095550101" }, { ...valid, channel: "phone", contact: "+446095550101" }];
  for (const payload of invalid) await assert.rejects(platform.createCustomerReferral(customer.id, payload as CreateCustomerReferralRequest), { statusCode: 400 });
  assert.equal((await repository.listLaunchLeads()).length, 0);
});

test("concurrent duplicate referrals are idempotent and the rolling limit is enforced under the same lock", async () => {
  const { repository, platform, customer } = await setup();
  const results = await Promise.all(Array.from({ length: 15 }, (_, index) => platform.createCustomerReferral(customer.id,
    { ...valid, channel: "phone", contact: index % 2 ? "609-555-0101" : "+1 (609) 555-0101" })));
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(new Set(results.map((result) => result.referral.id)).size, 1);
  const batch = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => platform.createCustomerReferral(customer.id, { ...valid, contact: `neighbor-${index}@example.com` })));
  assert.equal(batch.filter((result) => result.status === "fulfilled").length, 9);
  for (const result of batch) if (result.status === "rejected") assert.equal(result.reason.statusCode, 429);
  assert.equal((await repository.listLaunchLeads()).length, 10);
  assert.equal((await platform.createCustomerReferral(customer.id, { ...valid, channel: "phone", contact: "16095550101" })).created, false);
});

test("referral progress comes from ops without exposing private notes or payment details", async () => {
  const { repository, platform, customer } = await setup();
  await platform.createCustomerReferral(customer.id, valid);
  const [record] = await repository.listCustomerReferrals(customer.id);
  for (const [leadStatus, status] of [["contacted", "in-progress"], ["qualified", "in-progress"], ["converted", "booked"], ["closed-lost", "closed"]] as const) {
    await repository.updateLaunchLead(record!.leadId, { status: leadStatus, outcomeSummary: "Private ops discussion", convertedBookingIds: ["private-booking"] });
    const overview = await platform.listCustomerReferrals(customer.id);
    assert.equal(overview.referrals[0]!.status, status);
    assert.doesNotMatch(JSON.stringify(overview), /Private ops|private-booking/);
  }
});

for (const channel of ["email", "phone"] as const) test(`${channel} referral links to a real booking by matching contact, including phone formatting variants`, async () => {
  const { repository, platform, customer, other } = await setup();
  await platform.createCustomerReferral(customer.id, { ...valid, channel, contact: channel === "email" ? other.email : "+1 (609) 555-0102" });
  const [record] = await repository.listCustomerReferrals(customer.id);
  const provider = (await repository.listProviders())[0]!;
  const start = new Date(Date.now() + 5 * 86_400_000); start.setUTCHours(14, 0, 0, 0);
  const booking = await createWorkflowBooking(platform, repository, other.id, { providerId: provider.id, category: "lawn-mowing",
    scheduledStartIso: start.toISOString(), scheduledEndIso: new Date(start.getTime() + 3_600_000).toISOString(), totalCents: 7500, serviceAddress: address, notes: "Referral conversion test" });
  assert.equal(booking.launchLeadId, record!.leadId);
  assert.equal((await platform.listCustomerReferrals(customer.id)).referrals[0]!.status, "booked");
});

test("an unrelated customer cannot attach a friend referral by supplying its lead ID", async () => {
  const { repository, platform, customer, other } = await setup();
  await platform.createCustomerReferral(customer.id, valid);
  const [record] = await repository.listCustomerReferrals(customer.id);
  const start = new Date(Date.now() + 5 * 86_400_000); start.setUTCHours(14, 0, 0, 0);
  const booking = await createWorkflowBooking(platform, repository, other.id, { providerId: (await repository.listProviders())[0]!.id,
    category: "lawn-mowing", scheduledStartIso: start.toISOString(), scheduledEndIso: new Date(start.getTime() + 3_600_000).toISOString(),
    totalCents: 7500, serviceAddress: address, notes: "Unrelated booking", launchLeadId: record!.leadId });
  assert.notEqual(booking.launchLeadId, record!.leadId);
  assert.equal((await platform.listCustomerReferrals(customer.id)).referrals[0]!.status, "saved");
});

test("customer referral HTTP routes require customer auth and ignore caller-supplied ownership", async () => {
  const { repository, platform, customer, other } = await setup();
  const controller = new SupportController(platform);
  const response = { setHeader() {}, writeHead() {}, end() {} };
  const context = { method: "POST", path: "/api/customer/referrals", query: new URLSearchParams({ customerId: other.id }), headers: {}, body: valid };
  assert.equal(controller.canHandle(context), true);
  await assert.rejects(controller.handle(context, response as never), { statusCode: 401 });
  const provider = (await repository.listProviders())[0]!;
  const token = (user: { id: string; email: string; role: "customer" | "provider" | "crew-member" | "ops" }) => signSessionToken({ userId: user.id, email: user.email, role: user.role, sessionVersion: 1 });
  await assert.rejects(controller.handle({ ...context, headers: { authorization: `Bearer ${token(provider)}` } }, response as never), { statusCode: 403 });
  await controller.handle({ ...context, headers: { authorization: `Bearer ${token(customer)}` } }, response as never);
  assert.equal((await platform.listCustomerReferrals(customer.id)).referrals.length, 1);
  assert.equal((await platform.listCustomerReferrals(other.id)).referrals.length, 0);
  await assert.rejects(controller.handle({ ...context, method: "GET" }, response as never), { statusCode: 401 });
});

test("invitation composers encode content, canonicalize US contacts and do not include a tracking secret", () => {
  assert.equal(normalizeReferralPhone("(609) 555-0101"), "+16095550101");
  const email = buildReferralInvitationHref({ channel: "email", contact: "jamie@example.com" }, "Yard & garden", "Hi Jamie? & https://example.com/customer");
  assert.ok(email.startsWith("mailto:jamie%40example.com?subject=Yard%20%26%20garden&body="));
  assert.equal(buildReferralInvitationHref({ channel: "phone", contact: "+16095550101" }, "", "Hi", true), "sms:+16095550101&body=Hi");
  assert.equal(buildReferralInvitationHref({ channel: "phone", contact: "+16095550101" }, "", "Hi"), "sms:+16095550101?body=Hi");
});
