import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import type { ServiceCategory } from "@yardmatch/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { addLocalePrefix } from "@yardmatch/i18n";
import { helpCollections } from "@yardmatch/help-center";
import { HelpSupportTicketPanel } from "../../components/HelpSupportTicketPanel";
import { LaunchLeadCaptureCard } from "../../components/LaunchLeadCaptureCard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";
import { localizeTrustPolicyPage, trustPolicyPages } from "../../lib/trustPolicyContent";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/help",
    titleKey: "help.metadata.title",
    descriptionKey: "help.metadata.description"
  });
}

export default async function HelpPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const area = typeof params.area === "string" ? params.area.slice(0,120) : "";
  const service = typeof params.service === "string" && Object.hasOwn(serviceCategoryLabelKeys, params.service) ? params.service as ServiceCategory : undefined;
  const timing = typeof params.timing === "string" ? params.timing.slice(0,100).replaceAll("-", " ") : "";
  const i18n = await getRequestI18n();
  const collections = Object.values(helpCollections);
  const helpPolicyPages = trustPolicyPages.filter((page) => page.surfaces.includes("help"));

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>{i18n.t("help.hero.title")}</h1>
        <p>{i18n.t("help.hero.body")}</p>
      </section>

      <nav className="workspace-nav" aria-label={i18n.t("workspace.destinations")}>
        <a href="#booking-help">{i18n.t("journey.existing_booking")}</a>
        <a href="#contact-us">{i18n.t("journey.before_booking")}</a>
        <a href={addLocalePrefix("/account/security", i18n.locale)}>{i18n.t("journey.account_help")}</a>
      </nav>
      <section id="booking-help"><HelpSupportTicketPanel /></section>
      <section id="contact-us">
        <LaunchLeadCaptureCard
          defaultAreaLabel={area}
          defaultServiceCategory={service}
          defaultMessage={timing ? `${i18n.t("customer_live.label.when")}: ${timing}` : undefined}
          description={i18n.t("help.contact.body")}
          requestSource="help-contact-email-form"
          title={i18n.t("help.contact.title")}
        />
      </section>


      <section className="card">
        <div className="page-hero" style={{ paddingBottom: "1.5rem" }}>
          <h2>{i18n.t("help.policies.title")}</h2>
          <p>{i18n.t("help.policies.body")}</p>
        </div>
        <div className="grid-two">
          {helpPolicyPages.map((page) => {
            const localizedPage = localizeTrustPolicyPage(i18n, page);

            return (
              <Link className="list-panel" href={addLocalePrefix(localizedPage.href, i18n.locale)} key={localizedPage.id}>
                <span className="eyebrow">{localizedPage.eyebrow}</span>
                <h3>{localizedPage.title}</h3>
                <p>{localizedPage.summary}</p>
              </Link>
            );
          })}
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
