"use client";

import { useEffect, useRef, useState } from "react";
import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { clearStoredSession, getWebApiBaseUrl } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationMenu } from "./NotificationMenu";

const productColumns = [
  {
    titleKey: "provider_header.menu.marketplace" as TranslationKey,
    items: [
      {
        href: "/auth/provider/create",
        titleKey: "provider_header.product.list_business.title" as TranslationKey,
        bodyKey: "provider_header.product.list_business.body" as TranslationKey
      },
      {
        href: "/customer/listings",
        titleKey: "provider_header.product.sponsored.title" as TranslationKey,
        bodyKey: "provider_header.product.sponsored.body" as TranslationKey
      },
      {
        href: "/provider",
        titleKey: "provider_header.product.quote.title" as TranslationKey,
        bodyKey: "provider_header.product.quote.body" as TranslationKey
      }
    ]
  },
  {
    titleKey: "provider_header.menu.operations" as TranslationKey,
    items: [
      {
        href: "/provider/management",
        titleKey: "provider_header.product.schedule.title" as TranslationKey,
        bodyKey: "provider_header.product.schedule.body" as TranslationKey
      },
      {
        href: "/provider/payments",
        titleKey: "provider_header.product.payouts.title" as TranslationKey,
        bodyKey: "provider_header.product.payouts.body" as TranslationKey
      },
      {
        href: "/crew",
        titleKey: "provider_header.product.crew.title" as TranslationKey,
        bodyKey: "provider_header.product.crew.body" as TranslationKey
      },
    ]
  },
  {
    titleKey: "provider_header.menu.growth" as TranslationKey,
    items: [
      {
        href: "/provider",
        titleKey: "provider_header.product.google.title" as TranslationKey,
        bodyKey: "provider_header.product.google.body" as TranslationKey
      },
      {
        href: "/provider",
        titleKey: "provider_header.product.routes.title" as TranslationKey,
        bodyKey: "provider_header.product.routes.body" as TranslationKey
      },
      {
        href: "/provider/management",
        titleKey: "provider_header.product.sizing.title" as TranslationKey,
        bodyKey: "provider_header.product.sizing.body" as TranslationKey
      }
    ]
  }
] as const;

const marketplaceLinks = [
  {
    href: "/auth/provider/create",
    titleKey: "provider_header.marketplace.clients.title" as TranslationKey,
    bodyKey: "provider_header.marketplace.clients.body" as TranslationKey
  },
  {
    href: "/crew",
    titleKey: "provider_header.marketplace.employees.title" as TranslationKey,
    bodyKey: "provider_header.marketplace.employees.body" as TranslationKey
  },
  {
    href: "/provider/management",
    titleKey: "provider_header.marketplace.work.title" as TranslationKey,
    bodyKey: "provider_header.marketplace.work.body" as TranslationKey
  },
  {
    href: "/provider/payments",
    titleKey: "provider_header.marketplace.pay.title" as TranslationKey,
    bodyKey: "provider_header.marketplace.pay.body" as TranslationKey
  },
  {
    href: "/provider",
    titleKey: "provider_header.marketplace.quote.title" as TranslationKey,
    bodyKey: "provider_header.marketplace.quote.body" as TranslationKey
  }
] as const;

const learnLinks = [
  { href: "/help", labelKey: "nav.help_center" as TranslationKey },
  { href: `${getWebApiBaseUrl()}/api/docs`, labelKey: "provider_header.learn.developer_docs" as TranslationKey },
  { href: "/provider", labelKey: "nav.business_resources" as TranslationKey }
] as const;

export function ProviderSiteHeader() {
  const i18n = useI18n();
  const [openMenu, setOpenMenu] = useState<null | "learn" | "marketplace" | "products">(null);
  const { session } = useStoredWebSession();
  const navRef = useRef<HTMLElement | null>(null);
  const localHref = (href: string) => (href.startsWith("http") ? href : addLocalePrefix(href, i18n.locale));

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggleMenu(menu: "learn" | "marketplace" | "products") {
    setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu));
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  function handleSignOut() {
    clearStoredSession();
    window.location.href = localHref("/login/provider");
  }

  return (
    <header className="site-header provider-site-header">
      <div className="container site-header__inner provider-site-header__inner">
        <a href={localHref("/provider")} className="brand-lockup">
          <span className="brand-lockup__mark-frame brand-lockup__mark-text">YM</span>
          <span className="brand-lockup__wordmark">
            <strong>{i18n.t("provider_header.brand")}</strong>
            <small>{i18n.t("provider_header.tagline")}</small>
          </span>
        </a>

        <nav aria-label={i18n.t("provider_header.nav_aria")} ref={navRef}>
          <ul className="inline-nav provider-inline-nav">
            <li>
              <div className={`provider-menu ${openMenu === "products" ? "provider-menu--open" : ""}`}>
                <button
                  aria-expanded={openMenu === "products"}
                  className="provider-menu__summary"
                  onClick={() => toggleMenu("products")}
                  type="button"
                >
                  <span>{i18n.t("provider_header.menu.products")}</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "products" ? (
                  <div className="provider-menu__panel provider-menu__panel--wide">
                    <div className="provider-menu__grid">
                      {productColumns.map((column) => (
                        <section key={column.titleKey}>
                          <h2>{i18n.t(column.titleKey)}</h2>
                          <div className="provider-menu__stack">
                            {column.items.map((item) => (
                              <a className="provider-menu__card" href={localHref(item.href)} key={item.titleKey} onClick={closeMenu}>
                                <strong>{i18n.t(item.titleKey)}</strong>
                                <span>{i18n.t(item.bodyKey)}</span>
                              </a>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
            <li>
              <div
                className={`provider-menu ${openMenu === "marketplace" ? "provider-menu--open" : ""}`}
              >
                <button
                  aria-expanded={openMenu === "marketplace"}
                  className="provider-menu__summary"
                  onClick={() => toggleMenu("marketplace")}
                  type="button"
                >
                  <span>{i18n.t("provider_header.menu.marketplace")}</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "marketplace" ? (
                  <div className="provider-menu__panel">
                    <div className="provider-menu__stack">
                      {marketplaceLinks.map((item) => (
                        <a className="provider-menu__card" href={localHref(item.href)} key={item.titleKey} onClick={closeMenu}>
                          <strong>{i18n.t(item.titleKey)}</strong>
                          <span>{i18n.t(item.bodyKey)}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
            <li>
              <div className={`provider-menu ${openMenu === "learn" ? "provider-menu--open" : ""}`}>
                <button
                  aria-expanded={openMenu === "learn"}
                  className="provider-menu__summary"
                  onClick={() => toggleMenu("learn")}
                  type="button"
                >
                  <span>{i18n.t("provider_header.menu.learn")}</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "learn" ? (
                  <div className="provider-menu__panel">
                    <div className="provider-menu__stack">
                      {learnLinks.map((item) => (
                        <a className="provider-menu__link" href={localHref(item.href)} key={item.labelKey} onClick={closeMenu}>
                          {i18n.t(item.labelKey)}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
            <li>
              <a href={localHref("/customer")}>{i18n.t("provider_header.property_owners")}</a>
            </li>
          </ul>
        </nav>

        <div className="site-header__actions">
          {session?.role === "provider" ? (
            <>
              <NotificationMenu session={session} />
              <a className="button-secondary" href={localHref("/provider/management")}>
                {i18n.t("nav.user.management")}
              </a>
              <a className="button-secondary" href={localHref("/provider/payments")}>
                {i18n.t("nav.user.payments")}
              </a>
              <button className="button" onClick={handleSignOut} type="button">
                {i18n.t("nav.sign_out")}
              </button>
            </>
          ) : (
            <>
              <a className="button-secondary" href={localHref("/login/provider")}>
                {i18n.t("nav.log_in")}
              </a>
              <a className="button" href={localHref("/auth/provider/create")}>
                {i18n.t("nav.sign_up")}
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
