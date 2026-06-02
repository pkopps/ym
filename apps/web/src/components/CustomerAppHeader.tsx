"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { clearStoredSession, loadStoredSession, StoredWebSession } from "../lib/api";

const profileLinks = [
  { href: "/customer", label: "Dashboard" },
  { href: "/customer/history", label: "Service history" },
  { href: "/help", label: "Help" }
] as const;

export function CustomerAppHeader() {
  const pathname = usePathname();
  const [session, setSession] = useState<StoredWebSession | undefined>();
  const currentSectionLabel = pathname.startsWith("/customer/history")
    ? "Service history"
    : "Property dashboard";

  useEffect(() => {
    setSession(loadStoredSession());
  }, []);

  function handleSignOut() {
    clearStoredSession();
    window.location.href = "/login/customer";
  }

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
            <summary className="profile-menu__summary">{session?.fullName ?? "Customer"}</summary>
            <div className="profile-menu__panel">
              {profileLinks.map((link) => (
                <a href={link.href} key={link.href}>
                  {link.label}
                </a>
              ))}
              <button className="profile-menu__button" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
