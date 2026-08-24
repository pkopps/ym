type SentryModule = typeof import("@sentry/node");

let sentry: SentryModule | undefined;

function configuredTraceSampleRate(): number {
  const value = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  if (Number.isFinite(value) && value >= 0 && value <= 1) {
    return value;
  }
  return process.env.NODE_ENV === "production" ? 0.1 : 0;
}

function redactPotentialContactDetails(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[redacted-phone]");
}

export async function initializeApiErrorReporting(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return false;
  }

  sentry = await import("@sentry/node");
  sentry.init({
    dsn,
    environment: process.env.YARDMATCH_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: configuredTraceSampleRate(),
    beforeSend(event) {
      event.user = undefined;
      if (event.request) {
        event.request.data = undefined;
        event.request.cookies = undefined;
        event.request.query_string = undefined;
        event.request.headers = undefined;
      }
      for (const value of event.exception?.values ?? []) {
        if (value.value) {
          value.value = redactPotentialContactDetails(value.value);
        }
      }
      return event;
    }
  });
  return true;
}

export function captureApiException(
  error: unknown,
  context: {
    requestId: string;
    method: string;
    route: string;
    statusCode: number;
    category: string;
  }
): string | undefined {
  if (!sentry) {
    return undefined;
  }
  let eventId: string | undefined;
  sentry.withScope((scope) => {
    scope.setTag("request_id", context.requestId);
    scope.setTag("http.method", context.method);
    scope.setTag("http.route", context.route);
    scope.setTag("error.category", context.category);
    scope.setContext("yardmatch_api_request", {
      requestId: context.requestId,
      method: context.method,
      route: context.route,
      statusCode: context.statusCode
    });
    eventId = sentry?.captureException(error);
  });
  return eventId;
}

export function captureApiProcessException(
  error: unknown,
  kind: "uncaught-exception" | "unhandled-rejection"
): string | undefined {
  if (!sentry) {
    return undefined;
  }
  return sentry.captureException(error, {
    tags: {
      "error.category": "process-error",
      "process.failure_kind": kind
    }
  });
}

export async function flushApiErrorReporting(timeoutMs = 2_000): Promise<boolean> {
  return sentry ? sentry.flush(timeoutMs) : true;
}
