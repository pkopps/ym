import type { Metadata } from "next";
import { CrewHistoryBoard } from "../../../../components/CrewHistoryBoard";
import { CrewScheduleMenu } from "../../../../components/CrewScheduleMenu";

export const metadata: Metadata = {
  title: "Past crew job history",
  description: "Review completed crew shifts, hours, pay, and work details."
};

export default function CrewScheduleHistoryPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Crew schedule</span>
            <h1>Past job history.</h1>
            <p>Review completed work, hours, and pay.</p>
          </div>
          <CrewScheduleMenu />
        </div>
      </section>
      <CrewHistoryBoard />
    </main>
  );
}
