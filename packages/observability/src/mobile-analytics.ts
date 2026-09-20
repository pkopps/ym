import { AnalyticsEvent, MarketplaceApiClient, MarketplaceRole, TelemetryPlatformSurface } from "@yardmatch/contracts";
type Context = {allowed: boolean; anonymousId: string; sessionId: string; token?: string; actorId?: string; locale: string};
type Storage = {get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void>};
type Pending = {event: AnalyticsEvent; actorId?: string; attempts: number};
const contexts = new Map<string, Context>();
const screens = new Map<string, string>();
const stores = new Map<string, Storage>();
const work = new Map<string, Promise<void>>();
export class MobileAnalyticsTracker {
  public constructor(private readonly api: MarketplaceApiClient, private readonly role: MarketplaceRole,
    private readonly platform: TelemetryPlatformSurface) {}
  public static configure(role: MarketplaceRole, context: Context) { contexts.set(role, context); }
  public static storage(role: MarketplaceRole, storage: Storage) { stores.set(role, storage); }
  public static context(role: MarketplaceRole) {
    const value = contexts.get(role);
    return value?.allowed ? {anonymousId: value.anonymousId, sessionId: value.sessionId, consent: true} : undefined;
  }
  public static screen(role: MarketplaceRole, screen: string) { screens.set(role, screen); }
  private serialize(operation: () => Promise<void>) {
    const pending = (work.get(this.role) ?? Promise.resolve()).then(operation).catch(() => {});
    work.set(this.role, pending); return pending;
  }
  public clear(): Promise<void> {
    return this.serialize(async () => {
      const store = stores.get(this.role); if (!store) return;
      const ids = JSON.parse(await store.get("ym-analytics-index") ?? "[]") as string[];
      for (const id of ids) await store.remove(`ym-event-${id}`);
      await store.remove("ym-analytics-index");
    });
  }
  public flush(): Promise<void> { return this.serialize(() => this.deliver()); }
  private async deliver() {
    const store = stores.get(this.role), context = contexts.get(this.role);
    if (!store || !context?.allowed) return;
    const ids = JSON.parse(await store.get("ym-analytics-index") ?? "[]") as string[];
    for (const id of ids) {
      const item = JSON.parse(await store.get(`ym-event-${id}`) ?? "null") as Pending | null;
      if (contexts.get(this.role) !== context || !context.allowed) return;
      if (item && item.attempts < 5 && Date.parse(item.event.occurredAt) > Date.now() - 86400_000 &&
        (!item.actorId || item.actorId === context.actorId)) {
        this.api.setAuthToken(item.actorId ? context.token : undefined);
        try { await this.api.trackEvent(item.event); }
        catch {
          item.attempts++;
          await store.set(`ym-event-${id}`, JSON.stringify(item));
          return; // Retry on foreground or next action; preserve the same event ID.
        }
      }
      await store.remove(`ym-event-${id}`);
      await store.set("ym-analytics-index", JSON.stringify(ids.slice(ids.indexOf(id) + 1)));
    }
  }
  public track(name: string, properties: AnalyticsEvent["properties"] = {}): Promise<void> {
    const context = contexts.get(this.role);
    if (!context?.allowed) return Promise.resolve();
    const event: AnalyticsEvent = {id: globalThis.crypto?.randomUUID?.() ?? `ym-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, occurredAt: new Date().toISOString(), properties: {...properties,
        anonymousId: context.anonymousId, sessionId: context.sessionId, consent: true,
        locale: context.locale, platform: this.platform, screen: screens.get(this.role) ?? "entry", version: "1"}};
    return this.serialize(async () => {
      const store = stores.get(this.role); if (!store || contexts.get(this.role) !== context) return;
      const item: Pending = {event, actorId: context.actorId, attempts: 0};
      if (JSON.stringify(item).length > 1800) return; // Keep each encrypted SecureStore value small.
      const ids = JSON.parse(await store.get("ym-analytics-index") ?? "[]") as string[];
      while (ids.length >= 20) await store.remove(`ym-event-${ids.shift()!}`);
      await store.set(`ym-event-${event.id}`, JSON.stringify(item));
      await store.set("ym-analytics-index", JSON.stringify([...ids,event.id]));
      await this.deliver();
    });
  }
}
