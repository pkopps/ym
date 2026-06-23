import type { Metadata } from "next";
import Link from "next/link";
import { helpCollections } from "@yardmatch/help-center";
import { HelpSupportTicketPanel } from "../../components/HelpSupportTicketPanel";
import { LaunchLeadCaptureCard } from "../../components/LaunchLeadCaptureCard";
import { trustPolicyPages } from "../../lib/trustPolicyContent";

export const metadata: Metadata = {
  title: "Help center for customers, providers, and crew members",
  description:
    "Shared YardMatch help documentation for customers, landscaping businesses, and crew members across booking, staffing, scheduling, billing, payouts, and support."
};

export default function HelpPage() {
  const collections = Object.values(helpCollections);
  const helpPolicyPages = trustPolicyPages.filter((page) => page.surfaces.includes("help"));

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Help center</span>
        <h1>Help for customers, business owners, and crew members.</h1>
        <p>Get answers fast.</p>
      </section>

      <section className="grid-two">
        <LaunchLeadCaptureCard
          defaultAreaLabel="Barnegat, NJ"
          description="Contact GreenRain by email first for pre-booking questions, coverage checks, launch pricing questions, or help requests that are not tied to an existing booking yet."
          requestSource="help-contact-email-form"
          title="Contact us"
        />

        <article className="card">
          <h2>Collections at a glance</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {collections.map((collection) => (
              <article className="list-panel" key={collection.audience}>
                <h3>{collection.title}</h3>
                <div className="chip-row">
                  {collection.quickLinks.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="grid-two">
        <HelpSupportTicketPanel />

        <article className="card">
          <h2>When to use each path</h2>
          <ul className="timeline">
            <li>
              <strong>•</strong>
              <span>Use Contact us for pre-booking questions, launch coverage checks, pricing questions, and general help before you have a live booking.</span>
            </li>
            <li>
              <strong>•</strong>
              <span>Use support tickets after you log in and need help with an actual booking, billing issue, account problem, or service-quality follow-up.</span>
            </li>
            <li>
              <strong>•</strong>
              <span>No-booking customer account or general help tickets now also flow into the follow-up queue automatically, so both paths stay visible to ops instead of disappearing into a generic inbox.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="card">
        <div className="page-hero" style={{ paddingBottom: "1.5rem" }}>
          <span className="eyebrow">Trust basics</span>
          <h2>Support, cancellations, refunds, and booking expectations</h2>
          <p>
            These pages explain the launch-era support rules, legal basics, and provider standards
            in plain language so the public promise stays aligned with how GreenRain actually
            operates.
          </p>
        </div>
        <div className="grid-two">
          {helpPolicyPages.map((page) => (
            <Link className="list-panel" href={page.href} key={page.id}>
              <span className="eyebrow">{page.eyebrow}</span>
              <h3>{page.title}</h3>
              <p>{page.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      {collections.map((collection) => (
        <section className="card" key={collection.audience}>
          <div className="page-hero" style={{ paddingBottom: "1.5rem" }}>
            <span className="eyebrow">{collection.title}</span>
            <h2>{collection.title}</h2>
          </div>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {collection.articles.map((article) => (
              <article className="list-panel" key={article.id} id={article.slug}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h3>{article.title}</h3>
                  <span>
                    {article.readTimeMinutes} min read • Updated {article.updatedAt}
                  </span>
                </div>
                <p>{article.summary}</p>
                <div className="grid-two">
                  {article.sections.map((section) => (
                    <section key={section.heading}>
                      <h4>{section.heading}</h4>
                      <p>{section.body}</p>
                      <ul className="timeline">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>
                            <strong>•</strong>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
