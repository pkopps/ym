"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@yardmatch/i18n/react";
import { analyticsPermission, analyticsPreferenceEvent, setAnalyticsPermission } from "../lib/productAnalytics";
function subscribe(callback: () => void) {
  window.addEventListener(analyticsPreferenceEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(analyticsPreferenceEvent, callback); window.removeEventListener("storage", callback); };
}
export function AnalyticsPreferences() {
  const i18n = useI18n();
  const permission = useSyncExternalStore(subscribe, analyticsPermission, () => "unset");
  return <details className="container analytics-preferences">
    <summary>{i18n.t("analytics.preferences")}</summary>
    <p>{i18n.t("analytics.explanation")}</p>
    <p role="status">{i18n.t(permission === "yes" ? "analytics.enabled" : "analytics.disabled")}</p>
    <div className="button-row">
      <button type="button" className="button button--primary" onClick={() => setAnalyticsPermission(true)}>{i18n.t("analytics.allow")}</button>
      <button type="button" className="button button--secondary" onClick={() => setAnalyticsPermission(false)}>{i18n.t("analytics.decline")}</button>
    </div>
  </details>;
}
