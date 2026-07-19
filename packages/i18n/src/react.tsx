"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import {
  createI18n,
  I18nInstance,
  MessageDictionary,
  SupportedLocale,
  TranslationKey,
  TranslationValues
} from "./index";

const I18nContext = createContext<I18nInstance | undefined>(undefined);

export function I18nProvider({
  children,
  fallbackMessages,
  locale,
  messages
}: {
  children: ReactNode;
  fallbackMessages?: MessageDictionary;
  locale: SupportedLocale;
  messages: MessageDictionary;
}) {
  const i18n = useMemo(
    () =>
      createI18n({
        locale,
        messages,
        fallbackMessages,
        onMissingKey: (key, missingLocale) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[i18n] Missing ${String(key)} for ${missingLocale}`);
          }
        }
      }),
    [fallbackMessages, locale, messages]
  );

  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nInstance {
  const i18n = useContext(I18nContext);
  if (!i18n) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return i18n;
}

export function useT(): (key: TranslationKey, values?: TranslationValues) => string {
  return useI18n().t;
}
