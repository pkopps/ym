"use client";

import { clearStoredSession, StoredWebSession } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationMenu } from "./NotificationMenu";

const links = [
  { href: "/customer", label: "Book a service" },
  { href: "/provider", label: "For providers" },
  { href: "/crew", label: "For crews" },
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
    { href: "/customer/dashboard", label: "Account" },
    { href: "/customer/dashboard?view=history", label: "Past visits" }
  ],
  provider: [
    { href: "/provider/management", label: "Management" },
    { href: "/provider/payments", label: "Payments" }
  ],
  ops: [{ href: "/ops", label: "Operations dashboard" }],
  "crew-member": [
    { href: "/crew", label: "Open work" },
    { href: "/crew/schedule", label: "Schedule" }
  ]
};

export function NavBar() {
  const { session } = useStoredWebSession();

  function handleSignOut() {
    clearStoredSession();
    window.location.href = "/";
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a href="/" className="brand-lockup">
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
            <strong>YardMatch</strong>
            <small>Book, run, or join landscaping crews</small>
          </span>
        </a>
        <nav aria-label="Primary navigation" className="site-header__nav">
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
            <>
              <NotificationMenu session={session} />
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
            </>
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
