import type { Metadata } from "next";
import { crewAssignmentHistory } from "@yardmatch/ui";
import { CrewScheduleMenu } from "../../../../components/CrewScheduleMenu";

export const metadata: Metadata = {
  title: "Past crew job history",
  description: "Review completed crew shifts, hours, pay, and work details."
};

export default function CrewScheduleHistoryPage() {
  const totalHistoryHours = crewAssignmentHistory.reduce(
    (total, assignment) => total + assignment.plannedHours,
    0
  );
  const totalHistoryEarnings = crewAssignmentHistory.reduce((total, assignment) => {
    const numeric = Number(assignment.expectedEarnings.replace(/[^0-9.]/g, ""));
    return total + numeric;
  }, 0);
  const taxExportRows = [
    ["Date", "Business", "Service", "Hours", "Earnings", "Crew Lead", "Location"],
    ...crewAssignmentHistory.map((assignment) => [
      assignment.isoDate,
      assignment.businessName,
      assignment.serviceLabel,
      String(assignment.plannedHours),
      assignment.expectedEarnings.replace(/[^0-9.]/g, ""),
      assignment.crewLead,
      assignment.addressLine
    ])
  ];
  const taxExportCsv = taxExportRows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const taxExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(taxExportCsv)}`;

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

      <section className="grid-three">
        <article className="card">
          <h2>{totalHistoryHours}</h2>
          <p>Hours worked</p>
        </article>
        <article className="card">
          <h2>${totalHistoryEarnings}</h2>
          <p>Earnings from completed work</p>
        </article>
        <article className="card">
          <h2>{crewAssignmentHistory.length}</h2>
          <p>Completed shifts</p>
        </article>
      </section>

      <section className="card">
        <div className="search-result-title">
          <div>
            <h2>Tax-friendly export</h2>
            <p>Download your completed work and earnings as a CSV.</p>
          </div>
          <div className="cta-row">
            <a
              className="button"
              download="yardmatch-crew-earnings-2026.csv"
              href={taxExportHref}
            >
              Export CSV
            </a>
          </div>
        </div>
        <div className="chip-row">
          <span>2026 earnings: ${totalHistoryEarnings}</span>
          <span>2026 hours: {totalHistoryHours}</span>
          <span>{crewAssignmentHistory.length} completed shifts</span>
        </div>
      </section>

      <section className="stack-lg">
        {crewAssignmentHistory.map((assignment) => (
          <article className="history-card" key={assignment.id}>
            <div className="history-card__header">
              <div>
                <span className="eyebrow">{assignment.dateLabel}</span>
                <h2>{assignment.businessName}</h2>
              </div>
              <strong>{assignment.expectedEarnings}</strong>
            </div>
            <div className="history-card__grid">
              <div>
                <h3>Work</h3>
                <p>{assignment.serviceLabel}</p>
                <p>{assignment.notes}</p>
              </div>
              <div>
                <h3>Shift</h3>
                <p>{assignment.timeLabel}</p>
                <p>{assignment.plannedHours} hours</p>
              </div>
              <div>
                <h3>Lead and location</h3>
                <p>{assignment.crewLead}</p>
                <p>{assignment.addressLine}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
