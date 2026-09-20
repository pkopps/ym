"use client";
import { useEffect, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { MarketplaceApiClient } from "@yardmatch/contracts";
import { SessionHeartbeatFactory } from "@yardmatch/observability";
import { getWebApiBaseUrl, loadStoredSession, subscribeToStoredSession } from "../lib/api";
import { getLaunchAttributionContext } from "../lib/launchAttribution";
import { analyticsIdentity, analyticsAllowed, analyticsPreferenceEvent, captureProductEvent, flushProductAnalytics, resetAnalyticsIdentity } from "../lib/productAnalytics";

const reportVitals: Parameters<typeof useReportWebVitals>[0] = metric => captureProductEvent("web_vital", {metric: metric.name, value: metric.value});

export function ObservabilityProvider() {
  useReportWebVitals(reportVitals);
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    let previousUser = loadStoredSession()?.userId;
    const identify = () => {
      const user = loadStoredSession()?.userId;
      if (previousUser && previousUser !== user) resetAnalyticsIdentity();
      previousUser = user;
      if (user) captureProductEvent("journey_identified");
    };
    const unsubscribe = subscribeToStoredSession(identify);
    const action = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-action], a[href], button[type=submit]") : null;
      if (!target || target.closest("[data-analytics-private]")) return;
      const actionId = target.dataset.analyticsAction;
      const href = target instanceof HTMLAnchorElement ? new URL(target.href) : undefined;
      // Capture route destinations and authored IDs, never labels, form values, or external URL parameters.
      if (actionId) captureProductEvent("action_clicked", {action: actionId});
      else if (href?.origin === location.origin) captureProductEvent("action_clicked", {action: "navigate", destination: href.pathname});
    };
    const form = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement) || event.target.closest("[data-analytics-private]")) return;
      captureProductEvent("form_submitted", {form: event.target.dataset.analyticsForm ?? location.pathname});
    };
    const invalid = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.closest("[data-analytics-private]")) return;
      captureProductEvent("form_validation_failed", {field: input.type, reason: input.validity.valueMissing ? "required" : "invalid-format"});
    };
    const clientError = () => captureProductEvent("client_error", {reason: "uncaught-error"});
    const clientRejection = () => captureProductEvent("client_error", {reason: "unhandled-rejection"});
    const heartbeat = () => {
      if (document.visibilityState !== "visible" || !analyticsAllowed()) return;
      try {
        const api = new MarketplaceApiClient(getWebApiBaseUrl());
        api.setAuthToken(loadStoredSession()?.token);
        void api.trackSessionHeartbeat(SessionHeartbeatFactory.create({sessionId: analyticsIdentity().sessionId,
          platform: innerWidth < 900 ? "web-mobile" : "web-desktop", path: location.pathname})).catch(() => {});
      } catch { /* Optional analytics. */ }
    };
    const enabled = () => { identify(); captureProductEvent("page_viewed"); heartbeat(); };
    identify(); heartbeat();
    const interval = setInterval(heartbeat, 60000);
    document.addEventListener("invalid", invalid, true);
    window.addEventListener("error", clientError);
    window.addEventListener("unhandledrejection", clientRejection);
    document.addEventListener("click", action);
    document.addEventListener("submit", form);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", flushProductAnalytics);
    window.addEventListener(analyticsPreferenceEvent, enabled);
    return () => {
      unsubscribe(); clearInterval(interval);
      document.removeEventListener("invalid", invalid, true);
      window.removeEventListener("error", clientError);
      window.removeEventListener("unhandledrejection", clientRejection);
      document.removeEventListener("click", action); document.removeEventListener("submit", form);
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("online", flushProductAnalytics);
      window.removeEventListener(analyticsPreferenceEvent, enabled);
    };
  }, []);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const attribution = getLaunchAttributionContext();
    captureProductEvent("page_viewed", {source: attribution?.source ?? "direct", medium: attribution?.medium ?? "none", campaign: attribution?.campaign ?? "none"});
  }, [pathname]);
  return null;
}
