"use client";
import type { AnalyticsEvent } from "@yardmatch/contracts";
import { getWebApiBaseUrl, loadStoredSession } from "./api";

const consentKey = "yardmatch-analytics-permission";
const ownerKey = "yardmatch-analytics-owner";
const anonymousKey = "yardmatch-analytics-visitor";
const sessionKey = "yardmatch-analytics-session";
const queueKey = "yardmatch-analytics-queue";
export const analyticsPreferenceEvent = "yardmatch-analytics-preference";
let sending = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
type Queued = {event: AnalyticsEvent; attempts: number; userId?: string};

export function analyticsPermission(): string {
  try { return localStorage.getItem(consentKey) ?? "unset"; } catch { return "no"; }
}
export function analyticsAllowed() {
  return analyticsPermission() === "yes" && navigator.doNotTrack !== "1" &&
    !(navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl;
}
export function setAnalyticsPermission(allowed: boolean) {
  try {
    localStorage.setItem(consentKey, allowed ? "yes" : "no");
    if (!allowed) resetAnalyticsIdentity();
  } catch { /* Storage-disabled browsing still works. */ }
  window.dispatchEvent(new Event(analyticsPreferenceEvent));
}
export function resetAnalyticsIdentity() {
  generation++;
  if (timer) clearTimeout(timer);
  try { localStorage.removeItem(anonymousKey); localStorage.removeItem(ownerKey); sessionStorage.removeItem(sessionKey); sessionStorage.removeItem(queueKey); } catch { /* Optional storage. */ }
}
export function analyticsIdentity() {
  const userId = loadStoredSession()?.userId;
  const previousOwner = localStorage.getItem(ownerKey);
  if (previousOwner && previousOwner !== userId) resetAnalyticsIdentity();
  if (userId) localStorage.setItem(ownerKey, userId);
  const readId = (storage: Storage, key: string) => {
    let id = storage.getItem(key);
    if (!id) { id = crypto.randomUUID(); storage.setItem(key, id); }
    return id;
  };
  return {anonymousId: readId(localStorage, anonymousKey), sessionId: readId(sessionStorage, sessionKey)};
}
function queue(): Queued[] {
  try { return JSON.parse(sessionStorage.getItem(queueKey) ?? "[]") as Queued[]; } catch { return []; }
}
function save(items: Queued[]) { sessionStorage.setItem(queueKey, JSON.stringify(items.slice(-100))); }

export async function flushProductAnalytics() {
  if (sending || !analyticsAllowed()) return;
  sending = true;
  const currentGeneration = generation;
  try {
    while (analyticsAllowed() && currentGeneration === generation) {
      const item = queue()[0];
      if (!item) break;
      const session = loadStoredSession();
      if ((item.userId && item.userId !== session?.userId) || item.attempts >= 5 || Date.parse(item.event.occurredAt) < Date.now() - 86400_000) {
        save(queue().filter(entry => entry.event.id !== item.event.id)); continue;
      }
      const response = await fetch(`${getWebApiBaseUrl()}/api/analytics/events`, {
        method: "POST", headers: {"content-type": "application/json", ...(session && item.userId ? {Authorization: `Bearer ${session.token}`} : {})},
        body: JSON.stringify(item.event), signal: AbortSignal.timeout(5000), keepalive: true
      });
      if (generation !== currentGeneration) break;
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        save(queue().filter(entry => entry.event.id !== item.event.id));
      } else { throw new Error("Collection temporarily unavailable"); }
    }
  } catch {
    try {
      const items = queue();
      if (items[0] && generation === currentGeneration) {
        items[0].attempts++; save(items);
        timer = setTimeout(() => void flushProductAnalytics(), Math.min(60000, 1000 * 2 ** items[0].attempts));
      }
    } catch { /* Optional analytics must not break a workflow. */ }
  } finally { sending = false; }
}

export function captureProductEvent(name: string, properties: AnalyticsEvent["properties"] = {}) {
  try {
    if (!analyticsAllowed()) return;
    const session = loadStoredSession();
    if (session?.role === "ops") return;
    const event: AnalyticsEvent = {id: crypto.randomUUID(), name, occurredAt: new Date().toISOString(), properties: {
      ...properties, ...analyticsIdentity(), consent: true, platform: innerWidth < 900 ? "web-mobile" : "web-desktop",
      path: location.pathname, locale: document.documentElement.lang, version: "1"
    }};
    save([...queue(), {event, attempts: 0, userId: session?.userId}]);
    void flushProductAnalytics();
  } catch { /* No access to storage must never prevent using YardMatch. */ }
}
