import * as SecureStore from "expo-secure-store";
import { resolveLocale, type SupportedLocale } from "@yardmatch/i18n";

const localeStorageKey = "yardmatch.provider.locale";

let currentLocale = resolveProviderDeviceLocale();

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

export function resolveProviderDeviceLocale(): SupportedLocale {
  return resolveLocale({
    navigatorLanguages: getDeviceLocaleCandidates()
  });
}

export function getProviderMobileLocale(): SupportedLocale {
  return currentLocale;
}

export function setProviderMobileLocale(locale: SupportedLocale): void {
  currentLocale = locale;
}

export async function loadStoredProviderLocale(): Promise<SupportedLocale> {
  const locale = resolveLocale({
    persistedLocale: await SecureStore.getItemAsync(localeStorageKey),
    navigatorLanguages: getDeviceLocaleCandidates()
  });
  setProviderMobileLocale(locale);
  return locale;
}

export async function saveProviderLocale(locale: SupportedLocale): Promise<void> {
  setProviderMobileLocale(locale);
  await SecureStore.setItemAsync(localeStorageKey, locale, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}
