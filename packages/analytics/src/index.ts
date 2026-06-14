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
    const recommendationViews = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationPresented);
    const recommendationAlternativesViewed = this.countEvents(
      MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed
    );
    const recommendationDismissals = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationDismissed);
    const acceptedRecommendations = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationAccepted);
    const swappedRecommendations = this.countEvents(MarketplaceTelemetryEventCatalog.recommendationSwapped);
    const providerBookingConfirmations = this.countEvents(MarketplaceTelemetryEventCatalog.bookingConfirmed);
    const providerBookingDeclines = this.countEvents(MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider);
    const customerBookingCancellations = this.events.filter(
      (event) =>
        event.name === MarketplaceTelemetryEventCatalog.bookingCancelled &&
        event.properties.actorRole === "customer"
    ).length;
    const paymentAuthorizations = this.countEvents(MarketplaceTelemetryEventCatalog.paymentAuthorized);
    const paymentCaptures = this.countEvents(MarketplaceTelemetryEventCatalog.paymentCaptured);
    const recommendationMetricsBySource = this.buildRecommendationMetricsBySource();

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
      recommendationViews,
      recommendationAlternativesViewed,
      recommendationDismissals,
      acceptedRecommendations,
      swappedRecommendations,
      recommendationAcceptanceRate:
        recommendationViews > 0 ? acceptedRecommendations / recommendationViews : 0,
      providerBookingConfirmations,
      providerBookingDeclines,
      customerBookingCancellations,
      paymentAuthorizations,
      paymentCaptures,
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

  private buildRecommendationMetricsBySource(): RecommendationSurfaceMetrics[] {
    const relevantEvents = this.events.filter((event) =>
      [
        MarketplaceTelemetryEventCatalog.recommendationPresented,
        MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
        MarketplaceTelemetryEventCatalog.recommendationDismissed,
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
          recommendationViews: 0,
          recommendationAlternativesViewed: 0,
          recommendationDismissals: 0,
          acceptedRecommendations: 0,
          swappedRecommendations: 0,
          recommendationAcceptanceRate: 0
        };

      if (event.name === MarketplaceTelemetryEventCatalog.recommendationPresented) {
        current.recommendationViews += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed) {
        current.recommendationAlternativesViewed += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationDismissed) {
        current.recommendationDismissals += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationAccepted) {
        current.acceptedRecommendations += 1;
      } else if (event.name === MarketplaceTelemetryEventCatalog.recommendationSwapped) {
        current.swappedRecommendations += 1;
      }

      current.recommendationAcceptanceRate =
        current.recommendationViews > 0
          ? current.acceptedRecommendations / current.recommendationViews
          : 0;

      metrics.set(requestSource, current);
    }

    return [...metrics.values()].sort((left, right) => {
      if (right.recommendationViews !== left.recommendationViews) {
        return right.recommendationViews - left.recommendationViews;
      }

      return left.requestSource.localeCompare(right.requestSource);
    });
  }
}
