import assert from "node:assert/strict";
import test from "node:test";
import {
  MarketplaceApiClient,
  MarketplaceApiError,
  MarketplaceApiTimeoutError
} from "@yardmatch/contracts";
import { HttpError } from "../src/http";
import {
  ExternalRequestTimeoutError,
  withAbortableTimeout
} from "../src/integrations/outboundRequestTimeout";
import { createInboundAutomationBridgeHandler } from "../src/integrations/inboundAutomationBridge";
import { runStripeRequest } from "../src/integrations/stripeRequest";
import { AddressValidationService } from "../src/services/AddressValidationService";
import { NotificationDeliveryService } from "../src/services/NotificationDeliveryService";
import { PlaceSearchService } from "../src/services/PlaceSearchService";
import { SocialAuthService } from "../src/services/SocialAuthService";

function createHangingFetch(onAbort?: () => void): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        onAbort?.();
        reject(new DOMException("The request was aborted.", "AbortError"));
      }, { once: true });
    })) as typeof fetch;
}

test("shared API errors preserve the server request id for incident correlation", async () => {
  const client = new MarketplaceApiClient("http://yardmatch.test", {
    fetchImpl: (async () => new Response(JSON.stringify({ message: "Unable to finish the request." }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "x-request-id": "request-correlation-123"
      }
    })) as typeof fetch
  });

  await assert.rejects(
    client.searchPlaces("Barnegat"),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceApiError);
      assert.equal(error.statusCode, 500);
      assert.equal(error.requestId, "request-correlation-123");
      assert.match(error.message, /Reference: request-correlation-123/);
      return true;
    }
  );
});

test("shared API client aborts stalled GET and POST requests with actionable localized errors", async () => {
  let abortCount = 0;
  const client = new MarketplaceApiClient("http://yardmatch.test", {
    requestTimeoutMs: 5,
    fetchImpl: createHangingFetch(() => {
      abortCount += 1;
    })
  });

  await assert.rejects(
    client.searchPlaces("Barnegat"),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceApiTimeoutError);
      assert.equal(error.code, "REQUEST_TIMEOUT");
      assert.match(error.message, /taking longer than expected/i);
      assert.match(error.path, /places\/search/);
      return true;
    }
  );

  client.setLocale("es");
  await assert.rejects(
    client.reverseGeocodePlace({ latitude: 39.7532, longitude: -74.2229 }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceApiTimeoutError);
      assert.match(error.message, /tardando mas de lo esperado/i);
      return true;
    }
  );
  assert.equal(abortCount, 2);
});

test("abortable outbound timeout rejects even when an operation never settles", async () => {
  let aborted = false;
  await assert.rejects(
    withAbortableTimeout(
      async (signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise<never>(() => undefined);
      },
      { timeoutMs: 5, timeoutMessage: "Connected service timed out. Try again." }
    ),
    (error: unknown) => {
      assert.ok(error instanceof ExternalRequestTimeoutError);
      assert.equal(error.timeoutMs, 5);
      assert.match(error.message, /try again/i);
      return true;
    }
  );
  assert.equal(aborted, true);
});

test("notification, OAuth, place, and address integrations stop waiting on stalled vendors", async () => {
  const previousFetch = globalThis.fetch;
  const previousGoogleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const previousGoogleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  globalThis.fetch = createHangingFetch();
  process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";

  try {
    const notificationDelivery = new NotificationDeliveryService(5);
    await assert.rejects(
      notificationDelivery.dispatch({
        channel: "push",
        destination: "ExponentPushToken[test]",
        title: "Route update",
        body: "Your provider is on the way."
      }),
      /try the delivery again/i
    );

    const socialAuth = new SocialAuthService("http://yardmatch.test", 5);
    await assert.rejects(socialAuth.exchangeCode("google", "oauth-code"), /Google sign-in took too long/i);

    const placeSearch = new PlaceSearchService("google-key", 5);
    const placeResult = await placeSearch.search("Barnegat");
    assert.equal(placeResult.searchMode, "local-dataset");
    assert.match(placeResult.searchMessage ?? "", /unavailable/i);

    const addressValidation = new AddressValidationService("google-key", 5);
    const addressResult = await addressValidation.validateAddress({
      line1: "1 Main Street",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US",
      point: { latitude: 39.7532, longitude: -74.2229 }
    });
    assert.equal(addressResult.source, "local-rules");
    assert.equal(addressResult.confidence, "local-only");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGoogleClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    else process.env.GOOGLE_OAUTH_CLIENT_ID = previousGoogleClientId;
    if (previousGoogleClientSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    else process.env.GOOGLE_OAUTH_CLIENT_SECRET = previousGoogleClientSecret;
  }
});

test("inbound automation relay returns a 504 timeout message", async () => {
  const handler = createInboundAutomationBridgeHandler({
    targetBaseUrl: "http://yardmatch.test",
    inboundLeadWebhookSecret: "lead-secret",
    requestTimeoutMs: 5,
    fetchImpl: createHangingFetch()
  });
  const response = await handler(new Request("http://bridge.test/relay/launch/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@example.com" })
  }));

  assert.equal(response.status, 504);
  const payload = (await response.json()) as { message?: string };
  assert.match(payload.message ?? "", /did not respond in time/i);
  assert.match(payload.message ?? "", /retry/i);
});

test("Stripe connection timeouts become actionable 504 errors", async () => {
  await assert.rejects(
    runStripeRequest(
      async () => {
        throw {
          type: "StripeConnectionError",
          message: "Request aborted due to timeout being reached (10000ms)",
          detail: { code: "ETIMEDOUT" }
        };
      },
      "Stripe checkout did not respond in time. Refresh the booking before trying again."
    ),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 504);
      assert.match(error.message, /refresh the booking/i);
      return true;
    }
  );
});
