// N7, N10, N11 and N12 from reports/explorer/summary-2026-11-17.md.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import type { ProviderCredentialType, ProviderProfile } from "@yardmatch/contracts";
import { hashPassword } from "../src/auth";
import { HttpError } from "../src/http";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const future = (hours: number, base = Date.now()) => new Date(base + hours * 3_600_000).toISOString();
const tinyPdf = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF").toString("base64")}`;

async function verify(repository: InMemoryMarketplaceRepository, providerId: string, types: ProviderCredentialType[]) {
  for (const type of types) {
    await repository.upsertProviderCredential({ id: randomUUID(), providerId, type, status: "verified", jurisdiction: "NJ", referenceNumber: `ref-${type}`, submittedAt: new Date().toISOString(), expiresAt: future(24 * 365) });
  }
}

async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  await repository.updateProvider(provider.id, { address: { ...provider.address, state: "NJ" } });
  return { repository, platform, provider };
}

test("N7, N10: a new provider gets a plain to-do list and an email saying we'll write when they're approved", async () => {
  const { repository, platform } = await fixture();
  const email = `${randomUUID()}@example.invalid`;
  const registered = await platform.registerUser({
    role: "provider", fullName: "Dana Owner", companyName: "Dana Lawn", email, phone: "5550100",
    address: { line1: "10 Bay Ave", city: "Barnegat", state: "NJ", postalCode: "08005", country: "US" }, categories: ["lawn-mowing"]
  }, await hashPassword("Original123!"));
  const notices = await repository.listNotificationsByRecipient(registered.id);
  const welcome = notices.find((notice) => notice.title === "We got your application");
  assert.ok(welcome);
  assert.match(welcome.body, new RegExp(`email you at ${email.replace(/[.]/g, "\\.")}`));

  const profile = await platform.getProviderProfile(registered.id);
  const summary = profile.verificationSummary!;
  assert.match(summary.summary, /email you at/);
  assert.ok(summary.nextSteps.includes("Add your business registration under Business credentials."));
  assert.ok(summary.nextSteps.includes("Add your general liability insurance under Business credentials."));
  const visible = [summary.headline, summary.summary, ...summary.nextSteps, ...summary.checklist.flatMap((item) => [item.label, item.detail])].join(" ");
  assert.doesNotMatch(visible, /\bops\b|launch|counsel|signal|intervention|exemption|business-registration/i);
});

test("N10: a credential can carry a PDF or photo of the document, and bad files are refused", async () => {
  const { platform, provider } = await fixture();
  const withPdf = await platform.submitProviderCredential(provider.id, { type: "general-liability-insurance", documentDataUrl: tinyPdf });
  const stored = withPdf.credentials?.find((credential) => credential.type === "general-liability-insurance");
  assert.equal(stored?.status, "pending-review");
  assert.equal(stored?.documentUrl, tinyPdf, "inline storage keeps the uploaded file");

  await assert.rejects(platform.submitProviderCredential(provider.id, { type: "business-registration", documentDataUrl: `data:application/pdf;base64,${Buffer.from("not a pdf").toString("base64")}` }), /isn't a valid PDF/);
  await assert.rejects(platform.submitProviderCredential(provider.id, { type: "business-registration", documentDataUrl: "data:text/html;base64,PGgxPg==" }), /photo .* or a PDF/);
  await assert.rejects(platform.submitProviderCredential(provider.id, { type: "business-registration" }), /policy or registration number, or upload the document/);
  // An inline document has no private-storage link to serve.
  await assert.rejects(platform.getCredentialDocument(provider.id, stored!.id, "any"), (error: unknown) => error instanceof HttpError && error.statusCode === 404);
});

async function crewFixture() {
  const base = await fixture();
  const { repository, platform, provider } = base;
  await repository.updateProvider(provider.id, { categories: ["lawn-mowing"] });
  await verify(repository, provider.id, ["business-registration", "general-liability-insurance", "workers-compensation"]);
  const customer = await platform.registerUser({ role: "customer", fullName: "Site Customer", email: `${randomUUID()}@example.invalid`, address: provider.address, propertyLabel: "Beach house", propertyNotes: "Dog in the back yard; latch the gate." });
  const property = customer.properties[0]!;
  await repository.updateCustomer(customer.id, { properties: [{ ...property, gateCode: "4512", lawnSizeSqFt: 3200 }] });
  const book = (hours: number) => createWorkflowBooking(platform, repository, customer.id, {
    providerId: provider.id, serviceAddress: property.address, servicePropertyId: property.id, category: "lawn-mowing",
    scheduledStartIso: future(hours), scheduledEndIso: future(hours + 1), notes: "Bag the clippings, please.", totalCents: 6_000
  });
  return { ...base, customer, book };
}

test("N12: a provider invites crew by email, sees them, and can take them off the crew", async () => {
  const { repository, platform, provider } = await crewFixture();
  const email = `${randomUUID()}@example.invalid`;
  const { crew, invite } = await platform.inviteProviderCrewMember(provider.id, { fullName: "Riley Crew", email: email.toUpperCase() });
  assert.equal(invite, "new-account");
  assert.equal(crew.length, 1);
  assert.equal(crew[0]!.email, email);
  const member = (await repository.findCrewMemberById(crew[0]!.crewMemberId))!;
  assert.equal(member.assignedProviderId, provider.id);
  assert.ok((await repository.listNotificationsByRecipient(member.id)).some((notice) => /added you to their crew/.test(notice.title)));
  // Inviting again is harmless, and an existing account joins without a new password code.
  const again = await platform.inviteProviderCrewMember(provider.id, { fullName: "Riley Crew", email });
  assert.equal(again.crew.length, 1);
  assert.equal(again.invite, "joined");

  const other = (await repository.listProviders())[1]!;
  await assert.rejects(platform.inviteProviderCrewMember(other.id, { fullName: "Riley Crew", email }), /already on another business's crew/);
  await assert.rejects(platform.inviteProviderCrewMember(provider.id, { fullName: "Owner", email: provider.email }), /another kind of YardMatch account/);
  await assert.rejects(platform.inviteProviderCrewMember(provider.id, { fullName: "R", email: "not-an-email" }), /full name|valid email/);

  assert.deepEqual((await platform.removeProviderCrewMember(provider.id, { crewMemberId: member.id })).crew, []);
  assert.equal((await repository.findCrewMemberById(member.id))!.assignedProviderId, undefined);
  await assert.rejects(platform.removeProviderCrewMember(other.id, { crewMemberId: member.id }), /isn't on your crew/);
});

test("N12, N11: assigning own crew fills the slot within the job's limits, and only accepted crew see the site details", async () => {
  const { repository, platform, provider, book } = await crewFixture();
  const booking = await book(48);
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const [first, second] = await Promise.all(["Avery", "Blake"].map(async (name) =>
    (await platform.inviteProviderCrewMember(provider.id, { fullName: `${name} Crew`, email: `${randomUUID()}@example.invalid` })).crew.find((item) => item.fullName === `${name} Crew`)!));

  // Before anyone is assigned, nothing about the site reaches crew.
  assert.equal((await platform.getCrewMatchesForCrew(first!.crewMemberId)).matches.length, 0);

  await platform.assignProviderCrewMember(provider.id, { bookingId: booking.id, crewMemberId: first!.crewMemberId });
  const accepted = (await repository.listCrewMatchesForBookings([booking.id])).filter((match) => match.status === "accepted");
  assert.deepEqual(accepted.map((match) => match.crewMemberId), [first!.crewMemberId]);
  assert.ok((await repository.listNotificationsByRecipient(first!.crewMemberId)).some((notice) => notice.title === `New job with ${provider.companyName}`));

  const view = (await platform.getCrewMatchesForCrew(first!.crewMemberId)).matches[0]!;
  assert.deepEqual(view.siteInstructions, { propertyLabel: "Beach house", customerNotes: "Bag the clippings, please.", gateCode: "4512", accessNotes: "Dog in the back yard; latch the gate.", lawnSizeSqFt: 3200 });

  // A one-person mowing job is full now.
  await assert.rejects(platform.assignProviderCrewMember(provider.id, { bookingId: booking.id, crewMemberId: second!.crewMemberId }), /already has the crew it needs/);
  // Assigning the same person again changes nothing.
  await platform.assignProviderCrewMember(provider.id, { bookingId: booking.id, crewMemberId: first!.crewMemberId });

  // Someone already working another job at that time can't be added. Here Blake has an accepted job elsewhere.
  const elsewhere = { ...booking, id: randomUUID(), providerId: (await repository.listProviders())[1]!.id };
  await repository.createBooking(elsewhere);
  const blake = (await repository.findCrewMemberById(second!.crewMemberId))!;
  await repository.createCrewMatch({
    id: randomUUID(), bookingId: elsewhere.id, providerId: elsewhere.providerId, crewMemberId: blake.id, crewMemberName: blake.fullName, crewMemberPhone: blake.phone,
    categories: blake.categories, availableWeekdays: blake.availableWeekdays ?? ["Mon"], preferredSchedule: blake.preferredSchedule, willingToTravelMiles: blake.willingToTravelMiles,
    hasOwnEquipment: blake.hasOwnEquipment, winterWorkEnabled: true, status: "accepted", autoAccepted: false, distanceMiles: 1, hourlyRateCents: 2_500, createdAt: new Date().toISOString()
  });
  const later = await book(72);
  await platform.confirmBooking(provider.id, { bookingId: later.id });
  await platform.assignProviderCrewMember(provider.id, { bookingId: later.id, crewMemberId: blake.id });
  const sameTime = await book(52);
  await repository.updateBooking(sameTime.id, { scheduledStartIso: booking.scheduledStartIso, scheduledEndIso: booking.scheduledEndIso });
  await assert.rejects(platform.assignProviderCrewMember(provider.id, { bookingId: sameTime.id, crewMemberId: blake.id }), /already has a job at that time/);
});

test("N12: crew can't be put on jobs until workers' compensation is verified, or by another business", async () => {
  const { repository, platform, provider, book } = await crewFixture();
  const booking = await book(30);
  const { crew } = await platform.inviteProviderCrewMember(provider.id, { fullName: "Casey Crew", email: `${randomUUID()}@example.invalid` });
  const other = (await repository.listProviders())[1]!;
  await assert.rejects(platform.assignProviderCrewMember(other.id, { bookingId: booking.id, crewMemberId: crew[0]!.crewMemberId }), /Booking not found/);

  const current = (await repository.findProviderById(provider.id)) as ProviderProfile;
  for (const credential of current.credentials ?? []) {
    if (credential.type === "workers-compensation") await repository.upsertProviderCredential({ ...credential, status: "pending-review" });
  }
  await assert.rejects(platform.assignProviderCrewMember(provider.id, { bookingId: booking.id, crewMemberId: crew[0]!.crewMemberId }), /workers' compensation/);
});
