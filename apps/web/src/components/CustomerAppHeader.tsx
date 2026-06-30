"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { clearStoredSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationMenu } from "./NotificationMenu";

const profileLinks = [
  { href: "/customer/dashboard", label: "Account" },
  { href: "/customer/dashboard?view=history", label: "Past visits" },
  { href: "/help", label: "Help" }
] as const;

export function CustomerAppHeader() {
  const { session } = useStoredWebSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const currentFlow = searchParams.get("flow");

  const currentSectionLabel =
    pathname === "/help"
      ? "Help"
      : currentFlow === "request"
        ? "Request service"
        : currentView === "history"
          ? "Past visits"
          : "Customer account";

  function handleSignOut() {
    clearStoredSession();
    window.location.href = "/customer";
  }

  function isActiveLink(href: (typeof profileLinks)[number]["href"]) {
    if (href === "/help") {
      return pathname === "/help";
    }

    if (href === "/customer/dashboard?view=history") {
      return pathname === "/customer/dashboard" && currentView === "history";
    }

    return pathname === "/customer/dashboard" && currentView !== "history";
  }

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand-lockup" href="/customer/dashboard">
          <span className="brand-lockup__mark-frame brand-lockup__mark-text">YM</span>
          <span className="brand-lockup__wordmark">
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
                <a aria-current={isActiveLink(link.href) ? "page" : undefined} href={link.href} key={link.href}>
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
