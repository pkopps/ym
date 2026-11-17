/**
 * Refuses any database that is not a disposable local one. Shared by the scale smoke and the bot army so that
 * neither can be pointed at staging or production by a stray environment variable.
 */
export const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export function assertLocalTestDatabase(rawUrl: string | undefined, variableName = "TEST_DATABASE_URL"): URL {
  const url = new URL(rawUrl ?? "postgresql://missing/missing");
  if (!LOOPBACK_HOSTS.includes(url.hostname) || !/test|scale/i.test(url.pathname)) {
    throw new Error(`Use ${variableName} for a disposable local database whose name includes test or scale.`);
  }
  return url;
}

export function assertLoopbackBaseUrl(rawUrl: string, variableName: string): URL {
  const url = new URL(rawUrl);
  if (!LOOPBACK_HOSTS.includes(url.hostname)) {
    throw new Error(`${variableName} must point at this machine (localhost, 127.0.0.1 or [::1]), not ${url.hostname}.`);
  }
  return url;
}

/** Vendor credentials a local run must never inherit from the shell or a .env file. */
export const VENDOR_SECRET_KEYS = [
  "GOOGLE_MAPS_API_KEY", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "RESEND_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER", "POSTHOG_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "BLOB_READ_WRITE_TOKEN",
  "SENTRY_DSN", "OTEL_EXPORTER_OTLP_ENDPOINT", "GOOGLE_OAUTH_CLIENT_SECRET", "APPLE_PRIVATE_KEY", "OPS_AUTOMATION_TOKEN"
];
