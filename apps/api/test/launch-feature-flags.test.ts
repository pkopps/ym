import assert from "node:assert/strict";
import test from "node:test";
import { ApiRoutes, launchFeatureForApiPath, resolveLaunchFeatureFlags } from "@yardmatch/contracts";
import { enforceLaunchFeatureFlags } from "../src/config/featureGate";

const allOff = { payments: false, crewMarketplace: false };
const allOn = { payments: true, crewMarketplace: true };

const paymentRoutes = [
  ApiRoutes.listPayments,
  ApiRoutes.createCheckoutSession,
  ApiRoutes.finalizeCheckoutSession,
  ApiRoutes.createPaymentIntent,
  ApiRoutes.createRefund,
  ApiRoutes.partialRefund,
  ApiRoutes.opsRefundOverride,
  ApiRoutes.providerPayoutLedger,
  ApiRoutes.crewPayoutLedger,
  ApiRoutes.opsPayoutPreview,
  ApiRoutes.opsPayoutDisbursementRuns,
  ApiRoutes.opsPayoutDisbursementRunsExecute,
  ApiRoutes.providerConnectStatus,
  ApiRoutes.providerConnectOnboarding
];

const crewMarketplaceRoutes = [
  ApiRoutes.crewOpportunities,
  ApiRoutes.publicCrewOpportunities,
  ApiRoutes.selectPublicCrewOpportunity,
  ApiRoutes.claimPublicCrewOpportunity
];

test("payment, payout and crew-marketplace routes map to their launch flags", () => {
  for (const route of paymentRoutes) {
    assert.equal(launchFeatureForApiPath(route), "payments", route);
  }
  for (const route of crewMarketplaceRoutes) {
    assert.equal(launchFeatureForApiPath(route), "crewMarketplace", route);
  }
});

test("disabled launch features answer as unknown routes", () => {
  for (const route of [...paymentRoutes, ...crewMarketplaceRoutes]) {
    assert.throws(
      () => enforceLaunchFeatureFlags({ path: route }, allOff),
      (error: Error & { statusCode?: number }) => error.statusCode === 404 && error.message === "Route not found",
      route
    );
    assert.doesNotThrow(() => enforceLaunchFeatureFlags({ path: route }, allOn), route);
  }
});

test("core booking, crew team tools, support and the Stripe webhook stay reachable with flags off", () => {
  for (const route of [
    ApiRoutes.paymentsWebhook,
    ApiRoutes.createBooking,
    ApiRoutes.completeBooking,
    ApiRoutes.createBookingDispute,
    ApiRoutes.crewPreferences,
    ApiRoutes.crewMatches,
    ApiRoutes.providerStaffingOverview,
    ApiRoutes.providerAssignBookingRouteLeader,
    ApiRoutes.providerCrewMessages,
    ApiRoutes.serviceComplaints,
    ApiRoutes.opsSupportTickets
  ]) {
    assert.equal(launchFeatureForApiPath(route), undefined, route);
    assert.doesNotThrow(() => enforceLaunchFeatureFlags({ path: route }, allOff), route);
  }
});

test("deployment detection drives launch defaults", () => {
  assert.deepEqual(resolveLaunchFeatureFlags({}), allOn);
  assert.deepEqual(resolveLaunchFeatureFlags({ NODE_ENV: "production" }), allOff);
  assert.deepEqual(resolveLaunchFeatureFlags({ NODE_ENV: "production", YARDMATCH_ENV: "staging" }), allOff);
  assert.deepEqual(
    resolveLaunchFeatureFlags({ NODE_ENV: "production", YARDMATCH_CREW_MARKETPLACE_ENABLED: "on" }),
    { payments: false, crewMarketplace: true }
  );
});
