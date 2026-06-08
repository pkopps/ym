"use client";

import { usePathname } from "next/navigation";
import { clearStoredSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationMenu } from "./NotificationMenu";

const profileLinks = [
  { href: "/customer/dashboard", label: "Dashboard" },
  { href: "/customer/history", label: "Service history" },
  { href: "/help", label: "Help" }
] as const;

export function CustomerAppHeader() {
  const pathname = usePathname();
  const { session } = useStoredWebSession();
  const currentSectionLabel = pathname.startsWith("/customer/history")
    ? "Service history"
    : "Property dashboard";

  function handleSignOut() {
    clearStoredSession();
    window.location.href = "/customer";
  }

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand-lockup" href="/customer/dashboard">
          <span className="brand-lockup__mark">YM</span>
          <span>
            <strong>YardMatch</strong>
            <small>{currentSectionLabel}</small>
          </span>
        </a>

        <div className="app-header__actions">
          <NotificationMenu session={session} />

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
