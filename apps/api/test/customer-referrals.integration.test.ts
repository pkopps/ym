import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { CustomerProfile } from "@yardmatch/contracts";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { CustomerReferralService } from "../src/services/CustomerReferralService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
test("Postgres referrals persist ownership and consent, serialize limits, enforce uniqueness and roll back failed lead pairs", { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const service = new CustomerReferralService(repository, "http://localhost:3000");
  const id = `referral-test-${randomUUID()}`;
  const now = new Date().toISOString();
  const customer: CustomerProfile = { id, email: `${id}@example.com`, fullName: "Referral Test Customer", phone: "6095550100", role: "customer",
    address: { line1: "12 Oak Lane", city: "Barnegat", state: "NJ", postalCode: "08005", country: "US", point: { latitude: 39.758, longitude: -74.231 } },
    createdAt: now, properties: [], defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 };
  const orphanId = randomUUID();
  try {
    await repository.createCustomer(customer);
    const input = { friendName: "Jamie Test", channel: "phone" as const, contact: "609-555-0101", contactPermission: true };
    const concurrent = await Promise.all(Array.from({ length: 12 }, () => service.create(id, input)));
    assert.equal(concurrent.filter((item) => item.created).length, 1);
    const saved = await prisma.customerReferral.findMany({ where: { referrerCustomerId: id } });
    assert.equal(saved.length, 1);
    assert.equal(saved[0]!.contact, "+16095550101");
    assert.equal(saved[0]!.consentVersion, "friend-contact-permission-v1");
    assert.equal(saved[0]!.consentedAt.toISOString(), saved[0]!.createdAt.toISOString());
    const reopened = new CustomerReferralService(new PrismaMarketplaceRepository(prisma), "http://localhost:3000");
    assert.equal((await reopened.list(id)).referrals[0]!.id, saved[0]!.id);
    assert.deepEqual(await repository.listCustomerReferrals("another-customer"), []);
    await prisma.launchLead.update({ where: { id: saved[0]!.leadId }, data: { status: "contacted", outcomeSummary: "Private ops note" } });
    assert.equal((await reopened.list(id)).referrals[0]!.status, "in-progress");
    assert.doesNotMatch(JSON.stringify(await reopened.list(id)), /Private ops note/);

    const [record] = await repository.listCustomerReferrals(id);
    const lead = (await repository.findLaunchLeadById(record!.leadId))!;
    // A second referral for the same normalized contact fails the database constraint;
    // the new lead written earlier in the transaction must not survive.
    await assert.rejects(repository.createCustomerReferralWithLead({ ...record!, id: randomUUID(), leadId: orphanId },
      { ...lead, id: orphanId, sourceReferenceId: `customer-referral:${orphanId}` }), { code: "P2002" });
    assert.equal(await prisma.launchLead.count({ where: { id: orphanId } }), 0);
    assert.equal(await prisma.customerReferral.count({ where: { referrerCustomerId: id } }), 1);

    const batch = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => service.create(id, { ...input, channel: "email", contact: `neighbor-${index}@example.com` })));
    assert.equal(batch.filter((item) => item.status === "fulfilled").length, 9);
    for (const item of batch) if (item.status === "rejected") assert.equal(item.reason.statusCode, 429);
    assert.equal((await service.create(id, input)).created, false);
    await prisma.customerReferral.update({ where: { id: saved[0]!.id }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    assert.equal((await service.create(id, { ...input, channel: "email", contact: "after-window@example.com" })).created, true);
  } finally {
    const rows = await prisma.customerReferral.findMany({ where: { referrerCustomerId: id }, select: { leadId: true } });
    await prisma.launchLead.deleteMany({ where: { id: { in: [...rows.map((item) => item.leadId), orphanId] } } });
    await prisma.userAccount.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
