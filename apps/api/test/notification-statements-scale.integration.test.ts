import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { PrismaClient } from "@prisma/client";
import type { AppNotification } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import type { AuthIdentityRecord } from "../src/repositories/MarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";
type Notifier = { createNotification(payload: Omit<AppNotification, "id" | "isRead" | "createdAt">, forcedChannels?: string[], id?: string): Promise<AppNotification> };

test("Postgres notifications reach the same contact and queue the same deliveries with fewer statements", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const repository = new PrismaMarketplaceRepository(prisma);
  const prefix = `notification-statements-${randomUUID()}`;
  const [template] = await new InMemoryMarketplaceRepository().listProviders();
  const ids = { customer: `${prefix}-customer`, provider: `${prefix}-provider`, crew: `${prefix}-crew`, ops: `${prefix}-ops` };
  const email = (id: string) => `${id}@example.invalid`;
  try {
    await repository.createCustomer({ ...template!, id: ids.customer, email: email(ids.customer), phone: "609-555-0101", role: "customer", properties: [],
      defaultPropertyId: "", propertyNotes: "", lawnSizeSqFt: 1000 });
    await repository.createProvider({ ...template!, id: ids.provider, email: email(ids.provider), phone: "609-555-0102", credentials: [] });
    await repository.createCrewMember({ id: ids.crew, fullName: "Notification Crew", email: email(ids.crew), phone: "609-555-0103", role: "crew-member",
      address: template!.address, createdAt: new Date().toISOString(), bio: "Notification integration test", yearsExperience: 2, categories: ["lawn-mowing"],
      availableWeekdays: ["Mon"], willingToTravelMiles: 5, preferredSchedule: "flex", hasOwnEquipment: false, winterWorkEnabled: false, rating: 4.5,
      completedJobs: 1, cancellationCount: 0, status: "available" });
    await repository.createOpsUser({ ...template!, id: ids.ops, email: email(ids.ops), phone: "609-555-0104", role: "ops", internalScope: "admin" });

    // The contact is what the full profile lookups return, for every role.
    const profiles = { customer: await repository.findCustomerById(ids.customer), provider: await repository.findProviderById(ids.provider),
      "crew-member": await repository.findCrewMemberById(ids.crew), ops: await repository.findOpsUserById(ids.ops) };
    const userIdByRole = { customer: ids.customer, provider: ids.provider, "crew-member": ids.crew, ops: ids.ops };
    for (const role of ["customer", "provider", "crew-member", "ops"] as const) {
      const profile = profiles[role]!;
      assert.deepEqual(await repository.findNotificationContact(userIdByRole[role], role), { email: profile.email, phone: profile.phone });
    }
    // A user asked about in a role they have no profile for has no contact, as the profile lookups return nothing.
    const mismatches: Array<[string, AuthIdentityRecord["role"], unknown]> = [
      [ids.customer, "provider", await repository.findProviderById(ids.customer)], [ids.provider, "customer", await repository.findCustomerById(ids.provider)],
      [ids.customer, "crew-member", await repository.findCrewMemberById(ids.customer)], [ids.crew, "ops", await repository.findOpsUserById(ids.crew)],
      [`${prefix}-missing`, "customer", await repository.findCustomerById(`${prefix}-missing`)]
    ];
    for (const [userId, role, profile] of mismatches) {
      assert.equal(profile, undefined);
      assert.equal(await repository.findNotificationContact(userId, role), undefined);
    }

    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger()) as unknown as Notifier;
    const notice = (recipientId: string, recipientRole: AppNotification["recipientRole"]) => ({ recipientId, recipientRole, category: "booking" as const,
      title: "Statement test", body: "Notification statements integration test", actionHref: "/customer/dashboard" });
    for (const [recipientId, role] of [[ids.customer, "customer"], [ids.provider, "provider"], [ids.crew, "crew-member"]] as const) {
      const created = await platform.createNotification(notice(recipientId, role));
      const deliveries = await prisma.notificationDelivery.findMany({ where: { notificationId: created.id }, orderBy: { channel: "asc" } });
      assert.deepEqual(deliveries.map((row) => [row.channel, row.status, row.destination]),
        [["email", "queued", email(recipientId)], ["push", "queued", deliveries.find((row) => row.channel === "push")!.destination],
          ["sms", "queued", deliveries.find((row) => row.channel === "sms")!.destination]]);
      assert.match(deliveries.find((row) => row.channel === "sms")!.destination, /555/);
    }
    // A caller-chosen id is still idempotent: the second call returns the first notification and queues nothing more.
    const fixedId = `${prefix}-fixed`;
    const first = await platform.createNotification(notice(ids.customer, "customer"), [], fixedId);
    const second = await platform.createNotification({ ...notice(ids.customer, "customer"), title: "Different title" }, [], fixedId);
    assert.equal(second.title, first.title);
    assert.equal(await prisma.notificationDelivery.count({ where: { notificationId: fixedId } }), 3);
    assert.equal(await prisma.appNotification.count({ where: { id: fixedId } }), 1);
  } finally {
    const userIds = Object.values(ids);
    await prisma.notificationDelivery.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.appNotification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
