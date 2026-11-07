import assert from "node:assert/strict";
import test from "node:test";
import {
  CriticalPathMonitor,
  readCriticalPathConfig,
  type CriticalPathConfig,
  type CriticalPathDependencies
} from "../src/observability/CriticalPathMonitor";
import type { AuthIdentityRecord } from "../src/repositories/MarketplaceRepository";

const address = {
  line1: "1 Main St",
  city: "Barnegat",
  state: "NJ",
  postalCode: "08005",
  country: "US",
  point: { latitude: 39.75, longitude: -74.22 }
};
const identity = {
  userId: "user-monitor",
  email: "monitor@yardmatch.example",
  passwordHash: "hash",
  role: "customer",
  sessionVersion: 1
} as AuthIdentityRecord;
const fullConfig: CriticalPathConfig = {
  matching: { address, category: "lawn-mowing", minimumMatches: 1 },
  signIn: { email: identity.email, password: "correct-horse" }
};

function dependencies(overrides: Partial<CriticalPathDependencies> = {}) {
  const failures: Array<{ check: string; error: unknown }> = [];
  const calls = { search: 0, verify: 0 };
  const deps: CriticalPathDependencies = {
    checkDatabase: async () => undefined,
    searchProviders: async () => { calls.search += 1; return { totalMatches: 2 }; },
    findAuthIdentityByEmail: async () => identity,
    getUserByIdentity: async () => ({ id: identity.userId }),
    isAuthIdentityTemporarilyLocked: () => false,
    verifyPassword: async (password) => { calls.verify += 1; return password === "correct-horse"; },
    signSessionToken: (actor) => `token:${actor.userId}`,
    verifySessionToken: (token) => ({ ...identity, userId: token.replace("token:", "") }) as never,
    reportFailure: (check, error) => failures.push({ check, error }),
    ...overrides
  };
  return { deps, failures, calls };
}

test("all critical paths pass when database, matching and sign-in work", async () => {
  const { deps, failures } = dependencies();
  const report = await new CriticalPathMonitor(deps, fullConfig).getReport();
  assert.equal(report.status, "ok");
  assert.deepEqual(Object.values(report.checks).map((check) => check.status), ["pass", "pass", "pass"]);
  assert.equal(failures.length, 0);
});

test("unconfigured canaries report incomplete instead of a false ok", async () => {
  const { deps } = dependencies();
  const report = await new CriticalPathMonitor(deps, {}).getReport();
  assert.equal(report.status, "incomplete");
  assert.equal(report.checks.database.status, "pass");
  assert.equal(report.checks.matching.status, "not-configured");
  assert.equal(report.checks.signIn.status, "not-configured");
});

test("zero provider matches fails matching and reports detail privately", async () => {
  const { deps, failures } = dependencies({ searchProviders: async () => ({ totalMatches: 0 }) });
  const report = await new CriticalPathMonitor(deps, fullConfig).getReport();
  assert.equal(report.status, "failing");
  assert.equal(report.checks.matching.status, "fail");
  assert.equal(report.checks.signIn.status, "pass");
  assert.equal(failures[0]?.check, "matching");
  assert.match(String((failures[0]?.error as Error).message), /found 0/);
  assert.equal(JSON.stringify(report).includes("found 0"), false, "public report carries no failure detail");
});

test("sign-in failures cover missing account, lock, disabled access and bad password", async () => {
  const cases: Array<Partial<CriticalPathDependencies>> = [
    { findAuthIdentityByEmail: async () => undefined },
    { isAuthIdentityTemporarilyLocked: () => true },
    { findAuthIdentityByEmail: async () => ({ ...identity, accessDisabledAt: "2026-11-01T00:00:00Z" }) },
    { verifyPassword: async () => false },
    { getUserByIdentity: async () => undefined }
  ];
  for (const overrides of cases) {
    const { deps } = dependencies(overrides);
    const report = await new CriticalPathMonitor(deps, fullConfig).getReport();
    assert.equal(report.checks.signIn.status, "fail");
    assert.equal(report.status, "failing");
  }
});

test("a hung dependency fails its check within the timeout", async () => {
  const { deps, failures } = dependencies({ checkDatabase: () => new Promise(() => undefined) });
  const report = await new CriticalPathMonitor(deps, fullConfig, { checkTimeoutMs: 20 }).getReport();
  assert.equal(report.checks.database.status, "fail");
  assert.equal((failures[0]?.error as Error).name, "ExternalRequestTimeoutError");
});

test("reports are cached and concurrent probes share one run", async () => {
  let nowMs = 1_000_000;
  const { deps, calls } = dependencies();
  const monitor = new CriticalPathMonitor(deps, fullConfig, { cacheMs: 30_000, now: () => nowMs });
  await Promise.all([monitor.getReport(), monitor.getReport(), monitor.getReport()]);
  await monitor.getReport();
  assert.equal(calls.search, 1);
  assert.equal(calls.verify, 1);
  nowMs += 31_000;
  await monitor.getReport();
  assert.equal(calls.search, 2);
});

test("config is read from env and rejects incomplete canary addresses", () => {
  const config = readCriticalPathConfig({
    CRITICAL_PATH_MATCHING_ADDRESS: JSON.stringify(address),
    CRITICAL_PATH_SIGN_IN_EMAIL: " Monitor@YardMatch.example ",
    CRITICAL_PATH_SIGN_IN_PASSWORD: "secret"
  });
  assert.equal(config.matching?.category, "lawn-mowing");
  assert.equal(config.matching?.minimumMatches, 1);
  assert.equal(config.signIn?.email, "monitor@yardmatch.example");

  assert.equal(readCriticalPathConfig({ CRITICAL_PATH_MATCHING_ADDRESS: "{not json" }).matching, undefined);
  assert.equal(readCriticalPathConfig({ CRITICAL_PATH_MATCHING_ADDRESS: JSON.stringify({ ...address, point: undefined }) }).matching, undefined);
  assert.equal(readCriticalPathConfig({ CRITICAL_PATH_SIGN_IN_EMAIL: "a@b.c" }).signIn, undefined);
});
