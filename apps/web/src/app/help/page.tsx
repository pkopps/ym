import type { Metadata } from "next";
import { helpCollections } from "@yardmatch/help-center";
import { HelpSupportTicketPanel } from "../../components/HelpSupportTicketPanel";

export const metadata: Metadata = {
  title: "Help center for customers, providers, and crew members",
  description:
    "Shared YardMatch help documentation for customers, landscaping businesses, and crew members across booking, staffing, scheduling, billing, payouts, and support."
};

export default function HelpPage() {
  const collections = Object.values(helpCollections);

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Help center</span>
        <h1>Help for customers, business owners, and crew members.</h1>
        <p>Get answers fast.</p>
      </section>

      <section className="grid-two">
        <HelpSupportTicketPanel />

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
