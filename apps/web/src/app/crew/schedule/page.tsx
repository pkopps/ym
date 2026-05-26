import type { Metadata } from "next";
import { CrewScheduleBoard } from "../../../components/CrewScheduleBoard";
import { CrewScheduleMenu } from "../../../components/CrewScheduleMenu";

export const metadata: Metadata = {
  title: "Crew schedule",
  description: "View accepted shifts in calendar and list views, then add them to Apple or Google Calendar."
};

export default function CrewSchedulePage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Crew schedule</span>
            <h1>Your upcoming work.</h1>
            <p>See upcoming shifts and add them to your calendar.</p>
          </div>
          <CrewScheduleMenu />
        </div>
      </section>
      <CrewScheduleBoard />
    </main>
  );
}
