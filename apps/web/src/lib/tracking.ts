"use client";

import { AnalyticsEvent } from "@yardmatch/contracts";
import { createWebApiClient, loadStoredSession } from "./api";

function getPlatformSurface(): "web-mobile" | "web-desktop" {
  return window.innerWidth < 900 ? "web-mobile" : "web-desktop";
}

export async function trackWebEvent(
  name: string,
  properties: AnalyticsEvent["properties"] = {}
): Promise<void> {
  try {
    const api = createWebApiClient();
    const session = loadStoredSession();
    api.setAuthToken(session?.token);
    await api.trackEvent({
      id: globalThis.crypto?.randomUUID?.() ?? `${name}-${Date.now()}`,
      name,
      occurredAt: new Date().toISOString(),
      actorId: session?.userId,
      properties: {
        role: session?.role ?? "anonymous",
        platform: getPlatformSurface(),
        path: window.location.pathname,
        ...properties
      }
    });
  } catch {
    // Customer browsing should not fail if local analytics delivery is unavailable.
  }
}
