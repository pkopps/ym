import {
  Address,
  EstimateConfidenceTier,
  InstantQuoteRequest,
  InstantQuoteResponse,
  NormalizedAddressSummary,
  PropertySlope,
  PropertyMeasurementEstimateSources,
  PropertyMeasurementSource,
  QuoteConfidenceReason,
  QuoteFollowUpAnswer,
  QuoteFollowUpQuestion,
  ServiceCategory,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CustomerProperty,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  ExternalCalendarBlock,
  getExternalCalendarBlockLabel,
  PropertyMeasurementEstimate,
  ProviderCalendarEvent,
  ProviderDispatchDaySummary,
  ProviderDispatchRouteStatus,
  ProviderDispatchWindowSummary,
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

    return distanceScore * 10 + provider.rating * 20 + provider.reviewCount * 0.03;
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

  public buildProviderBookingCalendarFeed(input: {
    providerName: string;
    bookings: Array<{
      id: string;
      category: Booking["category"];
      customerName: string;
      addressLine: string;
      city: string;
      state: string;
      scheduledStartIso: string;
      scheduledEndIso: string;
      status: Booking["status"];
      notes?: string;
    }>;
  }): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YardMatch//ProviderSchedule//EN"];

    for (const booking of input.bookings) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${booking.id}@yardmatch.local`);
      lines.push(`DTSTART:${booking.scheduledStartIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(`DTEND:${booking.scheduledEndIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(
        `SUMMARY:${this.escapeIcsText(`${input.providerName}: ${this.titleCaseCategory(booking.category)} for ${booking.customerName}`)}`
      );
      lines.push(
        `DESCRIPTION:${this.escapeIcsText(
          `Status: ${booking.status}. ${booking.notes?.trim() || "YardMatch booked service."}`
        )}`
      );
      lines.push(`LOCATION:${this.escapeIcsText(`${booking.addressLine}, ${booking.city}, ${booking.state}`)}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\n");
  }

  public buildProviderCombinedCalendarFeed(input: {
    providerName: string;
    bookings: Array<{
      id: string;
      category: Booking["category"];
      customerName: string;
      addressLine: string;
      city: string;
      state: string;
      scheduledStartIso: string;
      scheduledEndIso: string;
      status: Booking["status"];
      notes?: string;
    }>;
    externalBlocks: ExternalCalendarBlock[];
  }): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YardMatch//ProviderSchedule//EN"];

    for (const booking of input.bookings) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${booking.id}@yardmatch.local`);
      lines.push(`DTSTART:${booking.scheduledStartIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(`DTEND:${booking.scheduledEndIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(
        `SUMMARY:${this.escapeIcsText(`${input.providerName}: ${this.titleCaseCategory(booking.category)} for ${booking.customerName}`)}`
      );
      lines.push(
        `DESCRIPTION:${this.escapeIcsText(
          `YardMatch booking. Status: ${booking.status}. ${booking.notes?.trim() || "Scheduled service."}`
        )}`
      );
      lines.push(`LOCATION:${this.escapeIcsText(`${booking.addressLine}, ${booking.city}, ${booking.state}`)}`);
      lines.push("END:VEVENT");
    }

    for (const block of input.externalBlocks) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${block.id}@yardmatch-external.local`);
      lines.push(`DTSTART:${block.startIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(`DTEND:${block.endIso.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`);
      lines.push(`SUMMARY:${this.escapeIcsText(`${input.providerName}: ${block.title}`)}`);
      lines.push(
        `DESCRIPTION:${this.escapeIcsText(
          `${getExternalCalendarBlockLabel(block.blockType)}.${block.notes ? ` ${block.notes}` : ""}`
        )}`
      );
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\n");
  }

  public buildProviderCalendarEvents(input: {
    bookings: Array<{
      id: string;
      category: Booking["category"];
      customerName: string;
      addressLine: string;
      city: string;
      state: string;
      scheduledStartIso: string;
      scheduledEndIso: string;
      status: Booking["status"];
      notes?: string;
    }>;
    externalBlocks: ExternalCalendarBlock[];
  }): ProviderCalendarEvent[] {
    const bookingEvents: ProviderCalendarEvent[] = input.bookings.map((booking) => ({
      id: booking.id,
      source: "yardmatch-booking",
      title: `${this.titleCaseCategory(booking.category)} for ${booking.customerName}`,
      startIso: booking.scheduledStartIso,
      endIso: booking.scheduledEndIso,
      isBlockingAvailability: true,
      addressLine: booking.addressLine,
      city: booking.city,
      state: booking.state,
      status: booking.status,
      customerName: booking.customerName,
      bookingId: booking.id,
      category: booking.category,
      notes: booking.notes
    }));

    const externalEvents: ProviderCalendarEvent[] = input.externalBlocks.map((block) => ({
      id: block.id,
      source: "external-block",
      title: block.title,
      startIso: block.startIso,
      endIso: block.endIso,
      isBlockingAvailability: true,
      blockType: block.blockType,
      notes: block.notes
    }));

    return [...bookingEvents, ...externalEvents].sort((left, right) =>
      left.startIso.localeCompare(right.startIso)
    );
  }

  public buildProviderDispatchDays(input: {
    providerAddress: Address;
    bookings: Array<{
      id: string;
      category: Booking["category"];
      customerName: string;
      addressLine: string;
      city: string;
      state: string;
      scheduledStartIso: string;
      scheduledEndIso: string;
      status: Booking["status"];
      notes?: string;
      serviceAddress: Address;
      requiredCrewMembers: number;
      assignedCrewMembers: number;
    }>;
    externalBlocks: ExternalCalendarBlock[];
  }): ProviderDispatchDaySummary[] {
    const grouped = new Map<
      string,
      {
        bookings: typeof input.bookings;
        externalBlocks: ExternalCalendarBlock[];
      }
    >();

    for (const booking of input.bookings) {
      const key = this.localDateKey(booking.scheduledStartIso);
      const current = grouped.get(key) ?? { bookings: [], externalBlocks: [] };
      current.bookings.push(booking);
      grouped.set(key, current);
    }

    for (const block of input.externalBlocks) {
      const key = this.localDateKey(block.startIso);
      const current = grouped.get(key) ?? { bookings: [], externalBlocks: [] };
      current.externalBlocks.push(block);
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dayKey, dayGroup]) => {
        const sortedBookings = [...dayGroup.bookings].sort((left, right) =>
          left.scheduledStartIso.localeCompare(right.scheduledStartIso)
        );
        const firstBooking = sortedBookings[0];
        const lastBooking = sortedBookings.at(-1);
        const bookedMinutes = sortedBookings.reduce(
          (sum, booking) =>
            sum + (new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime()) / 60_000,
          0
        );
        const blockedMinutes = dayGroup.externalBlocks.reduce(
          (sum, block) => sum + (new Date(block.endIso).getTime() - new Date(block.startIso).getTime()) / 60_000,
          0
        );
        const totalCrewRequired = sortedBookings.reduce((sum, booking) => sum + booking.requiredCrewMembers, 0);
        const totalCrewAssigned = sortedBookings.reduce((sum, booking) => sum + booking.assignedCrewMembers, 0);
        const crewGap = Math.max(totalCrewRequired - totalCrewAssigned, 0);
        const routeHeuristics = this.analyzeDailyRoute(input.providerAddress, sortedBookings);
        const windowSummaries = this.buildDispatchWindowSummaries({
          dayKey,
          bookings: sortedBookings,
          externalBlocks: dayGroup.externalBlocks
        });
        const routeStatus = this.getDispatchRouteStatus({
          crewGap,
          yardmatchJobCount: sortedBookings.length,
          estimatedDriveMiles: routeHeuristics.estimatedDriveMiles,
          longestDriveLegMiles: routeHeuristics.longestDriveLegMiles,
          largestIdleGapMinutes: routeHeuristics.largestIdleGapMinutes,
          blockedMinutes
        });

        return {
          dateIso: `${dayKey}T00:00:00.000Z`,
          dayLabel: this.formatDispatchDayLabel(dayKey),
          yardmatchJobCount: sortedBookings.length,
          externalBlockCount: dayGroup.externalBlocks.length,
          totalCrewRequired,
          totalCrewAssigned,
          crewGap,
          bookedMinutes,
          blockedMinutes,
          estimatedDriveMiles: routeHeuristics.estimatedDriveMiles,
          longestDriveLegMiles: routeHeuristics.longestDriveLegMiles,
          largestIdleGapMinutes: routeHeuristics.largestIdleGapMinutes,
          outlierStopCount: routeHeuristics.outlierStopCount,
          firstJobStartIso: firstBooking?.scheduledStartIso,
          lastJobEndIso: lastBooking?.scheduledEndIso,
          firstStopAddressLine: firstBooking?.addressLine,
          routeStatus,
          recommendations: this.buildDispatchRecommendations({
            routeStatus,
            crewGap,
            estimatedDriveMiles: routeHeuristics.estimatedDriveMiles,
            longestDriveLegMiles: routeHeuristics.longestDriveLegMiles,
            largestIdleGapMinutes: routeHeuristics.largestIdleGapMinutes,
            outlierStopCount: routeHeuristics.outlierStopCount,
            yardmatchJobCount: sortedBookings.length,
            externalBlockCount: dayGroup.externalBlocks.length
          }),
          windowSummaries
        };
      });
  }

  private titleCaseCategory(category: Booking["category"]): string {
    return category
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private escapeIcsText(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
  }

  private buildDispatchWindowSummaries(input: {
    dayKey: string;
    bookings: Array<{
      scheduledStartIso: string;
      scheduledEndIso: string;
      requiredCrewMembers: number;
      assignedCrewMembers: number;
    }>;
    externalBlocks: ExternalCalendarBlock[];
  }): ProviderDispatchWindowSummary[] {
    const windows: ProviderDispatchWindowSummary[] = [
      {
        windowKey: "morning",
        label: "Morning",
        yardmatchJobCount: 0,
        externalBlockCount: 0,
        totalCrewRequired: 0,
        totalCrewAssigned: 0,
        crewGap: 0,
        bookedMinutes: 0,
        blockedMinutes: 0
      },
      {
        windowKey: "afternoon",
        label: "Afternoon",
        yardmatchJobCount: 0,
        externalBlockCount: 0,
        totalCrewRequired: 0,
        totalCrewAssigned: 0,
        crewGap: 0,
        bookedMinutes: 0,
        blockedMinutes: 0
      },
      {
        windowKey: "late-afternoon-night",
        label: "Late afternoon / evening",
        yardmatchJobCount: 0,
        externalBlockCount: 0,
        totalCrewRequired: 0,
        totalCrewAssigned: 0,
        crewGap: 0,
        bookedMinutes: 0,
        blockedMinutes: 0
      }
    ];

    const windowByKey = new Map(windows.map((window) => [window.windowKey, window]));

    for (const booking of input.bookings) {
      const windowKey = this.getServiceWindowKey(booking.scheduledStartIso);
      const summary = windowByKey.get(windowKey);
      if (!summary) {
        continue;
      }

      summary.yardmatchJobCount += 1;
      summary.totalCrewRequired += booking.requiredCrewMembers;
      summary.totalCrewAssigned += booking.assignedCrewMembers;
      summary.crewGap = Math.max(summary.totalCrewRequired - summary.totalCrewAssigned, 0);
      summary.bookedMinutes +=
        (new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime()) / 60_000;
    }

    for (const block of input.externalBlocks) {
      for (const summary of windows) {
        const overlapMinutes = this.getWindowOverlapMinutes(input.dayKey, summary.windowKey, block.startIso, block.endIso);
        if (overlapMinutes > 0) {
          summary.externalBlockCount += 1;
          summary.blockedMinutes += overlapMinutes;
        }
      }
    }

    return windows;
  }

  private getDispatchRouteStatus(input: {
    crewGap: number;
    yardmatchJobCount: number;
    estimatedDriveMiles: number;
    longestDriveLegMiles: number;
    largestIdleGapMinutes: number;
    blockedMinutes: number;
  }): ProviderDispatchRouteStatus {
    if (
      input.crewGap > 0 ||
      input.yardmatchJobCount >= 5 ||
      input.estimatedDriveMiles >= 40 ||
      input.longestDriveLegMiles >= 14 ||
      input.largestIdleGapMinutes >= 180 ||
      input.blockedMinutes >= 240
    ) {
      return "overloaded";
    }

    if (
      input.yardmatchJobCount >= 3 ||
      input.estimatedDriveMiles >= 22 ||
      input.longestDriveLegMiles >= 8 ||
      input.largestIdleGapMinutes >= 90 ||
      input.blockedMinutes >= 120
    ) {
      return "watch";
    }

    return "comfortable";
  }

  private buildDispatchRecommendations(input: {
    routeStatus: ProviderDispatchRouteStatus;
    crewGap: number;
    estimatedDriveMiles: number;
    longestDriveLegMiles: number;
    largestIdleGapMinutes: number;
    outlierStopCount: number;
    yardmatchJobCount: number;
    externalBlockCount: number;
  }): string[] {
    const recommendations: string[] = [];

    if (input.crewGap > 0) {
      recommendations.push(
        `Add ${input.crewGap} more crew ${input.crewGap === 1 ? "slot" : "slots"} or rebalance accepted jobs.`
      );
    }
    if (input.estimatedDriveMiles >= 22) {
      recommendations.push("Consider shifting one stop or adding a travel buffer.");
    }
    if (input.longestDriveLegMiles >= 8) {
      recommendations.push(
        `One stop sits about ${input.longestDriveLegMiles} mi off route. Consider resequencing or moving that visit.`
      );
    }
    if (input.largestIdleGapMinutes >= 90) {
      recommendations.push(
        `There is a ${this.formatMinutesAsDuration(input.largestIdleGapMinutes)} idle gap between stops. Tighten timing or add nearby work.`
      );
    }
    if (input.externalBlockCount > 0 && input.yardmatchJobCount > 0) {
      recommendations.push("Outside calendar blocks are tightening this route.");
    }
    if (recommendations.length === 0) {
      recommendations.push(
        input.routeStatus === "comfortable"
          ? "This day looks balanced."
          : "Keep an eye on this day as bookings change."
      );
    }

    return recommendations.slice(0, 3);
  }

  private analyzeDailyRoute(
    providerAddress: Address,
    bookings: Array<{
      scheduledStartIso: string;
      scheduledEndIso: string;
      serviceAddress: Address;
    }>
  ): {
    estimatedDriveMiles: number;
    longestDriveLegMiles: number;
    largestIdleGapMinutes: number;
    outlierStopCount: number;
  } {
    if (bookings.length === 0) {
      return {
        estimatedDriveMiles: 0,
        longestDriveLegMiles: 0,
        largestIdleGapMinutes: 0,
        outlierStopCount: 0
      };
    }

    let miles = 0;
    let longestDriveLegMiles = 0;
    let largestIdleGapMinutes = 0;
    let outlierStopCount = 0;
    let currentAddress = providerAddress;
    const geo = new GeoService();
    bookings.forEach((booking, index) => {
      const legMiles = geo.distanceMiles(currentAddress, booking.serviceAddress);
      miles += legMiles;
      longestDriveLegMiles = Math.max(longestDriveLegMiles, legMiles);
      if (legMiles >= 8) {
        outlierStopCount += 1;
      }

      const nextBooking = bookings[index + 1];
      if (nextBooking) {
        const idleGapMinutes = Math.max(
          0,
          Math.round(
            (new Date(nextBooking.scheduledStartIso).getTime() - new Date(booking.scheduledEndIso).getTime()) / 60_000
          )
        );
        largestIdleGapMinutes = Math.max(largestIdleGapMinutes, idleGapMinutes);
      }

      currentAddress = booking.serviceAddress;
    });

    return {
      estimatedDriveMiles: Number(miles.toFixed(1)),
      longestDriveLegMiles: Number(longestDriveLegMiles.toFixed(1)),
      largestIdleGapMinutes,
      outlierStopCount
    };
  }

  private formatMinutesAsDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
  }

  private localDateKey(iso: string): string {
    const date = new Date(iso);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatDispatchDayLabel(dayKey: string): string {
    const date = new Date(`${dayKey}T12:00:00`);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  private getServiceWindowKey(iso: string): ProviderDispatchWindowSummary["windowKey"] {
    const hour = new Date(iso).getHours();
    if (hour < 12) {
      return "morning";
    }
    if (hour < 16) {
      return "afternoon";
    }
    return "late-afternoon-night";
  }

  private getWindowOverlapMinutes(
    dayKey: string,
    windowKey: ProviderDispatchWindowSummary["windowKey"],
    startIso: string,
    endIso: string
  ): number {
    const [startHour, endHour] =
      windowKey === "morning" ? [7, 12] : windowKey === "afternoon" ? [12, 16] : [16, 20];
    const windowStart = new Date(`${dayKey}T00:00:00`);
    windowStart.setHours(startHour, 0, 0, 0);
    const windowEnd = new Date(`${dayKey}T00:00:00`);
    windowEnd.setHours(endHour, 0, 0, 0);
    const eventStart = new Date(startIso);
    const eventEnd = new Date(endIso);

    const overlapStart = Math.max(windowStart.getTime(), eventStart.getTime());
    const overlapEnd = Math.min(windowEnd.getTime(), eventEnd.getTime());
    return overlapEnd > overlapStart ? Math.round((overlapEnd - overlapStart) / 60_000) : 0;
  }
}

export class BookingLifecycleService {
  // Booking creation stays centralized so pricing and status defaults never drift by client.
  public createBooking(id: string, payload: CreateBookingRequest & { customerId: string }): Booking {
    return {
      id,
      customerId: payload.customerId,
      providerId: payload.providerId,
      launchLeadId: payload.launchLeadId,
      serviceAddress: payload.serviceAddress,
      servicePropertyId: payload.servicePropertyId,
      category: payload.category,
      requestedAt: new Date().toISOString(),
      scheduledStartIso: payload.scheduledStartIso,
      scheduledEndIso: payload.scheduledEndIso,
      status: "requested",
      notes: payload.notes,
      totalCents: payload.totalCents,
      serviceEvidence: [],
      interventions: [],
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
    normalizedAddress?: NormalizedAddressSummary;
  }): Omit<InstantQuoteResponse, "launchPricingPolicy"> {
    const { measurements, measurementSources } = this.estimateMeasurements(
      input.request.address,
      input.property,
      input.request
    );
    const confidenceScore = this.calculateConfidenceScore({
      category: input.request.category,
      property: input.property,
      followUpAnswers: input.request.followUpAnswers ?? [],
      measurements,
      measurementSources
    });
    const confidenceTier = this.toConfidenceTier(confidenceScore);
    const durationMinutes = this.estimateDurationMinutes(input.request.category, measurements);
    const estimatedPriceCents = this.estimatePriceCents(input.request.category, measurements, durationMinutes);
    const estimatedCrewSize = durationMinutes >= 180 ? 2 : 1;
    const followUpQuestions =
      confidenceTier === "high"
        ? []
        : this.buildFollowUpQuestions(input.request.category, measurements, input.request.followUpAnswers ?? []);
    const confidenceReasons = this.buildConfidenceReasons(
      measurementSources,
      input.property,
      input.request.followUpAnswers ?? [],
      measurements
    );

    return {
      address: input.request.address,
      normalizedAddress:
        input.normalizedAddress ?? {
          displayLabel: this.formatAddressLabel(input.request.address),
          wasNormalized: false,
          normalizedFields: []
        },
      category: input.request.category,
      source: input.property ? "hybrid-imagery-plus-confirmation" : "address-heuristic",
      confidenceScore,
      confidenceTier,
      confidenceReasons,
      estimatedPriceCents,
      estimatedDurationMinutes: durationMinutes,
      estimatedCrewSize,
      estimateSummary: this.buildSummary(input.request.category, measurements, durationMinutes, confidenceTier),
      measurements,
      measurementSources,
      followUpQuestions,
      quoteReadyForCheckout: followUpQuestions.length === 0
    };
  }

  private estimateMeasurements(
    address: Address,
    property: CustomerProperty | undefined,
    request: InstantQuoteRequest
  ): {
    measurements: PropertyMeasurementEstimate;
    measurementSources: PropertyMeasurementEstimateSources;
  } {
    const geocodeSignal = Math.abs(Math.round(address.point.latitude * 1000 + address.point.longitude * 1000));
    const baselineTurf = 2200 + (geocodeSignal % 4500);
    const turfAnswer = this.answerAsNumber(request.followUpAnswers, "turf_sq_ft");
    const shrubAnswer = this.answerAsNumber(request.followUpAnswers, "shrub_sq_ft");
    const drivewayAnswer = this.answerAsNumber(request.followUpAnswers, "driveway_sq_ft");
    const sidewalkAnswer = this.answerAsNumber(request.followUpAnswers, "sidewalk_linear_ft");
    const lotComplexityAnswer = this.answerAsString(request.followUpAnswers, "lot_complexity");
    const turfSqFt = property?.lawnSizeSqFt ?? turfAnswer ?? baselineTurf;
    const shrubBedSqFt = property?.shrubBedSqFt ?? shrubAnswer ?? Math.round(turfSqFt * 0.18);
    const drivewaySqFt =
      property?.drivewaySqFt ??
      drivewayAnswer ??
      Math.round(420 + (Math.abs(Math.round(address.point.longitude * 1000)) % 700));
    const sidewalkLinearFt =
      property?.sidewalkLinearFt ??
      sidewalkAnswer ??
      Math.round(24 + (Math.abs(Math.round(address.point.latitude * 1000)) % 60));

    return {
      measurements: {
        turfSqFt,
        shrubBedSqFt,
        drivewaySqFt,
        sidewalkLinearFt,
        lotComplexity: this.resolveLotComplexity(turfSqFt, shrubBedSqFt, lotComplexityAnswer),
        slope: this.estimateSlope(address)
      },
      measurementSources: {
        turfSqFt: this.resolveMeasurementSource(property?.lawnSizeSqFt, turfAnswer),
        shrubBedSqFt: this.resolveMeasurementSource(property?.shrubBedSqFt, shrubAnswer),
        drivewaySqFt: this.resolveMeasurementSource(property?.drivewaySqFt, drivewayAnswer),
        sidewalkLinearFt: this.resolveMeasurementSource(property?.sidewalkLinearFt, sidewalkAnswer)
      }
    };
  }

  private calculateConfidenceScore(input: {
    category: ServiceCategory;
    property: CustomerProperty | undefined;
    followUpAnswers: QuoteFollowUpAnswer[];
    measurements: PropertyMeasurementEstimate;
    measurementSources: PropertyMeasurementEstimateSources;
  }): number {
    const { category, property, followUpAnswers, measurements, measurementSources } = input;
    const savedSignals =
      (property?.lawnSizeSqFt ? 1 : 0) +
      (property?.shrubBedSqFt ? 1 : 0) +
      (property?.drivewaySqFt ? 1 : 0);
    const heuristicMeasurementCount = Object.values(measurementSources).filter(
      (source) => source === "address-heuristic"
    ).length;
    const answerBoost = Math.min(3, followUpAnswers.length) * 0.05;
    const propertyBoost = savedSignals * 0.08;
    const complexityPenalty =
      measurements.lotComplexity === "high" ? 0.06 : measurements.lotComplexity === "medium" ? 0.03 : 0;
    const slopePenalty =
      measurements.slope === "steep" ? 0.05 : measurements.slope === "moderate" ? 0.02 : 0;
    const heuristicPenalty = heuristicMeasurementCount * 0.025;
    const categoryPenalty =
      !property && ["seasonal-cleanup", "mulch-installation", "hedge-trimming"].includes(category) ? 0.04 : 0;

    return Math.max(
      0.42,
      Math.min(
        0.95,
        0.6 + propertyBoost + answerBoost - complexityPenalty - slopePenalty - heuristicPenalty - categoryPenalty
      )
    );
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
      },
      {
        id: "driveway_sq_ft",
        prompt: "About how much driveway or parking area needs winter service?",
        inputType: "single-select" as const,
        helperText: `Current estimate: about ${measurements.drivewaySqFt} sq ft.`,
        options: [
          { label: "Single-car driveway", value: "320" },
          { label: "Two-car driveway", value: "640" },
          { label: "Long or wide driveway", value: "1100" },
          { label: "Large parking area", value: "1800" }
        ]
      },
      {
        id: "sidewalk_linear_ft",
        prompt: "How much sidewalk or walkway should be cleared?",
        inputType: "single-select" as const,
        helperText: `Current estimate: about ${measurements.sidewalkLinearFt} linear ft.`,
        options: [
          { label: "Short front walk", value: "20" },
          { label: "Typical sidewalk and walk", value: "55" },
          { label: "Corner lot or long walk", value: "100" },
          { label: "Large walkways", value: "160" }
        ]
      },
      {
        id: "lot_complexity",
        prompt: "How intricate is the property layout?",
        inputType: "single-select" as const,
        helperText: `Current estimate: ${measurements.lotComplexity} complexity based on the address and property pattern.`,
        options: [
          { label: "Mostly open and simple", value: "low" },
          { label: "Some beds, turns, or obstacles", value: "medium" },
          { label: "Tight layout with lots of detail work", value: "high" }
        ]
      }
    ];

    return questions.filter((question) => {
      if (unanswered.has(question.id)) {
        return false;
      }

      if (question.id === "driveway_sq_ft" || question.id === "sidewalk_linear_ft") {
        return this.isWinterHardscapeCategory(category);
      }

      if (this.isWinterHardscapeCategory(category) && (question.id === "turf_sq_ft" || question.id === "shrub_sq_ft")) {
        return false;
      }

      if (question.id === "lot_complexity") {
        return measurements.lotComplexity !== "low" || category === "seasonal-cleanup";
      }

      return true;
    });
  }

  private buildSummary(
    category: ServiceCategory,
    measurements: PropertyMeasurementEstimate,
    durationMinutes: number,
    confidenceTier: EstimateConfidenceTier
  ): string {
    return `${this.titleCase(category)} looks like roughly ${measurements.turfSqFt.toLocaleString()} sq ft of turf with ${measurements.lotComplexity} complexity. We estimate about ${durationMinutes} minutes of work with ${confidenceTier} confidence.`;
  }

  private buildConfidenceReasons(
    measurementSources: PropertyMeasurementEstimateSources,
    property: CustomerProperty | undefined,
    followUpAnswers: QuoteFollowUpAnswer[],
    measurements: PropertyMeasurementEstimate
  ): QuoteConfidenceReason[] {
    const reasons: QuoteConfidenceReason[] = [];
    const sources = Object.values(measurementSources);
    const savedMeasurementCount = sources.filter((source) => source === "saved-property").length;
    const followUpMeasurementCount = sources.filter((source) => source === "customer-follow-up").length;
    const heuristicMeasurementCount = sources.filter((source) => source === "address-heuristic").length;

    if (savedMeasurementCount > 0) {
      reasons.push({
        impact: "positive",
        label: "Saved property details improved the estimate",
        detail:
          savedMeasurementCount >= 3
            ? "Multiple property measurements were already saved, so the quote relies less on fallback assumptions."
            : "Some property measurements were already saved, which makes the quote more grounded than an address-only estimate."
      });
    }

    if (followUpAnswers.length > 0 || followUpMeasurementCount > 0) {
      reasons.push({
        impact: "positive",
        label: "Your answers sharpened the quote",
        detail:
          "Customer-provided size details replaced part of the default model, which improves confidence before checkout."
      });
    }

    if (!property && heuristicMeasurementCount >= 2) {
      reasons.push({
        impact: "warning",
        label: "Some measurements are still modeled from the address",
        detail:
          "Without saved property details, YardMatch is still estimating parts of the job from location patterns and property heuristics."
      });
    } else if (heuristicMeasurementCount > 0) {
      reasons.push({
        impact: "warning",
        label: "A few job details still use fallback assumptions",
        detail:
          "Driveway, sidewalk, or bed dimensions are still estimated until more property details are confirmed."
      });
    }

    if (measurements.lotComplexity === "high" || measurements.slope === "steep") {
      reasons.push({
        impact: "warning",
        label: "The property layout may still swing the final scope",
        detail:
          measurements.lotComplexity === "high"
            ? "The current estimate sees a more intricate property layout, so final routing and detail work could move the onsite scope slightly."
            : "The current estimate sees more slope than a flat property, which can move labor time until the crew confirms the site."
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        impact: "positive",
        label: "The quote is using a stable property profile",
        detail: "Saved property measurements are doing most of the work for this estimate."
      });
    }

    return reasons;
  }

  private resolveLotComplexity(
    turfSqFt: number,
    shrubBedSqFt: number,
    answerValue: string | undefined
  ): PropertyMeasurementEstimate["lotComplexity"] {
    if (answerValue === "low" || answerValue === "medium" || answerValue === "high") {
      return answerValue;
    }

    return this.estimateLotComplexity(turfSqFt, shrubBedSqFt);
  }

  private resolveMeasurementSource(
    savedValue: number | undefined,
    answerValue: number | undefined
  ): PropertyMeasurementSource {
    if (typeof savedValue === "number" && savedValue > 0) {
      return "saved-property";
    }

    if (typeof answerValue === "number" && Number.isFinite(answerValue)) {
      return "customer-follow-up";
    }

    return "address-heuristic";
  }

  private isWinterHardscapeCategory(category: ServiceCategory): boolean {
    return category === "snow-shoveling" || category === "snow-blowing" || category === "ice-melt-salting";
  }

  private formatAddressLabel(address: Address): string {
    return [address.line1, address.city, `${address.state} ${address.postalCode}`]
      .filter(Boolean)
      .join(", ");
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

  private answerAsString(
    answers: QuoteFollowUpAnswer[] | undefined,
    questionId: string
  ): string | undefined {
    const answer = answers?.find((item) => item.questionId === questionId);
    if (!answer) {
      return undefined;
    }

    return typeof answer.value === "string" ? answer.value : String(answer.value);
  }

  private titleCase(value: string): string {
    return value
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }
}

export const YARDMATCH_ECONOMICS_POLICY_VERSION = "2026-07-provider-funded-v1" as const;

export interface MarketplaceEconomicsPolicy {
  version: string;
  finderFeeCents: number;
  completedJobFeeCents: number;
  feeBearer: "provider";
  processorCostBearer: "platform";
  crewResponsibility: "provider";
}

export const ACTIVE_MARKETPLACE_ECONOMICS_POLICY: MarketplaceEconomicsPolicy = Object.freeze({
  version: YARDMATCH_ECONOMICS_POLICY_VERSION,
  finderFeeCents: 3_000,
  completedJobFeeCents: 699,
  feeBearer: "provider",
  processorCostBearer: "platform",
  crewResponsibility: "provider"
});

export interface MarketplaceSettlementInput {
  customerChargeCents: number;
  isFirstCompletedCustomerProviderJob: boolean;
  actualProcessorFeeCents?: number;
  policy?: MarketplaceEconomicsPolicy;
}

export interface MarketplaceSettlementBreakdown {
  policyVersion: string;
  customerChargeCents: number;
  providerServiceGrossCents: number;
  finderFeeCents: number;
  completedJobFeeCents: number;
  platformGrossRevenueCents: number;
  actualProcessorFeeCents: number;
  platformNetRevenueCents: number;
  providerNetCents: number;
  crewPayoutByYardMatchCents: 0;
  feeBearer: "provider";
  processorCostBearer: "platform";
  crewResponsibility: "provider";
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents.`);
  }
}

/**
 * The launch model keeps the customer price unchanged, deducts YardMatch's published
 * provider fees from provider proceeds, and leaves crew compensation entirely inside
 * the provider business. Processor cost is a platform expense and never silently
 * changes the provider's already-promised settlement.
 */
export function calculateMarketplaceSettlement(
  input: MarketplaceSettlementInput
): MarketplaceSettlementBreakdown {
  const policy = input.policy ?? ACTIVE_MARKETPLACE_ECONOMICS_POLICY;
  const processorFeeCents = input.actualProcessorFeeCents ?? 0;
  assertNonNegativeInteger(input.customerChargeCents, "customerChargeCents");
  assertNonNegativeInteger(processorFeeCents, "actualProcessorFeeCents");
  assertNonNegativeInteger(policy.finderFeeCents, "finderFeeCents");
  assertNonNegativeInteger(policy.completedJobFeeCents, "completedJobFeeCents");

  const finderFeeCents = input.isFirstCompletedCustomerProviderJob
    ? policy.finderFeeCents
    : 0;
  const platformGrossRevenueCents = finderFeeCents + policy.completedJobFeeCents;
  const providerNetCents = input.customerChargeCents - platformGrossRevenueCents;
  if (providerNetCents < 0) {
    throw new Error(
      `Booking charge is too small for economics policy ${policy.version}; provider proceeds would be negative.`
    );
  }

  return {
    policyVersion: policy.version,
    customerChargeCents: input.customerChargeCents,
    providerServiceGrossCents: input.customerChargeCents,
    finderFeeCents,
    completedJobFeeCents: policy.completedJobFeeCents,
    platformGrossRevenueCents,
    actualProcessorFeeCents: processorFeeCents,
    platformNetRevenueCents: platformGrossRevenueCents - processorFeeCents,
    providerNetCents,
    crewPayoutByYardMatchCents: 0,
    feeBearer: policy.feeBearer,
    processorCostBearer: policy.processorCostBearer,
    crewResponsibility: policy.crewResponsibility
  };
}

export type FinancialLedgerDirection = "debit" | "credit";
export type FinancialLedgerAccount =
  | "stripe-clearing"
  | "provider-payable"
  | "platform-finder-fee-revenue"
  | "platform-job-fee-revenue"
  | "payment-processing-expense";

export interface SettlementLedgerDraftEntry {
  account: FinancialLedgerAccount;
  direction: FinancialLedgerDirection;
  amountCents: number;
  idempotencyKey: string;
}

export function buildSettlementLedgerDraft(
  bookingId: string,
  settlement: MarketplaceSettlementBreakdown
): SettlementLedgerDraftEntry[] {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error("bookingId is required to build a financial ledger draft.");
  }

  const entries: SettlementLedgerDraftEntry[] = [
    {
      account: "stripe-clearing",
      direction: "debit",
      amountCents: settlement.customerChargeCents,
      idempotencyKey: `${normalizedBookingId}:settlement:stripe-clearing:debit`
    },
    {
      account: "provider-payable",
      direction: "credit",
      amountCents: settlement.providerNetCents,
      idempotencyKey: `${normalizedBookingId}:settlement:provider-payable:credit`
    },
    {
      account: "platform-job-fee-revenue",
      direction: "credit",
      amountCents: settlement.completedJobFeeCents,
      idempotencyKey: `${normalizedBookingId}:settlement:job-fee:credit`
    }
  ];

  if (settlement.finderFeeCents > 0) {
    entries.push({
      account: "platform-finder-fee-revenue",
      direction: "credit",
      amountCents: settlement.finderFeeCents,
      idempotencyKey: `${normalizedBookingId}:settlement:finder-fee:credit`
    });
  }

  if (settlement.actualProcessorFeeCents > 0) {
    entries.push(
      {
        account: "payment-processing-expense",
        direction: "debit",
        amountCents: settlement.actualProcessorFeeCents,
        idempotencyKey: `${normalizedBookingId}:processing-fee:expense:debit`
      },
      {
        account: "stripe-clearing",
        direction: "credit",
        amountCents: settlement.actualProcessorFeeCents,
        idempotencyKey: `${normalizedBookingId}:processing-fee:clearing:credit`
      }
    );
  }

  const debitCents = entries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const creditCents = entries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  if (debitCents !== creditCents) {
    throw new Error(`Financial ledger draft is unbalanced: debits=${debitCents}, credits=${creditCents}.`);
  }

  return entries.filter((entry) => entry.amountCents > 0);
}
