"use client";

import { usePathname } from "next/navigation";

const profileLinks = [
  { href: "/customer", label: "Dashboard" },
  { href: "/customer/history", label: "Service history" },
  { href: "/help", label: "Help" },
  { href: "/login", label: "Sign out" }
] as const;

export function CustomerAppHeader() {
  const pathname = usePathname();
  const currentSectionLabel = pathname.startsWith("/customer/history")
    ? "Service history"
    : "Property dashboard";

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand-lockup" href="/customer">
          <span className="brand-lockup__mark">YM</span>
          <span>
            <strong>YardMatch</strong>
            <small>{currentSectionLabel}</small>
          </span>
        </a>

        <div className="app-header__actions">
          <button className="app-header__notification" type="button" aria-label="Notifications, 3 unread">
            <span className="app-header__notification-icon" aria-hidden="true">
              &#128276;
            </span>
            <span className="app-header__notification-count">3</span>
          </button>

          <details className="profile-menu">
            <summary className="profile-menu__summary">Jordan Rivera</summary>
            <div className="profile-menu__panel">
              {profileLinks.map((link) => (
                <a href={link.href} key={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
