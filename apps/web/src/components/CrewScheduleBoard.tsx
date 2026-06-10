"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { crewAssignments } from "@yardmatch/ui";

type ScheduleView = "calendar" | "list";
const calendarStartHour = 6;
const calendarEndHour = 18;
const calendarHourSpan = calendarEndHour - calendarStartHour;

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

function buildGoogleMapsDirectionsUrl(addressLine: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;
}

function buildAppleMapsDirectionsUrl(addressLine: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(addressLine)}`;
}

function parseTimeLabelToRange(timeLabel: string) {
  const [startLabel, endLabel] = timeLabel.split(" - ");
  return {
    startMinutes: parseClockToMinutes(startLabel),
    endMinutes: parseClockToMinutes(endLabel)
  };
}

function parseClockToMinutes(label: string) {
  const [timePart, meridiem] = label.trim().split(" ");
  const [rawHours, rawMinutes] = timePart.split(":").map(Number);
  let hours = rawHours % 12;
  if (meridiem.toUpperCase() === "PM") {
    hours += 12;
  }
  return hours * 60 + rawMinutes;
}

function formatCalendarHour(hour: number) {
  if (hour === 12) {
    return "12 PM";
  }
  if (hour > 12) {
    return `${hour - 12} PM`;
  }
  return `${hour} AM`;
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
        }),
        googleMapsUrl: buildGoogleMapsDirectionsUrl(assignment.addressLine),
        appleMapsUrl: buildAppleMapsDirectionsUrl(assignment.addressLine),
        ...parseTimeLabelToRange(assignment.timeLabel)
      })),
    []
  );

  const calendarDays = useMemo(
    () =>
      assignments
        .slice()
        .sort((left, right) => left.isoDate.localeCompare(right.isoDate))
        .map((assignment) => ({
          isoDate: assignment.isoDate,
          dateLabel: assignment.dateLabel,
          dayLabel: assignment.dayLabel,
          monthLabel: assignment.monthLabel,
          assignments: [assignment]
        })),
    [assignments]
  );

  const timeMarkers = useMemo(
    () =>
      Array.from({ length: calendarHourSpan + 1 }, (_, index) => {
        const hour = calendarStartHour + index;
        return {
          hour,
          label: formatCalendarHour(hour)
        };
      }),
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
        <section className="crew-calendar-board">
          <div className="crew-calendar-board__header">
            <span className="eyebrow">Week view</span>
            <p>Shift cards are placed on a day grid so you can scan when each crew block starts and ends.</p>
          </div>
          <div className="crew-calendar-board__shell">
            <div className="crew-calendar-board__time-rail" aria-hidden="true">
              {timeMarkers.map((marker) => (
                <div className="crew-calendar-board__time-marker" key={marker.hour}>
                  <span>{marker.label}</span>
                </div>
              ))}
            </div>
            <div className="crew-calendar-board__days">
              {calendarDays.map((day) => (
                <article className="crew-calendar-day" key={day.isoDate}>
                  <header className="crew-calendar-day__header">
                    <strong>{day.dayLabel}</strong>
                    <span>{day.monthLabel}</span>
                  </header>
                  <div className="crew-calendar-day__grid" style={{ "--calendar-hours": String(calendarHourSpan) } as CSSProperties}>
                    {timeMarkers.slice(0, -1).map((marker) => (
                      <div className="crew-calendar-day__hour" key={`${day.isoDate}-${marker.hour}`} />
                    ))}
                    {day.assignments.map((assignment) => {
                      const topPercent =
                        ((assignment.startMinutes - calendarStartHour * 60) / (calendarHourSpan * 60)) * 100;
                      const heightPercent =
                        ((assignment.endMinutes - assignment.startMinutes) / (calendarHourSpan * 60)) * 100;

                      return (
                        <div
                          className="crew-calendar-shift"
                          key={assignment.id}
                          style={{
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`
                          }}
                        >
                          <span className="crew-calendar-shift__time">{assignment.timeLabel}</span>
                          <h3>{assignment.businessName}</h3>
                          <p>{assignment.serviceLabel}</p>
                          <p>{assignment.addressLine}</p>
                          <div className="crew-calendar-shift__meta">
                            <span>{assignment.expectedEarnings}</span>
                            <span>{assignment.crewLead}</span>
                          </div>
                          <div className="crew-calendar-shift__actions">
                            <a
                              className="button-secondary crew-mobile-directions"
                              href={assignment.googleMapsUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Google Maps
                            </a>
                            <a
                              className="button-secondary crew-mobile-directions"
                              href={assignment.appleMapsUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Apple Maps
                            </a>
                            <a className="button-secondary" href={assignment.googleUrl} rel="noreferrer" target="_blank">
                              Google
                            </a>
                            <a className="button-secondary" download={`${assignment.id}.ics`} href={assignment.appleUrl}>
                              Apple
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
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
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={assignment.googleMapsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Google Maps
                    </a>
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={assignment.appleMapsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Apple Maps
                    </a>
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
