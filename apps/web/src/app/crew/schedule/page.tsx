import type { Metadata } from "next";
import { CrewScheduleBoard } from "../../../components/CrewScheduleBoard";
import { CrewScheduleMenu } from "../../../components/CrewScheduleMenu";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/crew/schedule",
    titleKey: "crew_schedule.metadata.title",
    descriptionKey: "crew_schedule.metadata.description"
  });
}

export default async function CrewSchedulePage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("crew_schedule.eyebrow")}</span>
            <h1>{i18n.t("crew_schedule.hero.title")}</h1>
            <p>{i18n.t("crew_schedule.hero.body")}</p>
          </div>
          <CrewScheduleMenu />
        </div>
      </section>
      <CrewScheduleBoard />
    </main>
  );
}
