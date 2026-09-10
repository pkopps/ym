import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { HttpError } from "../http";
import { withAbortableTimeout } from "./outboundRequestTimeout";

export const MAX_CALENDAR_BYTES = 1_000_000;

export function isPublicCalendarAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast" &&
      (parsed.kind() === "ipv4" || (parsed as ipaddr.IPv6).match(ipaddr.parse("2000::"), 3));
  } catch { return false; }
}

export async function resolveCalendarTarget(url: URL, resolve = lookup): Promise<{ address: string; family: number }> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443")) {
    throw new HttpError(400, "Use a public HTTP or HTTPS calendar feed on a standard port.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6 }]
    : await resolve(hostname, { all: true });
  if (!addresses.length || addresses.some((item) => !isPublicCalendarAddress(item.address))) {
    throw new HttpError(400, "Calendar feeds must resolve only to public internet addresses.");
  }
  return addresses[0];
}

async function readPinnedResponse(url: URL, signal: AbortSignal): Promise<{ status: number; location?: string; body: string }> {
  const target = await resolveCalendarTarget(url);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal,
      agent: false,
      family: target.family,
      headers: { Accept: "text/calendar", "Accept-Encoding": "identity" },
      // DNS is validated once, then pinned at connection time; hostname remains intact
      // for HTTP Host, TLS SNI, and certificate verification (no DNS rebinding window).
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family)
    }, (response) => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        response.destroy();
        resolve({ status, location: response.headers.location, body: "" });
        return;
      }
      if (Number(response.headers["content-length"] ?? 0) > MAX_CALENDAR_BYTES) {
        response.destroy();
        reject(new HttpError(400, "Calendar feed is too large."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_CALENDAR_BYTES) {
          response.destroy(new HttpError(400, "Calendar feed is too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function fetchCalendarFeed(feedUrl: string): Promise<string> {
  if (feedUrl.startsWith("data:text/calendar")) {
    if (process.env.NODE_ENV === "production" || ["staging", "production"].includes(process.env.YARDMATCH_ENV ?? "")) {
      throw new HttpError(400, "Inline calendar feeds are available only in local development.");
    }
    const match = /^data:text\/calendar(?:;charset=utf-8)?(;base64)?,(.*)$/is.exec(feedUrl);
    if (!match) throw new HttpError(400, "Invalid inline calendar feed.");
    const body = match[1] ? Buffer.from(match[2], "base64").toString("utf8") : decodeURIComponent(match[2]);
    if (Buffer.byteLength(body) > MAX_CALENDAR_BYTES) throw new HttpError(400, "Calendar feed is too large.");
    return body;
  }
  return withAbortableTimeout(async (signal) => {
    let url = new URL(feedUrl.replace(/^webcal:\/\//i, "https://"));
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await readPinnedResponse(url, signal);
      if (response.status >= 300 && response.status < 400 && response.location && redirects < 3) {
        url = new URL(response.location, url);
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw new HttpError(400, `Calendar feed returned ${response.status}`);
      return response.body;
    }
    throw new HttpError(400, "Calendar feed redirected too many times.");
  }, { timeoutMessage: "Calendar feed did not respond in time. Check the feed URL and try syncing again." });
}
