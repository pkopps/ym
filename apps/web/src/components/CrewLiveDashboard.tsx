"use client";

import {
  CrewAvailabilityDay,
  CrewMatchesResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

const allDays: CrewAvailabilityDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const skillOptions: ServiceCategory[] = [
  "lawn-mowing",
  "hedge-trimming",
  "mulch-installation",
  "seasonal-cleanup",
  "weed-control",
  "leaf-blowing",
  "snow-shoveling"
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function CrewLiveDashboard() {
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  const crewMember = matchesResponse?.crewMember;
  const matches = matchesResponse?.matches ?? [];
  const acceptedMatches = useMemo(
    () => matches.filter((match) => match.status === "accepted"),
    [matches]
  );

  async function loadCrewView() {
    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
    const api = createAuthenticatedWebApiClient();
    const nextMatches = await api.getCrewMatches();
    setMatchesResponse(nextMatches);
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
      return;
    }

    void loadCrewView().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the crew dashboard.");
    });
  }, [sessionReady, session?.token, session?.role]);

  async function handleSavePreferences(next: {
    availableWeekdays?: CrewAvailabilityDay[];
    categories?: ServiceCategory[];
    willingToTravelMiles?: number;
    winterWorkEnabled?: boolean;
  }) {
    if (!crewMember) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.updateCrewPreferences({
        availableWeekdays: next.availableWeekdays ?? crewMember.availableWeekdays,
        categories: next.categories ?? crewMember.categories,
        willingToTravelMiles: next.willingToTravelMiles ?? crewMember.willingToTravelMiles,
        preferredSchedule: crewMember.preferredSchedule,
        hasOwnEquipment: crewMember.hasOwnEquipment,
        winterWorkEnabled: next.winterWorkEnabled ?? crewMember.winterWorkEnabled
      });
      setStatusMessage("Availability updated.");
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update preferences.");
    } finally {
      setIsWorking(false);
    }
  }

  async function startWork(bookingId: string) {
    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.startBooking({ bookingId });
      setStatusMessage("Work started. The business owner can now treat this booking as in progress.");
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start this booking.");
    } finally {
      setIsWorking(false);
    }
  }

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>Loading your crew dashboard...</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Crew member login required</h2>
        <p>Use the seeded crew account to test live staffing matches and chat.</p>
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
      {statusMessage ? (
        <section className="card">
          <h2>Updated</h2>
          <p>{statusMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <h2>Something needs attention</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{matches.length}</h2>
          <p>Matched jobs</p>
        </article>
        <article className="card">
          <h2>{acceptedMatches.length}</h2>
          <p>Accepted jobs</p>
        </article>
        <article className="card">
          <h2>{crewMember?.willingToTravelMiles ?? 0}</h2>
          <p>Travel miles</p>
        </article>
      </section>

      <section className="card">
        <div className="search-result-title">
          <div>
            <h2>{crewMember?.fullName}</h2>
            <p>Keep skills and availability current so providers match you automatically.</p>
          </div>
        </div>
        <div className="chip-row">
          {skillOptions.map((skill) => {
            const active = crewMember?.categories.includes(skill);
            return (
              <button
                className={active ? "button" : "button-secondary"}
                disabled={isWorking || !crewMember}
                key={skill}
                onClick={() =>
                  void handleSavePreferences({
                    categories: active
                      ? crewMember!.categories.filter((category) => category !== skill)
                      : [...(crewMember?.categories ?? []), skill]
                  })
                }
                type="button"
              >
                {skill.replaceAll("-", " ")}
              </button>
            );
          })}
        </div>
        <div className="chip-row">
          {allDays.map((day) => {
            const active = crewMember?.availableWeekdays?.includes(day);
            return (
              <button
                className={active ? "button" : "button-secondary"}
                disabled={isWorking || !crewMember}
                key={day}
                onClick={() =>
                  void handleSavePreferences({
                    availableWeekdays: active
                      ? (crewMember?.availableWeekdays ?? []).filter((item) => item !== day)
                      : [...(crewMember?.availableWeekdays ?? []), day]
                  })
                }
                type="button"
              >
                {day}
              </button>
            );
          })}
        </div>
        <div className="cta-row">
          <button
            className="button-secondary"
            disabled={isWorking || !crewMember}
            onClick={() =>
              void handleSavePreferences({
                willingToTravelMiles: Math.max(5, (crewMember?.willingToTravelMiles ?? 20) - 5)
              })
            }
            type="button"
          >
            -5 miles
          </button>
          <span>{crewMember?.willingToTravelMiles ?? 0} miles</span>
          <button
            className="button-secondary"
            disabled={isWorking || !crewMember}
            onClick={() =>
              void handleSavePreferences({
                willingToTravelMiles: Math.min(60, (crewMember?.willingToTravelMiles ?? 20) + 5)
              })
            }
            type="button"
          >
            +5 miles
          </button>
          <button
            className={crewMember?.winterWorkEnabled ? "button" : "button-secondary"}
            disabled={isWorking || !crewMember}
            onClick={() =>
              void handleSavePreferences({
                winterWorkEnabled: !(crewMember?.winterWorkEnabled ?? false)
              })
            }
            type="button"
          >
            {crewMember?.winterWorkEnabled ? "Winter work on" : "Winter work off"}
          </button>
        </div>
      </section>

      <section className="stack-lg">
        {matches.map((match) => {
          return (
            <article className="crew-opportunity-card" key={match.id}>
              <div className="crew-opportunity-card__header">
                <div>
                  <div className="search-result-title">
                    <h3>{match.providerCompanyName}</h3>
                    <span className="result-badge">{match.status.replaceAll("-", " ")}</span>
                  </div>
                  <p>{match.category.replaceAll("-", " ")}</p>
                </div>
                <strong>{formatCurrency(match.hourlyRateCents)}/hr</strong>
              </div>

              <div className="crew-opportunity-card__grid">
                <div>
                  <h4>When</h4>
                  <p>{formatDateTime(match.scheduledStartIso)}</p>
                  <p>{formatDateTime(match.scheduledEndIso)}</p>
                </div>
                <div>
                  <h4>Where</h4>
                  <p>{match.serviceAddress.line1}</p>
                  <p>
                    {match.serviceAddress.city}, {match.serviceAddress.state} {match.serviceAddress.postalCode}
                  </p>
                </div>
              </div>

              <p>{match.summary}</p>

              {match.status === "accepted" ? (
                <div className="cta-row">
                  {match.bookingStatus === "requested" ? (
                    <span className="result-badge">Waiting on business confirmation</span>
                  ) : null}
                  {match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt ? (
                    <span className="result-badge">Business owner starts the route</span>
                  ) : null}
                  {match.bookingStatus === "confirmed" && match.onRouteConfirmedAt ? (
                    <button
                      className="button"
                      disabled={isWorking}
                      onClick={() => void startWork(match.bookingId)}
                      type="button"
                    >
                      Start work
                    </button>
                  ) : null}
                  {match.bookingStatus === "in-progress" ? (
                    <span className="result-badge">Job in progress</span>
                  ) : null}
                  <a className="button-secondary" href={`tel:${match.providerPhone}`}>
                    Call business
                  </a>
                  <a
                    className="button-secondary"
                    href={`/help?bookingId=${encodeURIComponent(match.bookingId)}&issueType=general&subject=${encodeURIComponent("Crew assignment support")}`}
                  >
                    Get help
                  </a>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
