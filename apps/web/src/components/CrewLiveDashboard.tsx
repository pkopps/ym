"use client";

import {
  CrewAvailabilityDay,
  CrewOpportunity,
  CrewMatchesResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient, createWebApiClient } from "../lib/api";
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
  const [publicOpportunities, setPublicOpportunities] = useState<CrewOpportunity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  const crewMember = matchesResponse?.crewMember;
  const matches = matchesResponse?.matches ?? [];
  const acceptedMatches = useMemo(
    () => matches.filter((match) => match.status === "accepted"),
    [matches]
  );
  const previewOpportunities = useMemo(() => publicOpportunities.slice(0, 6), [publicOpportunities]);

  async function loadPublicPreview() {
    const api = createWebApiClient();
    const opportunities = await api.getPublicCrewOpportunities();
    setPublicOpportunities(opportunities);
  }

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
      void loadPublicPreview().catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load live crew openings right now."
        );
      });
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

  async function cancelCrewMatch(matchId: string) {
    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.cancelCrewMatch({
        crewMatchId: matchId,
        reason: "Crew member cancelled from the web dashboard."
      });
      setStatusMessage("Assignment cancelled. The business owner was notified.");
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel this assignment.");
    } finally {
      setIsWorking(false);
    }
  }

  function confirmCancelCrewMatch(matchId: string) {
    if (
      !window.confirm(
        "Backing out of an accepted shift can negatively affect your reliability score and reduce your chances of being selected for future crews. Cancel this assignment?"
      )
    ) {
      return;
    }

    void cancelCrewMatch(matchId);
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
      <div className="stack-lg">
        {previewOpportunities.length > 0 ? (
          <section className="stack-lg">
            <div className="section-header">
              <h2>Providers hiring now</h2>
            </div>
            <div className="grid-three">
              {previewOpportunities.map((opportunity) => (
                <article className="crew-opportunity-card" key={opportunity.id}>
                  <div className="crew-opportunity-card__header">
                    <div>
                      <div className="search-result-title">
                        <h3>{opportunity.providerCompanyName}</h3>
                        <span className="result-badge">Hiring</span>
                      </div>
                      <p>{opportunity.title}</p>
                    </div>
                    <strong>{formatCurrency(opportunity.hourlyRateCents)}/hr</strong>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>When</h4>
                      <p>{formatDateTime(opportunity.neededByStartIso)}</p>
                      <p>{formatDateTime(opportunity.neededByEndIso)}</p>
                    </div>
                    <div>
                      <h4>Where</h4>
                      <p>
                        {opportunity.city}, {opportunity.state}
                      </p>
                      <p>{opportunity.preferredSchedule} schedule</p>
                    </div>
                  </div>

                  <p>{opportunity.summary}</p>

                  <div className="chip-row">
                    {opportunity.categories.map((category) => (
                      <span key={`${opportunity.id}-${category}`}>{category.replaceAll("-", " ")}</span>
                    ))}
                    {opportunity.equipmentProvided ? <span>Equipment provided</span> : null}
                    {opportunity.trainingProvided ? <span>Training provided</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <h2>Log in or sign up for crew work</h2>
          <p>Create an account or log in to unlock acceptance, schedule details, and crew chat.</p>
          <div className="cta-row">
            <a className="button" href="/login/crew">
              Crew login
            </a>
            <a className="button-secondary" href="/auth/crew">
              Crew sign up
            </a>
          </div>
        </section>
      </div>
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
          <h2>{crewMember?.cancellationCount ?? 0}</h2>
          <p>Call-offs on record</p>
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
        <p className="muted-copy">
          Reliability matters. Cancelling accepted assignments can lower your future staffing priority with providers.
        </p>
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
              {match.status === "cancelled-by-crew" && match.cancellationReason ? (
                <p className="warning-copy">{match.cancellationReason}</p>
              ) : null}

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
                  {(match.bookingStatus === "requested" ||
                    (match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt)) ? (
                    <button
                      className="button-danger"
                      disabled={isWorking}
                      onClick={() => confirmCancelCrewMatch(match.id)}
                      type="button"
                    >
                      Cancel assignment
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
