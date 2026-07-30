import assert from "node:assert/strict";
import test from "node:test";
import { StripeConnectService } from "../src/services/StripeConnectService";

test("Stripe Connect service stays disabled without server-side credentials", () => {
  assert.equal(new StripeConnectService(undefined).isConfigured(), false);
});
