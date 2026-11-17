"use client";

import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";

/** Shared full-page message for a crashed route or a missing page. Copy stays user-facing only. */
export function PageErrorState({
  titleKey,
  bodyKey,
  reference,
  onRetry
}: {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  reference?: string;
  onRetry?: () => void;
}) {
  const i18n = useI18n();
  return (
    <main className="page-error-state">
      <section className="card page-error-state__card" role={onRetry ? "alert" : undefined}>
        <h1>{i18n.t(titleKey)}</h1>
        <p>{i18n.t(bodyKey)}</p>
        <div className="cta-row">
          {onRetry ? (
            <button className="button" type="button" onClick={onRetry}>{i18n.t("app_error.retry")}</button>
          ) : null}
          <a className={onRetry ? "button-secondary" : "button"} href={addLocalePrefix("/", i18n.locale)}>
            {i18n.t(onRetry ? "app_error.home" : "not_found.home")}
          </a>
          <a className="button-secondary" href={addLocalePrefix(onRetry ? "/help#contact-us" : "/help", i18n.locale)}>
            {i18n.t(onRetry ? "app_error.help" : "not_found.help")}
          </a>
        </div>
        {reference ? <p className="page-error-state__reference">{i18n.t("app_error.reference", { reference })}</p> : null}
      </section>
    </main>
  );
}
