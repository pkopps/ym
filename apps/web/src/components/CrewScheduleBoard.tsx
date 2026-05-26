"use client";

import { useMemo, useState } from "react";
import { crewAssignments } from "@yardmatch/ui";

type ScheduleView = "calendar" | "list";

function buildGoogleCalendarUrl({
  title,
  details,
  location,
  startDate
}: {
  title: string;
  details: string;
  location: string;
  startDate: string;
}) {
  const start = `${startDate.replaceAll("-", "")}T070000`;
  const end = `${startDate.replaceAll("-", "")}T150000`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    location,
    dates: `${start}/${end}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildAppleCalendarData({
  title,
  details,
  location,
  startDate
}: {
  title: string;
  details: string;
  location: string;
  startDate: string;
}) {
  const start = `${startDate.replaceAll("-", "")}T070000`;
  const end = `${startDate.replaceAll("-", "")}T150000`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function CrewScheduleBoard() {
  const [view, setView] = useState<ScheduleView>("calendar");

  const assignments = useMemo(
    () =>
      crewAssignments.map((assignment) => ({
        ...assignment,
        googleUrl: buildGoogleCalendarUrl({
          title: `${assignment.businessName} - ${assignment.serviceLabel}`,
          details: `${assignment.notes} Crew lead: ${assignment.crewLead}. ${assignment.equipmentLabel}.`,
          location: assignment.addressLine,
          startDate: assignment.isoDate
        }),
        appleUrl: buildAppleCalendarData({
          title: `${assignment.businessName} - ${assignment.serviceLabel}`,
          details: `${assignment.notes} Crew lead: ${assignment.crewLead}. ${assignment.equipmentLabel}.`,
          location: assignment.addressLine,
          startDate: assignment.isoDate
        })
      })),
    []
  );

  const plannedHours = assignments.reduce((total, assignment) => total + assignment.plannedHours, 0);
  const expectedEarnings = assignments.reduce((total, assignment) => {
    const numeric = Number(assignment.expectedEarnings.replace(/[^0-9.]/g, ""));
    return total + numeric;
  }, 0);

  return (
    <div className="stack-lg">
      <section className="grid-three">
        <article className="card">
          <h2>{plannedHours}</h2>
          <p>Planned hours</p>
        </article>
        <article className="card">
          <h2>${expectedEarnings}</h2>
          <p>Expected earnings</p>
        </article>
        <article className="card">
          <h2>{assignments.length}</h2>
          <p>Upcoming shifts</p>
        </article>
      </section>

      <section className="search-result-title">
        <div>
          <span className="eyebrow">Your upcoming work</span>
          <h2>Schedule</h2>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Schedule view">
          <button
            className={view === "calendar" ? "button" : "button-secondary"}
            onClick={() => setView("calendar")}
            type="button"
          >
            Calendar view
          </button>
          <button
            className={view === "list" ? "button" : "button-secondary"}
            onClick={() => setView("list")}
            type="button"
          >
            List view
          </button>
        </div>
      </section>

      {view === "calendar" ? (
        <section className="crew-schedule-grid">
          {assignments.map((assignment) => (
            <article className="crew-calendar-card" key={assignment.id}>
              <div className="crew-calendar-card__date">
                <strong>{assignment.dayLabel}</strong>
                <span>{assignment.monthLabel}</span>
              </div>
              <div className="crew-calendar-card__body">
                <h3>{assignment.businessName}</h3>
                <p>{assignment.serviceLabel}</p>
                <p>{assignment.timeLabel}</p>
                <p>{assignment.addressLine}</p>
                <div className="cta-row">
                  <a className="button-secondary" href={assignment.googleUrl} rel="noreferrer" target="_blank">
                    Add to Google
                  </a>
                  <a className="button-secondary" download={`${assignment.id}.ics`} href={assignment.appleUrl}>
                    Add to Apple
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="stack-lg">
          {assignments.map((assignment) => (
            <article className="history-card" key={`${assignment.id}-list`}>
              <div className="history-card__header">
                <div>
                  <span className="eyebrow">{assignment.dateLabel}</span>
                  <h2>{assignment.businessName}</h2>
                </div>
                <strong>{assignment.timeLabel}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>Work</h3>
                  <p>{assignment.serviceLabel}</p>
                  <p>{assignment.notes}</p>
                </div>
                <div>
                  <h3>Crew lead</h3>
                  <p>{assignment.crewLead}</p>
                  <p>{assignment.equipmentLabel}</p>
                </div>
                <div>
                  <h3>Location</h3>
                  <p>{assignment.addressLine}</p>
                  <div className="cta-row">
                    <a className="button-secondary" href={assignment.googleUrl} rel="noreferrer" target="_blank">
                      Google
                    </a>
                    <a className="button-secondary" download={`${assignment.id}.ics`} href={assignment.appleUrl}>
                      Apple
                    </a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
