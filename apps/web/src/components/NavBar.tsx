"use client";

import { useEffect, useState } from "react";
import { clearStoredSession, loadStoredSession, StoredWebSession } from "../lib/api";

const links = [
  { href: "/customer", label: "Book a service" },
  { href: "/auth/provider", label: "List your Business on YardMatch" },
  { href: "/crew", label: "Join a landscaping crew" },
  { href: "/help", label: "Help center" }
];

const loginLinks = [
  { href: "/login/customer", label: "Customer login" },
  { href: "/login/provider", label: "Business owner login" },
  { href: "/login/crew", label: "Crew member login" }
];

const accountLinks: Record<StoredWebSession["role"], Array<{ href: string; label: string }>> = {
  customer: [
    { href: "/customer", label: "Search services" },
    { href: "/customer/dashboard", label: "Dashboard" },
    { href: "/customer/history", label: "Service history" }
  ],
  provider: [
    { href: "/provider/management", label: "Management" },
    { href: "/provider/payments", label: "Payments" }
  ],
  "crew-member": [
    { href: "/crew", label: "Open work" },
    { href: "/crew/schedule", label: "Schedule" }
  ]
};

export function NavBar() {
  const [session, setSession] = useState<StoredWebSession | undefined>();

  useEffect(() => {
    setSession(loadStoredSession());
  }, []);

  function handleSignOut() {
    clearStoredSession();
    window.location.href = "/";
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a href="/" className="brand-lockup">
          <span className="brand-lockup__mark">YM</span>
          <span>
            <strong>YardMatch</strong>
            <small>Book, run, or join landscaping crews</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <ul className="inline-nav">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          {session ? (
            <details className="profile-menu">
              <summary className="profile-menu__summary">{session.fullName}</summary>
              <div className="profile-menu__panel">
                {accountLinks[session.role].map((link) => (
                  <a href={link.href} key={link.href}>
                    {link.label}
                  </a>
                ))}
                <button className="profile-menu__button" onClick={handleSignOut} type="button">
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <>
              <details className="auth-menu">
                <summary className="auth-menu__summary">Log in</summary>
                <div className="auth-menu__panel">
                  {loginLinks.map((link) => (
                    <a key={link.href} href={link.href}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </details>
              <a className="button" href="/auth">
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
