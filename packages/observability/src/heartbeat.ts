import {
  MarketplaceRole,
  SessionHeartbeatRequest,
  TelemetryPlatformSurface
} from "@yardmatch/contracts";

export class SessionHeartbeatFactory {
  // The same payload shape lets web and mobile publish comparable active-user signals.
  public static create(input: {
    sessionId: string;
    actorId?: string;
    role?: MarketplaceRole;
    platform: TelemetryPlatformSurface;
    path: string;
  }): SessionHeartbeatRequest {
    return {
      sessionId: input.sessionId,
      actorId: input.actorId,
      role: input.role,
      platform: input.platform,
      path: input.path,
      occurredAt: new Date().toISOString()
    };
  }
}
