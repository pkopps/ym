import { IncomingMessage, ServerResponse } from "node:http";

export interface RequestContext {
  method: string;
  path: string;
  body: unknown;
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

export function applyCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// The JSON parser is intentionally small so the API can run as a single-process monolith.
export async function parseRequest(request: IncomingMessage): Promise<RequestContext> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const bodyChunks: Buffer[] = [];

  for await (const chunk of request) {
    bodyChunks.push(Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(bodyChunks).toString("utf8");
  const parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;

  return {
    method: request.method ?? "GET",
    path: url.pathname,
    body: parsedBody,
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
  applyCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function sendText(response: ServerResponse, statusCode: number, payload: string): void {
  applyCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(payload);
}

export function sendHtml(response: ServerResponse, statusCode: number, payload: string): void {
  applyCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(payload);
}

export function sendRedirect(response: ServerResponse, location: string): void {
  applyCorsHeaders(response);
  response.writeHead(302, {
    Location: location
  });
  response.end();
}
