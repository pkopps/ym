import { MarketplaceApiClient } from "@yardmatch/contracts";

export function getProviderMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
}

export function createProviderMobileApiClient() {
  return new MarketplaceApiClient(getProviderMobileApiBaseUrl());
}
