"use client";

import { useMemo, useState } from "react";
import { providerCrewMemberSnapshots, providerManagedJobs } from "@yardmatch/ui";

type PortalView = "calendar" | "list";
type PropertyTypeFilter = "all" | "commercial" | "estate" | "hoa" | "homes";
type StaffingFilter = "all" | "covered" | "short";
type SortOption = "date" | "distance" | "crew-needed";

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
  const start = `${startDate.replaceAll("-", "")}T080000`;
  const end = `${startDate.replaceAll("-", "")}T130000`;
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
  const start = `${startDate.replaceAll("-", "")}T080000`;
  const end = `${startDate.replaceAll("-", "")}T130000`;
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

export function ProviderManagementBoard() {
  const [view, setView] = useState<PortalView>("calendar");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeFilter>("all");
  const [staffingFilter, setStaffingFilter] = useState<StaffingFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date");

  const allJobs = useMemo(
    () =>
      providerManagedJobs.map((job) => {
        const missingCrewCount = Math.max(0, job.requiredCrewMembers - job.assignedCrewMembers.length);
        const propertyType: Exclude<PropertyTypeFilter, "all"> =
          job.clientName.includes("Office Park")
            ? "commercial"
            : job.clientName.includes("Estate")
              ? "estate"
              : job.clientName.includes("HOA")
                ? "hoa"
                : "homes";

        return {
          ...job,
          appleUrl: buildAppleCalendarData({
            title: `${job.clientName} - ${job.serviceLabel}`,
            details: `${job.notes} Crew needed: ${job.requiredCrewMembers}. Assigned: ${job.assignedCrewMembers.join(", ") || "Unassigned"}.`,
            location: job.addressLine,
            startDate: job.isoDate
          }),
          googleUrl: buildGoogleCalendarUrl({
            title: `${job.clientName} - ${job.serviceLabel}`,
            details: `${job.notes} Crew needed: ${job.requiredCrewMembers}. Assigned: ${job.assignedCrewMembers.join(", ") || "Unassigned"}.`,
            location: job.addressLine,
            startDate: job.isoDate
          }),
          missingCrewCount,
          propertyType,
          staffingStatus: missingCrewCount > 0 ? "short" : "covered"
        };
      }),
    []
  );

  const jobs = useMemo(() => {
    const filteredJobs = allJobs
      .filter((job) => (propertyTypeFilter === "all" ? true : job.propertyType === propertyTypeFilter))
      .filter((job) => (staffingFilter === "all" ? true : job.staffingStatus === staffingFilter));

    const sortedJobs = [...filteredJobs].sort((leftJob, rightJob) => {
      if (sortBy === "distance") {
        return leftJob.distanceMiles - rightJob.distanceMiles;
      }

      if (sortBy === "crew-needed") {
        return rightJob.requiredCrewMembers - leftJob.requiredCrewMembers;
      }

      return leftJob.isoDate.localeCompare(rightJob.isoDate);
    });

    return sortedJobs;
  }, [allJobs, propertyTypeFilter, staffingFilter, sortBy]);

  const futureJobsCount = jobs.length;
  const totalCrewNeeded = jobs.reduce((total, job) => total + job.requiredCrewMembers, 0);
  const totalAssignedCrew = jobs.reduce((total, job) => total + job.assignedCrewMembers.length, 0);
  const shortfallCount = jobs.reduce((total, job) => total + job.missingCrewCount, 0);
  const shortStaffedJobs = jobs.filter((job) => job.missingCrewCount > 0).length;
  const availableCrewCount = providerCrewMemberSnapshots.length;

  return (
    <div className="stack-lg">
      <section className={`provider-capacity-alert ${shortfallCount > 0 ? "provider-capacity-alert--warning" : "provider-capacity-alert--healthy"}`}>
        <div>
          <span className="eyebrow">Crew balance</span>
          <h2>
            {shortfallCount > 0
              ? `You are short ${shortfallCount} crew member${shortfallCount === 1 ? "" : "s"} across ${shortStaffedJobs} upcoming job${shortStaffedJobs === 1 ? "" : "s"}.`
              : "Your upcoming work is fully staffed."}
          </h2>
          <p>
            {shortfallCount > 0
              ? "Larger properties and cleanup jobs are outpacing your current crew supply. Fill the gap before route quality slips."
              : "Crew supply is matching future demand right now, so you can focus on route quality and follow-through."}
          </p>
        </div>
        <div className="cta-row">
          <a className="button" href="/crew">
            Find crew members
          </a>
          <a className="button-secondary" href="/provider/partnerships">
            Equipment and partner deals
          </a>
        </div>
      </section>

      <section className="provider-filters">
        <div className="provider-filters__group">
          <label className="form-field">
            <span>Property type</span>
            <select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value as PropertyTypeFilter)}>
              <option value="all">All properties</option>
              <option value="homes">Homes</option>
              <option value="estate">Estates</option>
              <option value="hoa">HOA</option>
              <option value="commercial">Commercial</option>
            </select>
          </label>
          <label className="form-field">
            <span>Staffing</span>
            <select value={staffingFilter} onChange={(event) => setStaffingFilter(event.target.value as StaffingFilter)}>
              <option value="all">All jobs</option>
              <option value="short">Short-staffed</option>
              <option value="covered">Fully covered</option>
            </select>
          </label>
          <label className="form-field">
            <span>Sort by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="date">Date</option>
              <option value="distance">Distance</option>
              <option value="crew-needed">Crew needed</option>
            </select>
          </label>
        </div>
        <div className="chip-row">
          <span>{futureJobsCount} jobs in view</span>
          <span>{shortStaffedJobs} short-staffed</span>
          <span>{totalCrewNeeded} crew slots needed</span>
        </div>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{futureJobsCount}</h2>
          <p>Future jobs</p>
        </article>
        <article className="card">
          <h2>{availableCrewCount}</h2>
          <p>Available crew members</p>
        </article>
        <article className="card">
          <h2>{totalCrewNeeded}</h2>
          <p>Total crew slots needed</p>
        </article>
        <article className="card">
          <h2>{totalAssignedCrew}</h2>
          <p>Crew slots already assigned</p>
        </article>
        <article className="card">
          <h2>{shortStaffedJobs}</h2>
          <p>Short-staffed jobs</p>
        </article>
        <article className="card">
          <h2>{shortfallCount}</h2>
          <p>Open crew gap</p>
        </article>
      </section>

      <section className="search-result-title">
        <div>
          <span className="eyebrow">Management portal</span>
          <h2>Upcoming jobs and crew coverage</h2>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Portal view">
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
          {jobs.map((job) => (
            <article className="crew-calendar-card" key={job.id}>
              <div className="crew-calendar-card__date">
                <strong>{job.dayLabel}</strong>
                <span>{job.monthLabel}</span>
              </div>
              <div className="crew-calendar-card__body">
                <div className="provider-job-card__heading">
                  <h3>{job.clientName}</h3>
                  <span
                    className={`provider-staffing-badge ${
                      job.staffingStatus === "short"
                        ? "provider-staffing-badge--warning"
                        : "provider-staffing-badge--healthy"
                    }`}
                  >
                    {job.staffingStatus === "short" ? `Short ${job.missingCrewCount}` : "Covered"}
                  </span>
                </div>
                <p>{job.serviceLabel}</p>
                <p>{job.timeLabel}</p>
                <p>{job.addressLine}</p>
                <p>{job.distanceMiles} mi away • {job.propertySizeLabel}</p>
                <p>
                  Need {job.requiredCrewMembers} crew • Assigned {job.assignedCrewMembers.length}
                </p>
                <div className="cta-row">
                  {job.missingCrewCount > 0 ? (
                    <a className="button" href="/crew">
                      Find crew
                    </a>
                  ) : null}
                  <a className="button-secondary" href={job.googleUrl} rel="noreferrer" target="_blank">
                    Google
                  </a>
                  <a className="button-secondary" download={`${job.id}.ics`} href={job.appleUrl}>
                    Apple
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="stack-lg">
          {jobs.map((job) => (
            <article className="history-card" key={`${job.id}-list`}>
              <div className="history-card__header">
                <div>
                  <span className="eyebrow">{job.dateLabel}</span>
                  <h2>{job.clientName}</h2>
                </div>
                <strong>{job.quoteLabel}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>Service</h3>
                  <p>{job.serviceLabel}</p>
                  <p>{job.notes}</p>
                </div>
                <div>
                  <h3>Property</h3>
                  <p>{job.addressLine}</p>
                  <p>{job.distanceMiles} mi away • {job.propertySizeLabel}</p>
                </div>
                <div>
                  <h3>Crew plan</h3>
                  <p>Need {job.requiredCrewMembers} • Assigned {job.assignedCrewMembers.length}</p>
                  <p>{job.assignedCrewMembers.join(", ") || "No crew assigned yet"}</p>
                </div>
              </div>
              {job.missingCrewCount > 0 ? (
                <div className="provider-job-shortfall">
                  <strong>Staffing gap</strong>
                  <p>
                    This property size and service scope need {job.missingCrewCount} more crew member
                    {job.missingCrewCount === 1 ? "" : "s"}.
                  </p>
                  <div className="cta-row">
                    <a className="button" href="/crew">
                      Find crew members
                    </a>
                    <a className="button-secondary" href={job.googleUrl} rel="noreferrer" target="_blank">
                      Add to Google
                    </a>
                    <a className="button-secondary" download={`${job.id}.ics`} href={job.appleUrl}>
                      Add to Apple
                    </a>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
