import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";
import { resolveSeedPassword } from "./seedConfig";

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

  const now = new Date().toISOString();
  const seededPassword = hashPassword(resolveSeedPassword());

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
      minimumBookingLeadHours: 0,
      staffingMode: "review-first" as const,
      crewReviewLeadHours: 24,
      departureReminderLeadMinutes: 60,
      routeLeaderMode: "provider-only" as const,
      weeklyPayoutDay: "Thu" as const,
      instantPayoutsEnabled: false,
      verificationStatus: "verified" as const,
      verificationSubmittedAt: now,
      verificationReviewedAt: now,
      verificationNotes: "Seeded local provider verification for development.",
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
      minimumBookingLeadHours: 0,
      staffingMode: "review-first" as const,
      crewReviewLeadHours: 24,
      departureReminderLeadMinutes: 60,
      routeLeaderMode: "provider-only" as const,
      weeklyPayoutDay: "Thu" as const,
      instantPayoutsEnabled: false,
      verificationStatus: "verified" as const,
      verificationSubmittedAt: now,
      verificationReviewedAt: now,
      verificationNotes: "Seeded local provider verification for development.",
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

  async function ensureProviderAvailability(providerId: string, offsetIndex: number) {
    const futureSlots = await prisma.availabilitySlot.findMany({
      where: {
        providerId,
        startIso: {
          gt: new Date()
        }
      }
    });

    const qualifyingSlots = futureSlots.filter(
      (slot) => slot.endIso.getTime() - slot.startIso.getTime() >= 3 * 60 * 60 * 1000
    );

    if (qualifyingSlots.length >= 2) {
      return;
    }

    await prisma.availabilitySlot.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          providerId,
          startIso: new Date(Date.now() + (offsetIndex + 48) * 60 * 60 * 1000),
          endIso: new Date(Date.now() + (offsetIndex + 52) * 60 * 60 * 1000),
          isBooked: false
        },
        {
          id: crypto.randomUUID(),
          providerId,
          startIso: new Date(Date.now() + (offsetIndex + 72) * 60 * 60 * 1000),
          endIso: new Date(Date.now() + (offsetIndex + 76) * 60 * 60 * 1000),
          isBooked: false
        }
      ]
    });
  }

  for (const [index, provider] of providers.entries()) {
    const existingProvider = await prisma.userAccount.findUnique({
      where: { email: provider.email }
    });
    if (!existingProvider) {
      await repository.createProvider(provider, seededPassword);
    } else {
      await prisma.userAccount.update({
        where: { id: existingProvider.id },
        data: {
          fullName: provider.fullName,
          phone: provider.phone,
          address: provider.address,
          passwordHash: seededPassword
        }
      });
      await prisma.providerBusinessProfile.update({
        where: { userId: existingProvider.id },
        data: {
          companyName: provider.companyName,
          bio: provider.bio,
          yearsExperience: provider.yearsExperience,
          serviceRadiusMiles: provider.serviceRadiusMiles,
          minimumBookingLeadHours: provider.minimumBookingLeadHours,
          staffingMode: provider.staffingMode,
          crewReviewLeadHours: provider.crewReviewLeadHours,
          departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
          routeLeaderMode: provider.routeLeaderMode,
          weeklyPayoutDay: provider.weeklyPayoutDay,
          instantPayoutsEnabled: provider.instantPayoutsEnabled,
          verificationStatus: provider.verificationStatus,
          verificationSubmittedAt: provider.verificationSubmittedAt
            ? new Date(provider.verificationSubmittedAt)
            : null,
          verificationReviewedAt: provider.verificationReviewedAt
            ? new Date(provider.verificationReviewedAt)
            : null,
          verificationNotes: provider.verificationNotes,
          sponsoredListingEnabled: provider.sponsoredListingEnabled,
          categories: provider.categories,
          rating: provider.rating,
          timelinessRating: provider.timelinessRating,
          attentionToDetailRating: provider.attentionToDetailRating,
          reviewCount: provider.reviewCount,
          calendarConnection: provider.calendarConnection
        }
      });
    }

    await ensureProviderAvailability(existingProvider?.id ?? provider.id, index);
  }

  const seededOpsEmail = "ops@example.com";
  const existingOps = await prisma.userAccount.findUnique({
    where: { email: seededOpsEmail }
  });
  if (!existingOps) {
    await repository.createOpsUser(
      {
        id: crypto.randomUUID(),
        fullName: "Casey Ops",
        email: seededOpsEmail,
        phone: "555-0990",
        role: "ops",
        address: createAddress("18 Bay Ave", "Barnegat", "NJ", "08005", 39.7532, -74.2229),
        createdAt: now,
        internalScope: "admin"
      },
      seededPassword
    );
  } else if (existingOps.role === "ops") {
    await prisma.userAccount.update({
      where: { id: existingOps.id },
      data: {
        fullName: "Casey Ops",
        phone: "555-0990",
        internalScope: "admin",
        address: createAddress("18 Bay Ave", "Barnegat", "NJ", "08005", 39.7532, -74.2229),
        passwordHash: seededPassword
      }
    });
  }

  const seededCustomerEmail = "jordan@example.com";
  const existingCustomer = await prisma.userAccount.findUnique({
    where: { email: seededCustomerEmail }
  });
  let customerId = existingCustomer?.id;
  let defaultPropertyId = "";

  if (!existingCustomer) {
    const propertyId = crypto.randomUUID();
    const customer = await repository.createCustomer(
      {
        id: crypto.randomUUID(),
        fullName: "Jordan Rivera",
        email: seededCustomerEmail,
        phone: "555-0200",
        role: "customer",
        address: createAddress("150 Prospect Ave", "Brooklyn", "NY", "11215", 40.6692, -73.9827),
        createdAt: now,
        propertyNotes: "Side gate near driveway.",
        lawnSizeSqFt: 3900,
        defaultPropertyId: propertyId,
        properties: [
          {
            id: propertyId,
            label: "Primary home",
            address: createAddress("150 Prospect Ave", "Brooklyn", "NY", "11215", 40.6692, -73.9827),
            accessNotes: "Side gate near driveway.",
            lawnSizeSqFt: 3900,
            shrubBedSqFt: 420,
            drivewaySqFt: 560,
            sidewalkLinearFt: 48,
            isDefault: true,
            createdAt: now
          }
        ]
      },
      seededPassword
    );
    customerId = customer.id;
    defaultPropertyId = customer.defaultPropertyId;
  } else {
    customerId = existingCustomer.id;
    await prisma.userAccount.update({
      where: { id: existingCustomer.id },
      data: { passwordHash: seededPassword }
    });
    const customerProfile = await repository.findCustomerById(existingCustomer.id);
    defaultPropertyId = customerProfile?.defaultPropertyId ?? "";
  }

  const seededCrewEmail = "crew@example.com";
  const existingCrew = await prisma.userAccount.findUnique({
    where: { email: seededCrewEmail }
  });
  if (!existingCrew) {
    await repository.createCrewMember(
      {
        id: crypto.randomUUID(),
        fullName: "Maya Brooks",
        email: seededCrewEmail,
        phone: "555-0300",
        role: "crew-member",
        address: createAddress("170 5th Ave", "Brooklyn", "NY", "11217", 40.6761, -73.9804),
        createdAt: now,
        bio: "Reliable crew member for lawn care, cleanup, and seasonal work.",
        yearsExperience: 3,
        categories: ["lawn-mowing", "seasonal-cleanup", "leaf-blowing"],
        availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        willingToTravelMiles: 20,
        preferredSchedule: "flex",
        hasOwnEquipment: false,
        winterWorkEnabled: true,
        rating: 4.9,
        completedJobs: 28,
        cancellationCount: 0,
        status: "available"
      },
      seededPassword
    );
  } else {
    await prisma.userAccount.update({
      where: { id: existingCrew.id },
      data: {
        fullName: "Maya Brooks",
        phone: "555-0300",
        address: createAddress("170 5th Ave", "Brooklyn", "NY", "11217", 40.6761, -73.9804),
        passwordHash: seededPassword
      }
    });
    await prisma.crewMemberProfile.update({
      where: { userId: existingCrew.id },
      data: {
        bio: "Reliable crew member for lawn care, cleanup, and seasonal work.",
        yearsExperience: 3,
        categories: ["lawn-mowing", "seasonal-cleanup", "leaf-blowing"],
        availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        willingToTravelMiles: 20,
        preferredSchedule: "flex",
        hasOwnEquipment: false,
        winterWorkEnabled: true,
        rating: 4.9,
        completedJobs: 28,
        cancellationCount: 0,
        status: "available"
      }
    });
  }

  const primaryProvider = await prisma.userAccount.findUnique({
    where: { email: "ariana@greenstride.example" }
  });

  if (customerId && defaultPropertyId && primaryProvider) {
    const existingBooking = await prisma.booking.findFirst({
      where: {
        customerId,
        providerId: primaryProvider.id,
        notes: "Seeded YardMatch booking"
      }
    });

    if (!existingBooking) {
      await prisma.booking.create({
        data: {
          id: crypto.randomUUID(),
          customerId,
          providerId: primaryProvider.id,
          serviceAddress: {
            line1: "150 Prospect Ave",
            city: "Brooklyn",
            state: "NY",
            postalCode: "11215",
            country: "US",
            point: {
              latitude: 40.6692,
              longitude: -73.9827
            }
          },
          servicePropertyId: defaultPropertyId,
          category: "lawn-mowing",
          requestedAt: new Date(),
          scheduledStartIso: new Date(Date.now() + 48 * 60 * 60 * 1000),
          scheduledEndIso: new Date(Date.now() + 49 * 60 * 60 * 1000),
          status: "confirmed",
          notes: "Seeded YardMatch booking",
          totalCents: 6800,
          addressChangeHistory: [],
          serviceEvidence: [],
          interventions: []
        }
      });
    }
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
