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
        <h1>Help</h1>
        <p>Answers for customers, businesses, and crews.</p>
      </section>

      <section id="contact-us">
        <LaunchLeadCaptureCard
          defaultAreaLabel="Barnegat, NJ"
          description="Use this for pre-booking questions, coverage checks, and pricing before you have a booking."
          requestSource="help-contact-email-form"
          title="Contact us"
        />
      </section>

      <section>
        <HelpSupportTicketPanel />
      </section>

      <section className="card">
        <div className="page-hero" style={{ paddingBottom: "1.5rem" }}>
          <h2>Support, refunds, and booking rules</h2>
          <p>Plain-language support, refund, cancellation, and provider rules.</p>
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
            <h2>{collection.title}</h2>
          </div>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {collection.articles.map((article) => (
              <article className="list-panel" key={article.id} id={article.slug}>
                <details className="service-card-disclosure">
                  <summary className="service-card-disclosure__summary">{article.title}</summary>
                  <div className="service-card-disclosure__body">
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
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
