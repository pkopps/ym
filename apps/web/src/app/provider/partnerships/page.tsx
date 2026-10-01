import type { Metadata } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/partnerships",
    titleKey: "provider_partnerships.metadata.title",
    descriptionKey: "provider_partnerships.metadata.description"
  });
}

export default async function ProviderPartnershipsPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("provider_partnerships.eyebrow")}</span>
        <h1>{i18n.t("provider_partnerships.hero.title")}</h1>
        <p>{i18n.t("provider_partnerships.hero.body")}</p>
      </section>

      <div className="cta-row">
        <a className="button" href={addLocalePrefix("/auth/provider/create", i18n.locale)}>
          {i18n.t("provider_partnerships.get_started")}
        </a>
        <a className="button-secondary" href={addLocalePrefix("/provider", i18n.locale)}>
          {i18n.t("provider_partnerships.back")}
        </a>
      </div>
    </main>
  );
}
