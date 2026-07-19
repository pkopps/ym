import type { Metadata } from "next";
import { CrewHistoryBoard } from "../../../../components/CrewHistoryBoard";
import { CrewScheduleMenu } from "../../../../components/CrewScheduleMenu";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/crew/schedule/history",
    titleKey: "crew_history.metadata.title",
    descriptionKey: "crew_history.metadata.description"
  });
}

export default async function CrewScheduleHistoryPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("crew_schedule.eyebrow")}</span>
            <h1>{i18n.t("crew_history.hero.title")}</h1>
            <p>{i18n.t("crew_history.hero.body")}</p>
          </div>
          <CrewScheduleMenu />
        </div>
      </section>
      <CrewHistoryBoard />
    </main>
  );
}
