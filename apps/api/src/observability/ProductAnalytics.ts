import { utcTimestamp } from "../repositories/sqlTime";
import { Prisma } from "@prisma/client";
import { readAnalyticsReport } from "./analyticsReport";
import type { ProductAnalyticsReport } from "@yardmatch/contracts";
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
  private maintaining?: Promise<void>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private lastRetentionAt = 0;
  private readonly reportCache = new Map<number, { expiresAt: number; promise: Promise<ProductAnalyticsReport> }>();
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
      this.scheduleFlush();
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

  public async collect(event: AnalyticsEvent): Promise<void> {
    if (this.prisma && this.pending.size >= 10000 && !this.pending.has(event.id)) throw new HttpError(503, "Analytics collection is busy. Retry this event shortly.");
    this.record(event);
    do { await this.flush(); } while (this.pending.has(event.id));
  }

  private scheduleFlush(delayMs = 10) {
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush().catch(() => { this.lastFailureAt = new Date().toISOString(); });
    }, delayMs);
    this.flushTimer.unref();
  }

  public async flush(): Promise<void> {
    clearTimeout(this.flushTimer); this.flushTimer = undefined;
    if (!this.prisma) return;
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      // Snapshot the admitted work. Continuous arrivals must not postpone acknowledgement forever.
      const admitted = [...this.pending.values()];
      for (let offset = 0; offset < admitted.length; offset += 200) {
        const batch = admitted.slice(offset, offset + 200);
        await this.prisma!.productAnalyticsEvent.createMany({skipDuplicates: true, data: batch.map(event => ({
          id: event.id, name: event.name, actorId: event.actorId, occurredAt: new Date(event.occurredAt),
          environment: this.environment, source: event.properties.origin === "client" ? "client" : "server",
          properties: safeAnalyticsProperties(event.properties, event.properties.origin !== "client")
        }))});
        for (const event of batch) this.pending.delete(event.id);
      }
    })();
    let succeeded = false;
    try { await this.flushing; succeeded = true; } finally {
      this.flushing = undefined;
      if (this.pending.size) this.scheduleFlush(succeeded ? 10 : 1000);
    }
  }

  public async maintenance(): Promise<void> {
    if (this.maintaining) return this.maintaining;
    this.maintaining = this.runMaintenance();
    try { await this.maintaining; } finally { this.maintaining = undefined; }
  }

  public async drain(): Promise<void> {
    await this.maintaining;
    do { await this.flush(); } while (this.pending.size);
  }

  private async runMaintenance() {
    await this.flush();
    if (!this.prisma) return;
    const retentionDays = Math.max(7, Math.min(365, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90));
    if (Date.now() - this.lastRetentionAt >= 3600_000) {
      const removed = await this.prisma.$executeRaw`DELETE FROM "ProductAnalyticsEvent" WHERE id IN (
        SELECT id FROM "ProductAnalyticsEvent" WHERE environment = ${this.environment}
          AND "receivedAt" < ${utcTimestamp(new Date(Date.now() - retentionDays * 86400_000))} ORDER BY "receivedAt" LIMIT 1000
      )`;
      if (removed < 1000) this.lastRetentionAt = Date.now();
    }
    const token = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST;
    const hashKey = process.env.ANALYTICS_IDENTITY_HASH_KEY;
    if (!token || !host || !hashKey || this.environment !== "production") return;
    if (hashKey.length < 32) throw new Error("Analytics identity key must contain at least 32 characters");
    const url = new URL("/batch/", host);
    if (url.protocol !== "https:") throw new Error("Analytics export requires HTTPS");
    const deadline = Date.now() + 20_000;
    for (let batch = 0; batch < 20 && Date.now() < deadline; batch++) {
      const leaseToken = crypto.randomUUID();
      const now = new Date();
      const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; actorId: string | null; occurredAt: Date; environment: string; properties: unknown; attempts: number }>>`
        WITH due AS (
          SELECT id FROM "ProductAnalyticsEvent" WHERE environment = ${this.environment} AND "exportedAt" IS NULL
            AND properties->'consent' = 'true'::jsonb AND properties->'internal' IS DISTINCT FROM 'true'::jsonb
            AND properties->>'role' IS DISTINCT FROM 'ops' AND "nextAttemptAt" <= ${utcTimestamp(now)} AND attempts < 10
            AND ("exportLeaseExpiresAt" IS NULL OR "exportLeaseExpiresAt" <= ${utcTimestamp(now)})
          ORDER BY "receivedAt", id LIMIT 500 FOR UPDATE SKIP LOCKED
        ) UPDATE "ProductAnalyticsEvent" event SET "exportLeaseToken" = ${leaseToken},
          "exportLeaseExpiresAt" = ${utcTimestamp(new Date(now.getTime() + 30_000))}, attempts = attempts + 1
          FROM due WHERE event.id = due.id RETURNING event.*`;
      if (!rows.length) break;
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
      await this.prisma.productAnalyticsEvent.updateMany({where: {id: {in: rows.map(row => row.id)}, exportLeaseToken: leaseToken}, data: {exportedAt: new Date(), exportLeaseToken: null, exportLeaseExpiresAt: null}});
    } catch {
      this.lastFailureAt = new Date().toISOString();
      // One statement releases the failed batch and preserves a bounded exponential retry schedule.
      await this.prisma.$executeRaw`UPDATE "ProductAnalyticsEvent" SET "exportLeaseToken" = NULL, "exportLeaseExpiresAt" = NULL,
        "nextAttemptAt" = ${utcTimestamp(new Date())} + least(3600000, 30000 * power(2, attempts - 1)) * interval '1 millisecond'
        WHERE id IN (${Prisma.join(rows.map(row => row.id))}) AND "exportLeaseToken" = ${leaseToken}`;
      break;
    }
    }
  }

  private async databaseReport(days: number): Promise<ProductAnalyticsReport> {
    const cached = this.reportCache.get(days);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;
    const promise = (async () => {
      const since = new Date(Date.now() - days * 86400_000);
      const prisma = this.prisma!;
      const [totals, supplyRows, economics, queue] = await Promise.all([
        prisma.$transaction(async tx => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '15s'`;
          return readAnalyticsReport(tx as unknown as PrismaClient, this.environment, since);
        }, { timeout: 20_000 }),
        prisma.$queryRaw<Array<NonNullable<ProductAnalyticsReport["supply"]>>>`SELECT
          (SELECT count(*)::int FROM provider_business_profiles) AS registered,
          (SELECT count(*)::int FROM provider_business_profiles WHERE "verificationStatus" = 'verified') AS verified,
          (SELECT count(*)::int FROM provider_business_profiles p WHERE "verificationStatus" = 'verified' AND EXISTS (
            SELECT 1 FROM availability_slots s WHERE s."providerId" = p."userId" AND NOT s."isBooked" AND s."endIso" >= ${utcTimestamp(new Date())}
          )) AS "withAvailability",
          (SELECT count(DISTINCT "providerId")::int FROM bookings) AS "withFirstBooking",
          (SELECT count(DISTINCT "providerId")::int FROM bookings WHERE status = 'completed') AS "withCompletedJob"`,
        prisma.bookingFinancialSettlement.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true },
          _sum: { customerChargeCents: true, actualProcessorFeeCents: true, platformNetRevenueCents: true, providerNetCents: true } }),
        prisma.$queryRaw<Array<{ backlog: number; oldest: Date | null; exhausted: number }>>`SELECT count(*)::int AS backlog,
          min("receivedAt") AS oldest, count(*) FILTER (WHERE attempts >= 10)::int AS exhausted
          FROM "ProductAnalyticsEvent" WHERE environment = ${this.environment} AND "exportedAt" IS NULL
            AND properties->'consent' = 'true'::jsonb AND properties->'internal' IS DISTINCT FROM 'true'::jsonb AND properties->>'role' IS DISTINCT FROM 'ops'`
      ]);
      const oldestAgeSeconds = queue[0].oldest ? Math.max(0, Math.floor((Date.now() - queue[0].oldest.getTime()) / 1000)) : 0;
      return { ...totals, since: since.toISOString(), environment: this.environment, durable: true, supply: supplyRows[0], economics,
        health: { pendingWrites: this.pending.size, dropped: this.dropped, lastFailureAt: this.lastFailureAt,
          exportConfigured: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.ANALYTICS_IDENTITY_HASH_KEY),
          exportBacklog: queue[0].backlog, exportOldestAgeSeconds: oldestAgeSeconds, exportExhausted: queue[0].exhausted,
          exportDelayed: oldestAgeSeconds > 300 || queue[0].exhausted > 0, lastEventAt: totals.lastEventAt } };
    })();
    this.reportCache.set(days, { expiresAt: Date.now() + 15_000, promise });
    if (this.reportCache.size > 6) this.reportCache.delete(this.reportCache.keys().next().value!);
    try { return await promise; } catch (error) { this.reportCache.delete(days); throw error; }
  }

  public async report(days = 30): Promise<ProductAnalyticsReport> {
    days = Math.max(1, Math.min(90, Number.isFinite(days) ? Math.floor(days) : 30));
    if (this.prisma) return this.databaseReport(days);
    const since = new Date(Date.now() - Math.max(1, Math.min(90, days)) * 86400_000);
    const rows = this.listEvents().filter(event => Date.parse(event.occurredAt) >= since.getTime()).map(event => ({
      ...event, occurredAt: new Date(event.occurredAt), source: event.properties.origin === "client" ? "client" : "server"
    }));
    const truncated = rows.length > 50000;
    const events = rows.slice(0, 50000).filter(row => row.properties.role !== "ops" && row.name !== "session_heartbeat" && row.properties.internal !== true);
    const counts: Record<string, {events: number; people: number}> = {};
    const people = new Map<string, Set<string>>();
    const segments: Record<string, Record<string, number>> = {platform: {}, locale: {}, source: {}, category: {}, area: {}};
    for (const row of events) {
      const props = row.properties;
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
      const props = row.properties;
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
    const backlog = 0;
    const funnel = buildAnalyticsFunnel(events.map(row => ({id: row.id, name: row.name, actorId: row.actorId ?? undefined,
      occurredAt: row.occurredAt.toISOString(), properties: row.properties})));
    const supply = undefined;
    const economics: ProductAnalyticsReport["economics"] = [];
    return {funnel, economics, supply, actions, performance, since: since.toISOString(), environment: this.environment, durable: Boolean(this.prisma),
      events: events.length, truncated, lowSample: funnel.lowSample, counts, segments,
      health: {pendingWrites: this.pending.size, dropped: this.dropped, lastFailureAt: this.lastFailureAt,
        exportConfigured: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.ANALYTICS_IDENTITY_HASH_KEY),
        exportBacklog: backlog, lastEventAt: events.at(-1)?.occurredAt.toISOString()}};
  }
}
