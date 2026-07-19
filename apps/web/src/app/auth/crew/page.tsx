import type { Metadata } from "next";
import { CrewSignupExperience } from "../../../components/CrewSignupExperience";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/auth/crew",
    titleKey: "auth_crew.metadata.title"
  });
}

export default async function CrewSignupPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("auth_crew.eyebrow")}</span>
        <h1>{i18n.t("auth_crew.title")}</h1>
        <p>{i18n.t("auth_crew.body")}</p>
      </section>

      <CrewSignupExperience />
    </main>
  );
}
