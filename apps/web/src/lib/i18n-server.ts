import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import {
  addLocalePrefix,
  createI18n,
  loadFallbackMessages,
  loadLocaleMessages,
  localeToHtmlLang,
  MessageDictionary,
  resolveLocale,
  SupportedLocale,
  TranslationKey,
  TranslationValues
} from "@yardmatch/i18n";
import { buildSiteUrl } from "./site";

export const localeCookieName = "ym-locale";

export async function getRequestLocale(): Promise<SupportedLocale> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  return resolveLocale({
    explicitLocale: requestHeaders.get("x-yardmatch-locale"),
    persistedLocale: cookieStore.get(localeCookieName)?.value,
    acceptLanguage: requestHeaders.get("accept-language")
  });
}

export async function getRequestMessages(locale: SupportedLocale): Promise<{
  messages: MessageDictionary;
  fallbackMessages: MessageDictionary;
}> {
  const [messages, fallbackMessages] = await Promise.all([
    loadLocaleMessages(locale),
    locale === "en" ? loadLocaleMessages("en") : loadFallbackMessages()
  ]);

  return { messages, fallbackMessages };
}

export async function getRequestI18n() {
  const locale = await getRequestLocale();
  const { messages, fallbackMessages } = await getRequestMessages(locale);
  return createI18n({ locale, messages, fallbackMessages });
}

export async function getLocalizedPageMetadata({
  descriptionKey,
  path,
  titleKey,
  values = {}
}: {
  descriptionKey?: TranslationKey;
  path: string;
  titleKey: TranslationKey;
  values?: TranslationValues;
}): Promise<Metadata> {
  const i18n = await getRequestI18n();
  const localizedPath = addLocalePrefix(path, i18n.locale);
  const title = i18n.t(titleKey, values);
  const description = descriptionKey ? i18n.t(descriptionKey, values) : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: buildSiteUrl(localizedPath),
      languages: {
        en: buildSiteUrl(path),
        es: buildSiteUrl(addLocalePrefix(path, "es"))
      }
    },
    openGraph: {
      title,
      description,
      url: buildSiteUrl(localizedPath)
    }
  };
}

export { localeToHtmlLang };
