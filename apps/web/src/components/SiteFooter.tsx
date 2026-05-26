const footerColumns = [
  {
    title: "YardMatch",
    links: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About Us" },
      { href: "/press", label: "Press" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact us" },
      { href: "/help", label: "Help" }
    ]
  },
  {
    title: "Discover",
    links: [
      { href: "/stories", label: "The YardMatch Stories for and about property owners" },
      { href: "/provider", label: "Business Resources for landscaping owners" },
      { href: "/community-standards", label: "Community standards" },
      { href: "/privacy", label: "Data and privacy" },
      { href: "/reviews", label: "Verified reviews" },
      { href: "/tech-blog", label: "Tech Blog" }
    ]
  },
  {
    title: "Grow with YardMatch",
    links: [
      { href: "/provider", label: "Are you a top landscaper or outdoor service?" },
      { href: "/ai-assistant", label: "Try Zo, your AI Phone Assistant" },
      { href: "/auth/provider", label: "List your business on YardMatch" },
      { href: "/crew", label: "Find crew members for growing demand" },
      { href: "/enterprise", label: "Learn about YardMatch Enterprise Solutions" },
      { href: "/api/docs", label: "Access YardMatch for Developers" }
    ]
  },
  {
    title: "Directories",
    links: [
      { href: "/directories/service-areas", label: "Service Areas" },
      { href: "/directories/top-services", label: "Top Services" },
      { href: "/directories/seasons", label: "Seasonal Services" },
      { href: "/customer", label: "Book local lawn care" },
      { href: "/provider-mobile", label: "Get the YardMatch business app" },
      { href: "/customer-mobile", label: "Get the YardMatch customer app" }
    ]
  }
] as const;

const socialLinks = [
  { href: "https://instagram.com", label: "Instagram", badge: "IG" },
  { href: "https://linkedin.com", label: "LinkedIn", badge: "in" },
  { href: "https://facebook.com", label: "Facebook", badge: "f" },
  { href: "https://x.com", label: "X", badge: "X" }
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__grid">
          {footerColumns.map((column) => (
            <section className="site-footer__column" key={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__legal">
            <p>
              The content provided on the YardMatch website and mobile experiences is for general
              informational purposes only. It is not intended as, and YardMatch does not provide,
              legal, financial, tax, arborist, irrigation, safety, or landscaping trade advice.
              Always confirm service details, site conditions, pricing, licensing, and any
              property-specific requirements directly with your chosen landscaping business.
            </p>
            <div className="site-footer__meta">
              <span>&copy; 2026 YardMatch, Inc.</span>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/consumer-services">Consumer Services</a>
              <a href="/privacy-choices">Your privacy choices</a>
            </div>
          </div>

          <div className="site-footer__social" aria-label="Social media">
            {socialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="site-footer__social-badge"
                href={link.href}
                key={link.label}
                rel="noreferrer"
                target="_blank"
              >
                {link.badge}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
