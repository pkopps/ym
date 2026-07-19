import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/partnerships",
    titleKey: "provider_partnerships.metadata.title",
    descriptionKey: "provider_partnerships.metadata.description"
  });
}

const partnerDeals = [
  {
    brand: "Ford",
    titleKey: "provider_partnerships.deal.truck.title",
    bodyKey: "provider_partnerships.deal.truck.body"
  },
  {
    brand: "Home Depot",
    titleKey: "provider_partnerships.deal.equipment.title",
    bodyKey: "provider_partnerships.deal.equipment.body"
  },
  {
    brand: "YardMatch financing partners",
    titleKey: "provider_partnerships.deal.financing.title",
    bodyKey: "provider_partnerships.deal.financing.body"
  }
] satisfies Array<{ brand: string; titleKey: TranslationKey; bodyKey: TranslationKey }>;

export default async function ProviderPartnershipsPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("provider_partnerships.eyebrow")}</span>
        <h1>{i18n.t("provider_partnerships.hero.title")}</h1>
        <p>{i18n.t("provider_partnerships.hero.body")}</p>
      </section>

      <section className="grid-three">
        {partnerDeals.map((deal) => (
          <article className="card" key={deal.titleKey}>
            <span className="eyebrow">{deal.brand}</span>
            <h2>{i18n.t(deal.titleKey)}</h2>
            <p>{i18n.t(deal.bodyKey)}</p>
          </article>
        ))}
      </section>

      <section className="provider-final-cta panel">
        <div>
          <span className="eyebrow">{i18n.t("provider_partnerships.final.eyebrow")}</span>
          <h2>{i18n.t("provider_partnerships.final.title")}</h2>
          <p>{i18n.t("provider_partnerships.final.body")}</p>
        </div>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/auth/provider/create", i18n.locale)}>
            {i18n.t("provider_partnerships.get_started")}
          </a>
          <a className="button-secondary" href={addLocalePrefix("/provider", i18n.locale)}>
            {i18n.t("provider_partnerships.back")}
          </a>
        </div>
      </section>
    </main>
  );
}
