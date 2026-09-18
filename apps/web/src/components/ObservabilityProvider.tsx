"use client";

import { useEffect } from "react";
import { MarketplaceApiClient } from "@yardmatch/contracts";
import { SessionHeartbeatFactory } from "@yardmatch/observability";
import { getWebApiBaseUrl } from "../lib/api";
import { getLaunchAttributionContext } from "../lib/launchAttribution";

function getOrCreateSessionId(): string {
  const storageKey = "yardmatch-session-id";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const sessionId = globalThis.crypto?.randomUUID?.() ?? `ym-${Date.now()}`;
  window.sessionStorage.setItem(storageKey, sessionId);
  return sessionId;
}

function getPlatformSurface(): "web-mobile" | "web-desktop" {
  return window.innerWidth < 900 ? "web-mobile" : "web-desktop";
}

export function ObservabilityProvider() {
  useEffect(() => {
    // Persist the landing source before internal navigation replaces the referrer.
    getLaunchAttributionContext();
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    const sessionId = getOrCreateSessionId();

    const sendHeartbeat = () => {
      void api.trackSessionHeartbeat(
        SessionHeartbeatFactory.create({
          sessionId,
          platform: getPlatformSurface(),
          path: window.location.pathname
        })
      ).catch(() => {
        // Web browsing should keep working even if the local API is restarting during development.
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    // A light heartbeat cadence is enough for "active users in the last 5 minutes" dashboards.
    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 60_000);
    window.addEventListener("focus", sendHeartbeat);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", sendHeartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
