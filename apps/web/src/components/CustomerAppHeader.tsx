"use client";

import { addLocalePrefix, stripLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { usePathname, useSearchParams } from "next/navigation";
import { clearStoredSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationMenu } from "./NotificationMenu";

const profileLinks = [
  { href: "/customer/dashboard", labelKey: "nav.user.account" },
  { href: "/customer/dashboard?view=history", labelKey: "nav.user.past_visits" },
  { href: "/customer/referrals", labelKey: "referrals.title" },
  { href: "/account/security", labelKey: "security.title" },
  { href: "/help", labelKey: "nav.help" }
] satisfies Array<{ href: string; labelKey: TranslationKey }>;

export function CustomerAppHeader() {
  const i18n = useI18n();
  const { session } = useStoredWebSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const currentFlow = searchParams.get("flow");
  const normalizedPathname = stripLocalePrefix(pathname).path;

  const currentSectionLabelKey: TranslationKey =
    normalizedPathname === "/help"
      ? "nav.help"
      : currentFlow === "request"
        ? "customer_history.request_service"
        : currentView === "history"
          ? "nav.user.past_visits"
          : "customer_app_header.account";

  function handleSignOut() {
    clearStoredSession();
    window.location.href = addLocalePrefix("/customer", i18n.locale);
  }

  function isActiveLink(href: (typeof profileLinks)[number]["href"]) {
    if (href === "/customer/referrals") return normalizedPathname === href;
    if (href === "/help") {
      return normalizedPathname === "/help";
    }

    if (href === "/customer/dashboard?view=history") {
      return normalizedPathname === "/customer/dashboard" && currentView === "history";
    }

    return normalizedPathname === "/customer/dashboard" && currentView !== "history";
  }

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand-lockup" href={addLocalePrefix("/customer/dashboard", i18n.locale)}>
          <span className="brand-lockup__mark-frame brand-lockup__mark-text">YM</span>
          <span className="brand-lockup__wordmark">
            <strong>{i18n.t("common.brand")}</strong>
            <small>{i18n.t(currentSectionLabelKey)}</small>
          </span>
        </a>

        <div className="app-header__actions">
          <NotificationMenu session={session} />

          <details className="profile-menu">
            <summary className="profile-menu__summary">
              {session?.fullName ?? i18n.t("customer_app_header.customer_fallback")}
            </summary>
            <div className="profile-menu__panel">
              {profileLinks.map((link) => (
                <a
                  aria-current={isActiveLink(link.href) ? "page" : undefined}
                  href={addLocalePrefix(link.href, i18n.locale)}
                  key={link.href}
                >
                  {i18n.t(link.labelKey)}
                </a>
              ))}
              <button className="profile-menu__button" onClick={handleSignOut} type="button">
                {i18n.t("nav.sign_out")}
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
