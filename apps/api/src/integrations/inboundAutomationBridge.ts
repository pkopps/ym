import { ApiRoutes } from "@yardmatch/contracts";
import {
  DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS,
  ExternalRequestTimeoutError,
  withAbortableTimeout
} from "./outboundRequestTimeout";

type BridgeSecretKind = "lead" | "review";

export interface InboundAutomationBridgeRoute {
  path: string;
  targetPath: string;
  secretHeaderName: string;
  secretKind: BridgeSecretKind;
  label: string;
}

export interface InboundAutomationBridgeConfig {
  targetBaseUrl: string;
  bridgeSecret?: string;
  inboundLeadWebhookSecret?: string;
  inboundReviewResponseWebhookSecret?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export const inboundAutomationBridgeRoutes: InboundAutomationBridgeRoute[] = [
  {
    path: "/relay/launch/email",
    targetPath: ApiRoutes.inboundLaunchEmail,
    secretHeaderName: "x-yardmatch-inbound-secret",
    secretKind: "lead",
    label: "Direct inbox lead relay"
  },
  {
    path: "/relay/launch/google-business-profile",
    targetPath: ApiRoutes.inboundLaunchGoogleBusinessProfile,
    secretHeaderName: "x-yardmatch-inbound-secret",
    secretKind: "lead",
    label: "Google Business Profile lead relay"
  },
  {
    path: "/relay/launch/referral",
    targetPath: ApiRoutes.inboundLaunchReferral,
    secretHeaderName: "x-yardmatch-inbound-secret",
    secretKind: "lead",
    label: "Referral lead relay"
  },
  {
    path: "/relay/reviews/shared-inbox",
    targetPath: ApiRoutes.inboundSharedInboxReviewResponse,
    secretHeaderName: "x-yardmatch-review-response-secret",
    secretKind: "review",
    label: "Shared inbox review reply relay"
  },
  {
    path: "/relay/reviews/google-business-profile",
    targetPath: ApiRoutes.inboundGoogleBusinessProfileReviewResponse,
    secretHeaderName: "x-yardmatch-review-response-secret",
    secretKind: "review",
    label: "Google Business Profile review reply relay"
  }
];

export function readInboundAutomationBridgeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): InboundAutomationBridgeConfig {
  return {
    targetBaseUrl: (env.INBOUND_AUTOMATION_BRIDGE_TARGET_BASE_URL ?? env.API_BASE_URL ?? "http://127.0.0.1:4001")
      .trim()
      .replace(/\/+$/, ""),
    bridgeSecret: env.INBOUND_AUTOMATION_BRIDGE_SECRET?.trim() || undefined,
    inboundLeadWebhookSecret: env.INBOUND_LEAD_WEBHOOK_SECRET?.trim() || undefined,
    inboundReviewResponseWebhookSecret: env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET?.trim() || undefined,
    requestTimeoutMs: readPositiveNumber(
      env.INBOUND_AUTOMATION_BRIDGE_TIMEOUT_MS,
      DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS
    )
  };
}

export function createInboundAutomationBridgeHandler(config: InboundAutomationBridgeConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const targetBaseUrl = config.targetBaseUrl.replace(/\/+$/, "");
  const expectedBridgeSecret = config.bridgeSecret?.trim();
  const leadSecret = config.inboundLeadWebhookSecret?.trim();
  const reviewSecret = config.inboundReviewResponseWebhookSecret?.trim();

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse(405, {
        message: "Inbound automation bridge only accepts POST requests."
      });
    }

    const url = new URL(request.url);
    const route = inboundAutomationBridgeRoutes.find((item) => item.path === url.pathname);
    if (!route) {
      return jsonResponse(404, {
        message: "Bridge route not found."
      });
    }

    if (expectedBridgeSecret) {
      const providedSecret = request.headers.get("x-yardmatch-bridge-secret")?.trim();
      if (!providedSecret || providedSecret !== expectedBridgeSecret) {
        return jsonResponse(401, {
          message: "Invalid inbound automation bridge secret."
        });
      }
    }

    const upstreamSecret = route.secretKind === "lead" ? leadSecret : reviewSecret;
    if (!upstreamSecret) {
      return jsonResponse(503, {
        message: `${route.label} cannot run because the matching YardMatch webhook secret is not configured.`
      });
    }

    const body = await request.text();
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }
    headers.set(route.secretHeaderName, upstreamSecret);

    try {
      const { upstreamResponse, responseText } = await withAbortableTimeout(async (signal) => {
        const upstreamResponse = await fetchImpl(`${targetBaseUrl}${route.targetPath}`, {
          method: "POST",
          headers,
          body,
          signal
        });
        return {
          upstreamResponse,
          responseText: await upstreamResponse.text()
        };
      }, {
        timeoutMs: config.requestTimeoutMs,
        timeoutMessage: "The YardMatch API did not respond in time. Retry this relay request."
      });
      const responseHeaders = new Headers();
      const upstreamContentType = upstreamResponse.headers.get("content-type");
      if (upstreamContentType) {
        responseHeaders.set("content-type", upstreamContentType);
      }
      return new Response(responseText, {
        status: upstreamResponse.status,
        headers: responseHeaders
      });
    } catch (error) {
      return jsonResponse(error instanceof ExternalRequestTimeoutError ? 504 : 502, {
        message:
          error instanceof Error
            ? error instanceof ExternalRequestTimeoutError
              ? error.message
              : `Bridge could not reach the YardMatch API: ${error.message}`
            : "Bridge could not reach the YardMatch API."
      });
    }
  };
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
