export interface LaunchFeatureFlags {
  /** YardMatch-collected payments: checkout, refunds, Stripe Connect onboarding and payouts. */
  payments: boolean;
  /** Public crew opportunities that crew can browse, select and claim across providers. */
  crewMarketplace: boolean;
}

export const LAUNCH_FEATURE_FLAG_ENV_KEYS = {
  payments: "YARDMATCH_PAYMENTS_ENABLED",
  crewMarketplace: "YARDMATCH_CREW_MARKETPLACE_ENABLED"
} as const satisfies Record<keyof LaunchFeatureFlags, string>;

export type LaunchFeatureFlagEnvironment = Record<string, string | undefined>;

const TRUE_VALUES = new Set(["true", "1", "on", "yes"]);
const FALSE_VALUES = new Set(["false", "0", "off", "no"]);

export function isDeployedEnvironment(environment: LaunchFeatureFlagEnvironment): boolean {
  const configured = environment.YARDMATCH_ENV?.trim().toLowerCase();
  if (configured === "staging" || configured === "production") {
    return true;
  }
  if (configured === "local") {
    return false;
  }
  return environment.NODE_ENV?.trim() === "production";
}

/**
 * Launch scope (docs/plans/launch-scope-2026-10.md) ships without YardMatch-collected
 * payments or a public crew marketplace. Deployed environments default both off; local
 * development keeps them on so existing flows and smoke coverage stay exercisable.
 */
export function resolveLaunchFeatureFlags(
  environment: LaunchFeatureFlagEnvironment,
  problems?: string[]
): LaunchFeatureFlags {
  const defaultEnabled = !isDeployedEnvironment(environment);
  const read = (key: string): boolean => {
    const configured = environment[key]?.trim().toLowerCase();
    if (!configured) {
      return defaultEnabled;
    }
    if (TRUE_VALUES.has(configured)) {
      return true;
    }
    if (FALSE_VALUES.has(configured)) {
      return false;
    }
    problems?.push(`${key} must be true or false.`);
    return false;
  };

  return {
    payments: read(LAUNCH_FEATURE_FLAG_ENV_KEYS.payments),
    crewMarketplace: read(LAUNCH_FEATURE_FLAG_ENV_KEYS.crewMarketplace)
  };
}

const PAYMENT_ROUTE_PREFIXES = ["/api/payouts/", "/api/providers/connect/"];
const PAYMENT_ROUTES = new Set([
  "/api/payments",
  "/api/payments/checkout-session",
  "/api/payments/checkout-session/finalize",
  "/api/payments/intent",
  "/api/payments/refund",
  "/api/support/ops/partial-refund",
  "/api/support/ops/refund-override"
]);
const CREW_MARKETPLACE_ROUTES = new Set([
  "/api/crew/opportunities",
  "/api/crew/opportunities/public",
  "/api/crew/opportunities/public/select",
  "/api/crew/opportunities/claim"
]);

/**
 * Returns the flag that must be on for an API path, or undefined for ungated paths.
 * The Stripe webhook stays reachable so signed events are never dropped while a flag is off.
 */
export function launchFeatureForApiPath(path: string): keyof LaunchFeatureFlags | undefined {
  if (PAYMENT_ROUTES.has(path) || PAYMENT_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return "payments";
  }
  if (CREW_MARKETPLACE_ROUTES.has(path)) {
    return "crewMarketplace";
  }
  return undefined;
}
