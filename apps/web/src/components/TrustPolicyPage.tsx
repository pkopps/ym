"use client";

import Link from "next/link";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { localizeTrustPolicyPage, TrustPolicyPageContent, trustPolicyPages } from "../lib/trustPolicyContent";

export function TrustPolicyPage({ page }: { page: TrustPolicyPageContent }) {
  const i18n = useI18n();
  const localizedPage = localizeTrustPolicyPage(i18n, page);
  const siblingPages = trustPolicyPages
    .filter((candidate) => candidate.id !== page.id)
    .map((candidate) => localizeTrustPolicyPage(i18n, candidate));

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{localizedPage.eyebrow}</span>
        <h1>{localizedPage.title}</h1>
        <p>{localizedPage.summary}</p>
      </section>

      <section>
        <article className="card">
          <h2>{i18n.t("trust_policy.page.related_title")}</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {siblingPages.map((candidate) => (
              <Link className="list-panel" href={addLocalePrefix(candidate.href, i18n.locale)} key={candidate.id}>
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
          {localizedPage.sections.map((section) => (
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
          <h2>{i18n.t("trust_policy.page.help_title")}</h2>
          <p>{i18n.t("trust_policy.page.help_body")}</p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button" href={addLocalePrefix("/help", i18n.locale)}>
              {i18n.t("trust_policy.page.help_cta")}
            </Link>
          </div>
        </article>

        <article className="card">
          <h2>{i18n.t("trust_policy.page.launch_title")}</h2>
          <p>{i18n.t("trust_policy.page.launch_body")}</p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href={addLocalePrefix("/barnegat-nj", i18n.locale)}>
              {i18n.t("trust_policy.page.launch_cta")}
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
