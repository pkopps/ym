"use client";

import { useMemo, useState } from "react";
import { providerCrewMemberSnapshots, providerManagedJobs } from "@yardmatch/ui";
import { useI18n } from "@yardmatch/i18n/react";

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
  const i18n = useI18n();
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
          <span className="eyebrow">{i18n.t("ops_auto.provider_management_board.crew_balance_xu3zk3")}</span>
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
            {i18n.t("ops_auto.provider_management_board.find_crew_members_zz96p")} </a>
          <a className="button-secondary" href="/provider/partnerships">
            {i18n.t("ops_auto.provider_management_board.equipment_and_partner_deals_rtdaq4")} </a>
        </div>
      </section>

      <section className="provider-filters">
        <div className="provider-filters__group">
          <label className="form-field">
            <span>{i18n.t("ops_auto.provider_management_board.property_type_4luyyj")}</span>
            <select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value as PropertyTypeFilter)}>
              <option value="all">{i18n.t("ops_auto.provider_management_board.all_properties_rhn1zi")}</option>
              <option value="homes">{i18n.t("ops_auto.provider_management_board.homes_15mdlg")}</option>
              <option value="estate">{i18n.t("ops_auto.provider_management_board.estates_3kfu6f")}</option>
              <option value="hoa">HOA</option>
              <option value="commercial">{i18n.t("ops_auto.provider_management_board.commercial_n50qs6")}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.provider_management_board.staffing_mnmtcy")}</span>
            <select value={staffingFilter} onChange={(event) => setStaffingFilter(event.target.value as StaffingFilter)}>
              <option value="all">{i18n.t("ops_auto.provider_management_board.all_jobs_tubf6d")}</option>
              <option value="short">{i18n.t("ops_auto.provider_management_board.short_staffed_e5dyia")}</option>
              <option value="covered">{i18n.t("ops_auto.provider_management_board.fully_covered_7gnaao")}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.provider_management_board.sort_by_5yc0zr")}</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="date">{i18n.t("ops_auto.provider_management_board.date_19hvy")}</option>
              <option value="distance">{i18n.t("ops_auto.provider_management_board.distance_5u88ph")}</option>
              <option value="crew-needed">{i18n.t("ops_auto.provider_management_board.crew_needed_6t43po")}</option>
            </select>
          </label>
        </div>
        <div className="chip-row">
          <span>{futureJobsCount} {i18n.t("ops_auto.provider_management_board.jobs_in_view_khje2e")}</span>
          <span>{shortStaffedJobs} short-staffed</span>
          <span>{totalCrewNeeded} {i18n.t("ops_auto.provider_management_board.crew_slots_needed_lz72ov")}</span>
        </div>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{futureJobsCount}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.future_jobs_i9rvcj")}</p>
        </article>
        <article className="card">
          <h2>{availableCrewCount}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.available_crew_members_w7solr")}</p>
        </article>
        <article className="card">
          <h2>{totalCrewNeeded}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.total_crew_slots_needed_en9o65")}</p>
        </article>
        <article className="card">
          <h2>{totalAssignedCrew}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.crew_slots_already_assigned_e48dy8")}</p>
        </article>
        <article className="card">
          <h2>{shortStaffedJobs}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.short_staffed_jobs_68f0vc")}</p>
        </article>
        <article className="card">
          <h2>{shortfallCount}</h2>
          <p>{i18n.t("ops_auto.provider_management_board.open_crew_gap_picqk3")}</p>
        </article>
      </section>

      <section className="search-result-title">
        <div>
          <span className="eyebrow">{i18n.t("ops_auto.provider_management_board.management_portal_9up5br")}</span>
          <h2>{i18n.t("ops_auto.provider_management_board.upcoming_jobs_and_crew_coverage_klf61k")}</h2>
        </div>
        <div className="view-toggle" role="tablist" aria-label={i18n.t("ops_auto.provider_management_board.portal_view_mkcng9")}>
          <button
            className={view === "calendar" ? "button" : "button-secondary"}
            onClick={() => setView("calendar")}
            type="button"
          >
            {i18n.t("ops_auto.provider_management_board.calendar_view_qb80yh")} </button>
          <button
            className={view === "list" ? "button" : "button-secondary"}
            onClick={() => setView("list")}
            type="button"
          >
            {i18n.t("ops_auto.provider_management_board.list_view_bxpzgn")} </button>
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
                <p>{job.distanceMiles} {i18n.t("ops_auto.provider_management_board.mi_away_1j7q0k")} {job.propertySizeLabel}</p>
                <p>
                  {i18n.t("ops_auto.provider_management_board.need_1fyd2")} {job.requiredCrewMembers} {i18n.t("ops_auto.provider_management_board.crew_assigned_kvun5h")} {job.assignedCrewMembers.length}
                </p>
                <div className="cta-row">
                  {job.missingCrewCount > 0 ? (
                    <a className="button" href="/crew">
                      {i18n.t("ops_auto.provider_management_board.find_crew_vqvb94")} </a>
                  ) : null}
                  <a className="button-secondary" href={job.googleUrl} rel="noreferrer" target="_blank">
                    {i18n.t("ops_auto.provider_management_board.google_zd9eft")} </a>
                  <a className="button-secondary" download={`${job.id}.ics`} href={job.appleUrl}>
                    {i18n.t("ops_auto.provider_management_board.apple_11sit6")} </a>
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
                  <h3>{i18n.t("ops_auto.provider_management_board.service_aopgtn")}</h3>
                  <p>{job.serviceLabel}</p>
                  <p>{job.notes}</p>
                </div>
                <div>
                  <h3>{i18n.t("ops_auto.provider_management_board.property_fcswzv")}</h3>
                  <p>{job.addressLine}</p>
                  <p>{job.distanceMiles} {i18n.t("ops_auto.provider_management_board.mi_away_1j7q0k")} {job.propertySizeLabel}</p>
                </div>
                <div>
                  <h3>{i18n.t("ops_auto.provider_management_board.crew_plan_iuqpi0")}</h3>
                  <p>{i18n.t("ops_auto.provider_management_board.need_1fyd2")} {job.requiredCrewMembers} {i18n.t("ops_auto.provider_management_board.assigned_66aofg")} {job.assignedCrewMembers.length}</p>
                  <p>{job.assignedCrewMembers.join(", ") || "No crew assigned yet"}</p>
                </div>
              </div>
              {job.missingCrewCount > 0 ? (
                <div className="provider-job-shortfall">
                  <strong>{i18n.t("ops_auto.provider_management_board.staffing_gap_vbt594")}</strong>
                  <p>
                    {i18n.t("ops_auto.provider_management_board.this_property_size_and_service_scope_need_tr9x1w")} {job.missingCrewCount} {i18n.t("ops_auto.provider_management_board.more_crew_member_b66sxa")} {job.missingCrewCount === 1 ? "" : "s"}.
                  </p>
                  <div className="cta-row">
                    <a className="button" href="/crew">
                      {i18n.t("ops_auto.provider_management_board.find_crew_members_zz96p")} </a>
                    <a className="button-secondary" href={job.googleUrl} rel="noreferrer" target="_blank">
                      {i18n.t("ops_auto.provider_management_board.add_to_google_sk5d1d")} </a>
                    <a className="button-secondary" download={`${job.id}.ics`} href={job.appleUrl}>
                      {i18n.t("ops_auto.provider_management_board.add_to_apple_lwff2s")} </a>
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
