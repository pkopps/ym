import { LAWN_SIZE_BANDS, resolveLawnSizeBand, type LawnSizeBand } from "./propertySizeBands";

/**
 * Launch economics (owner decision, October 14, 2026): customers pay providers directly.
 * YardMatch bills the provider one finder fee per new customer relationship, sized by
 * the property, with no per-job fee. Each provider's first relationship is free.
 *
 * The earlier "2026-07-provider-funded-v1" policy stays in place for settlements that
 * were, or will be, recorded through YardMatch-collected payments.
 */
export const FINDER_FEE_ECONOMICS_POLICY_VERSION = "2026-10-finder-fee-v1" as const;

export type FinderFeePropertySizeTier = "typical" | "large" | "very-large";

export interface FinderFeeTierDefinition {
  tier: FinderFeePropertySizeTier;
  feeCents: number;
  /** Booking-flow lawn-size bands billed at this tier. */
  lawnSizeBandIds: readonly LawnSizeBand["id"][];
}

export interface FinderFeeEconomicsPolicy {
  version: string;
  tiers: readonly FinderFeeTierDefinition[];
  /** Tier used when the property has no lawn size on file. */
  unknownSizeTier: FinderFeePropertySizeTier;
  completedJobFeeCents: 0;
  firstRelationshipPerProviderWaived: boolean;
  /** Hours the customer has to dispute a completed job before the fee becomes billable. */
  customerDisputeWindowHours: number;
  feeBearer: "provider";
  collection: "provider-card-on-file";
  crewResponsibility: "provider";
}

export const DEFAULT_FINDER_FEE_DISPUTE_WINDOW_HOURS = 72;

export const ACTIVE_FINDER_FEE_ECONOMICS_POLICY: FinderFeeEconomicsPolicy = Object.freeze({
  version: FINDER_FEE_ECONOMICS_POLICY_VERSION,
  tiers: Object.freeze([
    { tier: "typical", feeCents: 7_500, lawnSizeBandIds: ["under-2000", "2000-to-5000"] },
    { tier: "large", feeCents: 11_000, lawnSizeBandIds: ["5000-to-9000"] },
    { tier: "very-large", feeCents: 15_000, lawnSizeBandIds: ["over-9000"] }
  ] as const),
  unknownSizeTier: "typical",
  completedJobFeeCents: 0,
  firstRelationshipPerProviderWaived: true,
  customerDisputeWindowHours: DEFAULT_FINDER_FEE_DISPUTE_WINDOW_HOURS,
  feeBearer: "provider",
  collection: "provider-card-on-file",
  crewResponsibility: "provider"
});

/** The policy version new customer relationships are billed under at launch. */
export const LAUNCH_ECONOMICS_POLICY_VERSION = FINDER_FEE_ECONOMICS_POLICY_VERSION;

export interface FinderFeeTierResolution {
  tier: FinderFeePropertySizeTier;
  feeCents: number;
  /** Undefined when no lawn size was on file and the policy's fallback tier applied. */
  lawnSizeBandId?: LawnSizeBand["id"];
}

export function resolveFinderFeeTier(
  lawnSizeSqFt: number | undefined | null,
  policy: FinderFeeEconomicsPolicy = ACTIVE_FINDER_FEE_ECONOMICS_POLICY
): FinderFeeTierResolution {
  const band = resolveLawnSizeBand(lawnSizeSqFt);
  const definition = band
    ? policy.tiers.find((candidate) => candidate.lawnSizeBandIds.includes(band.id))
    : policy.tiers.find((candidate) => candidate.tier === policy.unknownSizeTier);
  if (!definition) {
    throw new Error(
      `Economics policy ${policy.version} has no finder-fee tier for ${band ? `lawn-size band ${band.id}` : "an unknown lawn size"}.`
    );
  }
  return {
    tier: definition.tier,
    feeCents: definition.feeCents,
    ...(band ? { lawnSizeBandId: band.id } : {})
  };
}

export interface FinderFeeInput {
  lawnSizeSqFt?: number | null;
  /** True when the provider has no earlier waived relationship. */
  isProvidersFirstRelationship: boolean;
  policy?: FinderFeeEconomicsPolicy;
}

export interface FinderFeeBreakdown extends FinderFeeTierResolution {
  policyVersion: string;
  /** The tier's published fee before any waiver. */
  listFeeCents: number;
  /** What the provider is billed: zero when waived. */
  feeCents: number;
  waived: boolean;
  completedJobFeeCents: 0;
}

export function calculateFinderFee(input: FinderFeeInput): FinderFeeBreakdown {
  const policy = input.policy ?? ACTIVE_FINDER_FEE_ECONOMICS_POLICY;
  const resolution = resolveFinderFeeTier(input.lawnSizeSqFt, policy);
  if (!Number.isSafeInteger(resolution.feeCents) || resolution.feeCents < 0) {
    throw new Error("Finder fee must be a non-negative integer number of cents.");
  }
  const waived = policy.firstRelationshipPerProviderWaived && input.isProvidersFirstRelationship;
  return {
    ...resolution,
    policyVersion: policy.version,
    listFeeCents: resolution.feeCents,
    feeCents: waived ? 0 : resolution.feeCents,
    waived,
    completedJobFeeCents: policy.completedJobFeeCents
  };
}

/** When the dispute window for a completed job closes. */
export function resolveFinderFeeWindowEnd(completedAtIso: string, disputeWindowHours: number): string {
  const completedAt = Date.parse(completedAtIso);
  if (!Number.isFinite(completedAt)) {
    throw new Error("completedAt must be an ISO timestamp.");
  }
  if (!Number.isFinite(disputeWindowHours) || disputeWindowHours <= 0) {
    throw new Error("disputeWindowHours must be a positive number.");
  }
  return new Date(completedAt + disputeWindowHours * 60 * 60 * 1000).toISOString();
}

export type FinderFeeTriggerState = "awaiting-customer" | "blocked-by-dispute" | "billable";

export interface FinderFeeTriggerInput {
  /** Close of the dispute window, from `resolveFinderFeeWindowEnd`. */
  windowEndsAt: string;
  customerConfirmedAt?: string;
  disputeOpen: boolean;
  now: string;
}

/**
 * A finder fee is billable once the provider has marked the job complete and the customer
 * has either confirmed it or let the dispute window pass. An open dispute always blocks it.
 */
export function evaluateFinderFeeTrigger(input: FinderFeeTriggerInput): FinderFeeTriggerState {
  if (input.disputeOpen) {
    return "blocked-by-dispute";
  }
  if (input.customerConfirmedAt) {
    return "billable";
  }
  return Date.parse(input.now) >= Date.parse(input.windowEndsAt) ? "billable" : "awaiting-customer";
}

/** Every lawn-size band the booking flow offers must land in exactly one tier. */
export function describeFinderFeeBandMapping(
  policy: FinderFeeEconomicsPolicy = ACTIVE_FINDER_FEE_ECONOMICS_POLICY
): Array<{ lawnSizeBandId: LawnSizeBand["id"]; label: string; tier: FinderFeePropertySizeTier; feeCents: number }> {
  return LAWN_SIZE_BANDS.map((band) => {
    const resolution = resolveFinderFeeTier(band.representativeSqFt, policy);
    return { lawnSizeBandId: band.id, label: band.label, tier: resolution.tier, feeCents: resolution.feeCents };
  });
}
