import assert from "node:assert/strict";
import test from "node:test";
import { resolveSeedPassword } from "../prisma/seedConfig";

test("local seed retains the documented development password", () => {
  assert.equal(resolveSeedPassword({ YARDMATCH_ENV: "local" }), "YardMatch123!");
});

test("staging seed requires an unguessable environment-provided password", () => {
  assert.throws(
    () => resolveSeedPassword({ YARDMATCH_ENV: "staging" }),
    /YARDMATCH_STAGING_SEED_PASSWORD is required/
  );
  assert.throws(
    () => resolveSeedPassword({
      YARDMATCH_ENV: "staging",
      YARDMATCH_STAGING_SEED_PASSWORD: "YardMatch123!"
    }),
    /at least 16 characters/
  );
  assert.equal(
    resolveSeedPassword({
      YARDMATCH_ENV: "staging",
      YARDMATCH_STAGING_SEED_PASSWORD: "A7!rQ2#vN9@kL4$p"
    }),
    "A7!rQ2#vN9@kL4$p"
  );
});

test("production fixture seeding is always refused", () => {
  assert.throws(
    () => resolveSeedPassword({ YARDMATCH_ENV: "production" }),
    /disabled in production/
  );
});
