import { IncomingMessage, ServerResponse } from "node:http";

const DEFAULT_MAX_REQUEST_BODY_BYTES = 2_500_000;

export interface RequestContext {
  method: string;
  clientAddress?: string;
  path: string;
  body: unknown;
  rawBody?: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
}

export interface ApiController {
  canHandle(context: RequestContext): boolean;
  handle(context: RequestContext, response: ServerResponse): Promise<void>;
}

export class HttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function configuredCorsOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!configured) {
    return process.env.NODE_ENV === "production" ? [] : ["*"];
  }

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(origin: string, allowedOrigins = configuredCorsOrigins()): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === "*") {
      return true;
    }

    if (allowedOrigin === origin) {
      return true;
    }

    if (!allowedOrigin.includes("*.")) {
      return false;
    }

    try {
      const requested = new URL(origin);
      const allowed = new URL(allowedOrigin.replace("*.", "wildcard."));
      const suffix = allowed.hostname.slice("wildcard".length);
      return (
        requested.protocol === allowed.protocol &&
        requested.port === allowed.port &&
        requested.hostname.endsWith(suffix) &&
        requested.hostname.length > suffix.length
      );
    } catch {
      return false;
    }
  });
}

function appendVaryOrigin(response: ServerResponse): void {
  const existing = response.getHeader("Vary");
  const values = String(existing ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.some((value) => value.toLowerCase() === "origin")) {
    values.push("Origin");
  }
  response.setHeader("Vary", values.join(", "));
}

export function applyCorsHeaders(
  requestOrResponse: IncomingMessage | ServerResponse,
  maybeResponse?: ServerResponse
): void {
  const request = maybeResponse ? (requestOrResponse as IncomingMessage) : undefined;
  const response = maybeResponse ?? (requestOrResponse as ServerResponse);
  const origin = request?.headers.origin;
  const allowedOrigins = configuredCorsOrigins();

  if (origin && isCorsOriginAllowed(origin, allowedOrigins)) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes("*") ? "*" : origin);
    appendVaryOrigin(response);
  } else if (!origin && allowedOrigins.includes("*")) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-YardMatch-Locale");
  response.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  response.setHeader("Access-Control-Max-Age", "600");
}

function parseFormEncodedBody(rawBody: string): Record<string, string | string[]> {
  const parsed = new URLSearchParams(rawBody);
  const body: Record<string, string | string[]> = {};

  for (const [key, value] of parsed.entries()) {
    const existing = body[key];
    if (existing === undefined) {
      body[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      continue;
    }

    body[key] = [existing, value];
  }

  return body;
}

// The JSON parser is intentionally small so the API can run as a single-process monolith.
function configuredMaxRequestBodyBytes(): number {
  const configured = Number(process.env.API_MAX_REQUEST_BODY_BYTES ?? DEFAULT_MAX_REQUEST_BODY_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_REQUEST_BODY_BYTES;
}

export async function parseRequest(
  request: IncomingMessage,
  maxRequestBodyBytes = configuredMaxRequestBodyBytes()
): Promise<RequestContext> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const bodyChunks: Buffer[] = [];
  let receivedBytes = 0;
  const contentLength = Number(request.headers["content-length"] ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > maxRequestBodyBytes) {
      throw new HttpError(413, "Request body is too large.");
    }
    bodyChunks.push(buffer);
  }

  const rawBody = Buffer.concat(bodyChunks).toString("utf8");
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  let parsedBody: unknown;

  if (rawBody.length > 0) {
    if (contentType === "application/x-www-form-urlencoded") {
      parsedBody = parseFormEncodedBody(rawBody);
    } else if (contentType === undefined || contentType === "application/json" || contentType.endsWith("+json")) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        throw new HttpError(400, "Malformed JSON request body.");
      }
    } else {
      parsedBody = rawBody;
    }
  }

  return {
    method: request.method ?? "GET",
    clientAddress: request.socket?.remoteAddress,
    path: url.pathname,
    body: parsedBody,
    rawBody,
    query: url.searchParams,
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value
      ])
    )
  };
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  if (typeof response.hasHeader !== "function" || !response.hasHeader("Access-Control-Allow-Methods")) {
    applyCorsHeaders(response);
  }
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function sendText(response: ServerResponse, statusCode: number, payload: string): void {
  if (typeof response.hasHeader !== "function" || !response.hasHeader("Access-Control-Allow-Methods")) {
    applyCorsHeaders(response);
  }
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(payload);
}

export function sendHtml(response: ServerResponse, statusCode: number, payload: string): void {
  if (typeof response.hasHeader !== "function" || !response.hasHeader("Access-Control-Allow-Methods")) {
    applyCorsHeaders(response);
  }
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(payload);
}

export function sendRedirect(response: ServerResponse, location: string): void {
  if (typeof response.hasHeader !== "function" || !response.hasHeader("Access-Control-Allow-Methods")) {
    applyCorsHeaders(response);
  }
  response.writeHead(302, {
    Location: location
  });
  response.end();
}
