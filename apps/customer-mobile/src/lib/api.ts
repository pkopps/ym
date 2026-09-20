import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { MarketplaceApiClient } from "@yardmatch/contracts";
import { getCustomerMobileLocale } from "./i18n";

export function getCustomerMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const configured = runtimeEnv?.EXPO_PUBLIC_API_BASE_URL?.trim();
  const deploymentEnvironment = runtimeEnv?.EXPO_PUBLIC_YARDMATCH_ENV ?? "local";
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (deploymentEnvironment !== "local") {
    throw new Error("Customer app is missing EXPO_PUBLIC_API_BASE_URL for a deployed build.");
  }
  return "http://localhost:4001";
}

export function createCustomerMobileApiClient() {
  const api = new MarketplaceApiClient(getCustomerMobileApiBaseUrl());
  api.setAnalyticsContext(() => MobileAnalyticsTracker.context("customer"));
  api.setMobileClient("customer", "0.1.0");
  api.setLocale(getCustomerMobileLocale());
  return api;
}
