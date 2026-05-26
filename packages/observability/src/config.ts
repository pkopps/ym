export class ObservabilityEnv {
  // Keeping env names centralized makes installation and ops handoff less error-prone.
  public static readonly apiBaseUrl = "API_BASE_URL";
  public static readonly nextApiBaseUrl = "NEXT_PUBLIC_API_BASE_URL";
  public static readonly expoApiBaseUrl = "EXPO_PUBLIC_API_BASE_URL";
  public static readonly otelServiceName = "OTEL_SERVICE_NAME";
  public static readonly otelExporterEndpoint = "OTEL_EXPORTER_OTLP_ENDPOINT";
  public static readonly sentryDsn = "SENTRY_DSN";
  public static readonly nextSentryDsn = "NEXT_PUBLIC_SENTRY_DSN";
  public static readonly expoSentryDsn = "EXPO_PUBLIC_SENTRY_DSN";
  public static readonly posthogApiKey = "POSTHOG_API_KEY";
  public static readonly posthogHost = "POSTHOG_HOST";
  public static readonly nextPosthogKey = "NEXT_PUBLIC_POSTHOG_KEY";
  public static readonly nextPosthogHost = "NEXT_PUBLIC_POSTHOG_HOST";
  public static readonly expoPosthogKey = "EXPO_PUBLIC_POSTHOG_KEY";
  public static readonly expoPosthogHost = "EXPO_PUBLIC_POSTHOG_HOST";
}

export class RecommendedObservabilityStack {
  public static readonly backend = [
    "OpenTelemetry for traces, metrics, and logs",
    "Sentry for API errors and distributed tracing views",
    "Backend-authored business events for bookings, payments, refunds, and support"
  ] as const;

  public static readonly frontend = [
    "PostHog for product analytics and session replay on web/mobile",
    "Sentry for frontend crashes and performance",
    "Heartbeat-based presence tracking for active users"
  ] as const;
}
