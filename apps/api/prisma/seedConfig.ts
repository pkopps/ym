import { validatePasswordStrength } from "../src/auth";

export interface SeedEnvironment {
  [key: string]: string | undefined;
  YARDMATCH_ENV?: string;
  YARDMATCH_STAGING_SEED_PASSWORD?: string;
}

const LOCAL_SEED_PASSWORD = "YardMatch123!";
const KNOWN_UNSAFE_PASSWORDS = new Set([
  LOCAL_SEED_PASSWORD.toLowerCase(),
  "password123!",
  "changeme123!"
]);

export function resolveSeedPassword(environment: SeedEnvironment = process.env): string {
  const deploymentEnvironment = environment.YARDMATCH_ENV?.trim().toLowerCase() || "local";
  if (deploymentEnvironment === "production") {
    throw new Error("The YardMatch fixture seed is disabled in production.");
  }
  if (deploymentEnvironment !== "local" && deploymentEnvironment !== "staging") {
    throw new Error("YARDMATCH_ENV must be local, staging, or production before seeding.");
  }
  if (deploymentEnvironment === "local") {
    return LOCAL_SEED_PASSWORD;
  }

  const password = environment.YARDMATCH_STAGING_SEED_PASSWORD?.trim() ?? "";
  if (!password) {
    throw new Error("YARDMATCH_STAGING_SEED_PASSWORD is required when seeding staging.");
  }
  validatePasswordStrength(password);
  if (
    password.length < 16 ||
    KNOWN_UNSAFE_PASSWORDS.has(password.toLowerCase()) ||
    /(yardmatch|example|change.?me|password)/i.test(password)
  ) {
    throw new Error(
      "YARDMATCH_STAGING_SEED_PASSWORD must be at least 16 characters and cannot be a known or product-derived password."
    );
  }
  return password;
}
