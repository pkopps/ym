const DEVELOPMENT_JWT_SECRET = "yardmatch-dev-secret";

export interface RuntimeEnvironment {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  APP_BASE_URL?: string;
  API_BASE_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
}

export interface RuntimeConfiguration {
  production: boolean;
  repositoryMode: "in-memory" | "prisma-postgres";
}

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
    problems.push(`${key} is required in production.`);
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
      problems.push(`${key} must use https in production.`);
    }
  } catch {
    problems.push(`${key} must be a valid absolute URL.`);
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
      problems.push("DATABASE_URL must use PostgreSQL in production.");
    }
    if (!parsed.hostname || parsed.pathname === "/" || parsed.pathname === "") {
      problems.push("DATABASE_URL must identify a PostgreSQL host and database in production.");
    }
  } catch {
    problems.push("DATABASE_URL must be a valid PostgreSQL URL in production.");
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
  const production = value(environment, "NODE_ENV") === "production";
  if (!production) {
    return {
      production: false,
      repositoryMode: value(environment, "DATABASE_URL") ? "prisma-postgres" : "in-memory"
    };
  }

  const problems: string[] = [];
  requirePostgresUrl(environment, problems);

  const jwtSecret = requireValue(environment, "JWT_SECRET", problems);
  if (jwtSecret && (jwtSecret === DEVELOPMENT_JWT_SECRET || jwtSecret.length < 32)) {
    problems.push("JWT_SECRET must be at least 32 characters and must not use the development secret.");
  }

  const stripeKey = requireValue(environment, "STRIPE_SECRET_KEY", problems);
  if (stripeKey && !stripeKey.startsWith("rk_live_") && !stripeKey.startsWith("sk_live_")) {
    problems.push("STRIPE_SECRET_KEY must be a live restricted or secret key in production.");
  }
  requirePattern(
    environment,
    "STRIPE_WEBHOOK_SECRET",
    /^whsec_[A-Za-z0-9]{16,}$/,
    "STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret in production.",
    problems
  );

  requireHttpsUrl(environment, "APP_BASE_URL", problems);
  requireHttpsUrl(environment, "API_BASE_URL", problems);

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

  if (problems.length > 0) {
    throw new Error(`Unsafe production configuration:\n- ${problems.join("\n- ")}`);
  }

  return {
    production: true,
    repositoryMode: "prisma-postgres"
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
