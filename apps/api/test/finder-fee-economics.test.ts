import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_FINDER_FEE_ECONOMICS_POLICY,
  ACTIVE_MARKETPLACE_ECONOMICS_POLICY,
  FINDER_FEE_ECONOMICS_POLICY_VERSION,
  InstantQuoteEngine,
  LAWN_SIZE_BANDS,
  YARDMATCH_ECONOMICS_POLICY_VERSION,
  buildSettlementLedgerDraft,
  calculateFinderFee,
  calculateMarketplaceSettlement,
  describeFinderFeeBandMapping,
  evaluateFinderFeeTrigger,
  getSettlementEconomicsPolicy,
  resolveFinderFeeTier,
  resolveFinderFeeWindowEnd
} from "@yardmatch/domain";

test("finder-fee policy is a new version with no per-job fee and leaves the 2026-07 policy unchanged", () => {
  assert.equal(FINDER_FEE_ECONOMICS_POLICY_VERSION, "2026-10-finder-fee-v1");
  assert.notEqual(FINDER_FEE_ECONOMICS_POLICY_VERSION, YARDMATCH_ECONOMICS_POLICY_VERSION);
  assert.equal(ACTIVE_FINDER_FEE_ECONOMICS_POLICY.completedJobFeeCents, 0);
  assert.equal(ACTIVE_FINDER_FEE_ECONOMICS_POLICY.customerDisputeWindowHours, 72);
  assert.equal(ACTIVE_FINDER_FEE_ECONOMICS_POLICY.collection, "provider-card-on-file");
  assert.deepEqual(
    { version: ACTIVE_MARKETPLACE_ECONOMICS_POLICY.version, finder: ACTIVE_MARKETPLACE_ECONOMICS_POLICY.finderFeeCents, job: ACTIVE_MARKETPLACE_ECONOMICS_POLICY.completedJobFeeCents },
    { version: "2026-07-provider-funded-v1", finder: 3_000, job: 699 }
  );
});

test("tier selection maps every booking-flow lawn-size band, including its boundaries", () => {
  assert.deepEqual(describeFinderFeeBandMapping().map(row => [row.lawnSizeBandId, row.tier, row.feeCents]), [
    ["under-2000", "typical", 7_500],
    ["2000-to-5000", "typical", 7_500],
    ["5000-to-9000", "large", 11_000],
    ["over-9000", "very-large", 15_000]
  ]);
  const cases: Array<[number | undefined, string, number]> = [
    [1, "typical", 7_500], [1_999, "typical", 7_500], [2_000, "typical", 7_500], [5_000, "typical", 7_500],
    [5_001, "large", 11_000], [9_000, "large", 11_000], [9_001, "very-large", 15_000], [250_000, "very-large", 15_000],
    [undefined, "typical", 7_500], [0, "typical", 7_500], [Number.NaN, "typical", 7_500]
  ];
  for (const [size, tier, feeCents] of cases) {
    assert.deepEqual([resolveFinderFeeTier(size).tier, resolveFinderFeeTier(size).feeCents], [tier, feeCents], `size ${size}`);
  }
  assert.equal(resolveFinderFeeTier(undefined).lawnSizeBandId, undefined);
});

test("the quote follow-up offers exactly the bands the fee tiers are mapped onto", () => {
  // The engine only asks when its estimate is uncertain; read the question it would ask.
  const engine = new InstantQuoteEngine() as unknown as {
    buildFollowUpQuestions(category: string, measurements: object, answers: unknown[]): Array<{ id: string; options?: Array<{ label: string; value: string }> }>;
  };
  const questions = engine.buildFollowUpQuestions("lawn-mowing", {
    turfSqFt: 4_000, shrubBedSqFt: 300, drivewaySqFt: 600, sidewalkLinearFt: 40, lotComplexity: "high", slope: "steep"
  }, []);
  const turf = questions.find(question => question.id === "turf_sq_ft");
  assert.ok(turf, "lawn-size question is offered");
  assert.deepEqual(turf.options?.map(option => [option.label, Number(option.value)]), LAWN_SIZE_BANDS.map(band => [band.label, band.representativeSqFt]));
  for (const band of LAWN_SIZE_BANDS) {
    assert.equal(resolveFinderFeeTier(band.representativeSqFt).lawnSizeBandId, band.id);
  }
});

test("the provider's first relationship is waived and later ones pay the tier fee", () => {
  const first = calculateFinderFee({ lawnSizeSqFt: 10_000, isProvidersFirstRelationship: true });
  assert.deepEqual([first.waived, first.feeCents, first.listFeeCents, first.tier], [true, 0, 15_000, "very-large"]);
  const later = calculateFinderFee({ lawnSizeSqFt: 10_000, isProvidersFirstRelationship: false });
  assert.deepEqual([later.waived, later.feeCents, later.completedJobFeeCents, later.policyVersion], [false, 15_000, 0, "2026-10-finder-fee-v1"]);
  const noWaiver = calculateFinderFee({
    lawnSizeSqFt: 3_000, isProvidersFirstRelationship: true,
    policy: { ...ACTIVE_FINDER_FEE_ECONOMICS_POLICY, firstRelationshipPerProviderWaived: false }
  });
  assert.deepEqual([noWaiver.waived, noWaiver.feeCents], [false, 7_500]);
});

test("completion trigger: billable on customer confirmation or window expiry, never during a dispute", () => {
  const completedAt = "2026-11-02T15:00:00.000Z";
  const windowEndsAt = resolveFinderFeeWindowEnd(completedAt, 72);
  assert.equal(windowEndsAt, "2026-11-05T15:00:00.000Z");
  assert.equal(resolveFinderFeeWindowEnd(completedAt, 24), "2026-11-03T15:00:00.000Z");
  const base = { windowEndsAt, disputeOpen: false };
  assert.equal(evaluateFinderFeeTrigger({ ...base, now: "2026-11-05T14:59:59.999Z" }), "awaiting-customer");
  assert.equal(evaluateFinderFeeTrigger({ ...base, now: windowEndsAt }), "billable");
  assert.equal(evaluateFinderFeeTrigger({ ...base, customerConfirmedAt: "2026-11-02T16:00:00.000Z", now: "2026-11-02T16:00:00.000Z" }), "billable");
  assert.equal(evaluateFinderFeeTrigger({ ...base, disputeOpen: true, now: "2026-12-01T00:00:00.000Z" }), "blocked-by-dispute");
  assert.equal(evaluateFinderFeeTrigger({ ...base, disputeOpen: true, customerConfirmedAt: completedAt, now: "2026-12-01T00:00:00.000Z" }), "blocked-by-dispute");
  assert.throws(() => resolveFinderFeeWindowEnd("not a date", 72), /ISO/);
  assert.throws(() => resolveFinderFeeWindowEnd(completedAt, 0), /positive/);
});

test("a record stored under the old policy version still computes exactly as before", () => {
  const stored = calculateMarketplaceSettlement({ customerChargeCents: 7_500, isFirstCompletedCustomerProviderJob: true, actualProcessorFeeCents: 248 });
  assert.equal(stored.policyVersion, "2026-07-provider-funded-v1");
  const recomputed = calculateMarketplaceSettlement({
    customerChargeCents: stored.customerChargeCents,
    isFirstCompletedCustomerProviderJob: true,
    actualProcessorFeeCents: stored.actualProcessorFeeCents,
    policy: getSettlementEconomicsPolicy(stored.policyVersion)
  });
  assert.deepEqual(recomputed, stored);
  assert.deepEqual(
    [recomputed.finderFeeCents, recomputed.completedJobFeeCents, recomputed.providerNetCents, recomputed.platformNetRevenueCents],
    [3_000, 699, 3_801, 3_451]
  );
  assert.equal(buildSettlementLedgerDraft("booking-legacy", recomputed).length, 6);
  assert.throws(() => getSettlementEconomicsPolicy("2026-10-finder-fee-v1"), /Unknown settlement economics policy/);
  assert.throws(() => getSettlementEconomicsPolicy("__proto__"), /Unknown settlement economics policy/);
});
