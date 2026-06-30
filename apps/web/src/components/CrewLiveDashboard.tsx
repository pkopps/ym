"use client";

import {
  CrewAvailabilityDay,
  CrewMemberSchedulePreference,
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
  "aeration",
  "fertilization",
  "gutter-cleaning",
  "snow-shoveling",
  "snow-blowing"
];
const dayByDateIndex: CrewAvailabilityDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const categoryLabels: Record<ServiceCategory, string> = {
  "lawn-mowing": "lawn mowing",
  "hedge-trimming": "hedge trimming",
  "mulch-installation": "mulch installation",
  "seasonal-cleanup": "seasonal cleanup",
  "weed-control": "weed control",
  "irrigation-check": "irrigation checks",
  "leaf-blowing": "leaf blowing",
  "aeration": "aeration",
  "fertilization": "fertilization",
  "gutter-cleaning": "gutter cleaning",
  "snow-shoveling": "snow shoveling",
  "ice-melt-salting": "ice melt salting",
  "snow-blowing": "snow blowing"
};

type PublicCrewPreferenceDraft = {
  categories: ServiceCategory[];
  availableWeekdays: CrewAvailabilityDay[];
  preferredSchedule: CrewMemberSchedulePreference;
  willingToTravelMiles: number;
  hasOwnEquipment: boolean;
  winterWorkEnabled: boolean;
};

type PublicCrewRecommendation = {
  opportunity: CrewOpportunity;
  score: number;
  label: "Best fit" | "Good fit" | "Backup fit";
  reasons: string[];
};

const defaultPublicPreferences: PublicCrewPreferenceDraft = {
  categories: ["lawn-mowing", "seasonal-cleanup"],
  availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  preferredSchedule: "flex",
  willingToTravelMiles: 20,
  hasOwnEquipment: false,
  winterWorkEnabled: true
};

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

function formatCategory(category: ServiceCategory) {
  return categoryLabels[category];
}

function formatSchedulePreference(preference: CrewMemberSchedulePreference) {
  return preference.replaceAll("-", " ");
}

function getAvailabilityDay(iso: string): CrewAvailabilityDay {
  return dayByDateIndex[new Date(iso).getDay()] ?? "Mon";
}

function isWinterCategory(category: ServiceCategory) {
  return category === "snow-shoveling" || category === "snow-blowing" || category === "ice-melt-salting";
}

function toggleRequiredValue<T extends string>(current: T[], value: T) {
  if (!current.includes(value)) {
    return [...current, value];
  }

  return current.length === 1 ? current : current.filter((item) => item !== value);
}

function buildPublicCrewRecommendation(
  opportunity: CrewOpportunity,
  preferences: PublicCrewPreferenceDraft
): PublicCrewRecommendation {
  const reasons: string[] = [];
  const matchingCategory = opportunity.categories.find((category) => preferences.categories.includes(category));
  const opportunityDay = getAvailabilityDay(opportunity.neededByStartIso);
  const weekdayMatches = preferences.availableWeekdays.includes(opportunityDay);
  const winterCategory = opportunity.categories.some(isWinterCategory);
  const startsInHours = (Date.parse(opportunity.neededByStartIso) - Date.now()) / (60 * 60 * 1000);
  let score = 18;

  if (matchingCategory) {
    score += 34;
    reasons.push(`Matches ${formatCategory(matchingCategory)} skills`);
  } else if (opportunity.trainingProvided) {
    score += 8;
    reasons.push("Training is available");
  } else {
    score -= 18;
    reasons.push("Outside your selected skills");
  }

  if (weekdayMatches) {
    score += 24;
    reasons.push(`${opportunityDay} fits your availability`);
  } else {
    score -= 20;
    reasons.push(`${opportunityDay} is not in your selected days`);
  }

  if (opportunity.requiresEquipmentOwnership) {
    if (preferences.hasOwnEquipment) {
      score += 12;
      reasons.push("Your equipment helps here");
    } else {
      score -= 24;
      reasons.push("Requires your own equipment");
    }
  } else if (opportunity.equipmentProvided) {
    score += 8;
    reasons.push("Equipment provided");
  }

  if (winterCategory) {
    if (preferences.winterWorkEnabled) {
      score += 10;
      reasons.push("Winter work is on");
    } else {
      score -= 30;
      reasons.push("Winter work is off");
    }
  }

  if (opportunity.preferredSchedule === "flex" || opportunity.preferredSchedule === preferences.preferredSchedule) {
    score += 6;
  }

  if (startsInHours > 0 && startsInHours <= 72) {
    score += 4;
  }

  if (opportunity.hourlyRateCents >= 2400) {
    score += 3;
  }

  const normalizedScore = Math.max(0, score);
  return {
    opportunity,
    score: normalizedScore,
    label: normalizedScore >= 68 ? "Best fit" : normalizedScore >= 46 ? "Good fit" : "Backup fit",
    reasons: Array.from(new Set(reasons)).slice(0, 3)
  };
}

export function CrewLiveDashboard() {
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [publicOpportunities, setPublicOpportunities] = useState<CrewOpportunity[]>([]);
  const [publicPreferences, setPublicPreferences] =
    useState<PublicCrewPreferenceDraft>(defaultPublicPreferences);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [selectedPublicOpportunityId, setSelectedPublicOpportunityId] = useState<string | undefined>();
  const [notifyingOpportunityId, setNotifyingOpportunityId] = useState<string | undefined>();

  const crewMember = matchesResponse?.crewMember;
  const matches = matchesResponse?.matches ?? [];
  const acceptedMatches = useMemo(
    () => matches.filter((match) => match.status === "accepted"),
    [matches]
  );
  const recommendedPublicOpportunities = useMemo(
    () =>
      publicOpportunities
        .map((opportunity) => buildPublicCrewRecommendation(opportunity, publicPreferences))
        .sort((left, right) => {
          const scoreDelta = right.score - left.score;
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          return left.opportunity.neededByStartIso.localeCompare(right.opportunity.neededByStartIso);
        })
        .slice(0, 6),
    [publicOpportunities, publicPreferences]
  );
  const selectedPublicRecommendation = useMemo(
    () =>
      recommendedPublicOpportunities.find(
        (recommendation) => recommendation.opportunity.id === selectedPublicOpportunityId
      ),
    [recommendedPublicOpportunities, selectedPublicOpportunityId]
  );
  const selectedPublicOpportunity = useMemo(
    () =>
      selectedPublicRecommendation?.opportunity ??
      publicOpportunities.find((opportunity) => opportunity.id === selectedPublicOpportunityId),
    [publicOpportunities, selectedPublicOpportunityId, selectedPublicRecommendation]
  );
  const crewSignupHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPublicOpportunity) {
      params.set("opportunityId", selectedPublicOpportunity.id);
    }
    params.set("categories", publicPreferences.categories.join(","));
    params.set("days", publicPreferences.availableWeekdays.join(","));
    params.set("preferredSchedule", publicPreferences.preferredSchedule);
    params.set("willingToTravelMiles", String(publicPreferences.willingToTravelMiles));
    params.set("hasOwnEquipment", String(publicPreferences.hasOwnEquipment));
    params.set("winterWorkEnabled", String(publicPreferences.winterWorkEnabled));
    return `/auth/crew?${params.toString()}`;
  }, [publicPreferences, selectedPublicOpportunity]);

  async function loadPublicPreview() {
    const api = createWebApiClient();
    setErrorMessage(undefined);
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

  async function startRoute(bookingId: string) {
    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.markBookingOnRoute({ bookingId });
      setStatusMessage("Route started. The customer can now track the arrival.");
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start this route.");
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

  async function selectPublicOpportunity(opportunityId: string) {
    setSelectedPublicOpportunityId(opportunityId);
    setStatusMessage(undefined);
    setErrorMessage(undefined);
    setNotifyingOpportunityId(opportunityId);

    try {
      const api = createWebApiClient();
      const selection = await api.selectPublicCrewOpportunity({ opportunityId });
      setStatusMessage(
        selection.staffingMode === "auto-accept"
          ? `YardMatch notified ${selection.providerCompanyName} that you want this recommended opening. Create a profile so the assignment details can be confirmed.`
          : `YardMatch notified ${selection.providerCompanyName} that this recommended opening needs review. Create a profile so they can review your fit.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to request this recommended opening."
      );
    } finally {
      setNotifyingOpportunityId(undefined);
    }

    window.requestAnimationFrame(() => {
      const cta = document.getElementById("crew-signup-cta");
      cta?.scrollIntoView({ behavior: "smooth", block: "start" });
      cta?.focus({ preventScroll: true });
    });
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
        <section className="card crew-fit-panel">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Crew fit</span>
              <h2>Recommended openings</h2>
              <p>Pick the work you can do and the days you want routes.</p>
            </div>
            <strong>{recommendedPublicOpportunities.length} fit{recommendedPublicOpportunities.length === 1 ? "" : "s"}</strong>
          </div>
          <div className="crew-fit-panel__group">
            <h3>Skills</h3>
            <div className="chip-row">
              {skillOptions.map((skill) => {
                const active = publicPreferences.categories.includes(skill);
                return (
                  <button
                    className={active ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                    key={skill}
                    onClick={() =>
                      setPublicPreferences((current) => ({
                        ...current,
                        categories: toggleRequiredValue(current.categories, skill)
                      }))
                    }
                    type="button"
                  >
                    {formatCategory(skill)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crew-fit-panel__group">
            <h3>Days</h3>
            <div className="chip-row">
              {allDays.map((day) => {
                const active = publicPreferences.availableWeekdays.includes(day);
                return (
                  <button
                    className={active ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                    key={day}
                    onClick={() =>
                      setPublicPreferences((current) => ({
                        ...current,
                        availableWeekdays: toggleRequiredValue(current.availableWeekdays, day)
                      }))
                    }
                    type="button"
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crew-fit-panel__group">
            <h3>Preferences</h3>
            <div className="chip-row">
              {(["flex", "full-time", "part-time", "seasonal"] as CrewMemberSchedulePreference[]).map(
                (preference) => (
                  <button
                    className={
                      publicPreferences.preferredSchedule === preference
                        ? "button crew-fit-chip"
                        : "button-secondary crew-fit-chip"
                    }
                    key={preference}
                    onClick={() =>
                      setPublicPreferences((current) => ({
                        ...current,
                        preferredSchedule: preference
                      }))
                    }
                    type="button"
                  >
                    {formatSchedulePreference(preference)}
                  </button>
                )
              )}
              <button
                className={publicPreferences.hasOwnEquipment ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                onClick={() =>
                  setPublicPreferences((current) => ({
                    ...current,
                    hasOwnEquipment: !current.hasOwnEquipment
                  }))
                }
                type="button"
              >
                Own equipment
              </button>
              <button
                className={publicPreferences.winterWorkEnabled ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                onClick={() =>
                  setPublicPreferences((current) => ({
                    ...current,
                    winterWorkEnabled: !current.winterWorkEnabled
                  }))
                }
                type="button"
              >
                Winter work
              </button>
            </div>
            <div className="crew-fit-radius">
              <button
                className="button-secondary"
                onClick={() =>
                  setPublicPreferences((current) => ({
                    ...current,
                    willingToTravelMiles: Math.max(5, current.willingToTravelMiles - 5)
                  }))
                }
                type="button"
              >
                -5 miles
              </button>
              <strong>{publicPreferences.willingToTravelMiles} miles</strong>
              <button
                className="button-secondary"
                onClick={() =>
                  setPublicPreferences((current) => ({
                    ...current,
                    willingToTravelMiles: Math.min(60, current.willingToTravelMiles + 5)
                  }))
                }
                type="button"
              >
                +5 miles
              </button>
            </div>
          </div>
        </section>

        {recommendedPublicOpportunities.length > 0 ? (
          <section className="stack-lg">
            <div className="section-header">
              <h2>Best fits for you</h2>
            </div>
            <div className="grid-three">
              {recommendedPublicOpportunities.map((recommendation) => {
                const opportunity = recommendation.opportunity;
                return (
                <article className="crew-opportunity-card" key={opportunity.id}>
                  <div className="crew-opportunity-card__header">
                    <div>
                      <div className="search-result-title">
                        <h3>{opportunity.providerCompanyName}</h3>
                        <span className="result-badge">{recommendation.label}</span>
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

                  <div className="crew-recommendation-reasons">
                    {recommendation.reasons.map((reason) => (
                      <span key={`${opportunity.id}-${reason}`}>{reason}</span>
                    ))}
                  </div>

                  <div className="chip-row">
                    {opportunity.categories.map((category) => (
                      <span key={`${opportunity.id}-${category}`}>{formatCategory(category)}</span>
                    ))}
                    {opportunity.equipmentProvided ? <span>Equipment provided</span> : null}
                    {opportunity.trainingProvided ? <span>Training provided</span> : null}
                  </div>

                  <div className="cta-row">
                    <button
                      className="button"
                      disabled={notifyingOpportunityId === opportunity.id}
                      onClick={() => void selectPublicOpportunity(opportunity.id)}
                      type="button"
                    >
                      {notifyingOpportunityId === opportunity.id
                        ? "Selecting..."
                        : selectedPublicOpportunityId === opportunity.id
                          ? "Selected"
                          : "Request this fit"}
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="card">
            <span className="eyebrow">Crew openings</span>
            <h2>No crews hiring in your area right now.</h2>
            <p>
              We do not have any open crew listings to show currently. Sign up or log in and
              YardMatch can show new openings as soon as local providers post them.
            </p>
            {errorMessage ? (
              <p className="warning-copy">
                The live crew list could not be refreshed, so this may be temporary.
              </p>
            ) : null}
          </section>
        )}

        <section className="card" id="crew-signup-cta" tabIndex={-1}>
          {statusMessage ? (
            <div className="list-panel">
              <strong>Provider notified</strong>
              <p>{statusMessage}</p>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="list-panel" role="alert">
              <strong>Provider notification failed</strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}
          {selectedPublicOpportunity ? (
            <div className="list-panel">
              <span className="eyebrow">Selected opening</span>
              <h3>{selectedPublicOpportunity.providerCompanyName}</h3>
              <p>
                {selectedPublicOpportunity.title} in {selectedPublicOpportunity.city},{" "}
                {selectedPublicOpportunity.state} at{" "}
                {formatCurrency(selectedPublicOpportunity.hourlyRateCents)}/hr.
              </p>
              {selectedPublicRecommendation ? (
                <p>{selectedPublicRecommendation.reasons.join(" • ")}</p>
              ) : null}
            </div>
          ) : null}
          <h2>
            {selectedPublicOpportunity
              ? "Sign up to request this crew opening"
              : "Log in or sign up for crew work"}
          </h2>
          <p>
            {selectedPublicOpportunity
              ? "Create a crew profile so the business owner can review your skills, availability, and contact details."
              : "Create an account or log in to unlock acceptance, schedule details, and crew chat."}
          </p>
          <div className="cta-row">
            <a className="button" href="/login/crew">
              Crew login
            </a>
            <a className="button-secondary" href={crewSignupHref}>
              {selectedPublicOpportunity ? "Sign up for this opening" : "Crew sign up"}
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
                  {match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt && match.isAssignedRouteLeader ? (
                    <button
                      className="button"
                      disabled={isWorking}
                      onClick={() => void startRoute(match.bookingId)}
                      type="button"
                    >
                      Start route
                    </button>
                  ) : null}
                  {match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt && !match.isAssignedRouteLeader ? (
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
