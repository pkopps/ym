import type { Metadata } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { ProviderLiveManagementBoard } from "../../../components/ProviderLiveManagementBoard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/management",
    titleKey: "provider_management.metadata.title",
    descriptionKey: "provider_management.metadata.description"
  });
}

export default async function ProviderManagementPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <h1>{i18n.t("provider_management.hero.title")}</h1>
            <p>{i18n.t("provider_management.hero.body")}</p>
          </div>
          <div className="cta-row">
            <a className="button-secondary" href={addLocalePrefix("/provider/clients", i18n.locale)}>{i18n.t("provider_clients.nav")}</a>
            <a className="button" href={addLocalePrefix("/crew", i18n.locale)}>
              {i18n.t("provider_management.find_crew")}
            </a>
            <a className="button-secondary" href={addLocalePrefix("/provider", i18n.locale)}>
              {i18n.t("provider_management.back")}
            </a>
          </div>
        </div>
      </section>

      <ProviderLiveManagementBoard />
    </main>
  );
}
