import assert from "node:assert/strict";
import test from "node:test";
import { NotificationDeliveryService } from "../src/services/NotificationDeliveryService";

test("staging suppresses external notification destinations outside the allowlists", async () => {
  const previous = {
    environment: process.env.YARDMATCH_ENV,
    emails: process.env.STAGING_NOTIFICATION_ALLOWED_EMAILS,
    numbers: process.env.STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS
  };
  process.env.YARDMATCH_ENV = "staging";
  process.env.STAGING_NOTIFICATION_ALLOWED_EMAILS = "qa@yardmatch.com";
  process.env.STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS = "+15555550199";

  try {
    const delivery = new NotificationDeliveryService();
    const suppressed = await delivery.dispatch({
      channel: "email",
      destination: "customer@example.com",
      title: "Test",
      body: "Staging message"
    });
    assert.equal(suppressed.provider, "staging-suppressed-email");
    assert.equal(delivery.supportsRetry("email", "customer@example.com"), false);

    const allowed = await delivery.dispatch({
      channel: "email",
      destination: "QA@yardmatch.com",
      title: "Test",
      body: "Allowed staging message"
    });
    assert.equal(allowed.provider, "mock-email");
  } finally {
    if (previous.environment === undefined) delete process.env.YARDMATCH_ENV;
    else process.env.YARDMATCH_ENV = previous.environment;
    if (previous.emails === undefined) delete process.env.STAGING_NOTIFICATION_ALLOWED_EMAILS;
    else process.env.STAGING_NOTIFICATION_ALLOWED_EMAILS = previous.emails;
    if (previous.numbers === undefined) delete process.env.STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS;
    else process.env.STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS = previous.numbers;
  }
});
