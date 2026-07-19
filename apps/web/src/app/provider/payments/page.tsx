import type { Metadata } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { ProviderPaymentsBoard } from "../../../components/ProviderPaymentsBoard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/payments",
    titleKey: "provider_payments.metadata.title",
    descriptionKey: "provider_payments.metadata.description"
  });
}

export default async function ProviderPaymentsPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("provider_payments.eyebrow")}</span>
            <h1>{i18n.t("provider_payments.hero.title")}</h1>
            <p>{i18n.t("provider_payments.hero.body")}</p>
          </div>
          <div className="cta-row">
            <a className="button" href={addLocalePrefix("/provider/management", i18n.locale)}>
              {i18n.t("provider_payments.open_management")}
            </a>
            <a className="button-secondary" href={addLocalePrefix("/provider", i18n.locale)}>
              {i18n.t("provider_management.back")}
            </a>
          </div>
        </div>
      </section>

      <ProviderPaymentsBoard />
    </main>
  );
}
