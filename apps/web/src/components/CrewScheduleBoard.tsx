"use client";

import { CrewMatchSummary } from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

type ScheduleView = "calendar" | "list";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
  const end = new Date(endIso).toLocaleTimeString(undefined, {
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
  const { session, sessionReady } = useStoredWebSession();
  const [view, setView] = useState<ScheduleView>("calendar");
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [acceptedMatches, setAcceptedMatches] = useState<CrewMatchSummary[]>([]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
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
        setErrorMessage(error instanceof Error ? error.message : "Unable to load your schedule right now.");
      }
    })();
  }, [sessionReady, session?.role, session?.token]);

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
      label: formatDateLabel(matches[0]?.scheduledStartIso ?? date),
      matches
    }));
  }, [acceptedMatches]);

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>Loading your schedule...</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Crew member login required</h2>
        <p>Log in to see accepted shifts, route details, and directions.</p>
        <div className="cta-row">
          <a className="button" href="/login/crew">
            Go to crew login
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>Something needs attention</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{plannedHours.toFixed(1)}</h2>
          <p>Planned hours</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(Math.round(expectedEarnings * 100))}</h2>
          <p>Expected earnings</p>
        </article>
        <article className="card">
          <h2>{acceptedMatches.length}</h2>
          <p>Accepted shifts</p>
        </article>
      </section>

      <section className="search-result-title">
        <div>
          <span className="eyebrow">Live crew schedule</span>
          <h2>Upcoming work</h2>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Schedule view">
          <button
            className={view === "calendar" ? "button" : "button-secondary"}
            onClick={() => setView("calendar")}
            type="button"
          >
            Day groups
          </button>
          <button
            className={view === "list" ? "button" : "button-secondary"}
            onClick={() => setView("list")}
            type="button"
          >
            Full list
          </button>
        </div>
      </section>

      {acceptedMatches.length === 0 ? (
        <section className="card">
          <h2>No accepted shifts yet</h2>
          <p>Once a provider accepts you for a job, it will show up here automatically.</p>
        </section>
      ) : view === "calendar" ? (
        <section className="stack-lg">
          {groupedMatches.map((group) => (
            <article className="card" key={group.date}>
              <div className="search-result-title">
                <div>
                  <span className="eyebrow">{group.label}</span>
                  <h2>{group.matches.length} scheduled stop{group.matches.length === 1 ? "" : "s"}</h2>
                </div>
              </div>
              <div className="stack-lg" style={{ paddingBottom: 0 }}>
                {group.matches.map((match) => (
                  <article className="list-panel" key={match.id}>
                    <div className="search-result-title">
                      <div>
                        <h3>{match.providerCompanyName}</h3>
                        <p>{match.category.replaceAll("-", " ")}</p>
                      </div>
                      <strong>{formatTimeRange(match.scheduledStartIso, match.scheduledEndIso)}</strong>
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
                        Google Maps
                      </a>
                      <a
                        className="button-secondary crew-mobile-directions"
                        href={buildAppleMapsDirectionsUrl(match.serviceAddress.line1)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Apple Maps
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
                  <span className="eyebrow">{formatDateLabel(match.scheduledStartIso)}</span>
                  <h2>{match.providerCompanyName}</h2>
                </div>
                <strong>{formatTimeRange(match.scheduledStartIso, match.scheduledEndIso)}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>Work</h3>
                  <p>{match.category.replaceAll("-", " ")}</p>
                  <p>{match.summary}</p>
                </div>
                <div>
                  <h3>Route</h3>
                  <p>{match.serviceAddress.line1}</p>
                  <p>
                    {match.serviceAddress.city}, {match.serviceAddress.state}{" "}
                    {match.serviceAddress.postalCode}
                  </p>
                </div>
                <div>
                  <h3>Status</h3>
                  <p>{match.bookingStatus.replaceAll("-", " ")}</p>
                  <p>{formatCurrency(match.hourlyRateCents)}/hour</p>
                  <div className="cta-row">
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={buildGoogleMapsDirectionsUrl(match.serviceAddress.line1)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Google Maps
                    </a>
                    <a
                      className="button-secondary crew-mobile-directions"
                      href={buildAppleMapsDirectionsUrl(match.serviceAddress.line1)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Apple Maps
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
