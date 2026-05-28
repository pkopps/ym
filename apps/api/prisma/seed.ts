import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";

const prisma = new PrismaClient();

function createAddress(
  line1: string,
  city: string,
  state: string,
  postalCode: string,
  latitude: number,
  longitude: number
) {
  return {
    line1,
    city,
    state,
    postalCode,
    country: "US",
    point: {
      latitude,
      longitude
    }
  };
}

async function main() {
  const repository = new PrismaMarketplaceRepository(prisma);

  if ((await repository.listProviders()).length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const seededPassword = hashPassword("YardMatch123!");

  const providers = [
    {
      id: crypto.randomUUID(),
      fullName: "Ariana Fields",
      email: "ariana@greenstride.example",
      phone: "555-0101",
      role: "provider" as const,
      address: createAddress("145 Prospect Ave", "Brooklyn", "NY", "11215", 40.6681, -73.9836),
      createdAt: now,
      companyName: "GreenStride Lawn Co.",
      bio: "Weekly mowing, cleanup, edging, leaf service, and winter walkway clearing for busy homeowners.",
      yearsExperience: 7,
      serviceRadiusMiles: 18,
      sponsoredListingEnabled: true,
      categories: ["lawn-mowing", "seasonal-cleanup", "weed-control", "leaf-blowing", "gutter-cleaning", "snow-shoveling"],
      rating: 4.9,
      timelinessRating: 4.8,
      attentionToDetailRating: 4.9,
      reviewCount: 128,
      calendarConnection: {
        provider: "google",
        connected: true,
        externalCalendarId: "greenstride-main"
      }
    },
    {
      id: crypto.randomUUID(),
      fullName: "Luis Ortega",
      email: "luis@terracut.example",
      phone: "555-0102",
      role: "provider" as const,
      address: createAddress("88 River Rd", "Jersey City", "NJ", "07310", 40.7261, -74.0321),
      createdAt: now,
      companyName: "TerraCut Studio",
      bio: "Premium lawn, hedge, mulch, fertilization, and driveway snow service with weekend availability.",
      yearsExperience: 12,
      serviceRadiusMiles: 24,
      sponsoredListingEnabled: false,
      categories: ["lawn-mowing", "hedge-trimming", "mulch-installation", "fertilization", "aeration", "snow-blowing"],
      rating: 4.8,
      timelinessRating: 4.7,
      attentionToDetailRating: 4.9,
      reviewCount: 221,
      calendarConnection: {
        provider: "apple",
        connected: true,
        externalCalendarId: "terracut-pro"
      }
    }
  ];

  for (const [index, provider] of providers.entries()) {
    await repository.createProvider(provider, seededPassword);
    await prisma.availabilitySlot.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          startIso: new Date(Date.now() + (index + 2) * 60 * 60 * 1000),
          endIso: new Date(Date.now() + (index + 3) * 60 * 60 * 1000),
          isBooked: false
        },
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          startIso: new Date(Date.now() + (index + 26) * 60 * 60 * 1000),
          endIso: new Date(Date.now() + (index + 27) * 60 * 60 * 1000),
          isBooked: false
        }
      ]
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
