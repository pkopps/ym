import { resolveLocale, SupportedLocale } from "@yardmatch/i18n";

export const localeCookieName = "ym-locale";

export function readStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const cookieLocale = document.cookie
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${localeCookieName}=`))
    ?.split("=")[1];

  return resolveLocale({
    persistedLocale: window.localStorage.getItem(localeCookieName) ?? cookieLocale,
    navigatorLanguages: navigator.languages
  });
}
