import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import Link from "next/link";
import { ProviderRadiusSettingsCard } from "../../components/ProviderRadiusSettingsCard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";
import { localizeTrustPolicyPage, trustPolicyPages } from "../../lib/trustPolicyContent";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider",
    titleKey: "provider_landing.metadata.title",
    descriptionKey: "provider_landing.metadata.description"
  });
}

const growthPillars = [
  {
    titleKey: "provider_landing.growth.local.title",
    bodyKey: "provider_landing.growth.local.body"
  },
  {
    titleKey: "provider_landing.growth.routes.title",
    bodyKey: "provider_landing.growth.routes.body"
  },
  {
    titleKey: "provider_landing.growth.crew.title",
    bodyKey: "provider_landing.growth.crew.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

const operatingLeverKeys = [
  "provider_landing.operating.lever.provider_app",
  "provider_landing.operating.lever.property_match",
  "provider_landing.operating.lever.calendar",
  "provider_landing.operating.lever.sponsored",
  "provider_landing.operating.lever.reviews",
  "provider_landing.operating.lever.support"
] satisfies TranslationKey[];

const acquisitionChannels = [
  {
    titleKey: "provider_landing.acquisition.marketplace.title",
    bodyKey: "provider_landing.acquisition.marketplace.body"
  },
  {
    titleKey: "provider_landing.acquisition.google.title",
    bodyKey: "provider_landing.acquisition.google.body"
  },
  {
    titleKey: "provider_landing.acquisition.paid.title",
    bodyKey: "provider_landing.acquisition.paid.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

const staffingValue = [
  {
    titleKey: "provider_landing.staffing.supply.title",
    bodyKey: "provider_landing.staffing.supply.body"
  },
  {
    titleKey: "provider_landing.staffing.scale.title",
    bodyKey: "provider_landing.staffing.scale.body"
  },
  {
    titleKey: "provider_landing.staffing.quality.title",
    bodyKey: "provider_landing.staffing.quality.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

const heroChipKeys = [
  "provider_landing.hero.chip.routes",
  "provider_landing.hero.chip.cleanup",
  "provider_landing.hero.chip.google",
  "provider_landing.hero.chip.crew"
] satisfies TranslationKey[];

export default async function ProviderPage() {
  const i18n = await getRequestI18n();
  const href = (path: string) => addLocalePrefix(path, i18n.locale);
  const providerPolicyPages = trustPolicyPages.filter((page) => page.surfaces.includes("provider"));

  return (
    <main>
      <section className="container hero provider-landing-hero">
        <div>
          <span className="eyebrow">{i18n.t("provider_landing.hero.eyebrow")}</span>
          <h1>{i18n.t("provider_landing.hero.title")}</h1>
          <p>{i18n.t("provider_landing.hero.body")}</p>
          <div className="cta-row">
            <a className="button" href={href("/auth/provider/create")}>
              {i18n.t("provider_landing.hero.primary_cta")}
            </a>
            <a className="button-secondary" href={href("/login/provider")}>
              {i18n.t("provider_landing.hero.secondary_cta")}
            </a>
          </div>
          <div className="chip-row" style={{ marginTop: "1.5rem" }}>
            {heroChipKeys.map((key) => (
              <span key={key}>{i18n.t(key)}</span>
            ))}
          </div>
        </div>
        <aside className="panel panel--hero provider-growth-panel">
          <div className="panel__accent" />
          <span className="eyebrow">{i18n.t("provider_landing.panel.eyebrow")}</span>
          <div className="provider-metric-stack">
            <article className="stat-card">
              <strong>{i18n.t("provider_landing.panel.demand.title")}</strong>
              <p>{i18n.t("provider_landing.panel.demand.body")}</p>
            </article>
            <article className="stat-card">
              <strong>{i18n.t("provider_landing.panel.schedule.title")}</strong>
              <p>{i18n.t("provider_landing.panel.schedule.body")}</p>
            </article>
            <article className="stat-card">
              <strong>{i18n.t("provider_landing.panel.labor.title")}</strong>
              <p>{i18n.t("provider_landing.panel.labor.body")}</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("provider_landing.growth.title")}</h2>
          <p>{i18n.t("provider_landing.growth.body")}</p>
        </div>
        <div className="grid-three">
          {growthPillars.map((pillar) => (
            <article className="card" key={pillar.titleKey}>
              <h3>{i18n.t(pillar.titleKey)}</h3>
              <p>{i18n.t(pillar.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="provider-strip">
          <div>
            <span className="eyebrow">{i18n.t("provider_landing.demand.eyebrow")}</span>
            <h2>{i18n.t("provider_landing.demand.title")}</h2>
          </div>
          <p>{i18n.t("provider_landing.demand.body")}</p>
        </div>
        <div className="grid-three">
          {acquisitionChannels.map((channel) => (
            <article className="card" key={channel.titleKey}>
              <h3>{i18n.t(channel.titleKey)}</h3>
              <p>{i18n.t(channel.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("provider_landing.operating.title")}</h2>
          <p>{i18n.t("provider_landing.operating.body")}</p>
        </div>
        <div className="grid-two provider-proof-grid">
          <article className="card">
            <h3>{i18n.t("provider_landing.operating.territory.title")}</h3>
            <p>{i18n.t("provider_landing.operating.territory.body")}</p>
            <ProviderRadiusSettingsCard />
          </article>
          <article className="card">
            <h3>{i18n.t("provider_landing.operating.levers.title")}</h3>
            <ul className="provider-feature-list">
              {operatingLeverKeys.map((key) => (
                <li key={key}>{i18n.t(key)}</li>
              ))}
            </ul>
            <div className="provider-proof-callout">
              <strong>{i18n.t("provider_landing.operating.app.title")}</strong>
              <p>{i18n.t("provider_landing.operating.app.body")}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("provider_landing.staffing.title")}</h2>
          <p>{i18n.t("provider_landing.staffing.body")}</p>
        </div>
        <div className="grid-three">
          {staffingValue.map((item) => (
            <article className="card" key={item.titleKey}>
              <h3>{i18n.t(item.titleKey)}</h3>
              <p>{i18n.t(item.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("provider_landing.standards.title")}</h2>
          <p>{i18n.t("provider_landing.standards.body")}</p>
        </div>
        <div className="grid-two">
          {providerPolicyPages.map((page) => {
            const localizedPage = localizeTrustPolicyPage(i18n, page);

            return (
              <Link className="list-panel" href={href(localizedPage.href)} key={localizedPage.id}>
                <span className="eyebrow">{localizedPage.eyebrow}</span>
                <h3>{localizedPage.title}</h3>
                <p>{localizedPage.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="provider-final-cta panel">
          <div>
            <span className="eyebrow">{i18n.t("provider_landing.final.eyebrow")}</span>
            <h2>{i18n.t("provider_landing.final.title")}</h2>
            <p>{i18n.t("provider_landing.final.body")}</p>
          </div>
          <div className="cta-row">
            <a className="button" href={href("/auth/provider/create")}>
              {i18n.t("provider_landing.final.primary_cta")}
            </a>
            <a className="button-secondary" href={href("/login/provider")}>
              {i18n.t("provider_landing.final.secondary_cta")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
