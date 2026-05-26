import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business owner sign up"
};

const providerSections = [
  {
    eyebrow: "Client growth you can count on",
    title: "Get found by property owners who are ready to book.",
    body: "Put your business in front of homeowners and property managers already searching for mowing, cleanup, seasonal work, and recurring maintenance.",
    bullets: ["Show up in local search results", "Turn interest into booked work", "Win repeat clients, not just one-off jobs"],
    image: "/illustrations/provider-growth.svg",
    imageAlt: "Landscaping truck and route pins representing local client growth"
  },
  {
    eyebrow: "Trusted by home and property owners",
    title: "Build trust before the first visit.",
    body: "Reviews, on-time history, clear service details, and polished profiles help property owners feel confident choosing your crew.",
    bullets: ["Review-driven credibility", "Transparent service details", "Professional profile presence"],
    image: "/illustrations/provider-trust.svg",
    imageAlt: "Landscaping crew profile with review stars and a home"
  },
  {
    eyebrow: "Powering businesses of all sizes",
    title: "Whether you run solo or manage multiple crews, YardMatch scales with you.",
    body: "Use one system to grow from a single truck to a larger operation with multiple routes, recurring clients, and crew coordination.",
    bullets: ["Great for solo operators", "Supports multi-crew growth", "Keeps admin work in one place"],
    image: "/illustrations/provider-operations.svg",
    imageAlt: "Landscape business operations dashboard with schedule and route cards"
  },
  {
    eyebrow: "Demand and crew balancing",
    title: "See demand rising before your schedule breaks.",
    body: "YardMatch connects incoming jobs with crew capacity so you can hire sooner, rebalance routes, and avoid missing growth opportunities.",
    bullets: ["Spot overbooked territories", "Find crew members when demand spikes", "Keep jobs staffed and on time"],
    image: "/illustrations/provider-growth.svg",
    imageAlt: "Landscaping routes and staffing needs represented visually"
  },
  {
    eyebrow: "Run the operation",
    title: "Use the tools that matter every day.",
    body: "Manage schedules, crews, service radius, property sizing, instant quotes, reviews, and follow-through from one operating system.",
    bullets: ["Map-based property sizing for faster quotes", "Scheduling and crew coordination", "Service radius, reviews, and customer management"],
    image: "/illustrations/provider-operations.svg",
    imageAlt: "Business management dashboard for landscaping operations"
  },
  {
    eyebrow: "Equipment deals and partnerships",
    title: "Stretch your margins with equipment discounts.",
    body: "Access special pricing and partner deals on equipment, tools, and supplies that help your crews keep moving.",
    bullets: ["Savings on core equipment", "Partner discounts on tools and supplies", "More margin as you grow"],
    ctaHref: "/provider/partnerships",
    ctaLabel: "See partnership deals",
    image: "/illustrations/provider-equipment.svg",
    imageAlt: "Lawn mower equipment and discount tags"
  }
] as const;

const providerHighlights = [
  "Find new clients",
  "Fill crew gaps faster",
  "Quote from address-based property sizing",
  "Run schedules and routes in one place"
] as const;

export default function ProviderSignupLandingPage() {
  return (
    <main className="provider-landing">
      <section className="container provider-hero">
        <div className="provider-hero__content">
          <span className="eyebrow">Business owner sign up</span>
          <h1>Grow your landscaping business with YardMatch.</h1>
          <p>
            Find more clients, add crew supply as demand grows, quote faster with map-based property sizing, and run the operation from one place.
          </p>
          <div className="provider-hero__actions">
            <a className="button provider-hero__button" href="/auth/provider/create">
              Get Started
            </a>
            <a className="button-secondary" href="/login/provider">
              Business owner login
            </a>
          </div>
          <div className="provider-hero__chips" aria-label="Business benefits">
            {providerHighlights.map((highlight) => (
              <span className="provider-hero__chip" key={highlight}>
                {highlight}
              </span>
            ))}
          </div>
        </div>

        <aside className="provider-hero__visual panel">
          <img
            alt="Landscaping truck and mower parked outside a home"
            className="provider-hero__image"
            src="/illustrations/provider-growth.svg"
          />
          <div className="provider-hero__visual-copy">
            <strong>Designed for real landscaping operations.</strong>
            <p>From lead flow to instant quotes to crew coverage, YardMatch helps your business stay full and stay organized.</p>
          </div>
        </aside>
      </section>

      <div className="provider-sections">
        {providerSections.map((section, index) => (
          <section
            className={`provider-story provider-story--${index % 2 === 0 ? "mint" : "sand"}`}
            key={section.title}
          >
            <div className="container provider-story__grid">
              <div className={`provider-story__image-wrap ${index % 2 === 1 ? "provider-story__image-wrap--reverse" : ""}`}>
                <img alt={section.imageAlt} className="provider-story__image" src={section.image} />
              </div>
              <div className="provider-story__copy">
                <span className="eyebrow">{section.eyebrow}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                <ul className="provider-story__list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {"ctaHref" in section && section.ctaHref ? (
                  <div className="cta-row">
                    <a className="button-secondary" href={section.ctaHref}>
                      {section.ctaLabel}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="container provider-final-cta panel">
        <div>
          <span className="eyebrow">Ready to list your business?</span>
          <h2>Start now and build the next stage of your landscaping business on YardMatch.</h2>
          <p>Create your account first. Company details, territory, and quote settings come after signup.</p>
        </div>
        <div className="cta-row">
          <a className="button" href="/auth/provider/create">
            Get Started
          </a>
          <a className="button-secondary" href="/login/provider">
            Business owner login
          </a>
        </div>
      </section>
    </main>
  );
}
