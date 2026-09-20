import { AsyncLocalStorage } from "node:async_hooks";
import type { AnalyticsEvent } from "@yardmatch/contracts";
export const analyticsRequestContext = new AsyncLocalStorage<AnalyticsEvent["properties"]>();
/** An optional correlation handle, never an authentication or business authorization claim. */
export function parseAnalyticsContext(raw?: string): AnalyticsEvent["properties"] {
  if (!raw || raw.length > 1000) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.consent !== true || !/^[a-zA-Z0-9_-]{8,100}$/.test(String(value.anonymousId)) ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(String(value.sessionId))) return {};
    return {anonymousId: String(value.anonymousId), sessionId: String(value.sessionId), consent: true};
  } catch { return {}; }
}
