"use client";

import { CrewMatchSummary } from "@yardmatch/contracts";
import { addLocalePrefix, type I18nInstance } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { LoadingSkeleton } from "./LoadingSkeleton";

type ScheduleView = "calendar" | "list";

function formatDateLabel(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeRange(i18n: I18nInstance, startIso: string, endIso: string) {
  const start = i18n.formatDate(startIso, {
    hour: "numeric",
    minute: "2-digit"
  });
  const end = i18n.formatDate(endIso, {
    hour: "numeric",
    minute: "2-digit"
  });
  return `${start} - ${end}`;
}

function buildGoogleMapsDirectionsUrl(addressLine: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;
}

function buildAppleMapsDirectionsUrl(addressLine: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(addressLine)}`;
}

export function CrewScheduleBoard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [view, setView] = useState<ScheduleView>("calendar");
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [acceptedMatches, setAcceptedMatches] = useState<CrewMatchSummary[]>([]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }

    setAccessDenied(false);

    void (async () => {
      try {
        const api = createAuthenticatedWebApiClient();
        const response = await api.getCrewMatches();
        setAcceptedMatches(
          response.matches
            .filter((match) => match.status === "accepted")
            .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_schedule.board.load_error"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [i18n, sessionReady, session?.role, session?.token]);

  const plannedHours = useMemo(
    () =>
      acceptedMatches.reduce((total, match) => {
        const durationHours =
          (Date.parse(match.scheduledEndIso) - Date.parse(match.scheduledStartIso)) / (60 * 60 * 1000);
        return total + Math.max(durationHours, 0);
      }, 0),
    [acceptedMatches]
  );
  const expectedEarnings = useMemo(
    () =>
      acceptedMatches.reduce((total, match) => {
        const durationHours =
          (Date.parse(match.scheduledEndIso) - Date.parse(match.scheduledStartIso)) / (60 * 60 * 1000);
        return total + Math.max(durationHours, 0) * (match.hourlyRateCents / 100);
      }, 0),
    [acceptedMatches]
  );
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, CrewMatchSummary[]>();
    for (const match of acceptedMatches) {
      const key = match.scheduledStartIso.slice(0, 10);
      const next = groups.get(key) ?? [];
      next.push(match);
      groups.set(key, next);
    }

    return [...groups.entries()].map(([date, matches]) => ({
      date,
      label: formatDateLabel(i18n, matches[0]?.scheduledStartIso ?? date),
      matches
    }));
  }, [acceptedMatches, i18n]);

  if (!sessionReady || (!accessDenied && isLoading && acceptedMatches.length === 0 && !errorMessage)) {
    return (
      <LoadingSkeleton cardCount={3} className="grid-three" label={i18n.t("crew_schedule.board.loading")} showAction />
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("crew_schedule.board.login_required")}</h2>
        <p>{i18n.t("crew_schedule.board.login_body")}</p>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/login/crew", i18n.locale)}>
            {i18n.t("crew_schedule.board.login_cta")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("common.state.needs_attention")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{plannedHours.toFixed(1)}</h2>
          <p>{i18n.t("crew_schedule.board.metric.planned_hours")}</p>
        </article>
        <article className="card">
          <h2>{i18n.formatCurrency(Math.round(expectedEarnings * 100))}</h2>
          <p>{i18n.t("crew_schedule.board.metric.expected_earnings")}</p>
        </article>
        <article className="card">
          <h2>{acceptedMatches.length}</h2>
          <p>{i18n.t("crew_schedule.board.metric.accepted_shifts")}</p>
        </article>
      </section>

      <section className="search-result-title">
        <div>
          <span className="eyebrow">{i18n.t("crew_schedule.board.eyebrow")}</span>
          <h2>{i18n.t("crew_schedule.board.upcoming_work")}</h2>
        </div>
        <div className="view-toggle" role="tablist" aria-label={i18n.t("crew_schedule.board.view_aria")}>
          <button
            className={view === "calendar" ? "button" : "button-secondary"}
            onClick={() => setView("calendar")}
            type="button"
          >
            {i18n.t("crew_schedule.board.view.day_groups")}
          </button>
          <button
            className={view === "list" ? "button" : "button-secondary"}
            onClick={() => setView("list")}
            type="button"
          >
            {i18n.t("crew_schedule.board.view.full_list")}
          </button>
        </div>
      </section>

      {acceptedMatches.length === 0 ? (
        <section className="card">
          <h2>{i18n.t("crew_schedule.board.empty.title")}</h2>
          <p>{i18n.t("crew_schedule.board.empty.body")}</p>
        </section>
      ) : view === "calendar" ? (
        <section className="stack-lg">
          {groupedMatches.map((group) => (
            <article className="card" key={group.date}>
              <div className="search-result-title">
                <div>
                  <span className="eyebrow">{group.label}</span>
                  <h2>{i18n.t("crew_schedule.board.scheduled_stop_count", { count: group.matches.length })}</h2>
                </div>
              </div>
              <div className="stack-lg" style={{ paddingBottom: 0 }}>
                {group.matches.map((match) => (
                  <article className="list-panel" key={match.id}>
                    <div className="search-result-title">
                      <div>
                        <h3>{match.providerCompanyName}</h3>
                        <p>{(match.serviceCategories?.length ? match.serviceCategories : [match.category]).map(category => category.replaceAll("-", " ")).join(" · ")}</p>
                      </div>
                      <strong>{formatTimeRange(i18n, match.scheduledStartIso, match.scheduledEndIso)}</strong>
                    </div>
                    <p>{match.serviceAddress.line1}</p>
                    <p>
                      {match.serviceAddress.city}, {match.serviceAddress.state}{" "}
                      {match.serviceAddress.postalCode}
                    </p>
                    <p>{match.summary}</p>
                    <div className="cta-row">
                      <a
                        className="button-secondary crew-mobile-directions"
                        href={buildGoogleMapsDirectionsUrl(match.serviceAddress.line1)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {i18n.t("common.maps.google")}
                      </a>
                      <a
                        className="button-secondary crew-mobile-directions"
                        href={buildAppleMapsDirectionsUrl(match.serviceAddress.line1)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {i18n.t("common.maps.apple")}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="stack-lg">
          {acceptedMatches.map((match) => (
            <article className="history-card" key={match.id}>
              <div className="history-card__header">
                <div>
                  <span className="eyebrow">{formatDateLabel(i18n, match.scheduledStartIso)}</span>
                  <h2>{match.providerCompanyName}</h2>
                </div>
                <strong>{formatTimeRange(i18n, match.scheduledStartIso, match.scheduledEndIso)}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>{i18n.t("crew_schedule.board.work")}</h3>
                  <p>{(match.serviceCategories?.length ? match.serviceCategories : [match.category]).map(category => category.replaceAll("-", " ")).join(" · ")}</p>
                  <p>{match.summary}</p>
                </div>
                <div>
                  <h3>{i18n.t("crew_schedule.board.route")}</h3>
                  <p>{match.serviceAddress.line1}</p>
                  <p>
                    {match.serviceAddress.city}, {match.serviceAddress.state}{" "}
                    {match.serviceAddress.postalCode}
                  </p>
                </div>
                <div>
                  <h3>{i18n.t("crew_schedule.board.status")}</h3>
                  <p>{match.bookingStatus.replaceAll("-", " ")}</p>
                  <p>{i18n.t("crew_schedule.board.hour_rate", { rate: i18n.formatCurrency(match.hourlyRateCents) })}</p>
                  <div className="cta-row">
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={buildGoogleMapsDirectionsUrl(match.serviceAddress.line1)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {i18n.t("common.maps.google")}
                    </a>
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={buildAppleMapsDirectionsUrl(match.serviceAddress.line1)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {i18n.t("common.maps.apple")}
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
