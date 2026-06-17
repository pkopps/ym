import {
  ActiveSession,
  AnalyticsEvent,
  Booking,
  ObservabilityOverview,
  RecommendationSurfaceMetrics,
  SessionHeartbeatRequest,
  SupportTicket,
  TelemetryPlatformSurface
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";

interface RecommendationSessionMetrics {
  providerSearches: number;
  providerSearchesNoResults: number;
  providerSearchesNoOpenWindows: number;
  providerSearchCoverageRate: number;
  providerSearchOpenWindowRate: number;
  recommendationViews: number;
  recommendationAlternativesViewed: number;
  recommendationAlternativeRevealRate: number;
  recommendationDismissals: number;
  recommendationDismissalRate: number;
  recommendationBookingIntents: number;
  recommendationBookingIntentRate: number;
  acceptedRecommendations: number;
  swappedRecommendations: number;
  recommendationAcceptanceRate: number;
  recommendationSwapRate: number;
}

interface RecommendationSessionState {
  requestSource: string;
  searched: boolean;
  noResults: boolean;
  noOpenWindows: boolean;
  presented: boolean;
  alternativesViewed: boolean;
  dismissed: boolean;
  bookingIntent: boolean;
  accepted: boolean;
  swapped: boolean;
}

export class DataEngineeringLogger {
  private readonly events: AnalyticsEvent[] = [];
  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly activeWindowMs = 5 * 60 * 1000;

  // Persisting to memory now makes local demos easy while preserving the ingestion shape.
  public record(event: AnalyticsEvent): AnalyticsEvent {
    this.events.push(event);
    return event;
  }

  public recordFunnelStep(name: string, actorId: string, properties: AnalyticsEvent["properties"]) {
    return this.record({
      id: crypto.randomUUID(),
      name,
      actorId,
      occurredAt: new Date().toISOString(),
      properties
    });
  }

  // Session heartbeats give us an operational definition of "active users right now".
  public recordSessionHeartbeat(payload: SessionHeartbeatRequest): ActiveSession {
    const session: ActiveSession = {
      sessionId: payload.sessionId,
      actorId: payload.actorId,
      role: payload.role,
      platform: payload.platform,
      path: payload.path,
      lastSeenAt: payload.occurredAt
    };

    this.activeSessions.set(payload.sessionId, session);
    this.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.sessionHeartbeat,
      occurredAt: payload.occurredAt,
      actorId: payload.actorId,
      properties: {
        platform: payload.platform,
        path: payload.path,
        role: payload.role ?? "anonymous"
      }
    });
    return session;
  }

  public getOverview(input: {
    bookings: Booking[];
    supportTickets: SupportTicket[];
  }): ObservabilityOverview {
    const activeSessions = this.getActiveSessions();
    const providerSearches = this.countEvents(MarketplaceTelemetryEventCatalog.providerSearchPerformed);
    const providerSearchesNoResults = this.countEvents(MarketplaceTelemetryEventCatalog.providerSearchNoResults);
    const providerSearchesNoOpenWindows = this.countEvents(
      MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows
    );
    const recommendationViews = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationPresented);
    const recommendationAlternativesViewed = this.countEvents(
      MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed
    );
    const recommendationDismissals = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationDismissed);
    const recommendationBookingIntents = this.countEvents(
      MarketplaceTelemetryEventCatalog.recommendationBookingIntent
    );
    const acceptedRecommendations = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationAccepted);
    const swappedRecommendations = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationSwapped);
    const providerBookingConfirmations = this.countEvents(MarketplaceTelemetryEventCatalog.bookingConfirmed);
    const providerBookingDeclines = this.countEvents(MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider);
    const customerBookingCancellations = this.events.filter(
      (event) =>
        event.name === MarketplaceTelemetryEventCatalog.bookingCancelled &&
        event.properties.actorRole === "customer"
    ).length;
    const paymentCheckoutStarts = this.countEvents(MarketplaceTelemetryEventCatalog.paymentCheckoutStarted);
    const paymentAuthorizations = this.countEvents(MarketplaceTelemetryEventCatalog.paymentAuthorized);
    const paymentCaptures = this.countEvents(MarketplaceTelemetryEventCatalog.paymentCaptured);
    const paymentFailures = this.countEvents(MarketplaceTelemetryEventCatalog.paymentFailed);
    const recommendationMetricsBySource = this.buildRecommendationMetricsBySource();
    const recommendationRates = this.buildRecommendationSessionMetrics();

    return {
      generatedAt: new Date().toISOString(),
      totalBookings: input.bookings.length,
      requestedBookings: input.bookings.filter((booking) => booking.status === "requested").length,
      bookingsLast24Hours: input.bookings.filter((booking) => this.happenedWithinLastDay(booking.requestedAt))
        .length,
      refundRequestedCount: this.events.filter(
        (event) => event.name === MarketplaceTelemetryEventCatalog.refundRequested
      ).length,
      openSupportTickets: input.supportTickets.filter((ticket) => ticket.status !== "resolved").length,
      providerSearches,
      providerSearchesNoResults,
      providerSearchesNoOpenWindows,
      providerSearchCoverageRate: recommendationRates.providerSearchCoverageRate,
      providerSearchOpenWindowRate: recommendationRates.providerSearchOpenWindowRate,
      recommendationViews,
      recommendationAlternativesViewed,
      recommendationAlternativeRevealRate: recommendationRates.recommendationAlternativeRevealRate,
      recommendationDismissals,
      recommendationDismissalRate: recommendationRates.recommendationDismissalRate,
      recommendationBookingIntents,
      recommendationBookingIntentRate: recommendationRates.recommendationBookingIntentRate,
      acceptedRecommendations,
      swappedRecommendations,
      recommendationAcceptanceRate: recommendationRates.recommendationAcceptanceRate,
      recommendationSwapRate: recommendationRates.recommendationSwapRate,
      providerBookingConfirmations,
      providerBookingDeclines,
      customerBookingCancellations,
      paymentCheckoutStarts,
      paymentAuthorizations,
      paymentCaptures,
      paymentFailures,
      recommendationMetricsBySource,
      activeUsers5m: activeSessions.length,
      activeCustomers5m: activeSessions.filter((session) => session.role === "customer").length,
      activeProviders5m: activeSessions.filter((session) => session.role === "provider").length,
      activeCrewMembers5m: activeSessions.filter((session) => session.role === "crew-member").length,
      activeUsersByPlatform: this.countPlatforms(activeSessions),
      recentEvents: [...this.events].slice(-12).reverse()
    };
  }

  public listEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  private getActiveSessions(): ActiveSession[] {
    const cutoff = Date.now() - this.activeWindowMs;
    const sessions = [...this.activeSessions.values()].filter((session) => {
      return new Date(session.lastSeenAt).getTime() >= cutoff;
    });

    // Removing expired sessions keeps the in-memory store small for local development.
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (new Date(session.lastSeenAt).getTime() < cutoff) {
        this.activeSessions.delete(sessionId);
      }
    }

    return sessions;
  }

  private countPlatforms(
    sessions: ActiveSession[]
  ): Partial<Record<TelemetryPlatformSurface, number>> {
    return sessions.reduce<Partial<Record<TelemetryPlatformSurface, number>>>((accumulator, session) => {
      accumulator[session.platform] = (accumulator[session.platform] ?? 0) + 1;
      return accumulator;
    }, {});
  }

  private happenedWithinLastDay(isoDate: string): boolean {
    return new Date(isoDate).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }

  private countEvents(name: string): number {
    return this.events.filter((event) => event.name === name).length;
  }

  private buildRecommendationSessionMetrics(
    requestSource?: string
  ): RecommendationSessionMetrics {
    const sessions = this.buildRecommendationSessions(requestSource);
    const sessionRecords = [...sessions.values()];
    const providerSearches = sessionRecords.filter((session) => session.searched).length;
    const providerSearchesNoResults = sessionRecords.filter((session) => session.noResults).length;
    const providerSearchesNoOpenWindows = sessionRecords.filter((session) => session.noOpenWindows).length;
    const recommendationViews = sessionRecords.filter((session) => session.presented).length;
    const recommendationAlternativesViewed = sessionRecords.filter(
      (session) => session.alternativesViewed
    ).length;
    const recommendationDismissals = sessionRecords.filter((session) => session.dismissed).length;
    const recommendationBookingIntents = sessionRecords.filter((session) => session.bookingIntent).length;
    const acceptedRecommendations = sessionRecords.filter((session) => session.accepted).length;
    const swappedRecommendations = sessionRecords.filter((session) => session.swapped).length;

    return {
      providerSearches,
      providerSearchesNoResults,
      providerSearchesNoOpenWindows,
      providerSearchCoverageRate:
        providerSearches > 0 ? (providerSearches - providerSearchesNoResults) / providerSearches : 0,
      providerSearchOpenWindowRate:
        providerSearches > 0
          ? (providerSearches - providerSearchesNoResults - providerSearchesNoOpenWindows) /
            providerSearches
          : 0,
      recommendationViews,
      recommendationAlternativesViewed,
      recommendationAlternativeRevealRate:
        recommendationViews > 0 ? recommendationAlternativesViewed / recommendationViews : 0,
      recommendationDismissals,
      recommendationDismissalRate:
        recommendationViews > 0 ? recommendationDismissals / recommendationViews : 0,
      recommendationBookingIntents,
      recommendationBookingIntentRate:
        recommendationViews > 0 ? recommendationBookingIntents / recommendationViews : 0,
      acceptedRecommendations,
      swappedRecommendations,
      recommendationAcceptanceRate:
        recommendationViews > 0 ? acceptedRecommendations / recommendationViews : 0,
      recommendationSwapRate:
        recommendationViews > 0 ? swappedRecommendations / recommendationViews : 0
    };
  }

  private buildRecommendationSessions(
    requestSource?: string
  ): Map<string, RecommendationSessionState> {
    const relevantEvents = this.events.filter((event) =>
      [
        MarketplaceTelemetryEventCatalog.providerSearchPerformed,
        MarketplaceTelemetryEventCatalog.providerSearchNoResults,
        MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows,
        MarketplaceTelemetryEventCatalog.recommendationPresented,
        MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
        MarketplaceTelemetryEventCatalog.recommendationDismissed,
        MarketplaceTelemetryEventCatalog.recommendationBookingIntent,
        MarketplaceTelemetryEventCatalog.recommendationAccepted,
        MarketplaceTelemetryEventCatalog.recommendationSwapped
      ].includes(event.name)
    );
    const sessions = new Map<string, RecommendationSessionState>();

    for (const event of relevantEvents) {
      const recommendationSessionId =
        typeof event.properties.recommendationSessionId === "string" &&
        event.properties.recommendationSessionId.trim().length > 0
          ? event.properties.recommendationSessionId
          : undefined;
      if (!recommendationSessionId) {
        continue;
      }

      const resolvedRequestSource = this.resolveRecommendationRequestSource(event);
      if (requestSource && resolvedRequestSource !== requestSource) {
        continue;
      }

      const current =
        sessions.get(recommendationSessionId) ??
        {
          requestSource: resolvedRequestSource,
          searched: false,
          noResults: false,
          noOpenWindows: false,
          presented: false,
          alternativesViewed: false,
          dismissed: false,
          bookingIntent: false,
          accepted: false,
          swapped: false
        };

      if (event.name === MarketplaceTelemetryEventCatalog.providerSearchPerformed) {
        current.searched = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.providerSearchNoResults) {
        current.noResults = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows) {
        current.noOpenWindows = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationPresented) {
        current.presented = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed) {
        current.alternativesViewed = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationDismissed) {
        current.dismissed = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationBookingIntent) {
        current.bookingIntent = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAccepted) {
        current.accepted = true;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationSwapped) {
        current.swapped = true;
      }

      sessions.set(recommendationSessionId, current);
    }

    return sessions;
  }

  private buildRecommendationMetricsBySource(): RecommendationSurfaceMetrics[] {
    const relevantEvents = this.events.filter((event) =>
      [
        MarketplaceTelemetryEventCatalog.providerSearchPerformed,
        MarketplaceTelemetryEventCatalog.providerSearchNoResults,
        MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows,
        MarketplaceTelemetryEventCatalog.recommendationPresented,
        MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
        MarketplaceTelemetryEventCatalog.recommendationDismissed,
        MarketplaceTelemetryEventCatalog.recommendationBookingIntent,
        MarketplaceTelemetryEventCatalog.recommendationAccepted,
        MarketplaceTelemetryEventCatalog.recommendationSwapped
      ].includes(event.name)
    );

    const metrics = new Map<string, RecommendationSurfaceMetrics>();

    for (const event of relevantEvents) {
      const requestSource =
        typeof event.properties.requestSource === "string" && event.properties.requestSource.trim().length > 0
          ? event.properties.requestSource
          : typeof event.properties.recommendationSource === "string" &&
              event.properties.recommendationSource.trim().length > 0
            ? event.properties.recommendationSource
          : "unknown";
      const current =
        metrics.get(requestSource) ??
        {
          requestSource,
          providerSearches: 0,
          providerSearchesNoResults: 0,
          providerSearchesNoOpenWindows: 0,
          providerSearchCoverageRate: 0,
          providerSearchOpenWindowRate: 0,
          recommendationViews: 0,
          recommendationAlternativesViewed: 0,
          recommendationAlternativeRevealRate: 0,
          recommendationDismissals: 0,
          recommendationDismissalRate: 0,
          recommendationBookingIntents: 0,
          recommendationBookingIntentRate: 0,
          acceptedRecommendations: 0,
          swappedRecommendations: 0,
          recommendationAcceptanceRate: 0,
          recommendationSwapRate: 0
        };

      if (event.name === MarketplaceTelemetryEventCatalog.providerSearchPerformed) {
        current.providerSearches += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.providerSearchNoResults) {
        current.providerSearchesNoResults += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows) {
        current.providerSearchesNoOpenWindows += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationPresented) {
        current.recommendationViews += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed) {
        current.recommendationAlternativesViewed += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationDismissed) {
        current.recommendationDismissals += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationBookingIntent) {
        current.recommendationBookingIntents += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAccepted) {
        current.acceptedRecommendations += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationSwapped) {
        current.swappedRecommendations += 1;
      }

      metrics.set(requestSource, current);
    }

    for (const [requestSource, current] of metrics.entries()) {
      const sessionMetrics = this.buildRecommendationSessionMetrics(requestSource);
      current.providerSearchCoverageRate = sessionMetrics.providerSearchCoverageRate;
      current.providerSearchOpenWindowRate = sessionMetrics.providerSearchOpenWindowRate;
      current.recommendationAlternativeRevealRate = sessionMetrics.recommendationAlternativeRevealRate;
      current.recommendationDismissalRate = sessionMetrics.recommendationDismissalRate;
      current.recommendationBookingIntentRate = sessionMetrics.recommendationBookingIntentRate;
      current.recommendationAcceptanceRate = sessionMetrics.recommendationAcceptanceRate;
      current.recommendationSwapRate = sessionMetrics.recommendationSwapRate;
      metrics.set(requestSource, current);
    }

    return [...metrics.values()].sort((left, right) => {
      if (right.recommendationViews !== left.recommendationViews) {
        return right.recommendationViews - left.recommendationViews;
      }

      return left.requestSource.localeCompare(right.requestSource);
    });
  }

  private resolveRecommendationRequestSource(event: AnalyticsEvent): string {
    if (typeof event.properties.requestSource === "string" && event.properties.requestSource.trim().length > 0) {
      return event.properties.requestSource;
    }

    if (
      typeof event.properties.recommendationSource === "string" &&
      event.properties.recommendationSource.trim().length > 0
    ) {
      return event.properties.recommendationSource;
    }

    return "unknown";
  }
}
