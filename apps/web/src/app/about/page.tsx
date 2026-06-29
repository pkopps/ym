import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn why GreenRain by YardMatch is building a recommendation-first marketplace for reliable lawn care and landscaping."
};

const principles = [
  {
    title: "Recommendation first",
    body: "Customers should not need to compare dozens of profiles. Start with the best match, then open backup options only if you want them."
  },
  {
    title: "Local before national",
    body: "Dense local coverage creates better routes, faster response times, and more consistent service than a thin directory spread everywhere."
  },
  {
    title: "Provider-friendly operations",
    body: "Healthy provider economics matter. Better supply leads to better service, better retention, and a stronger customer experience."
  }
] as const;

const audiences = [
  {
    title: "For homeowners",
    body: "Book recurring care or one-time work quickly, understand why a provider was picked, and track the route without a chain of texts."
  },
  {
    title: "For business owners",
    body: "Run bookings, dispatch, staffing, payouts, and customer updates in one operating system instead of stitching tools together."
  },
  {
    title: "For crew members",
    body: "See assignments, availability, route context, and payout status in one place so work is clearer and easier to trust."
  }
] as const;

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="container page-hero about-hero">
        <div className="grid-two about-hero__layout">
          <div className="about-hero__story">
            <span className="eyebrow">About GreenRain by YardMatch</span>
            <h1>Reliable yard care, without the comparison shopping.</h1>
            <p>
              GreenRain is the customer experience built on YardMatch. Tell us the service, timing, and
              property, and we recommend the best local fit first.
            </p>
            <div className="cta-row">
              <a className="button" href="/customer">
                Book a service
              </a>
              <a className="button-secondary" href="/provider">
                List your business
              </a>
              <a className="button-secondary" href="/auth/crew">
                Join a crew
              </a>
            </div>
          </div>

          <aside className="card about-hero__panel">
            <span className="eyebrow">What we believe</span>
            <h2>The matching system should be the product.</h2>
            <p>
              We are not trying to become another endless directory or quote marketplace. We are building
              a managed marketplace that reduces decision fatigue while keeping trust high.
            </p>
            <div className="about-hero__quote">
              <strong>Core idea</strong>
              <p>Tell us what you need. We&apos;ll handle the rest.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Why we built it this way</h2>
          <p>Most outdoor-service marketplaces make both sides work too hard.</p>
        </div>
        <div className="grid-two">
          <article className="card">
            <span className="eyebrow">What we are not</span>
            <p>
              GreenRain is not meant to be a scrolling directory, a bidding war, or a promoted-listings
              platform where customers compare twenty businesses before booking a simple mow.
            </p>
          </article>
          <article className="card">
            <span className="eyebrow">What we are</span>
            <p>
              We are building a recommendation-first marketplace that helps customers book faster, helps
              providers run tighter operations, and helps crews fit into real working routes.
            </p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>How we think about growth</h2>
          <p>Quality and density beat breadth.</p>
        </div>
        <div className="grid-three">
          {principles.map((principle) => (
            <article className="card about-principle" key={principle.title}>
              <strong>{principle.title}</strong>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Built for every side of the job</h2>
          <p>One marketplace, three very different needs.</p>
        </div>
        <div className="grid-three">
          {audiences.map((audience) => (
            <article className="card about-audience" key={audience.title}>
              <strong>{audience.title}</strong>
              <p>{audience.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg about-cta">
        <div className="card about-cta__card">
          <span className="eyebrow">Ready to see it in action?</span>
          <h2>Start with the job you need done. We&apos;ll recommend the best fit.</h2>
          <p>Book a service, grow your landscaping business, or join a crew route that needs help.</p>
          <div className="cta-row">
            <a className="button" href="/customer">
              Find my provider
            </a>
            <a className="button-secondary" href="/provider">
              Explore provider tools
            </a>
            <a className="button-secondary" href="/crew">
              Explore crew work
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
