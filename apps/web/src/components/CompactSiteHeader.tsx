"use client";

import { addLocalePrefix, stripLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { clearStoredSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { LanguagePicker } from "./LanguagePicker";
import { NotificationMenu } from "./NotificationMenu";

type NavItem = { href: string; label: TranslationKey };
export function CompactSiteHeader() {
  const i18n = useI18n();
  const { session } = useStoredWebSession();
  const path = stripLocalePrefix(usePathname()).path;
  const provider = path.startsWith("/provider") || path.includes("/provider/") || path.endsWith("/provider");
  const crew = path.startsWith("/crew") || path.endsWith("/crew");
  const role = session?.role;
  const links: NavItem[] = role === "provider" ? [
    { href: "/provider/management", label: "ux.jobs" }, { href: "/provider/payments", label: "ux.payouts" }, { href: "/crew", label: "ux.crew" }, { href: "/help", label: "ux.help" }
  ] : role === "crew-member" ? [
    { href: "/crew", label: "ux.jobs" }, { href: "/crew/schedule", label: "ux.schedule" }, { href: "/crew/schedule/history", label: "nav.user.past_visits" }, { href: "/help", label: "ux.help" }
  ] : role === "ops" ? [
    { href: "/ops", label: "ux.operations" }, { href: "/account/security", label: "ux.security" }
  ] : role === "customer" ? [
    { href: "/customer/dashboard", label: "ux.account" }, { href: "/customer/dashboard?flow=request", label: "ux.services" }, { href: "/customer/history", label: "nav.user.past_visits" }, { href: "/help", label: "ux.help" }
  ] : provider ? [
    { href: "/provider#pricing", label: "ux.pricing" }, { href: "/provider#requirements", label: "ux.requirements" }, { href: "/help", label: "ux.help" }
  ] : [
    { href: "/customer", label: "ux.services" }, { href: "/provider", label: "ux.business" }, { href: "/crew", label: "ux.crew" }, { href: "/help", label: "ux.help" }
  ];
  const login = provider ? "/login/provider" : crew ? "/login/crew" : "/login/customer";
  const signup = provider ? "/auth/provider/create" : crew ? "/auth/crew" : "/auth/customer";
  const local = (href: string) => addLocalePrefix(href, i18n.locale);
  return <header className="compact-header">
    <a className="skip-link" href="#main-content">{i18n.t("ux.skip")}</a>
    <div className="container compact-header__top">
      <a className="compact-header__brand" href={local("/")}>
        <Image src="/media/logo_without_words.png" width={36} height={36} alt="" />
        <strong>{i18n.t("common.brand")}</strong>
      </a>
      <div className="compact-header__actions">
        {session ? <>
          <NotificationMenu session={session} />
          <details className="profile-menu">
            <summary className="profile-menu__summary" title={session.fullName}>{i18n.t("ux.account")}</summary>
            <div className="profile-menu__panel">
              <strong>{session.fullName}</strong>
              <a href={local("/account/security")}>{i18n.t("ux.security")}</a>
              <a href={local("/help")}>{i18n.t("ux.help")}</a>
              <LanguagePicker />
              <button className="profile-menu__button" type="button" onClick={() => { clearStoredSession(); window.location.href = local(login); }}>{i18n.t("nav.sign_out")}</button>
            </div>
          </details>
        </> : <>
          <a href={local(login)}>{i18n.t("nav.log_in")}</a>
          <a className="button" href={local(signup)}>{i18n.t("nav.sign_up")}</a>
        </>}
      </div>
    </div>
    <nav className="container compact-header__nav" aria-label={i18n.t("nav.primary_aria")}>
      {links.map(link => <a key={link.href} href={local(link.href)} aria-current={!link.href.includes("?") && path === link.href ? "page" : undefined}>{i18n.t(link.label)}</a>)}
      {!session ? <LanguagePicker /> : null}
    </nav>
  </header>;
}
