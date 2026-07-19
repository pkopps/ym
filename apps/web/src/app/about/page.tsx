import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/about",
    titleKey: "about.metadata.title",
    descriptionKey: "about.metadata.description"
  });
}

const principles = [
  {
    titleKey: "about.principle.recommendation.title",
    bodyKey: "about.principle.recommendation.body"
  },
  {
    titleKey: "about.principle.local.title",
    bodyKey: "about.principle.local.body"
  },
  {
    titleKey: "about.principle.provider.title",
    bodyKey: "about.principle.provider.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

const audiences = [
  {
    titleKey: "about.audience.homeowners.title",
    bodyKey: "about.audience.homeowners.body"
  },
  {
    titleKey: "about.audience.business.title",
    bodyKey: "about.audience.business.body"
  },
  {
    titleKey: "about.audience.crew.title",
    bodyKey: "about.audience.crew.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

export default async function AboutPage() {
  const i18n = await getRequestI18n();
  const href = (path: string) => addLocalePrefix(path, i18n.locale);

  return (
    <main className="about-page">
      <section className="container page-hero about-hero">
        <div className="grid-two about-hero__layout">
          <div className="about-hero__story">
            <span className="eyebrow">{i18n.t("about.hero.eyebrow")}</span>
            <h1>{i18n.t("about.hero.title")}</h1>
            <p>{i18n.t("about.hero.body")}</p>
            <div className="cta-row">
              <a className="button" href={href("/customer")}>
                {i18n.t("about.hero.book")}
              </a>
              <a className="button-secondary" href={href("/provider")}>
                {i18n.t("about.hero.list_business")}
              </a>
              <a className="button-secondary" href={href("/auth/crew")}>
                {i18n.t("about.hero.join_crew")}
              </a>
            </div>
          </div>

          <aside className="card about-hero__panel">
            <span className="eyebrow">{i18n.t("about.belief.eyebrow")}</span>
            <h2>{i18n.t("about.belief.title")}</h2>
            <p>{i18n.t("about.belief.body")}</p>
            <div className="about-hero__quote">
              <strong>{i18n.t("about.belief.quote_label")}</strong>
              <p>{i18n.t("about.belief.quote")}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("about.why.title")}</h2>
          <p>{i18n.t("about.why.body")}</p>
        </div>
        <div className="grid-two">
          <article className="card">
            <span className="eyebrow">{i18n.t("about.not.eyebrow")}</span>
            <p>{i18n.t("about.not.body")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{i18n.t("about.are.eyebrow")}</span>
            <p>{i18n.t("about.are.body")}</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("about.growth.title")}</h2>
          <p>{i18n.t("about.growth.body")}</p>
        </div>
        <div className="grid-three">
          {principles.map((principle) => (
            <article className="card about-principle" key={principle.titleKey}>
              <strong>{i18n.t(principle.titleKey)}</strong>
              <p>{i18n.t(principle.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("about.audiences.title")}</h2>
          <p>{i18n.t("about.audiences.body")}</p>
        </div>
        <div className="grid-three">
          {audiences.map((audience) => (
            <article className="card about-audience" key={audience.titleKey}>
              <strong>{i18n.t(audience.titleKey)}</strong>
              <p>{i18n.t(audience.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg about-cta">
        <div className="card about-cta__card">
          <span className="eyebrow">{i18n.t("about.cta.eyebrow")}</span>
          <h2>{i18n.t("about.cta.title")}</h2>
          <p>{i18n.t("about.cta.body")}</p>
          <div className="cta-row">
            <a className="button" href={href("/customer")}>
              {i18n.t("about.cta.find_provider")}
            </a>
            <a className="button-secondary" href={href("/provider")}>
              {i18n.t("about.cta.provider_tools")}
            </a>
            <a className="button-secondary" href={href("/crew")}>
              {i18n.t("about.cta.crew_work")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
