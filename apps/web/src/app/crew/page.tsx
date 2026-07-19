import type { Metadata } from "next";
import { CrewLiveDashboard } from "../../components/CrewLiveDashboard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/crew",
    titleKey: "crew_dashboard.metadata.title",
    descriptionKey: "crew_dashboard.metadata.description"
  });
}

export default async function CrewPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>{i18n.t("crew_dashboard.hero.title")}</h1>
      </section>
      <CrewLiveDashboard />
    </main>
  );
}
