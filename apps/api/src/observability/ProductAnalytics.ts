import { analyticsRequestContext } from "./analyticsContext";
import { buildAnalyticsFunnel } from "./analyticsFunnel";
import { createHash, createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import type { AnalyticsEvent } from "@yardmatch/contracts";
import { HttpError, type RequestContext } from "../http";

export const clientEventNames = new Set([
  "page_viewed", "screen_viewed", "action_clicked", "form_submitted", "form_validation_failed",
  "journey_identified", "journey_feedback", "web_vital", "client_error",
  "recommendation_dismissed", "recommendation_alternatives_viewed", "retention_prompt_presented",
  "retention_prompt_accepted", "mobile_auth_completed"
]);
const safeKeys = new Set([
  "anonymousId", "sessionId", "path", "previousPath", "destination", "action", "form", "screen",
  "platform", "locale", "source", "medium", "campaign", "requestSource", "category", "area",
  "recommendationSessionId", "recommendedProviderId", "providerId", "bookingId", "retentionSource",
  "retentionStrategy", "strategy", "reason", "field", "metric", "value", "durationMs", "version",
  "experiment", "variant", "consent", "role", "origin", "environment", "sample", "customerId",
  "internal", "city", "dateIso", "status", "attributionSource", "attributionMedium", "attributionCampaign", "serviceCategory", "totalCents"
]);
const idPattern = /^[a-zA-Z0-9_-]{8,100}$/;
const safeString = /^[a-zA-Z0-9_./: -]{0,160}$/;

export function safeAnalyticsProperties(input: AnalyticsEvent["properties"], trusted = false): AnalyticsEvent["properties"] {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => (safeKeys.has(key) || (trusted && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) && ["number", "boolean"].includes(typeof value))) &&
    (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && safeString.test(value) && !value.includes("@") && !value.includes("?")))));
}

export function validateClientEvent(body: unknown, identity?: {userId: string; role: string}): AnalyticsEvent {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid analytics event");
  const event = body as AnalyticsEvent;
  if (typeof event.id !== "string" || !idPattern.test(event.id) || !clientEventNames.has(event.name)) {
    throw new HttpError(400, "Unsupported analytics event");
  }
  const timestamp = Date.parse(event.occurredAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || timestamp < Date.now() - 24 * 3600_000) {
    throw new HttpError(400, "Analytics event timestamp is outside the delivery window");
  }
  if (!event.properties || typeof event.properties !== "object" || Array.isArray(event.properties) ||
    JSON.stringify(event.properties).length > 6000) throw new HttpError(400, "Invalid analytics properties");
  const properties = safeAnalyticsProperties(event.properties);
  if (properties.consent !== true) throw new HttpError(400, "Optional analytics requires permission");
  if (!idPattern.test(String(properties.sessionId ?? "")) || !idPattern.test(String(properties.anonymousId ?? ""))) {
    throw new HttpError(400, "Analytics session identity is required");
  }
  return { id: event.id, name: event.name, occurredAt: new Date(timestamp).toISOString(),
    actorId: identity?.userId, properties: {...properties, origin: "client", role: identity?.role ?? "anonymous"} };
}

export function analyticsExportUuid(id: string, environment: string) {
  // UUIDv5 in the nil namespace supports legacy/mobile IDs that are not UUIDs.
  const bytes = createHash("sha1").update(Buffer.alloc(16)).update(`yardmatch:${environment}:${id}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex").slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export class AnalyticsRateLimit {
  private readonly windows = new Map<string, {start: number; count: number}>();
  public check(context: RequestContext) {
    const now = Date.now();
    for (const [key, value] of this.windows) if (now - value.start >= 60_000) this.windows.delete(key);
    const key = context.clientAddress ?? "unknown";
    const window = this.windows.get(key) ?? {start: now, count: 0};
    if (++window.count > 180 || (!this.windows.has(key) && this.windows.size >= 10000)) {
      throw new HttpError(429, "Analytics request limit reached");
    }
    this.windows.set(key, window);
  }
}

/** Durable delivery is enabled whenever the API uses PostgreSQL. The bounded buffer remains a local fallback. */
export class ProductAnalytics extends DataEngineeringLogger {
  private readonly pending = new Map<string, AnalyticsEvent>();
  private flushing?: Promise<void>;
  private dropped = 0;
  private readonly seen = new Set<string>();
  private lastFailureAt?: string;
  public readonly environment = process.env.YARDMATCH_ENV ?? "local";
  public constructor(private readonly prisma?: PrismaClient) { super(); }

  public override record(event: AnalyticsEvent): AnalyticsEvent {
    event = {...event, actorId: event.actorId === "anonymous" ? undefined : event.actorId,
      properties: {...analyticsRequestContext.getStore(), ...event.properties, internal: analyticsRequestContext.getStore()?.internal ?? false}};
    if (this.pending.has(event.id) || this.seen.has(event.id)) return event;
    // Heartbeats are live presence, not product history or a PostHog billable event.
    this.seen.add(event.id);
    if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value as string);
    const result = super.record(event);
    if (this.prisma && event.name !== "session_heartbeat") {
      if (this.pending.size >= 10000) { this.dropped++; return result; }
      this.pending.set(event.id, event);
      void this.flush().catch(() => { this.lastFailureAt = new Date().toISOString(); });
    }
    return result;
  }

  public async restore() {
    if (!this.prisma) return;
    const rows = await this.prisma.productAnalyticsEvent.findMany({
      where: {environment: this.environment}, orderBy: {occurredAt: "desc"}, take: 10000
    });
    for (const row of rows.reverse()) { this.seen.add(row.id); super.record({id: row.id, name: row.name,
      actorId: row.actorId ?? undefined, occurredAt: row.occurredAt.toISOString(),
      properties: row.properties as AnalyticsEvent["properties"]}); }
  }

  public async flush(): Promise<void> {
    if (!this.prisma) return;
    if (this.flushing) { await this.flushing; if (this.pending.size) return this.flush(); return; }
    this.flushing = (async () => {
      while (this.pending.size) {
        const batch = [...this.pending.values()].slice(0, 200);
        await this.prisma!.productAnalyticsEvent.createMany({skipDuplicates: true, data: batch.map(event => ({
          id: event.id, name: event.name, actorId: event.actorId, occurredAt: new Date(event.occurredAt),
          environment: this.environment, source: event.properties.origin === "client" ? "client" : "server",
          properties: safeAnalyticsProperties(event.properties, event.properties.origin !== "client")
        }))});
        for (const event of batch) this.pending.delete(event.id);
      }
    })();
    try { await this.flushing; } finally { this.flushing = undefined; }
  }

  public async maintenance() {
    await this.flush();
    if (!this.prisma) return;
    const retentionDays = Math.max(7, Math.min(365, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90));
    await this.prisma.productAnalyticsEvent.deleteMany({where: {environment: this.environment, receivedAt: {lt: new Date(Date.now() - retentionDays * 86400_000)}}});
    const token = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST;
    const hashKey = process.env.ANALYTICS_IDENTITY_HASH_KEY;
    if (!token || !host || !hashKey || this.environment !== "production") return;
    if (hashKey.length < 32) throw new Error("Analytics identity key must contain at least 32 characters");
    const url = new URL("/batch/", host);
    if (url.protocol !== "https:") throw new Error("Analytics export requires HTTPS");
    const rows = await this.prisma.productAnalyticsEvent.findMany({where: {environment: this.environment,
      AND: [{properties: {path: ["consent"], equals: true}}, {NOT: {properties: {path: ["internal"], equals: true}}}], exportedAt: null, nextAttemptAt: {lte: new Date()}, attempts: {lt: 10}}, orderBy: {receivedAt: "asc"}, take: 100});
    if (!rows.length) return;
    const hash = (id: string) => createHmac("sha256", hashKey).update(id).digest("hex");
    try {
      const response = await fetch(url, {method: "POST", signal: AbortSignal.timeout(5000),
        headers: {"content-type": "application/json"}, body: JSON.stringify({api_key: token,
          batch: rows.map(row => {
            const props = row.properties as AnalyticsEvent["properties"];
            const anonymousId = String(props.anonymousId ?? "");
            return {uuid: analyticsExportUuid(row.id, row.environment), event: row.name === "journey_identified" ? "$identify" : row.name,
              distinct_id: hash(row.actorId ?? (anonymousId || row.id)), timestamp: row.occurredAt.toISOString(), properties: {...Object.fromEntries(Object.entries(safeAnalyticsProperties(props)).map(([key,value]) =>
                  [key, key.endsWith("Id") && typeof value === "string" ? hash(value) : value])),
                $insert_id: row.id,
                ...(row.name === "journey_identified" && anonymousId ? {$anon_distinct_id: hash(anonymousId)} : {}),
                environment: row.environment, $process_person_profile: Boolean(row.actorId)}};
          })})});
      if (!response.ok) throw new Error("Analytics export rejected");
      await this.prisma.productAnalyticsEvent.updateMany({where: {id: {in: rows.map(row => row.id)}}, data: {exportedAt: new Date()}});
    } catch {
      this.lastFailureAt = new Date().toISOString();
      for (const row of rows) await this.prisma.productAnalyticsEvent.update({where: {id: row.id}, data: {
        attempts: {increment: 1}, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** row.attempts))
      }});
    }
  }

  public async report(days = 30) {
    const since = new Date(Date.now() - Math.max(1, Math.min(90, days)) * 86400_000);
    const rows = this.prisma ? await this.prisma.productAnalyticsEvent.findMany({
      where: {environment: this.environment, occurredAt: {gte: since}}, orderBy: {occurredAt: "asc"}, take: 50001
    }) : this.listEvents().filter(event => Date.parse(event.occurredAt) >= since.getTime()).map(event => ({
      ...event, occurredAt: new Date(event.occurredAt), source: event.properties.origin === "client" ? "client" : "server"
    }));
    const truncated = rows.length > 50000;
    const events = rows.slice(0, 50000).filter(row => (row.properties as AnalyticsEvent["properties"]).role !== "ops" && row.name !== "session_heartbeat" && (row.properties as AnalyticsEvent["properties"]).internal !== true);
    const counts: Record<string, {events: number; people: number}> = {};
    const people = new Map<string, Set<string>>();
    const segments: Record<string, Record<string, number>> = {platform: {}, locale: {}, source: {}, category: {}, area: {}};
    for (const row of events) {
      const props = row.properties as AnalyticsEvent["properties"];
      const person = row.actorId ?? String(props.anonymousId ?? row.id);
      if (!people.has(row.name)) people.set(row.name, new Set());
      people.get(row.name)!.add(person);
      counts[row.name] = {events: (counts[row.name]?.events ?? 0) + 1, people: people.get(row.name)!.size};
      for (const key of Object.keys(segments)) {
        const value = String(props[key] ?? "unknown");
        segments[key][value] = (segments[key][value] ?? 0) + 1;
      }
    }
    const actions: Record<string, number> = {};
    const metricValues = new Map<string, number[]>();
    for (const row of events) {
      const props = row.properties as AnalyticsEvent["properties"];
      if (row.name === "action_clicked") {
        const key = `${props.action ?? "unknown"}${props.destination ? `: ${props.destination}` : ""}`;
        actions[key] = (actions[key] ?? 0) + 1;
      }
      if (row.name === "web_vital" && typeof props.metric === "string" && typeof props.value === "number") {
        const values = metricValues.get(props.metric) ?? []; values.push(props.value); metricValues.set(props.metric, values);
      }
    }
    const performance = Object.fromEntries([...metricValues].map(([name, values]) => {
      values.sort((a,b) => a-b);
      return [name, {samples: values.length, p75: values[Math.max(0, Math.ceil(values.length * 0.75) - 1)]}];
    }));
    const backlog = this.prisma ? await this.prisma.productAnalyticsEvent.count({where: {environment: this.environment, exportedAt: null, properties: {path: ["consent"], equals: true}}}) : 0;
    const funnel = buildAnalyticsFunnel(events.map(row => ({id: row.id, name: row.name, actorId: row.actorId ?? undefined,
      occurredAt: row.occurredAt.toISOString(), properties: row.properties as AnalyticsEvent["properties"]})));
    const supply = this.prisma ? {
      registered: await this.prisma.providerBusinessProfile.count(),
      verified: await this.prisma.providerBusinessProfile.count({where: {verificationStatus: "verified"}}),
      withAvailability: await this.prisma.providerBusinessProfile.count({where: {verificationStatus: "verified", slots: {some: {isBooked: false, endIso: {gte: new Date()}}}}}),
      withFirstBooking: (await this.prisma.booking.findMany({select: {providerId: true}, distinct: ["providerId"]})).length,
      withCompletedJob: (await this.prisma.booking.findMany({where: {status: "completed"}, select: {providerId: true}, distinct: ["providerId"]})).length
    } : undefined;
    const economics = this.prisma ? await this.prisma.bookingFinancialSettlement.groupBy({by: ["status"],
      where: {createdAt: {gte: since}}, _count: {_all: true}, _sum: {customerChargeCents: true,
        actualProcessorFeeCents: true, platformNetRevenueCents: true, providerNetCents: true}}) : [];
    return {funnel, economics, supply, actions, performance, since: since.toISOString(), environment: this.environment, durable: Boolean(this.prisma),
      events: events.length, truncated, lowSample: funnel.lowSample, counts, segments,
      health: {pendingWrites: this.pending.size, dropped: this.dropped, lastFailureAt: this.lastFailureAt,
        exportConfigured: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.ANALYTICS_IDENTITY_HASH_KEY),
        exportBacklog: backlog, lastEventAt: events.at(-1)?.occurredAt.toISOString()}};
  }
}
