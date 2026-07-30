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
  requireValue(environment, "DATABASE_URL", problems);

  const jwtSecret = requireValue(environment, "JWT_SECRET", problems);
  if (jwtSecret && (jwtSecret === DEVELOPMENT_JWT_SECRET || jwtSecret.length < 32)) {
    problems.push("JWT_SECRET must be at least 32 characters and must not use the development secret.");
  }

  const stripeKey = requireValue(environment, "STRIPE_SECRET_KEY", problems);
  if (stripeKey && !stripeKey.startsWith("rk_live_") && !stripeKey.startsWith("sk_live_")) {
    problems.push("STRIPE_SECRET_KEY must be a live restricted or secret key in production.");
  }
  requireValue(environment, "STRIPE_WEBHOOK_SECRET", problems);

  requireHttpsUrl(environment, "APP_BASE_URL", problems);
  requireHttpsUrl(environment, "API_BASE_URL", problems);

  requireValue(environment, "RESEND_API_KEY", problems);
  requireValue(environment, "NOTIFICATION_EMAIL_FROM", problems);
  requireValue(environment, "TWILIO_ACCOUNT_SID", problems);
  requireValue(environment, "TWILIO_AUTH_TOKEN", problems);
  requireValue(environment, "TWILIO_FROM_NUMBER", problems);

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
