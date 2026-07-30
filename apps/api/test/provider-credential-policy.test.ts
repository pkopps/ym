import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProviderCredentialReadiness } from "../src/policies/providerCredentialPolicy";

test("baseline provider requires verified registration and liability insurance", () => {
  const readiness = evaluateProviderCredentialReadiness({ categories: ["lawn-mowing"] }, []);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missingTypes.sort(), [
    "business-registration",
    "general-liability-insurance"
  ]);
  assert.equal(readiness.crewEngagementAllowed, false);
});

test("regulated lawn-treatment categories require pesticide credential review", () => {
  const submittedAt = "2026-07-01T00:00:00.000Z";
  const credentials = [
    {
      id: "business",
      providerId: "provider-1",
      type: "business-registration" as const,
      status: "verified" as const,
      jurisdiction: "NJ",
      submittedAt
    },
    {
      id: "insurance",
      providerId: "provider-1",
      type: "general-liability-insurance" as const,
      status: "verified" as const,
      jurisdiction: "NJ",
      expiresAt: "2027-07-01T00:00:00.000Z",
      submittedAt
    }
  ];
  const readiness = evaluateProviderCredentialReadiness(
    { categories: ["fertilization"] },
    credentials,
    new Date("2026-07-29T00:00:00.000Z")
  );
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missingTypes, ["pesticide-applicator-license"]);
});

test("workers compensation is a separate hard gate for engaging crew", () => {
  const submittedAt = "2026-07-01T00:00:00.000Z";
  const credentials = [
    {
      id: "business",
      providerId: "provider-1",
      type: "business-registration" as const,
      status: "verified" as const,
      jurisdiction: "NJ",
      submittedAt
    },
    {
      id: "insurance",
      providerId: "provider-1",
      type: "general-liability-insurance" as const,
      status: "verified" as const,
      jurisdiction: "NJ",
      submittedAt
    },
    {
      id: "workers-comp",
      providerId: "provider-1",
      type: "workers-compensation" as const,
      status: "verified" as const,
      jurisdiction: "NJ",
      expiresAt: "2027-01-01T00:00:00.000Z",
      submittedAt
    }
  ];
  const readiness = evaluateProviderCredentialReadiness(
    { categories: ["lawn-mowing"] },
    credentials,
    new Date("2026-07-29T00:00:00.000Z")
  );
  assert.equal(readiness.ready, true);
  assert.equal(readiness.crewEngagementAllowed, true);
});
