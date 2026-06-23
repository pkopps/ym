const footerColumns = [
  {
    title: "YardMatch",
    links: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About Us" },
      { href: "/barnegat-nj", label: "Barnegat launch page" },
      { href: "/customer", label: "Book a service" },
      { href: "/help", label: "Help" }
    ]
  },
  {
    title: "Discover",
    links: [
      { href: "/services/lawn-mowing", label: "Lawn mowing" },
      { href: "/services/yard-cleanup", label: "Yard cleanup" },
      { href: "/barnegat-nj/lawn-mowing", label: "Barnegat lawn mowing" },
      { href: "/barnegat-nj/yard-cleanup", label: "Barnegat yard cleanup" },
      { href: "/provider", label: "Business Resources for landscaping owners" },
      { href: "/crew", label: "Crew hiring" }
    ]
  },
  {
    title: "Grow with YardMatch",
    links: [
      { href: "/provider", label: "Are you a top landscaper or outdoor service?" },
      { href: "/auth/provider", label: "List your business on YardMatch" },
      { href: "/crew", label: "Find crew members for growing demand" },
      { href: "/provider", label: "Provider growth tools" },
      { href: "/about", label: "How the marketplace works" },
      { href: "/help", label: "Support and help center" }
    ]
  },
  {
    title: "Launch focus",
    links: [
      { href: "/barnegat-nj", label: "Launch area overview" },
      { href: "/services/lawn-mowing", label: "Core recurring service" },
      { href: "/services/yard-cleanup", label: "Core reset service" },
      { href: "/customer", label: "Recommendation-first booking" },
      { href: "/about", label: "Why GreenRain is managed" },
      { href: "/provider", label: "Provider-side marketplace story" }
    ]
  },
  {
    title: "Trust and policies",
    links: [
      { href: "/support", label: "Support expectations" },
      { href: "/cancellation-policy", label: "Cancellation policy" },
      { href: "/refund-policy", label: "Refund policy" },
      { href: "/booking-expectations", label: "Booking expectations" },
      { href: "/provider-verification", label: "Provider verification" },
      { href: "/privacy-policy", label: "Privacy policy" },
      { href: "/terms-of-service", label: "Terms of service" },
      { href: "/provider-standards", label: "Provider standards" },
      { href: "/help", label: "Help center" }
    ]
  }
] as const;

const socialLinks = [
  { href: "https://instagram.com", label: "Instagram" },
  { href: "https://linkedin.com", label: "LinkedIn" },
  { href: "https://facebook.com", label: "Facebook" },
  { href: "https://x.com", label: "X" }
] as const;

function SocialIcon({ label }: { label: (typeof socialLinks)[number]["label"] }) {
  if (label === "Instagram") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  if (label === "LinkedIn") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <path
          d="M7.3 9.2V19H4.1V9.2H7.3ZM7.5 6.2C7.5 7.2 6.8 7.9 5.7 7.9C4.6 7.9 3.9 7.2 3.9 6.2C3.9 5.2 4.6 4.5 5.7 4.5C6.8 4.5 7.5 5.2 7.5 6.2ZM20.1 12.8V19H16.9V13.2C16.9 11.8 16.4 10.8 15.1 10.8C14.1 10.8 13.5 11.5 13.2 12.1C13.1 12.4 13.1 12.7 13.1 13V19H9.9C9.9 15.7 9.9 10.7 9.9 9.2H13.1V10.6C13.5 9.9 14.3 8.9 16.2 8.9C18.5 8.9 20.1 10.4 20.1 13.6V12.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (label === "Facebook") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <path
          d="M13.8 19V12.8H15.9L16.2 10.3H13.8V8.7C13.8 7.9 14 7.3 15.2 7.3H16.3V5.1C15.8 5 15.2 5 14.7 5C12.4 5 10.9 6.4 10.9 9V10.3H9V12.8H10.9V19H13.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
      <path
        d="M6.2 5H9.3L12.1 9L15.1 5H18.1L13.5 11L18.4 19H15.2L12 14.2L8.4 19H5.4L10.6 12.1L6.2 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
              <a href="/about">About</a>
              <a href="/help">Help</a>
              <a href="/support">Support</a>
              <a href="/refund-policy">Refunds</a>
              <a href="/privacy-policy">Privacy</a>
              <a href="/terms-of-service">Terms</a>
              <a href="/barnegat-nj">Launch area</a>
              <a href="/provider">For providers</a>
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
                <SocialIcon label={link.label} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
