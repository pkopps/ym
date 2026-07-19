import { MarketplaceApiClient } from "@yardmatch/contracts";
import { getCustomerMobileLocale } from "./i18n";

export function getCustomerMobileApiBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
}

export function createCustomerMobileApiClient() {
  const api = new MarketplaceApiClient(getCustomerMobileApiBaseUrl());
  api.setLocale(getCustomerMobileLocale());
  return api;
}
