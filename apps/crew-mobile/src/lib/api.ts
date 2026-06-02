import { MarketplaceApiClient } from "@yardmatch/contracts";

export function getCrewMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
}

export function createCrewMobileApiClient() {
  return new MarketplaceApiClient(getCrewMobileApiBaseUrl());
}
