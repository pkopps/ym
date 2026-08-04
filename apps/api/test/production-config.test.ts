import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  resolveJwtSecret,
  validateRuntimeConfiguration,
  type RuntimeEnvironment
} from "../src/config/productionConfig";

function completeProductionEnvironment(): RuntimeEnvironment {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://yardmatch:secret@db.yardmatch.com/yardmatch",
    JWT_SECRET: "a-production-secret-that-is-longer-than-32-characters",
    APP_BASE_URL: "https://yardmatch.com",
    API_BASE_URL: "https://api.yardmatch.com",
    STRIPE_SECRET_KEY: "rk_live_51YardMatchProductionShape",
    STRIPE_WEBHOOK_SECRET: "whsec_1234567890abcdef",
    RESEND_API_KEY: "re_1234567890abcdef",
    NOTIFICATION_EMAIL_FROM: "YardMatch <notifications@yardmatch.com>",
    TWILIO_ACCOUNT_SID: "AC1234567890abcdef1234567890abcdef",
    TWILIO_AUTH_TOKEN: "1234567890abcdef1234567890abcdef",
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

test("production runtime rejects non-Postgres storage and malformed vendor credentials", () => {
  const environment = completeProductionEnvironment();
  environment.DATABASE_URL = "file:./production.db";
  environment.STRIPE_WEBHOOK_SECRET = "webhook-secret";
  environment.RESEND_API_KEY = "resend-key";
  environment.NOTIFICATION_EMAIL_FROM = "YardMatch <notifications@example.com>";
  environment.TWILIO_ACCOUNT_SID = "AC_placeholder";
  environment.TWILIO_AUTH_TOKEN = "twilio-placeholder";
  environment.TWILIO_FROM_NUMBER = "555-555-0100";

  assert.throws(
    () => validateRuntimeConfiguration(environment),
    (error: Error) => {
      assert.match(error.message, /DATABASE_URL must use PostgreSQL/);
      assert.match(error.message, /Stripe webhook signing secret/);
      assert.match(error.message, /production-shaped Resend API key/);
      assert.match(error.message, /valid production sender domain/);
      assert.match(error.message, /valid Twilio account SID/);
      assert.match(error.message, /production-shaped Twilio auth token/);
      assert.match(error.message, /approved E\.164 sender number/);
      return true;
    }
  );
});

test("API process refuses to listen with unsafe production configuration", () => {
  const apiEntryPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
  const unsafeEnvironment = { ...process.env, NODE_ENV: "production" };
  for (const key of [
    "DATABASE_URL",
    "JWT_SECRET",
    "APP_BASE_URL",
    "API_BASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "NOTIFICATION_EMAIL_FROM",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER"
  ]) {
    delete unsafeEnvironment[key];
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", apiEntryPath], {
    encoding: "utf8",
    env: unsafeEnvironment,
    timeout: 10_000
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsafe production configuration/);
  assert.doesNotMatch(result.stdout, /YardMatch API listening/);
});

test("complete production configuration selects Postgres", () => {
  assert.deepEqual(validateRuntimeConfiguration(completeProductionEnvironment()), {
    production: true,
    repositoryMode: "prisma-postgres"
  });
});
