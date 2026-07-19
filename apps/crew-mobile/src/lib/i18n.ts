import * as SecureStore from "expo-secure-store";
import { resolveLocale, type SupportedLocale } from "@yardmatch/i18n";

const localeStorageKey = "yardmatch.crew.locale";

let currentLocale = resolveCrewDeviceLocale();

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

export function resolveCrewDeviceLocale(): SupportedLocale {
  return resolveLocale({
    navigatorLanguages: getDeviceLocaleCandidates()
  });
}

export function getCrewMobileLocale(): SupportedLocale {
  return currentLocale;
}

export function setCrewMobileLocale(locale: SupportedLocale): void {
  currentLocale = locale;
}

export async function loadStoredCrewLocale(): Promise<SupportedLocale> {
  const locale = resolveLocale({
    persistedLocale: await SecureStore.getItemAsync(localeStorageKey),
    navigatorLanguages: getDeviceLocaleCandidates()
  });
  setCrewMobileLocale(locale);
  return locale;
}

export async function saveCrewLocale(locale: SupportedLocale): Promise<void> {
  setCrewMobileLocale(locale);
  await SecureStore.setItemAsync(localeStorageKey, locale, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}
