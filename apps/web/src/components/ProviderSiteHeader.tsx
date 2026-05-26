"use client";

import { useEffect, useRef, useState } from "react";

const productColumns = [
  {
    title: "Marketplace",
    items: [
      {
        href: "/auth/provider",
        title: "List your business",
        body: "Reach new property owners looking for recurring service."
      },
      {
        href: "/customer/listings",
        title: "Sponsored placement",
        body: "Promote your business in relevant local search results."
      },
      {
        href: "/provider",
        title: "Instant quote engine",
        body: "Use mapped property sizing to support faster quoting and better booking conversion."
      }
    ]
  },
  {
    title: "Operations",
    items: [
      {
        href: "/provider/management",
        title: "Schedule management",
        body: "Keep routes, calendars, and service areas aligned."
      },
      {
        href: "/provider/payments",
        title: "Crew payouts",
        body: "Pay crew members post-service and manage funding cards."
      },
      {
        href: "/crew",
        title: "Crew hiring",
        body: "Find workers when demand outgrows your current team."
      },
    ]
  },
  {
    title: "Growth",
    items: [
      {
        href: "/provider",
        title: "Google lead capture",
        body: "Turn search demand into booked work on YardMatch."
      },
      {
        href: "/provider",
        title: "Route efficiency",
        body: "Stack nearby work and reduce wasted drive time."
      },
      {
        href: "/provider/management",
        title: "Map-based property sizing",
        body: "Estimate property size from address context to help price jobs faster."
      }
    ]
  }
] as const;

const marketplaceLinks = [
  {
    href: "/auth/provider",
    title: "Find new clients",
    body: "Show up where property owners are already looking for lawn care."
  },
  {
    href: "/crew",
    title: "Find employees",
    body: "Bring in crew members through the same marketplace."
  },
  {
    href: "/provider/management",
    title: "Manage booked work",
    body: "Handle schedules, crews, and follow-through from one place."
  },
  {
    href: "/provider/payments",
    title: "Pay your crew",
    body: "Fund completed jobs and control default cards for payout runs."
  },
  {
    href: "/provider",
    title: "Quote faster",
    body: "Use map-driven property sizing and instant quotes to move leads into booked work."
  }
] as const;

const learnLinks = [
  { href: "/help", label: "Help center" },
  { href: "/api/docs", label: "Developer docs" },
  { href: "/provider", label: "Business resources" }
] as const;

export function ProviderSiteHeader() {
  const [openMenu, setOpenMenu] = useState<null | "learn" | "marketplace" | "products">(null);
  const navRef = useRef<HTMLElement | null>(null);

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

  return (
    <header className="site-header provider-site-header">
      <div className="container site-header__inner provider-site-header__inner">
        <a href="/auth/provider" className="brand-lockup">
          <span className="brand-lockup__mark">YM</span>
          <span>
            <strong>YardMatch for Businesses</strong>
            <small>Clients, crews, and schedules in one place</small>
          </span>
        </a>

        <nav aria-label="Business navigation" ref={navRef}>
          <ul className="inline-nav provider-inline-nav">
            <li>
              <div className={`provider-menu ${openMenu === "products" ? "provider-menu--open" : ""}`}>
                <button
                  aria-expanded={openMenu === "products"}
                  className="provider-menu__summary"
                  onClick={() => toggleMenu("products")}
                  type="button"
                >
                  <span>Products</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "products" ? (
                  <div className="provider-menu__panel provider-menu__panel--wide">
                    <div className="provider-menu__grid">
                      {productColumns.map((column) => (
                        <section key={column.title}>
                          <h2>{column.title}</h2>
                          <div className="provider-menu__stack">
                            {column.items.map((item) => (
                              <a className="provider-menu__card" href={item.href} key={item.title} onClick={closeMenu}>
                                <strong>{item.title}</strong>
                                <span>{item.body}</span>
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
                  <span>Marketplace</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "marketplace" ? (
                  <div className="provider-menu__panel">
                    <div className="provider-menu__stack">
                      {marketplaceLinks.map((item) => (
                        <a className="provider-menu__card" href={item.href} key={item.title} onClick={closeMenu}>
                          <strong>{item.title}</strong>
                          <span>{item.body}</span>
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
                  <span>Learn</span>
                  <span className="provider-menu__chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>
                {openMenu === "learn" ? (
                  <div className="provider-menu__panel">
                    <div className="provider-menu__stack">
                      {learnLinks.map((item) => (
                        <a className="provider-menu__link" href={item.href} key={item.label} onClick={closeMenu}>
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
            <li>
              <a href="/customer">For property owners</a>
            </li>
          </ul>
        </nav>

        <div className="site-header__actions">
          <a className="button-secondary" href="/login/provider">
            Log in
          </a>
          <a className="button" href="/auth/provider/create">
            Sign up
          </a>
        </div>
      </div>
    </header>
  );
}
