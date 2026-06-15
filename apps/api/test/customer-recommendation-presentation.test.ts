import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerProviderChoicePresentations,
  SearchProviderResult,
  ServiceCategory
} from "@yardmatch/contracts";

function createResult({
  id,
  companyName,
  distanceMiles,
  rating,
  timelinessRating,
  reviewCount,
  nearbyCompletedJobCount,
  completedJobCount,
  specialization,
  hasOpenSlot = true
}: {
  id: string;
  companyName: string;
  distanceMiles: number;
  rating: number;
  timelinessRating: number;
  reviewCount: number;
  nearbyCompletedJobCount: number;
  completedJobCount: number;
  specialization: number;
  hasOpenSlot?: boolean;
}): SearchProviderResult {
  const categories: ServiceCategory[] = ["lawn-mowing"];
  return {
    provider: {
      id,
      fullName: `${companyName} Owner`,
      email: `${id}@example.com`,
      phone: "555-0100",
      role: "provider",
      companyName,
      bio: `${companyName} bio`,
      yearsExperience: 8,
      serviceRadiusMiles: 18,
      minimumBookingLeadHours: 6,
      crewReviewLeadHours: 12,
      departureReminderLeadMinutes: 45,
      routeLeaderMode: "provider-only",
      weeklyPayoutDay: "Fri",
      instantPayoutsEnabled: false,
      verificationStatus: "verified",
      sponsoredListingEnabled: false,
      categories,
      rating,
      timelinessRating,
      attentionToDetailRating: 4.8,
      reviewCount,
      calendarConnection: {
        provider: "google",
        connected: true
      },
      address: {
        line1: "100 Market St",
        city: "Austin",
        state: "TX",
        postalCode: "78704",
        country: "US",
        point: {
          latitude: 30.25,
          longitude: -97.75
        }
      },
      createdAt: new Date().toISOString()
    },
    score: 90,
    distanceMiles,
    hasOpenSlot,
    suggestedSlot: hasOpenSlot
      ? {
          providerId: id,
          startIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          endIso: new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString(),
          isBooked: false
        }
      : undefined,
    reasons: ["Matches the requested service", "Open route window available"],
    completedJobCount,
    nearbyCompletedJobCount,
    availabilityConfidence: hasOpenSlot ? "high" : "low",
    availabilityConfidenceLabel: hasOpenSlot ? "High confidence in this window" : "No live route window right now",
    reliabilityLabel: "Consistently strong service history",
    reliabilityDetail: `${companyName} has a healthy mix of reviews, punctuality, and completed work.`,
    selectionSummaryLabel: "Best overall match for this property",
    selectionSummaryDetail: `${companyName} gives the strongest overall balance of fit and trust.`,
    neighborhoodFamiliarityLabel: "Knows this neighborhood well",
    neighborhoodFamiliarityDetail: `${companyName} has completed ${nearbyCompletedJobCount} jobs nearby.`,
    factors: {
      serviceFit: 9,
      specialization,
      distance: 8,
      reliability: 8,
      experience: 7,
      availability: hasOpenSlot ? 8 : 2,
      sponsorship: 0,
      issuePenalty: 0
    }
  };
}

test("customer provider choice presentations keep one recommendation and curated alternatives", () => {
  const results = [
    createResult({
      id: "recommended",
      companyName: "GreenRain Lawn Co.",
      distanceMiles: 4.2,
      rating: 4.9,
      timelinessRating: 4.9,
      reviewCount: 120,
      nearbyCompletedJobCount: 8,
      completedJobCount: 160,
      specialization: 8
    }),
    createResult({
      id: "highest-rated",
      companyName: "Five Star Turf",
      distanceMiles: 5.4,
      rating: 5,
      timelinessRating: 4.95,
      reviewCount: 210,
      nearbyCompletedJobCount: 4,
      completedJobCount: 90,
      specialization: 7
    }),
    createResult({
      id: "closest-route",
      companyName: "Corner Lot Lawn",
      distanceMiles: 1.8,
      rating: 4.7,
      timelinessRating: 4.7,
      reviewCount: 32,
      nearbyCompletedJobCount: 2,
      completedJobCount: 45,
      specialization: 5
    }),
    createResult({
      id: "local-specialist",
      companyName: "Neighborhood Green",
      distanceMiles: 6.1,
      rating: 4.8,
      timelinessRating: 4.85,
      reviewCount: 80,
      nearbyCompletedJobCount: 14,
      completedJobCount: 200,
      specialization: 9
    })
  ];

  const presentations = buildCustomerProviderChoicePresentations(results);

  assert.equal(presentations[0]?.badge, "Recommended for this property");
  assert.equal(presentations[0]?.heading, "Best overall match");
  assert.equal(presentations[1]?.badge, "Highest rated");
  assert.equal(presentations[2]?.badge, "Closest route");
  assert.equal(presentations[3]?.badge, "Local specialist");
});

test("customer provider choice presentations fall back to service-specialist messaging after curated labels are assigned", () => {
  const results = [
    createResult({
      id: "recommended",
      companyName: "GreenRain Lawn Co.",
      distanceMiles: 4.2,
      rating: 4.9,
      timelinessRating: 4.9,
      reviewCount: 120,
      nearbyCompletedJobCount: 8,
      completedJobCount: 160,
      specialization: 8
    }),
    createResult({
      id: "highest-rated",
      companyName: "Five Star Turf",
      distanceMiles: 6.4,
      rating: 5,
      timelinessRating: 4.95,
      reviewCount: 210,
      nearbyCompletedJobCount: 2,
      completedJobCount: 90,
      specialization: 6
    }),
    createResult({
      id: "closest-route",
      companyName: "Corner Lot Lawn",
      distanceMiles: 1.8,
      rating: 4.7,
      timelinessRating: 4.7,
      reviewCount: 32,
      nearbyCompletedJobCount: 1,
      completedJobCount: 45,
      specialization: 5
    }),
    createResult({
      id: "local-specialist",
      companyName: "Neighborhood Green",
      distanceMiles: 7.1,
      rating: 4.8,
      timelinessRating: 4.85,
      reviewCount: 80,
      nearbyCompletedJobCount: 14,
      completedJobCount: 200,
      specialization: 6
    }),
    createResult({
      id: "service-specialist",
      companyName: "Trim Detail Pros",
      distanceMiles: 8.2,
      rating: 4.6,
      timelinessRating: 4.6,
      reviewCount: 28,
      nearbyCompletedJobCount: 0,
      completedJobCount: 16,
      specialization: 8
    })
  ];

  const presentations = buildCustomerProviderChoicePresentations(results);

  assert.equal(presentations[4]?.badge, "Service specialist");
  assert.equal(presentations[4]?.heading, "Focused on this type of work");
});
