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
    YARDMATCH_ENV: "production",
    DATABASE_URL: "postgresql://yardmatch:secret@db.yardmatch.com/yardmatch",
    JWT_SECRET: "a-production-secret-that-is-longer-than-32-characters",
    APP_BASE_URL: "https://yardmatch.com",
    API_BASE_URL: "https://api.yardmatch.com",
    CORS_ALLOWED_ORIGINS: "https://yardmatch.com,https://www.yardmatch.com",
    STRIPE_SECRET_KEY: "rk_live_51YardMatchProductionShape",
    STRIPE_WEBHOOK_SECRET: "whsec_1234567890abcdef",
    RESEND_API_KEY: "re_1234567890abcdef",
    NOTIFICATION_EMAIL_FROM: "YardMatch <notifications@yardmatch.com>",
    TWILIO_ACCOUNT_SID: "AC1234567890abcdef1234567890abcdef",
    TWILIO_AUTH_TOKEN: "1234567890abcdef1234567890abcdef",
    TWILIO_FROM_NUMBER: "+15555550100",
    PHOTO_STORAGE_MODE: "vercel-blob-private",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_production_secret_123456",
    SENTRY_DSN: "https://publickey@o123.ingest.sentry.io/456",
    SENTRY_TRACES_SAMPLE_RATE: "0.1"
  };
}

function completeStagingEnvironment(): RuntimeEnvironment {
  return {
    ...completeProductionEnvironment(),
    YARDMATCH_ENV: "staging",
    DATABASE_URL: "postgresql://yardmatch:secret@staging-db.yardmatch.com/yardmatch",
    JWT_SECRET: "a-staging-secret-that-is-longer-than-32-characters",
    APP_BASE_URL: "https://yardmatch-staging.vercel.app",
    API_BASE_URL: "https://yardmatch-staging-api.onrender.com",
    CORS_ALLOWED_ORIGINS: "https://yardmatch-staging.vercel.app,https://*.vercel.app",
    STRIPE_SECRET_KEY: "rk_test_51YardMatchStagingShape",
    STAGING_NOTIFICATION_ALLOWED_EMAILS: "qa@yardmatch.com",
    STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS: "+15555550199"
  };
}

test("local runtime intentionally permits the in-memory development repository", () => {
  assert.deepEqual(validateRuntimeConfiguration({ NODE_ENV: "development" }), {
    production: false,
    staging: false,
    deployed: false,
    deploymentEnvironment: "local",
    repositoryMode: "in-memory",
    maxRequestBodyBytes: 2_500_000,
    features: { payments: true, crewMarketplace: true }
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
      assert.match(error.message, /SENTRY_DSN is required/);
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
  environment.SENTRY_DSN = "http://placeholder";
  environment.SENTRY_TRACES_SAMPLE_RATE = "2";

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
      assert.match(error.message, /valid HTTPS project DSN/);
      assert.match(error.message, /number between 0 and 1/);
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
    "TWILIO_FROM_NUMBER",
    "CORS_ALLOWED_ORIGINS",
    "PHOTO_STORAGE_MODE",
    "BLOB_READ_WRITE_TOKEN",
    "SENTRY_DSN"
  ]) {
    delete unsafeEnvironment[key];
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", apiEntryPath], {
    encoding: "utf8",
    env: unsafeEnvironment,
    timeout: 10_000
  });

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsafe production configuration/);
  assert.doesNotMatch(result.stdout, /YardMatch API listening/);
});

test("complete production configuration selects Postgres", () => {
  assert.deepEqual(validateRuntimeConfiguration(completeProductionEnvironment()), {
    production: true,
    staging: false,
    deployed: true,
    deploymentEnvironment: "production",
    repositoryMode: "prisma-postgres",
    maxRequestBodyBytes: 2_500_000,
    features: { payments: false, crewMarketplace: false }
  });
});

test("staging requires test-mode Stripe, notification allowlists, and private photo storage", () => {
  const invalid = completeStagingEnvironment();
  invalid.STRIPE_SECRET_KEY = "sk_live_51WrongForStaging";
  invalid.STAGING_NOTIFICATION_ALLOWED_EMAILS = "";
  invalid.PHOTO_STORAGE_MODE = "inline";

  assert.throws(
    () => validateRuntimeConfiguration(invalid),
    (error: Error) => {
      assert.match(error.message, /Stripe test mode/);
      assert.match(error.message, /STAGING_NOTIFICATION_ALLOWED_EMAILS is required/);
      assert.match(error.message, /PHOTO_STORAGE_MODE must be vercel-blob-private/);
      return true;
    }
  );
});

test("complete staging configuration selects Postgres and deployment safeguards", () => {
  assert.deepEqual(validateRuntimeConfiguration(completeStagingEnvironment()), {
    production: false,
    staging: true,
    deployed: true,
    deploymentEnvironment: "staging",
    repositoryMode: "prisma-postgres",
    maxRequestBodyBytes: 2_500_000,
    features: { payments: false, crewMarketplace: false }
  });
});

test("deployed launch features default off and can be enabled explicitly", () => {
  const enabled = completeProductionEnvironment();
  enabled.YARDMATCH_PAYMENTS_ENABLED = "true";
  enabled.YARDMATCH_CREW_MARKETPLACE_ENABLED = "1";
  assert.deepEqual(validateRuntimeConfiguration(enabled).features, {
    payments: true,
    crewMarketplace: true
  });

  assert.deepEqual(
    validateRuntimeConfiguration({ NODE_ENV: "development", YARDMATCH_PAYMENTS_ENABLED: "false" }).features,
    { payments: false, crewMarketplace: true }
  );
});

test("malformed launch feature flags fail closed", () => {
  assert.throws(
    () => validateRuntimeConfiguration({ ...completeProductionEnvironment(), YARDMATCH_PAYMENTS_ENABLED: "maybe" }),
    /YARDMATCH_PAYMENTS_ENABLED must be true or false/
  );
  assert.throws(
    () => validateRuntimeConfiguration({ NODE_ENV: "development", YARDMATCH_CREW_MARKETPLACE_ENABLED: "enabled" }),
    /YARDMATCH_CREW_MARKETPLACE_ENABLED must be true or false/
  );
});
