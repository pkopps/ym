"use client";

import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { clearStoredSession, StoredWebSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { LanguagePicker } from "./LanguagePicker";
import { NotificationMenu } from "./NotificationMenu";

const links = [
  { href: "/customer", labelKey: "nav.book_service" },
  { href: "/provider", labelKey: "nav.for_providers" },
  { href: "/crew", labelKey: "nav.for_crews" },
  { href: "/help", labelKey: "nav.help_center" }
] as const;

const loginLinks = [
  { href: "/login/customer", labelKey: "nav.customer_login" },
  { href: "/login/provider", labelKey: "nav.business_owner_login" },
  { href: "/login/crew", labelKey: "nav.crew_member_login" }
] as const;

const accountLinks: Record<StoredWebSession["role"], Array<{ href: string; labelKey: TranslationKey }>> = {
  customer: [
    { href: "/customer", labelKey: "nav.user.search_services" },
    { href: "/customer/dashboard", labelKey: "nav.user.account" },
    { href: "/customer/dashboard?view=history", labelKey: "nav.user.past_visits" }
  ],
  provider: [
    { href: "/provider/management", labelKey: "nav.user.management" },
    { href: "/provider/payments", labelKey: "nav.user.payments" }
  ],
  ops: [{ href: "/ops", labelKey: "nav.user.operations_dashboard" }],
  "crew-member": [
    { href: "/crew", labelKey: "nav.user.open_work" },
    { href: "/crew/schedule", labelKey: "nav.user.schedule" }
  ]
};

export function NavBar() {
  const { session } = useStoredWebSession();
  const i18n = useI18n();
  const localizedHref = (href: string) => addLocalePrefix(href, i18n.locale);

  function handleSignOut() {
    clearStoredSession();
    window.location.href = localizedHref("/");
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a href={localizedHref("/")} className="brand-lockup">
          <span className="brand-lockup__mark-frame" aria-hidden="true">
            <img
              alt=""
              className="brand-lockup__mark-image"
              height={56}
              src="/media/logo_without_words.png"
              width={56}
            />
          </span>
          <span className="brand-lockup__wordmark">
            <strong>{i18n.t("common.brand")}</strong>
            <small>{i18n.t("nav.brand_tagline")}</small>
          </span>
        </a>
        <nav aria-label={i18n.t("nav.primary_aria")} className="site-header__nav">
          <ul className="inline-nav">
            {links.map((link) => (
              <li key={link.href}>
                <a href={localizedHref(link.href)}>{i18n.t(link.labelKey)}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          {session ? (
            <>
              <NotificationMenu session={session} />
              <details className="profile-menu">
                <summary className="profile-menu__summary">{session.fullName}</summary>
                <div className="profile-menu__panel">
                  {accountLinks[session.role].map((link) => (
                    <a href={localizedHref(link.href)} key={link.href}>
                      {i18n.t(link.labelKey)}
                    </a>
                  ))}
                  <button className="profile-menu__button" onClick={handleSignOut} type="button">
                    {i18n.t("nav.sign_out")}
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <details className="auth-menu">
                <summary className="auth-menu__summary">{i18n.t("nav.log_in")}</summary>
                <div className="auth-menu__panel">
                  {loginLinks.map((link) => (
                    <a key={link.href} href={localizedHref(link.href)}>
                      {i18n.t(link.labelKey)}
                    </a>
                  ))}
                </div>
              </details>
              <a className="button" href={localizedHref("/auth")}>
                {i18n.t("nav.sign_up")}
              </a>
            </>
          )}
          <LanguagePicker />
        </div>
      </div>
    </header>
  );
}
