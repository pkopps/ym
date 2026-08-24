const DEVELOPMENT_JWT_SECRET = "yardmatch-dev-secret";

export interface RuntimeEnvironment {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  YARDMATCH_ENV?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  APP_BASE_URL?: string;
  API_BASE_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  API_MAX_REQUEST_BODY_BYTES?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  STAGING_NOTIFICATION_ALLOWED_EMAILS?: string;
  STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS?: string;
  STAGING_NOTIFICATION_ALLOWED_PUSH_TOKENS?: string;
  PHOTO_STORAGE_MODE?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
}

export type YardMatchDeploymentEnvironment = "local" | "staging" | "production";

export interface RuntimeConfiguration {
  production: boolean;
  staging: boolean;
  deployed: boolean;
  deploymentEnvironment: YardMatchDeploymentEnvironment;
  repositoryMode: "in-memory" | "prisma-postgres";
  maxRequestBodyBytes: number;
}

const DEFAULT_MAX_REQUEST_BODY_BYTES = 2_500_000;
const MIN_MAX_REQUEST_BODY_BYTES = 64 * 1024;
const MAX_MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024;

function value(environment: RuntimeEnvironment, key: string): string {
  return environment[key]?.trim() ?? "";
}

function requireValue(
  environment: RuntimeEnvironment,
  key: string,
  problems: string[]
): string {
  const configured = value(environment, key);
  if (!configured) {
    problems.push(`${key} is required in staging and production.`);
  }
  return configured;
}

function requireHttpsUrl(
  environment: RuntimeEnvironment,
  key: "APP_BASE_URL" | "API_BASE_URL",
  problems: string[]
): void {
  const configured = requireValue(environment, key, problems);
  if (!configured) {
    return;
  }

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:") {
      problems.push(`${key} must use https in staging and production.`);
    }
  } catch {
    problems.push(`${key} must be a valid absolute URL.`);
  }
}

function requireErrorReporting(environment: RuntimeEnvironment, problems: string[]): void {
  const configured = requireValue(environment, "SENTRY_DSN", problems);
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol !== "https:" || !parsed.username || !parsed.hostname || parsed.pathname === "/") {
        problems.push("SENTRY_DSN must be a valid HTTPS project DSN in staging and production.");
      }
    } catch {
      problems.push("SENTRY_DSN must be a valid HTTPS project DSN in staging and production.");
    }
  }

  const sampleRate = value(environment, "SENTRY_TRACES_SAMPLE_RATE");
  if (sampleRate) {
    const parsed = Number(sampleRate);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      problems.push("SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1.");
    }
  }
}

function parseDeploymentEnvironment(
  environment: RuntimeEnvironment,
  problems: string[]
): YardMatchDeploymentEnvironment {
  const configured = value(environment, "YARDMATCH_ENV").toLowerCase();
  const nodeProduction = value(environment, "NODE_ENV") === "production";

  if (!configured) {
    return nodeProduction ? "production" : "local";
  }

  if (configured !== "local" && configured !== "staging" && configured !== "production") {
    problems.push("YARDMATCH_ENV must be local, staging, or production.");
    return nodeProduction ? "production" : "local";
  }

  if ((configured === "staging" || configured === "production") && !nodeProduction) {
    problems.push(`${configured} deployments require NODE_ENV=production.`);
  }

  if (configured === "local" && nodeProduction) {
    problems.push("YARDMATCH_ENV=local cannot be used with NODE_ENV=production.");
  }

  return configured;
}

function parseMaxRequestBodyBytes(
  environment: RuntimeEnvironment,
  problems: string[]
): number {
  const configured = value(environment, "API_MAX_REQUEST_BODY_BYTES");
  if (!configured) {
    return DEFAULT_MAX_REQUEST_BODY_BYTES;
  }

  const parsed = Number(configured);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_MAX_REQUEST_BODY_BYTES ||
    parsed > MAX_MAX_REQUEST_BODY_BYTES
  ) {
    problems.push(
      `API_MAX_REQUEST_BODY_BYTES must be an integer between ${MIN_MAX_REQUEST_BODY_BYTES} and ${MAX_MAX_REQUEST_BODY_BYTES}.`
    );
    return DEFAULT_MAX_REQUEST_BODY_BYTES;
  }

  return parsed;
}

function parseCsv(environment: RuntimeEnvironment, key: string): string[] {
  return value(environment, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireCorsOrigins(
  environment: RuntimeEnvironment,
  appBaseUrl: string,
  problems: string[]
): void {
  const origins = parseCsv(environment, "CORS_ALLOWED_ORIGINS");
  if (origins.length === 0) {
    problems.push("CORS_ALLOWED_ORIGINS is required for staging and production deployments.");
    return;
  }

  if (origins.includes("*")) {
    problems.push("CORS_ALLOWED_ORIGINS cannot use a wildcard in staging or production.");
  }

  for (const origin of origins) {
    const normalized = origin.replace("*.", "wildcard.");
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        problems.push(`CORS_ALLOWED_ORIGINS contains an invalid HTTPS origin: ${origin}`);
      }
    } catch {
      problems.push(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  if (appBaseUrl && !origins.includes(appBaseUrl)) {
    problems.push("CORS_ALLOWED_ORIGINS must include APP_BASE_URL exactly.");
  }
}

function requirePrivatePhotoStorage(
  environment: RuntimeEnvironment,
  problems: string[]
): void {
  const storageMode = requireValue(environment, "PHOTO_STORAGE_MODE", problems);
  if (storageMode && storageMode !== "vercel-blob-private") {
    problems.push("PHOTO_STORAGE_MODE must be vercel-blob-private in staging and production.");
  }

  const token = requireValue(environment, "BLOB_READ_WRITE_TOKEN", problems);
  if (token && token.length < 24) {
    problems.push("BLOB_READ_WRITE_TOKEN must be a non-placeholder private Blob credential.");
  }
}

function requireStagingNotificationAllowlist(
  environment: RuntimeEnvironment,
  problems: string[]
): void {
  if (parseCsv(environment, "STAGING_NOTIFICATION_ALLOWED_EMAILS").length === 0) {
    problems.push("STAGING_NOTIFICATION_ALLOWED_EMAILS is required in staging.");
  }
  if (parseCsv(environment, "STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS").length === 0) {
    problems.push("STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS is required in staging.");
  }
}

function requirePostgresUrl(
  environment: RuntimeEnvironment,
  problems: string[]
): void {
  const configured = requireValue(environment, "DATABASE_URL", problems);
  if (!configured) {
    return;
  }

  try {
    const parsed = new URL(configured);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      problems.push("DATABASE_URL must use PostgreSQL in staging and production.");
    }
    if (!parsed.hostname || parsed.pathname === "/" || parsed.pathname === "") {
      problems.push("DATABASE_URL must identify a PostgreSQL host and database in staging and production.");
    }
  } catch {
    problems.push("DATABASE_URL must be a valid PostgreSQL URL in staging and production.");
  }
}

function requirePattern(
  environment: RuntimeEnvironment,
  key: string,
  pattern: RegExp,
  message: string,
  problems: string[]
): string {
  const configured = requireValue(environment, key, problems);
  if (configured && !pattern.test(configured)) {
    problems.push(message);
  }
  return configured;
}

function requireProductionEmailFrom(
  environment: RuntimeEnvironment,
  problems: string[]
): void {
  const configured = requireValue(environment, "NOTIFICATION_EMAIL_FROM", problems);
  if (!configured) {
    return;
  }

  const angleBracketMatch = configured.match(/<([^<>]+)>$/);
  const address = (angleBracketMatch?.[1] ?? configured).trim().toLowerCase();
  const emailMatch = address.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  const domain = emailMatch?.[1];
  if (
    !domain ||
    domain === "example.com" ||
    domain.endsWith(".example") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".test") ||
    domain === "localhost"
  ) {
    problems.push(
      "NOTIFICATION_EMAIL_FROM must use a valid production sender domain, not a placeholder domain."
    );
  }
}

/**
 * Prevents the API from silently launching with development storage, auth, payment,
 * or notification fallbacks. Local development intentionally remains permissive.
 */
export function validateRuntimeConfiguration(
  environment: RuntimeEnvironment = process.env
): RuntimeConfiguration {
  const problems: string[] = [];
  const deploymentEnvironment = parseDeploymentEnvironment(environment, problems);
  const production = deploymentEnvironment === "production";
  const staging = deploymentEnvironment === "staging";
  const deployed = production || staging;
  const maxRequestBodyBytes = parseMaxRequestBodyBytes(environment, problems);

  if (!deployed) {
    if (problems.length > 0) {
      throw new Error(`Unsafe runtime configuration:\n- ${problems.join("\n- ")}`);
    }
    return {
      production: false,
      staging: false,
      deployed: false,
      deploymentEnvironment,
      repositoryMode: value(environment, "DATABASE_URL") ? "prisma-postgres" : "in-memory",
      maxRequestBodyBytes
    };
  }

  requirePostgresUrl(environment, problems);

  const jwtSecret = requireValue(environment, "JWT_SECRET", problems);
  if (jwtSecret && (jwtSecret === DEVELOPMENT_JWT_SECRET || jwtSecret.length < 32)) {
    problems.push("JWT_SECRET must be at least 32 characters and must not use the development secret.");
  }

  const stripeKey = requireValue(environment, "STRIPE_SECRET_KEY", problems);
  if (
    production &&
    stripeKey &&
    !stripeKey.startsWith("rk_live_") &&
    !stripeKey.startsWith("sk_live_")
  ) {
    problems.push("STRIPE_SECRET_KEY must be a live restricted or secret key in production.");
  }
  if (
    staging &&
    stripeKey &&
    !stripeKey.startsWith("rk_test_") &&
    !stripeKey.startsWith("sk_test_")
  ) {
    problems.push("STRIPE_SECRET_KEY must use Stripe test mode in staging.");
  }
  requirePattern(
    environment,
    "STRIPE_WEBHOOK_SECRET",
    /^whsec_[A-Za-z0-9]{16,}$/,
    "STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret in staging and production.",
    problems
  );

  const appBaseUrl = value(environment, "APP_BASE_URL");
  requireHttpsUrl(environment, "APP_BASE_URL", problems);
  requireHttpsUrl(environment, "API_BASE_URL", problems);
  requireCorsOrigins(environment, appBaseUrl, problems);
  requirePrivatePhotoStorage(environment, problems);
  requireErrorReporting(environment, problems);

  requirePattern(
    environment,
    "RESEND_API_KEY",
    /^re_[A-Za-z0-9_-]{16,}$/,
    "RESEND_API_KEY must be a production-shaped Resend API key.",
    problems
  );
  requireProductionEmailFrom(environment, problems);
  requirePattern(
    environment,
    "TWILIO_ACCOUNT_SID",
    /^AC[a-fA-F0-9]{32}$/,
    "TWILIO_ACCOUNT_SID must be a valid Twilio account SID.",
    problems
  );
  requirePattern(
    environment,
    "TWILIO_AUTH_TOKEN",
    /^[a-fA-F0-9]{32}$/,
    "TWILIO_AUTH_TOKEN must be a production-shaped Twilio auth token.",
    problems
  );
  requirePattern(
    environment,
    "TWILIO_FROM_NUMBER",
    /^\+[1-9]\d{7,14}$/,
    "TWILIO_FROM_NUMBER must be an approved E.164 sender number.",
    problems
  );

  if (staging) {
    requireStagingNotificationAllowlist(environment, problems);
  }

  if (problems.length > 0) {
    throw new Error(`Unsafe ${deploymentEnvironment} configuration:\n- ${problems.join("\n- ")}`);
  }

  return {
    production,
    staging,
    deployed,
    deploymentEnvironment,
    repositoryMode: "prisma-postgres",
    maxRequestBodyBytes
  };
}

export function resolveJwtSecret(environment: RuntimeEnvironment = process.env): string {
  const configured = value(environment, "JWT_SECRET");
  if (configured) {
    if (value(environment, "NODE_ENV") === "production" && configured.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production.");
    }
    return configured;
  }

  if (value(environment, "NODE_ENV") === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }

  return DEVELOPMENT_JWT_SECRET;
}
