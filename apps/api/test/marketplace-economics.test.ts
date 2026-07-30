import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_MARKETPLACE_ECONOMICS_POLICY,
  buildSettlementLedgerDraft,
  calculateMarketplaceSettlement
} from "@yardmatch/domain";

test("first completed customer-provider job applies the finder and per-job fees", () => {
  const settlement = calculateMarketplaceSettlement({
    customerChargeCents: 7_500,
    isFirstCompletedCustomerProviderJob: true,
    actualProcessorFeeCents: 248
  });

  assert.equal(settlement.finderFeeCents, 3_000);
  assert.equal(settlement.completedJobFeeCents, 699);
  assert.equal(settlement.providerNetCents, 3_801);
  assert.equal(settlement.platformGrossRevenueCents, 3_699);
  assert.equal(settlement.platformNetRevenueCents, 3_451);
  assert.equal(settlement.crewPayoutByYardMatchCents, 0);
  assert.equal(settlement.crewResponsibility, "provider");
});

test("repeat job applies only the per-job fee and does not shift processing cost to provider", () => {
  const settlement = calculateMarketplaceSettlement({
    customerChargeCents: 7_500,
    isFirstCompletedCustomerProviderJob: false,
    actualProcessorFeeCents: 248
  });

  assert.equal(settlement.finderFeeCents, 0);
  assert.equal(settlement.providerNetCents, 6_801);
  assert.equal(settlement.platformGrossRevenueCents, 699);
  assert.equal(settlement.platformNetRevenueCents, 451);
});

test("economics policy blocks jobs whose provider proceeds would be negative", () => {
  assert.throws(
    () =>
      calculateMarketplaceSettlement({
        customerChargeCents: 3_000,
        isFirstCompletedCustomerProviderJob: true
      }),
    /provider proceeds would be negative/
  );
});

test("financial ledger draft is balanced and idempotency keys are unique", () => {
  const settlement = calculateMarketplaceSettlement({
    customerChargeCents: 7_500,
    isFirstCompletedCustomerProviderJob: true,
    actualProcessorFeeCents: 248
  });
  const entries = buildSettlementLedgerDraft("booking-1", settlement);
  const debits = entries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const credits = entries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);

  assert.equal(debits, credits);
  assert.equal(new Set(entries.map((entry) => entry.idempotencyKey)).size, entries.length);
  assert.equal(ACTIVE_MARKETPLACE_ECONOMICS_POLICY.crewResponsibility, "provider");
});
