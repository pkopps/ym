import { randomUUID } from "node:crypto";
import type {
  ApiFailureCategory,
  ApiRuntimeFailure,
  ApiRuntimeObservabilitySnapshot,
  ApiRuntimeRouteMetric
} from "@yardmatch/contracts";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_SLOW_REQUEST_MS = 1_500;
const DEFAULT_RECENT_FAILURE_LIMIT = 100;
const MAX_RECENT_REQUESTS = 2_000;
const MAX_TRACKED_ROUTES = 200;
const BACKGROUND_LOG_INTERVAL_MS = 60_000;
export const UNMATCHED_ROUTE_LABEL = "(unmatched)";
export const OVERFLOW_ROUTE_LABEL = "(other)";

const ID_LIKE_SEGMENT =
  /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,})$/i;

/**
 * Collapse IDs and opaque tokens in a path so route metrics stay low-cardinality.
 * Without this, every media ID or scanner probe would create its own metrics entry.
 */
export function normalizeRouteLabel(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "/";
  return withoutQuery
    .split("/")
    .map((segment) => (segment && ID_LIKE_SEGMENT.test(segment) ? ":id" : segment))
    .join("/")
    .slice(0, 160) || "/";
}

function redactLogText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[redacted-phone]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted-token]")
    .slice(0, 300);
}

interface RouteAccumulator {
  method: string;
  route: string;
  requestCount: number;
  failureCount: number;
  serverErrorCount: number;
  slowRequestCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

interface RecentRequest {
  occurredAtMs: number;
  statusCode: number;
  isSlow: boolean;
}

interface StructuredLogSink {
  warn(message: string): void;
  error(message: string): void;
}

export interface ApiRequestObservation {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorType?: string;
  category?: ApiFailureCategory;
  errorFrames?: string[];
}

export class ApiRuntimeObservability {
  private readonly startedAt = new Date().toISOString();
  private readonly routes = new Map<string, RouteAccumulator>();
  private readonly recentFailures: ApiRuntimeFailure[] = [];
  private readonly recentRequests: RecentRequest[] = [];
  private readonly errorCountsByType = new Map<string, number>();
  private readonly recentBackgroundFailureTimes: number[] = [];
  private readonly backgroundLogState = new Map<string, { lastLoggedAtMs: number; suppressed: number }>();
  private requestCount = 0;
  private failureCount = 0;
  private serverErrorCount = 0;
  private slowRequestCount = 0;

  public readonly slowRequestThresholdMs: number;
  private readonly recentFailureLimit: number;
  private readonly errorReportingConfigured: boolean;
  private readonly requireExternalErrorReporting: boolean;

  public constructor(
    options: {
      slowRequestThresholdMs?: number;
      recentFailureLimit?: number;
      errorReportingConfigured?: boolean;
      requireExternalErrorReporting?: boolean;
      logSink?: StructuredLogSink;
    } = {}
  ) {
    this.slowRequestThresholdMs = this.normalizePositiveInteger(
      options.slowRequestThresholdMs,
      DEFAULT_SLOW_REQUEST_MS
    );
    this.recentFailureLimit = this.normalizePositiveInteger(
      options.recentFailureLimit,
      DEFAULT_RECENT_FAILURE_LIMIT
    );
    this.errorReportingConfigured = options.errorReportingConfigured ?? false;
    this.requireExternalErrorReporting = options.requireExternalErrorReporting ?? false;
    this.logSink = options.logSink ?? console;
  }

  private readonly logSink: StructuredLogSink;

  public recordRequest(observation: ApiRequestObservation): void {
    const durationMs = Math.max(0, Math.round(observation.durationMs * 10) / 10);
    const isFailure = observation.statusCode >= 400;
    const isServerError = observation.statusCode >= 500;
    const isSlow = durationMs >= this.slowRequestThresholdMs;
    const method = /^[A-Z]{3,10}$/.test(observation.method) ? observation.method : "OTHER";
    let routeLabel = normalizeRouteLabel(observation.route);
    let routeKey = `${method} ${routeLabel}`;
    if (!this.routes.has(routeKey) && this.routes.size >= MAX_TRACKED_ROUTES) {
      routeLabel = OVERFLOW_ROUTE_LABEL;
      routeKey = `${method} ${routeLabel}`;
    }
    const route = this.routes.get(routeKey) ?? {
      method,
      route: routeLabel,
      requestCount: 0,
      failureCount: 0,
      serverErrorCount: 0,
      slowRequestCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0
    };

    this.requestCount += 1;
    this.failureCount += isFailure ? 1 : 0;
    this.serverErrorCount += isServerError ? 1 : 0;
    this.slowRequestCount += isSlow ? 1 : 0;
    route.requestCount += 1;
    route.failureCount += isFailure ? 1 : 0;
    route.serverErrorCount += isServerError ? 1 : 0;
    route.slowRequestCount += isSlow ? 1 : 0;
    route.totalDurationMs += durationMs;
    route.maxDurationMs = Math.max(route.maxDurationMs, durationMs);
    this.routes.set(routeKey, route);

    const occurredAtMs = Date.now();
    this.recentRequests.push({ occurredAtMs, statusCode: observation.statusCode, isSlow });
    if (this.recentRequests.length > MAX_RECENT_REQUESTS) {
      this.recentRequests.splice(0, this.recentRequests.length - MAX_RECENT_REQUESTS);
    }

    if (isFailure) {
      const failure = this.createFailure({ ...observation, method, route: routeLabel }, durationMs);
      this.recentFailures.unshift(failure);
      this.recentFailures.splice(this.recentFailureLimit);
      this.errorCountsByType.set(
        failure.errorType,
        (this.errorCountsByType.get(failure.errorType) ?? 0) + 1
      );
    }

    if (isServerError || isSlow) {
      const payload = JSON.stringify({
        event: isServerError ? "api_request_failed" : "api_request_slow",
        occurredAt: new Date(occurredAtMs).toISOString(),
        requestId: observation.requestId,
        method,
        route: routeLabel,
        statusCode: observation.statusCode,
        durationMs,
        category: observation.category,
        errorType: observation.errorType,
        errorFrames: observation.errorFrames?.slice(0, 8)
      });
      if (isServerError) {
        this.logSink.error(payload);
      } else {
        this.logSink.warn(payload);
      }
    }
  }

  public recordProcessFailure(kind: "uncaught-exception" | "unhandled-rejection", error: unknown): void {
    const errorType = error instanceof Error ? error.name : "UnknownProcessError";
    const requestId = randomUUID();
    const occurredAt = new Date().toISOString();
    this.failureCount += 1;
    this.serverErrorCount += 1;
    this.errorCountsByType.set(errorType, (this.errorCountsByType.get(errorType) ?? 0) + 1);
    this.recentFailures.unshift({
      requestId,
      occurredAt,
      method: "PROCESS",
      route: kind,
      statusCode: 500,
      durationMs: 0,
      category: "process-error",
      errorType
    });
    this.recentFailures.splice(this.recentFailureLimit);
    this.logSink.error(JSON.stringify({
      event: "api_process_failure",
      occurredAt,
      requestId,
      kind,
      category: "process-error",
      errorType
    }));
  }

  /**
   * Background workers (notification delivery, analytics flushing) run outside any request,
   * so their failures would otherwise only show up as a bare console line.
   */
  public recordBackgroundFailure(job: string, error: unknown): void {
    const errorType = error instanceof Error ? error.name || "Error" : "UnknownBackgroundError";
    const occurredAtMs = Date.now();
    const occurredAt = new Date(occurredAtMs).toISOString();
    const requestId = randomUUID();
    this.recentBackgroundFailureTimes.push(occurredAtMs);
    if (this.recentBackgroundFailureTimes.length > MAX_RECENT_REQUESTS) {
      this.recentBackgroundFailureTimes.splice(0, this.recentBackgroundFailureTimes.length - MAX_RECENT_REQUESTS);
    }
    this.errorCountsByType.set(errorType, (this.errorCountsByType.get(errorType) ?? 0) + 1);
    // A worker that ticks every second would otherwise emit one line per second during an outage.
    const logKey = `${job}:${errorType}`;
    const logState = this.backgroundLogState.get(logKey);
    if (logState && occurredAtMs - logState.lastLoggedAtMs < BACKGROUND_LOG_INTERVAL_MS) {
      logState.suppressed += 1;
      return;
    }
    const suppressedSinceLastLog = logState?.suppressed ?? 0;
    this.backgroundLogState.set(logKey, { lastLoggedAtMs: occurredAtMs, suppressed: 0 });
    this.recentFailures.unshift({
      requestId,
      occurredAt,
      method: "JOB",
      route: job,
      statusCode: 500,
      durationMs: 0,
      category: "process-error",
      errorType
    });
    this.recentFailures.splice(this.recentFailureLimit);
    this.logSink.error(JSON.stringify({
      event: "api_background_job_failed",
      occurredAt,
      requestId,
      job,
      suppressedSinceLastLog,
      category: "process-error",
      errorType,
      errorMessage: error instanceof Error ? redactLogText(error.message) : undefined,
      errorFrames: error instanceof Error
        ? error.stack?.split("\n").slice(1, 9).map((frame) => frame.trim())
        : undefined
    }));
  }

  public getSnapshot(): ApiRuntimeObservabilitySnapshot {
    const generatedAt = new Date();
    const recentCutoff = generatedAt.getTime() - FIVE_MINUTES_MS;
    const recent = this.recentRequests.filter((request) => request.occurredAtMs >= recentCutoff);
    const recentFailures = recent.filter((request) => request.statusCode >= 400).length;
    const recentServerErrors = recent.filter((request) => request.statusCode >= 500).length;
    const recentSlowRequests = recent.filter((request) => request.isSlow).length;
    const failureRate = recent.length > 0 ? recentFailures / recent.length : 0;
    const alerts: ApiRuntimeObservabilitySnapshot["alerts"] = [];

    if (recentServerErrors > 0) {
      alerts.push({
        severity: "critical",
        title: "API server errors detected",
        detail: `${recentServerErrors} server error${recentServerErrors === 1 ? "" : "s"} occurred in the last five minutes.`,
        recommendedAction: "Inspect the recent failure types and correlate request IDs in structured production logs."
      });
    }
    const recentBackgroundFailures = this.recentBackgroundFailureTimes.filter((at) => at >= recentCutoff).length;
    if (recentBackgroundFailures > 0) {
      alerts.push({
        severity: "critical",
        title: "Background job failures detected",
        detail: `${recentBackgroundFailures} background job failure${recentBackgroundFailures === 1 ? "" : "s"} occurred in the last five minutes.`,
        recommendedAction: "Check recent failures with method JOB, then search structured logs for api_background_job_failed."
      });
    }
    if (this.requireExternalErrorReporting && !this.errorReportingConfigured) {
      alerts.push({
        severity: "critical",
        title: "External API error reporting is not configured",
        detail: "SENTRY_DSN is missing, so production exceptions cannot trigger the external incident workflow.",
        recommendedAction: "Configure the API Sentry project and verify a test exception before production traffic."
      });
    }
    if (recentSlowRequests >= 3) {
      alerts.push({
        severity: "warning",
        title: "Repeated slow API requests detected",
        detail: `${recentSlowRequests} requests exceeded ${this.slowRequestThresholdMs} ms in the last five minutes.`,
        recommendedAction: "Review the slowest route metrics and database query plans before traffic increases."
      });
    }
    if (recent.length >= 20 && failureRate >= 0.05) {
      alerts.push({
        severity: "warning",
        title: "API failure rate is elevated",
        detail: `${(failureRate * 100).toFixed(1)}% of requests failed in the last five minutes.`,
        recommendedAction: "Group recent failures by type and route, then triage the highest-volume actionable class."
      });
    }

    return {
      generatedAt: generatedAt.toISOString(),
      startedAt: this.startedAt,
      status: alerts.some((alert) => alert.severity === "critical")
        ? "critical"
        : alerts.length > 0
          ? "watch"
          : "healthy",
      slowRequestThresholdMs: this.slowRequestThresholdMs,
      errorReportingProvider: "sentry",
      errorReportingConfigured: this.errorReportingConfigured,
      requestCount: this.requestCount,
      failureCount: this.failureCount,
      serverErrorCount: this.serverErrorCount,
      slowRequestCount: this.slowRequestCount,
      failureRate,
      errorCountsByType: Object.fromEntries(
        [...this.errorCountsByType.entries()].sort((left, right) => right[1] - left[1])
      ),
      routeMetrics: [...this.routes.values()]
        .map((route): ApiRuntimeRouteMetric => ({
          method: route.method,
          route: route.route,
          requestCount: route.requestCount,
          failureCount: route.failureCount,
          serverErrorCount: route.serverErrorCount,
          slowRequestCount: route.slowRequestCount,
          averageDurationMs:
            route.requestCount > 0
              ? Math.round((route.totalDurationMs / route.requestCount) * 10) / 10
              : 0,
          maxDurationMs: Math.round(route.maxDurationMs * 10) / 10
        }))
        .sort((left, right) =>
          right.serverErrorCount - left.serverErrorCount ||
          right.slowRequestCount - left.slowRequestCount ||
          right.maxDurationMs - left.maxDurationMs
        )
        .slice(0, 25),
      recentFailures: this.recentFailures.slice(0, 25),
      alerts
    };
  }

  private createFailure(observation: ApiRequestObservation, durationMs: number): ApiRuntimeFailure {
    return {
      requestId: observation.requestId,
      occurredAt: new Date().toISOString(),
      method: observation.method,
      route: observation.route,
      statusCode: observation.statusCode,
      durationMs,
      category: observation.category ?? this.categoryForStatus(observation.statusCode),
      errorType: observation.errorType ?? `HTTP_${observation.statusCode}`
    };
  }

  private categoryForStatus(statusCode: number): ApiFailureCategory {
    if (statusCode === 401 || statusCode === 403) {
      return "authentication";
    }
    return statusCode >= 500 ? "server-error" : "client-request";
  }

  private normalizePositiveInteger(value: number | undefined, fallback: number): number {
    return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
  }
}

export function createApiRuntimeObservabilityFromEnv(): ApiRuntimeObservability {
  return new ApiRuntimeObservability({
    slowRequestThresholdMs: Number(process.env.API_SLOW_REQUEST_THRESHOLD_MS),
    recentFailureLimit: Number(process.env.API_RECENT_FAILURE_LIMIT),
    errorReportingConfigured: Boolean(process.env.SENTRY_DSN?.trim()),
    requireExternalErrorReporting: process.env.NODE_ENV === "production"
  });
}
