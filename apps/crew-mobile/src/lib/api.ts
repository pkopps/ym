import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { MarketplaceApiClient } from "@yardmatch/contracts";
import { getCrewMobileLocale } from "./i18n";

export function getCrewMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const configured = runtimeEnv?.EXPO_PUBLIC_API_BASE_URL?.trim();
  const deploymentEnvironment = runtimeEnv?.EXPO_PUBLIC_YARDMATCH_ENV ?? "local";
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (deploymentEnvironment !== "local") {
    throw new Error("Crew app is missing EXPO_PUBLIC_API_BASE_URL for a deployed build.");
  }
  return "http://localhost:4001";
}

export function createCrewMobileApiClient() {
  const api = new MarketplaceApiClient(getCrewMobileApiBaseUrl());
  api.setAnalyticsContext(() => MobileAnalyticsTracker.context("crew-member"));
  api.setMobileClient("crew", "0.1.0");
  api.setLocale(getCrewMobileLocale());
  return api;
}
