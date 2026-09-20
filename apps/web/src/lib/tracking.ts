"use client";
import type { AnalyticsEvent } from "@yardmatch/contracts";
import { buildLaunchAttributionAnalyticsProperties } from "./launchAttribution";
import { captureProductEvent } from "./productAnalytics";
export async function trackWebEvent(name: string, properties: AnalyticsEvent["properties"] = {}): Promise<void> {
  captureProductEvent(name, {...buildLaunchAttributionAnalyticsProperties(), ...properties});
}
