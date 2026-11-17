import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { Address, CrewMemberProfile, ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { searchBounds } from "../src/repositories/searchQueries";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

test(
  "Postgres provider search on location columns returns the same providers as the address JSON query",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const repository = new PrismaMarketplaceRepository(prisma);
    const prefix = `location-search-${randomUUID()}`;
    const [template] = await new InMemoryMarketplaceRepository().listProviders();
    // A search origin far from every other fixture, and one next to the antimeridian so the box wraps.
    const origin = { latitude: -20, longitude: 30 };
    const wrapOrigin = { latitude: -20, longitude: 179.9 };
    const addressAt = (latitude: number, longitude: number): Address => ({ ...template.address, point: { latitude, longitude } });
    const provider = (name: string, latitude: number, longitude: number, extra: Partial<ProviderProfile> = {}): ProviderProfile => ({
      ...template,
      id: `${prefix}-${name}`,
      email: `${prefix}-${name}@example.invalid`,
      address: addressAt(latitude, longitude),
      verificationStatus: "verified",
      categories: ["lawn-mowing"],
      credentials: [],
      ...extra
    });
    const providers = [
      provider("center", origin.latitude, origin.longitude),
      provider("inside-north", origin.latitude + 0.8, origin.longitude),
      provider("inside-east", origin.latitude, origin.longitude + 0.9),
      provider("outside-north", origin.latitude + 0.9, origin.longitude),
      provider("outside-east", origin.latitude, origin.longitude + 1.0),
      provider("unverified", origin.latitude, origin.longitude, { verificationStatus: "pending" }),
      provider("other-category", origin.latitude, origin.longitude, { categories: ["gutter-cleaning"] }),
      provider("wrap-west", wrapOrigin.latitude, 179.5),
      provider("wrap-east", wrapOrigin.latitude, -179.5),
      provider("wrap-outside", wrapOrigin.latitude, -178.5)
    ];
    const crewMember: CrewMemberProfile = {
      id: `${prefix}-crew`,
      fullName: "Location Search Crew",
      email: `${prefix}-crew@example.invalid`,
      phone: template.phone,
      role: "crew-member",
      address: addressAt(origin.latitude, origin.longitude),
      createdAt: new Date().toISOString(),
      bio: "A test crew member used only by the location search integration suite.",
      yearsExperience: 1,
      categories: ["lawn-mowing"],
      willingToTravelMiles: 10,
      preferredSchedule: "flex",
      hasOwnEquipment: false,
      rating: 4.5,
      completedJobs: 0,
      cancellationCount: 0,
      status: "available"
    };
    const own = (ids: string[]) => ids.filter((id) => id.startsWith(prefix));
    /** The query searchProvidersPage ran before the location columns existed, without paging. */
    const addressJsonSearch = async (address: Address, categories: string[]) => {
      const bounds = searchBounds(address);
      const longitude = Prisma.sql`(u.address->'point'->>'longitude')::double precision`;
      const longitudeCondition = bounds.west <= bounds.east
        ? Prisma.sql`${longitude} BETWEEN ${bounds.west} AND ${bounds.east}`
        : Prisma.sql`(${longitude} >= ${bounds.west} OR ${longitude} <= ${bounds.east})`;
      const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT p."userId" FROM provider_business_profiles p JOIN user_accounts u ON u.id = p."userId"
        WHERE p."verificationStatus" = 'verified' AND p.categories && ARRAY[${Prisma.join(categories)}]::text[]
          AND (u.address->'point'->>'latitude')::double precision BETWEEN ${bounds.south} AND ${bounds.north}
          AND ${longitudeCondition} ORDER BY p."userId"`;
      return rows.map((row) => row.userId);
    };
    const columnSearch = async (address: Address, categories: ProviderProfile["categories"]) => {
      const ids: string[] = [];
      let cursorId: string | undefined;
      do {
        const page = await repository.searchProvidersPage({ address, categories, cursorId });
        ids.push(...page.items.map((item) => item.id));
        cursorId = page.hasMore ? page.nextCursorId : undefined;
      } while (cursorId);
      return ids;
    };

    try {
      for (const row of providers) await repository.createProvider(row);
      await repository.createCrewMember(crewMember);

      const nearOrigin = await columnSearch(addressAt(origin.latitude, origin.longitude), ["lawn-mowing"]);
      assert.deepEqual(own(nearOrigin), ["center", "inside-east", "inside-north"].map((name) => `${prefix}-${name}`));
      assert.deepEqual(nearOrigin, await addressJsonSearch(addressAt(origin.latitude, origin.longitude), ["lawn-mowing"]));

      const nearAntimeridian = await columnSearch(addressAt(wrapOrigin.latitude, wrapOrigin.longitude), ["lawn-mowing"]);
      assert.deepEqual(own(nearAntimeridian), ["wrap-east", "wrap-west"].map((name) => `${prefix}-${name}`));
      assert.deepEqual(nearAntimeridian, await addressJsonSearch(addressAt(wrapOrigin.latitude, wrapOrigin.longitude), ["lawn-mowing"]));

      // Moving a provider updates the columns with the address, so search follows the new location.
      await repository.updateProvider(`${prefix}-outside-north`, { address: addressAt(origin.latitude + 0.1, origin.longitude) });
      await repository.updateProvider(`${prefix}-center`, { address: addressAt(origin.latitude + 5, origin.longitude) });
      const afterMove = await columnSearch(addressAt(origin.latitude, origin.longitude), ["lawn-mowing"]);
      assert.deepEqual(own(afterMove), ["inside-east", "inside-north", "outside-north"].map((name) => `${prefix}-${name}`));
      assert.deepEqual(afterMove, await addressJsonSearch(addressAt(origin.latitude, origin.longitude), ["lawn-mowing"]));

      // Crew members get the same columns.
      const crewRow = await prisma.userAccount.findUniqueOrThrow({ where: { id: crewMember.id } });
      assert.deepEqual([crewRow.latitude, crewRow.longitude], [origin.latitude, origin.longitude]);

      // Every account's columns match its address, including rows written before this test.
      const [{ mismatched }] = await prisma.$queryRaw<Array<{ mismatched: number }>>`
        SELECT COUNT(*)::int AS mismatched FROM user_accounts
        WHERE latitude IS DISTINCT FROM (address->'point'->>'latitude')::double precision
          OR longitude IS DISTINCT FROM (address->'point'->>'longitude')::double precision`;
      assert.equal(mismatched, 0);
    } finally {
      await prisma.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
      await prisma.$disconnect();
    }
  }
);
