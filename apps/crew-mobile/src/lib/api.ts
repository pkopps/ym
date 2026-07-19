import { MarketplaceApiClient } from "@yardmatch/contracts";
import { getCrewMobileLocale } from "./i18n";

export function getCrewMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
}

export function createCrewMobileApiClient() {
  const api = new MarketplaceApiClient(getCrewMobileApiBaseUrl());
  api.setLocale(getCrewMobileLocale());
  return api;
}
