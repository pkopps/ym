import * as SecureStore from "expo-secure-store";
import { resolveLocale, type SupportedLocale } from "@yardmatch/i18n";

const localeStorageKey = "yardmatch.customer.locale";

let currentLocale = resolveCustomerDeviceLocale();

function getDeviceLocaleCandidates(): string[] {
  const navigatorLike = globalThis as {
    navigator?: {
      language?: string;
      languages?: readonly string[];
    };
  };

  return [
    ...(navigatorLike.navigator?.languages ?? []),
    navigatorLike.navigator?.language,
    Intl.DateTimeFormat().resolvedOptions().locale
  ].filter((value): value is string => Boolean(value));
}

export function resolveCustomerDeviceLocale(): SupportedLocale {
  return resolveLocale({
    navigatorLanguages: getDeviceLocaleCandidates()
  });
}

export function getCustomerMobileLocale(): SupportedLocale {
  return currentLocale;
}

export function setCustomerMobileLocale(locale: SupportedLocale): void {
  currentLocale = locale;
}

export async function loadStoredCustomerLocale(): Promise<SupportedLocale> {
  const locale = resolveLocale({
    persistedLocale: await SecureStore.getItemAsync(localeStorageKey),
    navigatorLanguages: getDeviceLocaleCandidates()
  });
  setCustomerMobileLocale(locale);
  return locale;
}

export async function saveCustomerLocale(locale: SupportedLocale): Promise<void> {
  setCustomerMobileLocale(locale);
  await SecureStore.setItemAsync(localeStorageKey, locale, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}
