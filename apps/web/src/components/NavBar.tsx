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

export function NavBar() {
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
        </div>
      </div>
    </header>
  );
}
