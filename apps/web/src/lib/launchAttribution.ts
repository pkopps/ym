import { AnalyticsEvent, LaunchAttributionContext } from "@yardmatch/contracts";

const launchAttributionStorageKey = "yardmatch-launch-attribution";
const launchLeadStorageKey = "yardmatch-launch-lead-id";

function sanitizeToken(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || undefined;
}

function sanitizePath(path: string | null | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalized = path
    .trim()
    .replace(/[^A-Za-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return normalized || "/";
}

function sanitizeHost(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);

  return normalized || undefined;
}

function readStoredLaunchAttribution(): LaunchAttributionContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(launchAttributionStorageKey);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as LaunchAttributionContext;
  } catch {
    window.localStorage.removeItem(launchAttributionStorageKey);
    return undefined;
  }
}

function persistLaunchAttribution(context: LaunchAttributionContext): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(launchAttributionStorageKey, JSON.stringify(context));
}

function detectLaunchAttribution(): LaunchAttributionContext {
  const params = new URLSearchParams(window.location.search);
  const referrerHost = (() => {
    if (!document.referrer) {
      return undefined;
    }

    try {
      const referrer = new URL(document.referrer);
      if (referrer.host === window.location.host) {
        return undefined;
      }
      return sanitizeHost(referrer.hostname);
    } catch {
      return undefined;
    }
  })();
  const source = sanitizeToken(params.get("utm_source")) ?? referrerHost ?? "direct";
  const medium = sanitizeToken(params.get("utm_medium")) ?? (referrerHost ? "referral" : "none");

  return {
    source,
    medium,
    campaign: sanitizeToken(params.get("utm_campaign")),
    term: sanitizeToken(params.get("utm_term")),
    content: sanitizeToken(params.get("utm_content")),
    referrerHost,
    landingPath: sanitizePath(window.location.pathname),
    capturedAt: new Date().toISOString()
  };
}

export function getLaunchAttributionContext(): LaunchAttributionContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const current = detectLaunchAttribution();
  const stored = readStoredLaunchAttribution();
  if (!stored) {
    persistLaunchAttribution(current);
    return current;
  }

  if (
    stored.source === "direct" &&
    current.source &&
    current.source !== "direct" &&
    current.medium !== "none"
  ) {
    persistLaunchAttribution(current);
    return current;
  }

  return stored;
}

export function buildLaunchAttributionAnalyticsProperties(
  attribution = getLaunchAttributionContext()
): AnalyticsEvent["properties"] {
  if (!attribution) {
    return {};
  }

  const properties: AnalyticsEvent["properties"] = {};
  if (attribution.source) {
    properties.attributionSource = attribution.source;
  }
  if (attribution.medium) {
    properties.attributionMedium = attribution.medium;
  }
  if (attribution.campaign) {
    properties.attributionCampaign = attribution.campaign;
  }
  if (attribution.term) {
    properties.attributionTerm = attribution.term;
  }
  if (attribution.content) {
    properties.attributionContent = attribution.content;
  }
  if (attribution.referrerHost) {
    properties.attributionReferrerHost = attribution.referrerHost;
  }
  if (attribution.landingPath) {
    properties.attributionLandingPath = attribution.landingPath;
  }
  if (attribution.capturedAt) {
    properties.attributionCapturedAt = attribution.capturedAt;
  }

  return properties;
}

export function persistLaunchLeadId(leadId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = leadId.trim();
  if (!normalized) {
    return;
  }

  window.localStorage.setItem(launchLeadStorageKey, normalized);
}

export function getStoredLaunchLeadId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = window.localStorage.getItem(launchLeadStorageKey)?.trim();
  return value || undefined;
}
