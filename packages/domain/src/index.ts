import {
  Address,
  EstimateConfidenceTier,
  InstantQuoteRequest,
  InstantQuoteResponse,
  PropertySlope,
  QuoteFollowUpAnswer,
  QuoteFollowUpQuestion,
  ServiceCategory,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CustomerProperty,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  PropertyMeasurementEstimate,
  ProviderProfile
} from "@yardmatch/contracts";

export class GeoService {
  // Haversine math keeps provider matching deterministic across clients and the API.
  public distanceMiles(a: Address, b: Address): number {
    const radiusMiles = 3958.8;
    const dLat = this.toRadians(b.point.latitude - a.point.latitude);
    const dLon = this.toRadians(b.point.longitude - a.point.longitude);
    const latA = this.toRadians(a.point.latitude);
    const latB = this.toRadians(b.point.latitude);
    const haversine =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

    return 2 * radiusMiles * Math.asin(Math.sqrt(haversine));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}

export class ProviderMatchService {
  private static readonly sponsorshipBoost = 35;

  public constructor(private readonly geoService: GeoService) {}

  // Ranking blends proximity, service radius, and reputation into one simple score.
  public rankProviders(customerAddress: Address, providers: ProviderProfile[]): ProviderProfile[] {
    return [...providers].sort((left, right) => {
      const leftScore = this.scoreProvider(customerAddress, left);
      const rightScore = this.scoreProvider(customerAddress, right);
      return rightScore - leftScore;
    });
  }

  private scoreProvider(customerAddress: Address, provider: ProviderProfile): number {
    const distance = this.geoService.distanceMiles(customerAddress, provider.address);
    const distanceScore = Math.max(0, provider.serviceRadiusMiles - distance);
    const sponsorshipScore = provider.sponsoredListingEnabled
      ? ProviderMatchService.sponsorshipBoost
      : 0;

    return distanceScore * 10 + provider.rating * 20 + provider.reviewCount * 0.03 + sponsorshipScore;
  }
}

export class SchedulingService {
  // This helper picks the first open slot that can hold the requested duration.
  public findFirstAvailableSlot(
    slots: AvailabilitySlot[],
    durationMinutes: number
  ): AvailabilitySlot | undefined {
    return slots.find((slot) => {
      if (slot.isBooked) {
        return false;
      }

      const start = new Date(slot.startIso).getTime();
      const end = new Date(slot.endIso).getTime();
      return end - start >= durationMinutes * 60_000;
    });
  }

  public buildCalendarFeed(slots: AvailabilitySlot[]): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YardMatch//Availability//EN"];

    for (const slot of slots) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${slot.id}@yardmatch.local`);
      lines.push(`DTSTART:${slot.startIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(`DTEND:${slot.endIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push("SUMMARY:YardMatch Availability");
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\n");
  }
}

export class BookingLifecycleService {
  // Booking creation stays centralized so pricing and status defaults never drift by client.
  public createBooking(id: string, payload: CreateBookingRequest & { customerId: string }): Booking {
    return {
      id,
      customerId: payload.customerId,
      providerId: payload.providerId,
      serviceAddress: payload.serviceAddress,
      servicePropertyId: payload.servicePropertyId,
      category: payload.category,
      requestedAt: new Date().toISOString(),
      scheduledStartIso: payload.scheduledStartIso,
      scheduledEndIso: payload.scheduledEndIso,
      status: "requested",
      notes: payload.notes,
      totalCents: payload.totalCents,
      addressChangeHistory: []
    };
  }
}

export class PropertyBookService {
  // Customer properties are stored separately from bookings so bookings can keep immutable snapshots.
  public createProperty(
    id: string,
    payload: CreateCustomerPropertyRequest & { customerId?: string }
  ): CustomerProperty {
    return {
      id,
      label: payload.label,
      address: payload.address,
      gateCode: payload.gateCode,
      accessNotes: payload.accessNotes,
      lawnSizeSqFt: payload.lawnSizeSqFt,
      shrubBedSqFt: payload.shrubBedSqFt,
      drivewaySqFt: payload.drivewaySqFt,
      sidewalkLinearFt: payload.sidewalkLinearFt,
      isDefault: payload.setAsDefault ?? false,
      createdAt: new Date().toISOString()
    };
  }

  public setDefaultProperty(properties: CustomerProperty[], propertyId: string): CustomerProperty[] {
    return properties.map((property) => ({
      ...property,
      isDefault: property.id === propertyId
    }));
  }
}

export class BookingAddressPolicyService {
  public constructor(private readonly geoService: GeoService) {}

  // Address changes are only auto-approved when they remain operationally safe.
  public evaluateAddressChange(input: {
    booking: Booking;
    provider: ProviderProfile;
    newAddress: Address;
  }): {
    outcome: "updated" | "requires-provider-review" | "blocked";
    reason: string;
  } {
    if (input.booking.status === "in-progress" || input.booking.status === "completed") {
      return {
        outcome: "blocked",
        reason: "The crew is already working or the job is complete, so the address can no longer be changed."
      };
    }

    const serviceStart = new Date(input.booking.scheduledStartIso).getTime();
    const hoursUntilService = (serviceStart - Date.now()) / (60 * 60 * 1000);
    const distanceMiles = this.geoService.distanceMiles(input.newAddress, input.provider.address);

    if (distanceMiles > input.provider.serviceRadiusMiles) {
      return {
        outcome: "blocked",
        reason: "The new address is outside the provider's service radius."
      };
    }

    if (input.booking.status === "requested") {
      return {
        outcome: "updated",
        reason: "The booking has not been confirmed yet, so the address can be updated immediately."
      };
    }

    if (hoursUntilService >= 24) {
      return {
        outcome: "requires-provider-review",
        reason:
          "The booking is confirmed, so the provider should review the route impact and approve the address change."
      };
    }

    return {
      outcome: "blocked",
      reason:
        "The booking starts in less than 24 hours, so address changes are blocked and should be handled by support."
    };
  }

  public buildAddressChangeHistoryEntry(input: {
    bookingId: string;
    customerId: string;
    previousAddress: Address;
    requestedAddress: Address;
    requestedPropertyId?: string;
    outcome: "updated" | "requires-provider-review" | "blocked";
    reason: string;
  }): BookingAddressChangeRequest {
    return {
      id: crypto.randomUUID(),
      bookingId: input.bookingId,
      previousAddress: input.previousAddress,
      requestedAddress: input.requestedAddress,
      requestedPropertyId: input.requestedPropertyId,
      requestedAt: new Date().toISOString(),
      requestedByCustomerId: input.customerId,
      outcome: input.outcome,
      reason: input.reason
    };
  }
}

export class InstantQuoteEngine {
  // The current implementation is a low-friction heuristic scaffold designed to be replaced or
  // augmented by licensed aerial imagery and ML later without changing the API shape.
  public buildQuote(input: {
    request: InstantQuoteRequest;
    property?: CustomerProperty;
  }): InstantQuoteResponse {
    const measurements = this.estimateMeasurements(input.request.address, input.property, input.request);
    const confidenceScore = this.calculateConfidenceScore(input.property, input.request.followUpAnswers ?? []);
    const confidenceTier = this.toConfidenceTier(confidenceScore);
    const durationMinutes = this.estimateDurationMinutes(input.request.category, measurements);
    const estimatedPriceCents = this.estimatePriceCents(input.request.category, measurements, durationMinutes);
    const estimatedCrewSize = durationMinutes >= 180 ? 2 : 1;
    const followUpQuestions =
      confidenceTier === "high"
        ? []
        : this.buildFollowUpQuestions(input.request.category, measurements, input.request.followUpAnswers ?? []);

    return {
      address: input.request.address,
      category: input.request.category,
      source: input.property ? "hybrid-imagery-plus-confirmation" : "address-heuristic",
      confidenceScore,
      confidenceTier,
      estimatedPriceCents,
      estimatedDurationMinutes: durationMinutes,
      estimatedCrewSize,
      estimateSummary: this.buildSummary(input.request.category, measurements, durationMinutes, confidenceTier),
      measurements,
      followUpQuestions,
      quoteReadyForCheckout: followUpQuestions.length === 0
    };
  }

  private estimateMeasurements(
    address: Address,
    property: CustomerProperty | undefined,
    request: InstantQuoteRequest
  ): PropertyMeasurementEstimate {
    const geocodeSignal = Math.abs(Math.round(address.point.latitude * 1000 + address.point.longitude * 1000));
    const baselineTurf = 2200 + (geocodeSignal % 4500);
    const turfSqFt =
      property?.lawnSizeSqFt ??
      this.answerAsNumber(request.followUpAnswers, "turf_sq_ft") ??
      baselineTurf;
    const shrubBedSqFt =
      property?.shrubBedSqFt ??
      this.answerAsNumber(request.followUpAnswers, "shrub_sq_ft") ??
      Math.round(turfSqFt * 0.18);
    const drivewaySqFt =
      property?.drivewaySqFt ??
      Math.round(420 + (Math.abs(Math.round(address.point.longitude * 1000)) % 700));
    const sidewalkLinearFt =
      property?.sidewalkLinearFt ??
      Math.round(24 + (Math.abs(Math.round(address.point.latitude * 1000)) % 60));

    return {
      turfSqFt,
      shrubBedSqFt,
      drivewaySqFt,
      sidewalkLinearFt,
      lotComplexity: this.estimateLotComplexity(turfSqFt, shrubBedSqFt),
      slope: this.estimateSlope(address)
    };
  }

  private calculateConfidenceScore(
    property: CustomerProperty | undefined,
    followUpAnswers: QuoteFollowUpAnswer[]
  ): number {
    const savedSignals =
      (property?.lawnSizeSqFt ? 1 : 0) +
      (property?.shrubBedSqFt ? 1 : 0) +
      (property?.drivewaySqFt ? 1 : 0);
    const answerBoost = Math.min(2, followUpAnswers.length) * 0.06;
    const propertyBoost = savedSignals * 0.08;
    return Math.min(0.95, 0.58 + propertyBoost + answerBoost);
  }

  private toConfidenceTier(score: number): EstimateConfidenceTier {
    if (score >= 0.82) {
      return "high";
    }

    if (score >= 0.68) {
      return "medium";
    }

    return "low";
  }

  private estimateDurationMinutes(
    category: ServiceCategory,
    measurements: PropertyMeasurementEstimate
  ): number {
    const complexityMultiplier =
      measurements.lotComplexity === "high" ? 1.28 : measurements.lotComplexity === "medium" ? 1.12 : 1;
    const slopeMultiplier = measurements.slope === "steep" ? 1.18 : measurements.slope === "moderate" ? 1.08 : 1;

    const baseMinutesByCategory: Record<ServiceCategory, number> = {
      "lawn-mowing": 25 + measurements.turfSqFt / 170,
      "hedge-trimming": 35 + measurements.shrubBedSqFt / 18,
      "mulch-installation": 55 + measurements.shrubBedSqFt / 10,
      "seasonal-cleanup": 45 + measurements.turfSqFt / 150 + measurements.shrubBedSqFt / 24,
      "weed-control": 28 + measurements.shrubBedSqFt / 14,
      "irrigation-check": 40 + measurements.turfSqFt / 400,
      "leaf-blowing": 22 + measurements.turfSqFt / 210,
      "aeration": 35 + measurements.turfSqFt / 160,
      "fertilization": 20 + measurements.turfSqFt / 260,
      "gutter-cleaning": 50 + measurements.sidewalkLinearFt / 3,
      "snow-shoveling": 18 + measurements.drivewaySqFt / 80 + measurements.sidewalkLinearFt / 2,
      "ice-melt-salting": 14 + measurements.drivewaySqFt / 120 + measurements.sidewalkLinearFt / 2.2,
      "snow-blowing": 16 + measurements.drivewaySqFt / 95 + measurements.sidewalkLinearFt / 2.4
    };

    return Math.ceil(baseMinutesByCategory[category] * complexityMultiplier * slopeMultiplier);
  }

  private estimatePriceCents(
    category: ServiceCategory,
    measurements: PropertyMeasurementEstimate,
    durationMinutes: number
  ): number {
    const baseTripCentsByCategory: Record<ServiceCategory, number> = {
      "lawn-mowing": 2800,
      "hedge-trimming": 4200,
      "mulch-installation": 6500,
      "seasonal-cleanup": 5200,
      "weed-control": 3000,
      "irrigation-check": 3900,
      "leaf-blowing": 2400,
      "aeration": 3600,
      "fertilization": 3300,
      "gutter-cleaning": 5200,
      "snow-shoveling": 2600,
      "ice-melt-salting": 2400,
      "snow-blowing": 3000
    };

    const laborCents = durationMinutes * 95;
    const areaPremium = Math.round((measurements.turfSqFt + measurements.shrubBedSqFt) * 0.12);
    return baseTripCentsByCategory[category] + laborCents + areaPremium;
  }

  private buildFollowUpQuestions(
    category: ServiceCategory,
    measurements: PropertyMeasurementEstimate,
    existingAnswers: QuoteFollowUpAnswer[]
  ): QuoteFollowUpQuestion[] {
    const unanswered = new Set(existingAnswers.map((answer) => answer.questionId));
    const questions = [
      {
        id: "turf_sq_ft",
        prompt: "About how much grass needs service?",
        inputType: "single-select" as const,
        helperText: "We only ask this when the automated estimate is uncertain.",
        options: [
          { label: "Under 2,000 sq ft", value: "1800" },
          { label: "2,000 to 5,000 sq ft", value: "3500" },
          { label: "5,000 to 9,000 sq ft", value: "7000" },
          { label: "Over 9,000 sq ft", value: "11000" }
        ]
      },
      {
        id: "shrub_sq_ft",
        prompt:
          category === "hedge-trimming" || category === "weed-control" || category === "mulch-installation"
            ? "How much shrub or bed area should we plan for?"
            : "Are there significant beds or shrubs around the yard?",
        inputType: "single-select" as const,
        helperText: `Current estimate: about ${measurements.shrubBedSqFt} sq ft.`,
        options: [
          { label: "Very little", value: "120" },
          { label: "A moderate amount", value: "350" },
          { label: "A lot", value: "700" }
        ]
      }
    ];

    return questions.filter((question) => !unanswered.has(question.id));
  }

  private buildSummary(
    category: ServiceCategory,
    measurements: PropertyMeasurementEstimate,
    durationMinutes: number,
    confidenceTier: EstimateConfidenceTier
  ): string {
    return `${this.titleCase(category)} looks like roughly ${measurements.turfSqFt.toLocaleString()} sq ft of turf with ${measurements.lotComplexity} complexity. We estimate about ${durationMinutes} minutes of work with ${confidenceTier} confidence.`;
  }

  private estimateLotComplexity(turfSqFt: number, shrubBedSqFt: number): PropertyMeasurementEstimate["lotComplexity"] {
    const complexityScore = turfSqFt / 3000 + shrubBedSqFt / 350;
    if (complexityScore >= 4.5) {
      return "high";
    }

    if (complexityScore >= 2.4) {
      return "medium";
    }

    return "low";
  }

  private estimateSlope(address: Address): PropertySlope {
    const signal = Math.abs(Math.round(address.point.latitude * 100));
    if (signal % 7 === 0) {
      return "steep";
    }

    if (signal % 3 === 0) {
      return "moderate";
    }

    return "flat";
  }

  private answerAsNumber(
    answers: QuoteFollowUpAnswer[] | undefined,
    questionId: string
  ): number | undefined {
    const answer = answers?.find((item) => item.questionId === questionId);
    if (!answer) {
      return undefined;
    }

    return typeof answer.value === "number" ? answer.value : Number(answer.value);
  }

  private titleCase(value: string): string {
    return value
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }
}
