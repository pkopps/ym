import assert from "node:assert/strict";
import test from "node:test";
import { buildReturnUrl } from "../src/services/StripeCheckoutService";

test("Stripe success return URL leaves the checkout session macro unescaped", () => {
  const returnUrl = buildReturnUrl(
    "http://localhost:3000",
    "/customer/dashboard?payment=stripe-success",
    true
  );

  assert.equal(
    returnUrl,
    "http://localhost:3000/customer/dashboard?payment=stripe-success&session_id={CHECKOUT_SESSION_ID}"
  );
  assert.ok(!returnUrl.includes("%7BCHECKOUT_SESSION_ID%7D"));
});

test("Stripe cancel return URL does not include a session id", () => {
  const returnUrl = buildReturnUrl(
    "http://localhost:3000",
    "/customer/dashboard?payment=stripe-cancelled",
    false
  );

  assert.equal(returnUrl, "http://localhost:3000/customer/dashboard?payment=stripe-cancelled");
});
