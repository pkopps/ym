import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ProductAnalytics } from "../src/observability/ProductAnalytics";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const skip = databaseUrl ? false : "TEST_DATABASE_URL is not configured";

test("Postgres analytics report counts providers with bookings the same as count(DISTINCT)", { skip }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  const prefix = `analytics-supply-${randomUUID()}`;
  const now = Date.now();
  const booking = (name: string, providerName: string, status: string) => ({ id: `${prefix}-booking-${name}`, customerId: `${prefix}-customer`,
    providerId: `${prefix}-provider-${providerName}`, serviceAddress: { city: "Barnegat", state: "NJ", postalCode: "08005" }, category: "lawn-mowing",
    requestedAt: new Date(now), scheduledStartIso: new Date(now + 86_400_000), scheduledEndIso: new Date(now + 90_000_000), status,
    notes: "Analytics supply integration test", totalCents: 7_500, serviceEvidence: [], interventions: [], addressChangeHistory: [] });
  try {
    await prisma.booking.createMany({ data: [booking("1", "a", "completed"), booking("2", "a", "completed"), booking("3", "a", "confirmed"),
      booking("4", "b", "requested"), booking("5", "b", "cancelled"), booking("6", "c", "completed")] });
    const [expected] = await prisma.$queryRaw<Array<{ booked: number; completed: number }>>`SELECT
      (SELECT count(DISTINCT "providerId")::int FROM bookings) AS booked,
      (SELECT count(DISTINCT "providerId")::int FROM bookings WHERE status = 'completed') AS completed`;
    const supply = (await new ProductAnalytics(prisma).report()).supply!;
    assert.equal(supply.withFirstBooking, expected!.booked);
    assert.equal(supply.withCompletedJob, expected!.completed);
    assert.ok(supply.withFirstBooking >= 3 && supply.withCompletedJob >= 2 && supply.withFirstBooking > supply.withCompletedJob);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
