"use client";

import Link from "next/link";
import { TrustPolicyPageContent, trustPolicyPages } from "../lib/trustPolicyContent";

export function TrustPolicyPage({ page }: { page: TrustPolicyPageContent }) {
  const siblingPages = trustPolicyPages.filter((candidate) => candidate.id !== page.id);

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Why this page exists</h2>
          <p>{page.description}</p>
          <p>
            YardMatch is meant to be a managed marketplace, so the public promise about support,
            legal basics, booking rules, and provider expectations should match how the product and
            ops flow actually behave.
          </p>
        </article>

        <article className="card">
          <h2>Related trust pages</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {siblingPages.map((candidate) => (
              <Link className="list-panel" href={candidate.href} key={candidate.id}>
                <span className="eyebrow">{candidate.eyebrow}</span>
                <h3>{candidate.title}</h3>
                <p>{candidate.summary}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="grid-two">
          {page.sections.map((section) => (
            <section className="faq-item" key={section.heading}>
              <h2>{section.heading}</h2>
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
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Need help right now?</h2>
          <p>
            Use the Help center if you need the full support path, pre-booking Contact us entry
            point, or logged-in ticket flow for a live booking. These policy pages are meant to
            clarify expectations, not replace support when a real situation needs follow-through.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button" href="/help">
              Go to Help center
            </Link>
          </div>
        </article>

        <article className="card">
          <h2>Launch area focus</h2>
          <p>
            Trust grows faster when coverage is dense and predictable. YardMatch is intentionally
            prioritizing the launch radius before broad expansion.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href="/barnegat-nj">
              See launch area page
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
