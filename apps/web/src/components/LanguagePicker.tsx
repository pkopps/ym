"use client";

import { addLocalePrefix, stripLocalePrefix, SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent } from "react";
import { localeCookieName } from "../lib/i18n-client";

const selectableLocales: SupportedLocale[] = ["en", "es"];

export function LanguagePicker() {
  const i18n = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as SupportedLocale;
    const stripped = stripLocalePrefix(pathname);
    const query = searchParams.toString();
    const nextPath = `${addLocalePrefix(stripped.path, nextLocale)}${query ? `?${query}` : ""}`;
    window.localStorage.setItem(localeCookieName, nextLocale);
    document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(nextPath);
    router.refresh();
  }

  return (
    <label className="language-picker">
      <span className="sr-only">{i18n.t("common.language.label")}</span>
      <select aria-label={i18n.t("common.language.label")} onChange={handleChange} value={i18n.locale}>
        {selectableLocales.map((locale) => (
          <option key={locale} value={locale}>
            {locale === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english")}
          </option>
        ))}
      </select>
    </label>
  );
}
