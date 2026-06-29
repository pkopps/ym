import type { Metadata } from "next";
import Link from "next/link";
import { ProviderRadiusSettingsCard } from "../../components/ProviderRadiusSettingsCard";
import { trustPolicyPages } from "../../lib/trustPolicyContent";

export const metadata: Metadata = {
  title: "Grow your landscaping business",
  description:
    "Get more property-owner demand, improve scheduling, expand your service area, and hire crew members through YardMatch."
};

const growthPillars = [
  {
    title: "Win more local property owners",
    body:
      "Show up where homeowners are already searching for lawn care, cleanup, and seasonal help, then convert them into recurring clients."
  },
  {
    title: "Turn demand into route density",
    body:
      "YardMatch helps you stack nearby jobs, reduce dead-drive time, and expose only the time windows your team can actually service."
  },
  {
    title: "Add crew when demand spikes",
    body:
      "Hire individual landscapers who are ready to work as part of a crew so growth does not stall when your calendar fills up."
  }
] as const;

const operatingLevers = [
  "Dedicated provider app for schedules, routes, payouts, and crew coordination",
  "Customer-property-based matching so your team only sees jobs inside your target territory",
  "Calendar-aware booking windows so you stop wasting time on back-and-forth scheduling",
  "Sponsored placement options for businesses that want stronger visibility in relevant local search results",
  "Review collection after completed service to build reputation with real operational context",
  "Shared help and billing support when refunds, disputes, or quality issues show up"
] as const;

const acquisitionChannels = [
  {
    title: "Marketplace demand",
    body:
      "Property owners can discover your business directly on YardMatch when they search by service, distance, and availability."
  },
  {
    title: "Google-friendly web presence",
    body:
      "Your business benefits from YardMatch's search-friendly web layer so service pages and local intent can compound over time."
  },
  {
    title: "Paid growth support",
    body:
      "Use YardMatch as the conversion layer behind Google and local advertising, so lead volume maps back into real schedule capacity."
  }
] as const;

const staffingValue = [
  {
    title: "Crew supply when you need it",
    body:
      "Bring on part-time, seasonal, or recurring crew members without forcing every worker to own a truck, trailer, or full book of business."
  },
  {
    title: "Scale cleanly",
    body:
      "Match larger property jobs with more labor so your quote engine, schedule duration, and field reality stay aligned."
  },
  {
    title: "Protect quality while growing",
    body:
      "Track timeliness, attention to detail, and post-service reviews while you expand into new neighborhoods and service lines."
  }
] as const;

export default function ProviderPage() {
  const providerPolicyPages = trustPolicyPages.filter((page) => page.surfaces.includes("provider"));

  return (
    <main>
      <section className="container hero provider-landing-hero">
        <div>
          <span className="eyebrow">For landscaping business owners</span>
          <h1>Grow your book of business without losing control of your calendar, crews, or margins.</h1>
          <p>Win local jobs, fill your calendar, and add crew when demand picks up.</p>
          <div className="cta-row">
            <a className="button" href="/auth/provider/create">
              Get started
            </a>
            <a className="button-secondary" href="/login/provider">
              Business owner login
            </a>
          </div>
          <div className="chip-row" style={{ marginTop: "1.5rem" }}>
            <span>Recurring mowing routes</span>
            <span>Seasonal cleanup growth</span>
            <span>Google lead conversion</span>
            <span>Crew hiring pipeline</span>
          </div>
        </div>
        <aside className="panel panel--hero provider-growth-panel">
          <div className="panel__accent" />
          <span className="eyebrow">What grows with YardMatch</span>
          <div className="provider-metric-stack">
            <article className="stat-card">
              <strong>More local demand</strong>
              <p>Reach nearby customers looking for service now.</p>
            </article>
            <article className="stat-card">
              <strong>More efficient schedules</strong>
              <p>Tighter routes. Fewer gaps.</p>
            </article>
            <article className="stat-card">
              <strong>More labor supply</strong>
              <p>Hire crew through the same marketplace.</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Why landscaping businesses join</h2>
          <p>Grow without losing control.</p>
        </div>
        <div className="grid-three">
          {growthPillars.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="provider-strip">
          <div>
            <span className="eyebrow">Demand</span>
            <h2>Bring in jobs from YardMatch, local search, and your own marketing.</h2>
          </div>
          <p>Bring demand in. Turn it into booked work.</p>
        </div>
        <div className="grid-three">
          {acquisitionChannels.map((channel) => (
            <article className="card" key={channel.title}>
              <h3>{channel.title}</h3>
              <p>{channel.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>See the operating side before you commit</h2>
          <p>Set your territory and stay efficient.</p>
        </div>
        <div className="grid-two provider-proof-grid">
          <article className="card">
            <h3>Control territory before accepting more work</h3>
            <p>Set the mile radius you are willing to serve by property address.</p>
            <ProviderRadiusSettingsCard />
          </article>
          <article className="card">
            <h3>Operational levers that protect growth</h3>
            <ul className="provider-feature-list">
              {operatingLevers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="provider-proof-callout">
              <strong>Dedicated provider mobile app</strong>
              <p>Schedules, routes, clients, reviews, and payouts in one place.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Find the crew capacity to support new demand</h2>
          <p>Scale your labor with your bookings.</p>
        </div>
        <div className="grid-three">
          {staffingValue.map((item) => (
            <article className="card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Provider standards before you scale</h2>
          <p>See the quality, verification, support, and operating expectations that are meant to hold the marketplace together.</p>
        </div>
        <div className="grid-two">
          {providerPolicyPages.map((page) => (
            <Link className="list-panel" href={page.href} key={page.id}>
              <span className="eyebrow">{page.eyebrow}</span>
              <h3>{page.title}</h3>
              <p>{page.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="provider-final-cta panel">
          <div>
            <span className="eyebrow">Ready to grow?</span>
            <h2>Join YardMatch and turn more local demand into real routes, crews, and repeat clients.</h2>
            <p>Start with your business account.</p>
          </div>
          <div className="cta-row">
            <a className="button" href="/auth/provider/create">
              Sign up as a business owner
            </a>
            <a className="button-secondary" href="/login/provider">
              Already have an account?
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
