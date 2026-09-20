import assert from "node:assert/strict";
import {test} from "node:test";
import {compareVersions, enforceMobileRelease} from "../src/observability/mobileReleasePolicy";
import type {RequestContext} from "../src/http";
test("mobile version comparison is numeric and rejects malformed versions", () => {
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.throws(() => compareVersions("1.0", "1.0.0"));
});
test("old marked mobile clients are blocked while policy and web requests remain accessible", () => {
  const context = {path: "/api/bookings", headers: {"x-yardmatch-app": "customer", "x-yardmatch-app-version": "0.0.1"}} as unknown as RequestContext;
  assert.throws(() => enforceMobileRelease(context), /Update YardMatch/);
  assert.doesNotThrow(() => enforceMobileRelease({...context, path: "/api/mobile/release-policy"}));
  assert.doesNotThrow(() => enforceMobileRelease({...context, headers: {}}));
});
