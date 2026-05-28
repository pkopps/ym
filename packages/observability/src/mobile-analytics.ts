import {
  AnalyticsEvent,
  MarketplaceApiClient,
  MarketplaceRole,
  TelemetryPlatformSurface
} from "@yardmatch/contracts";

export class MobileAnalyticsTracker {
  public constructor(
    private readonly api: MarketplaceApiClient,
    private readonly role: MarketplaceRole,
    private readonly platform: TelemetryPlatformSurface,
    private readonly actorId?: string
  ) {}

  // Mobile interactions should be easy to instrument without blocking the UI on network availability.
  public async track(name: string, properties: AnalyticsEvent["properties"] = {}): Promise<void> {
    try {
      await this.api.trackEvent({
        id: globalThis.crypto?.randomUUID?.() ?? `${name}-${Date.now()}`,
        name,
        occurredAt: new Date().toISOString(),
        actorId: this.actorId,
        properties: {
          role: this.role,
          platform: this.platform,
          ...properties
        }
      });
    } catch {
      // Mobile prototypes should stay responsive even when the local API is offline.
    }
  }
}
