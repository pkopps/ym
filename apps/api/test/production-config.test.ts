import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveJwtSecret,
  validateRuntimeConfiguration,
  type RuntimeEnvironment
} from "../src/config/productionConfig";

function completeProductionEnvironment(): RuntimeEnvironment {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://yardmatch:test@database.example/yardmatch",
    JWT_SECRET: "a-production-secret-that-is-longer-than-32-characters",
    APP_BASE_URL: "https://yardmatch.example",
    API_BASE_URL: "https://api.yardmatch.example",
    STRIPE_SECRET_KEY: "rk_live_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    RESEND_API_KEY: "re_placeholder",
    NOTIFICATION_EMAIL_FROM: "YardMatch <notifications@yardmatch.example>",
    TWILIO_ACCOUNT_SID: "AC_placeholder",
    TWILIO_AUTH_TOKEN: "twilio-placeholder",
    TWILIO_FROM_NUMBER: "+15555550100"
  };
}

test("local runtime intentionally permits the in-memory development repository", () => {
  assert.deepEqual(validateRuntimeConfiguration({ NODE_ENV: "development" }), {
    production: false,
    repositoryMode: "in-memory"
  });
  assert.equal(resolveJwtSecret({ NODE_ENV: "development" }), "yardmatch-dev-secret");
});

test("production runtime fails closed when durable storage and vendor configuration are missing", () => {
  assert.throws(
    () => validateRuntimeConfiguration({ NODE_ENV: "production" }),
    (error: Error) => {
      assert.match(error.message, /DATABASE_URL is required/);
      assert.match(error.message, /JWT_SECRET is required/);
      assert.match(error.message, /STRIPE_WEBHOOK_SECRET is required/);
      assert.match(error.message, /RESEND_API_KEY is required/);
      assert.match(error.message, /TWILIO_ACCOUNT_SID is required/);
      return true;
    }
  );
});

test("production runtime rejects development secrets, test Stripe keys, and insecure URLs", () => {
  const environment = completeProductionEnvironment();
  environment.JWT_SECRET = "yardmatch-dev-secret";
  environment.STRIPE_SECRET_KEY = "sk_test_placeholder";
  environment.APP_BASE_URL = "http://yardmatch.example";

  assert.throws(
    () => validateRuntimeConfiguration(environment),
    (error: Error) => {
      assert.match(error.message, /development secret/);
      assert.match(error.message, /live restricted or secret key/);
      assert.match(error.message, /APP_BASE_URL must use https/);
      return true;
    }
  );
});

test("complete production configuration selects Postgres", () => {
  assert.deepEqual(validateRuntimeConfiguration(completeProductionEnvironment()), {
    production: true,
    repositoryMode: "prisma-postgres"
  });
});
