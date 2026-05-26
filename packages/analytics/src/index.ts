import {
  ActiveSession,
  AnalyticsEvent,
  Booking,
  ObservabilityOverview,
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
}
