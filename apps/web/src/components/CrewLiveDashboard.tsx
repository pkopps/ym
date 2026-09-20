"use client";
import type { PropertyPhotoArea } from "@yardmatch/contracts";
import { WorkspaceSection } from "./WorkspaceSection";

import {
  BookingEvidencePhase,
  CrewAvailabilityDay,
  CrewMemberSchedulePreference,
  CrewOpportunity,
  CrewMatchesResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, type I18nInstance, type TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient, createWebApiClient } from "../lib/api";
import { readEvidenceImage } from "../lib/imageUploads";
import { useStoredWebSession } from "../lib/session";
import { LoadingSkeleton } from "./LoadingSkeleton";

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
const dayLabelKeys: Record<CrewAvailabilityDay, TranslationKey> = {
  Mon: "crew_day.mon",
  Tue: "crew_day.tue",
  Wed: "crew_day.wed",
  Thu: "crew_day.thu",
  Fri: "crew_day.fri",
  Sat: "crew_day.sat",
  Sun: "crew_day.sun"
};

const schedulePreferenceKeys: Record<CrewMemberSchedulePreference, TranslationKey> = {
  flex: "crew_signup.schedule.flex",
  "full-time": "crew_signup.schedule.full_time",
  "part-time": "crew_signup.schedule.part_time",
  seasonal: "crew_signup.schedule.seasonal"
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
  labelKey: TranslationKey;
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

function formatDateTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatCategory(i18n: I18nInstance, category: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(category));
}

function formatSchedulePreference(i18n: I18nInstance, preference: CrewMemberSchedulePreference) {
  return i18n.t(schedulePreferenceKeys[preference]);
}

function formatDay(i18n: I18nInstance, day: CrewAvailabilityDay) {
  return i18n.t(dayLabelKeys[day]);
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
  i18n: I18nInstance,
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
    reasons.push(i18n.t("crew_live.reason.matches_skill", { skill: formatCategory(i18n, matchingCategory) }));
  } else if (opportunity.trainingProvided) {
    score += 8;
    reasons.push(i18n.t("crew_live.reason.training_available"));
  } else {
    score -= 18;
    reasons.push(i18n.t("crew_live.reason.outside_skills"));
  }

  if (weekdayMatches) {
    score += 24;
    reasons.push(i18n.t("crew_live.reason.day_fits", { day: formatDay(i18n, opportunityDay) }));
  } else {
    score -= 20;
    reasons.push(i18n.t("crew_live.reason.day_not_selected", { day: formatDay(i18n, opportunityDay) }));
  }

  if (opportunity.requiresEquipmentOwnership) {
    if (preferences.hasOwnEquipment) {
      score += 12;
      reasons.push(i18n.t("crew_live.reason.equipment_helps"));
    } else {
      score -= 24;
      reasons.push(i18n.t("crew_live.reason.requires_equipment"));
    }
  } else if (opportunity.equipmentProvided) {
    score += 8;
    reasons.push(i18n.t("crew_live.equipment_provided"));
  }

  if (winterCategory) {
    if (preferences.winterWorkEnabled) {
      score += 10;
      reasons.push(i18n.t("crew_live.reason.winter_on"));
    } else {
      score -= 30;
      reasons.push(i18n.t("crew_live.reason.winter_off"));
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
    labelKey:
      normalizedScore >= 68
        ? "crew_live.recommendation.best_fit"
        : normalizedScore >= 46
          ? "crew_live.recommendation.good_fit"
          : "crew_live.recommendation.backup_fit",
    reasons: Array.from(new Set(reasons)).slice(0, 3)
  };
}

export function CrewLiveDashboard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [publicOpportunities, setPublicOpportunities] = useState<CrewOpportunity[]>([]);
  const [publicPreferences, setPublicPreferences] =
    useState<PublicCrewPreferenceDraft>(defaultPublicPreferences);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [evidenceAreas, setEvidenceAreas] = useState<Record<string, PropertyPhotoArea>>({});
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
        .map((opportunity) => buildPublicCrewRecommendation(i18n, opportunity, publicPreferences))
        .sort((left, right) => {
          const scoreDelta = right.score - left.score;
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          return left.opportunity.neededByStartIso.localeCompare(right.opportunity.neededByStartIso);
        })
        .slice(0, 6),
    [i18n, publicOpportunities, publicPreferences]
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
    const signupDays = new Set(publicPreferences.availableWeekdays);
    if (selectedPublicOpportunity) {
      params.set("opportunityId", selectedPublicOpportunity.id);
      signupDays.add(getAvailabilityDay(selectedPublicOpportunity.neededByStartIso));
    }
    params.set("categories", publicPreferences.categories.join(","));
    params.set("days", allDays.filter((day) => signupDays.has(day)).join(","));
    params.set("preferredSchedule", publicPreferences.preferredSchedule);
    params.set("willingToTravelMiles", String(publicPreferences.willingToTravelMiles));
    params.set("hasOwnEquipment", String(publicPreferences.hasOwnEquipment));
    params.set("winterWorkEnabled", String(publicPreferences.winterWorkEnabled));
    return addLocalePrefix(`/auth/crew?${params.toString()}`, i18n.locale);
  }, [i18n.locale, publicPreferences, selectedPublicOpportunity]);

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
          error instanceof Error ? error.message : i18n.t("crew_live.error.load_openings")
        );
      });
      return;
    }

    void loadCrewView().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.load_dashboard"));
    });
  }, [i18n, sessionReady, session?.token, session?.role]);

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
      setStatusMessage(i18n.t("crew_live.status.availability_updated"));
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.update_preferences"));
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
      setStatusMessage(i18n.t("crew_live.status.work_started"));
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.start_booking"));
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
      setStatusMessage(i18n.t("crew_live.status.route_started"));
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.start_route"));
    } finally {
      setIsWorking(false);
    }
  }

  async function captureEvidencePhoto(bookingId: string, phase: BookingEvidencePhase, file: File) {
    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      const imageDataUrl = await readEvidenceImage(file);
      const api = createAuthenticatedWebApiClient();
      await api.addBookingEvidence({ bookingId, phase, imageDataUrl, photoArea: evidenceAreas[bookingId] ?? "lawn" });
      setStatusMessage(
        phase === "before"
          ? i18n.t("crew_live.status.before_photo_saved")
          : i18n.t("crew_live.status.after_photo_saved")
      );
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.capture_photo"));
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
        reason: i18n.t("crew_live.cancel.reason")
      });
      setStatusMessage(i18n.t("crew_live.status.assignment_cancelled"));
      await loadCrewView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_live.error.cancel_assignment"));
    } finally {
      setIsWorking(false);
    }
  }

  function confirmCancelCrewMatch(matchId: string) {
    if (
      !window.confirm(i18n.t("crew_live.cancel.confirm"))
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
          ? i18n.t("crew_live.status.provider_notified_auto", { provider: selection.providerCompanyName })
          : i18n.t("crew_live.status.provider_notified_review", { provider: selection.providerCompanyName })
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : i18n.t("crew_live.error.request_opening")
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

  if (!sessionReady || (!accessDenied && !matchesResponse && !errorMessage)) {
    return (
      <LoadingSkeleton cardCount={3} className="grid-three" label={i18n.t("crew_live.loading")} showAction />
    );
  }

  if (accessDenied) {
    return (
      <div className="stack-lg">
        <h1>{i18n.t("crew_dashboard.hero.title")}</h1>
        <section className="card crew-fit-panel">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">{i18n.t("crew_live.fit.eyebrow")}</span>
              <h2>{i18n.t("crew_live.fit.title")}</h2>
              <p>{i18n.t("crew_live.fit.body")}</p>
            </div>
            <strong>{i18n.t("crew_live.fit.count", { count: recommendedPublicOpportunities.length })}</strong>
          </div>
          <div className="crew-fit-panel__group">
            <h3>{i18n.t("crew_signup.skills")}</h3>
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
                    {formatCategory(i18n, skill)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crew-fit-panel__group">
            <h3>{i18n.t("crew_signup.days")}</h3>
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
                    {formatDay(i18n, day)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crew-fit-panel__group">
            <h3>{i18n.t("crew_signup.preferences")}</h3>
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
                    {formatSchedulePreference(i18n, preference)}
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
                {i18n.t("crew_signup.own_equipment")}
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
                {i18n.t("crew_signup.winter_work")}
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
                {i18n.t("crew_signup.minus_miles")}
              </button>
              <strong>{i18n.t("crew_live.travel_miles", { distance: publicPreferences.willingToTravelMiles })}</strong>
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
                {i18n.t("crew_signup.plus_miles")}
              </button>
            </div>
          </div>
        </section>

        {recommendedPublicOpportunities.length > 0 ? (
          <section className="stack-lg">
            <div className="section-header">
              <h2>{i18n.t("crew_live.best_fits")}</h2>
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
                        <span className="result-badge">{i18n.t(recommendation.labelKey)}</span>
                      </div>
                      <p>{opportunity.title}</p>
                    </div>
                    <strong>
                      {i18n.t("crew_live.hour_rate_short", { rate: i18n.formatCurrency(opportunity.hourlyRateCents) })}
                    </strong>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>{i18n.t("crew_live.when")}</h4>
                      <p>{formatDateTime(i18n, opportunity.neededByStartIso)}</p>
                      <p>{formatDateTime(i18n, opportunity.neededByEndIso)}</p>
                    </div>
                    <div>
                      <h4>{i18n.t("crew_live.where")}</h4>
                      <p>
                        {opportunity.city}, {opportunity.state}
                      </p>
                      <p>
                        {i18n.t("crew_live.schedule_label", {
                          preference: formatSchedulePreference(i18n, opportunity.preferredSchedule)
                        })}
                      </p>
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
                      <span key={`${opportunity.id}-${category}`}>{formatCategory(i18n, category)}</span>
                    ))}
                    {opportunity.equipmentProvided ? <span>{i18n.t("crew_live.equipment_provided")}</span> : null}
                    {opportunity.trainingProvided ? <span>{i18n.t("crew_hiring.training_provided")}</span> : null}
                  </div>

                  <div className="cta-row">
                    <button
                      className="button"
                      disabled={notifyingOpportunityId === opportunity.id}
                      onClick={() => void selectPublicOpportunity(opportunity.id)}
                      type="button"
                    >
                      {notifyingOpportunityId === opportunity.id
                        ? i18n.t("crew_live.action.selecting")
                        : selectedPublicOpportunityId === opportunity.id
                          ? i18n.t("crew_live.action.selected")
                          : i18n.t("crew_live.action.request_fit")}
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="card">
            <span className="eyebrow">{i18n.t("crew_live.openings.eyebrow")}</span>
            <h2>{i18n.t("crew_live.openings.empty.title")}</h2>
            <p>{i18n.t("crew_live.openings.empty.body")}</p>
            {errorMessage ? (
              <p className="warning-copy">
                {i18n.t("crew_live.openings.empty.warning")}
              </p>
            ) : null}
          </section>
        )}

        <section className="card" id="crew-signup-cta" tabIndex={-1}>
          {statusMessage ? (
            <div className="list-panel">
              <strong>{i18n.t("crew_live.provider_notified")}</strong>
              <p>{statusMessage}</p>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="list-panel" role="alert">
              <strong>{i18n.t("crew_live.provider_notification_failed")}</strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}
          {selectedPublicOpportunity ? (
            <div className="list-panel">
              <span className="eyebrow">{i18n.t("crew_live.selected_opening")}</span>
              <h3>{selectedPublicOpportunity.providerCompanyName}</h3>
              <p>
                {i18n.t("crew_live.selected_opening_summary", {
                  title: selectedPublicOpportunity.title,
                  city: selectedPublicOpportunity.city,
                  state: selectedPublicOpportunity.state,
                  rate: i18n.formatCurrency(selectedPublicOpportunity.hourlyRateCents)
                })}
              </p>
              {selectedPublicRecommendation ? (
                <p>{selectedPublicRecommendation.reasons.join(" • ")}</p>
              ) : null}
            </div>
          ) : null}
          <h2>
            {selectedPublicOpportunity
              ? i18n.t("crew_live.signup.title_selected")
              : i18n.t("crew_live.signup.title_default")}
          </h2>
          <p>
            {selectedPublicOpportunity
              ? i18n.t("crew_live.signup.body_selected")
              : i18n.t("crew_live.signup.body_default")}
          </p>
          <div className="cta-row">
            <a className="button" href={addLocalePrefix("/login/crew", i18n.locale)}>
              {i18n.t("crew_live.crew_login")}
            </a>
            <a className="button-secondary" href={crewSignupHref}>
              {selectedPublicOpportunity ? i18n.t("crew_live.signup.cta_selected") : i18n.t("crew_live.signup.cta_default")}
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
          <h2>{i18n.t("crew_live.updated")}</h2>
          <p>{statusMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("common.state.needs_attention")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <h1>{i18n.t("workspace.jobs")}</h1>
      <nav className="workspace-nav"><a href={i18n.locale === "es" ? "/es/crew/schedule" : "/crew/schedule"}>{i18n.t("workspace.today")}</a><a href="#crew-preferences">{i18n.t("workspace.settings")}</a></nav>
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
                <strong>{i18n.t("crew_live.hour_rate_short", { rate: i18n.formatCurrency(match.hourlyRateCents) })}</strong>
              </div>

              <div className="crew-opportunity-card__grid">
                <div>
                  <h4>{i18n.t("crew_live.when")}</h4>
                  <p>{formatDateTime(i18n, match.scheduledStartIso)}</p>
                  <p>{formatDateTime(i18n, match.scheduledEndIso)}</p>
                </div>
                <div>
                  <h4>{i18n.t("crew_live.where")}</h4>
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
                <div className="stack-md">
                  {(match.bookingStatus === "confirmed" && match.onRouteConfirmedAt) ||
                  match.bookingStatus === "in-progress" ? (
                    <section className="evidence-capture-panel">
                      <div>
                        <strong>{i18n.t("crew_live.evidence.title")}</strong>
                        <p>{i18n.t("complaint.provider_capture")}</p>
                  <label className="form-field"><span>{i18n.t("customer_live.photos.area_label")}</span><select value={evidenceAreas[match.bookingId] ?? "lawn"} onChange={event => setEvidenceAreas(current => ({ ...current, [match.bookingId]: event.target.value as PropertyPhotoArea }))}>{(["lawn", "shrubs", "garden-beds", "trees", "driveway", "walkways", "gutters", "other"] as const).map(area => <option key={area} value={area}>{i18n.t(`photo.area.${area.replaceAll("-", "_")}` as "photo.area.lawn")}</option>)}</select></label>
                        <p>
                          {match.bookingStatus === "in-progress"
                            ? i18n.t("crew_live.evidence.after_help", { count: match.afterEvidenceCount })
                            : i18n.t("crew_live.evidence.before_help", { count: match.beforeEvidenceCount })}
                        </p>
                      </div>
                      <label className="button-secondary evidence-upload-button">
                        <span>
                          {match.bookingStatus === "in-progress"
                            ? i18n.t("crew_live.evidence.add_after")
                            : i18n.t("crew_live.evidence.add_before")}
                        </span>
                        <input
                          accept="image/*"
                          aria-label={
                            match.bookingStatus === "in-progress"
                              ? i18n.t("crew_live.evidence.after_label")
                              : i18n.t("crew_live.evidence.before_label")
                          }
                          capture="environment"
                          className="visually-hidden"
                          disabled={isWorking}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            if (!file) {
                              return;
                            }
                            void captureEvidencePhoto(
                              match.bookingId,
                              match.bookingStatus === "in-progress" ? "after" : "before",
                              file
                            ).finally(() => {
                              input.value = "";
                            });
                          }}
                          type="file"
                        />
                      </label>
                    </section>
                  ) : null}
                  <div className="cta-row">
                  {match.bookingStatus === "requested" ? (
                    <span className="result-badge">{i18n.t("crew_live.status.waiting_confirmation")}</span>
                  ) : null}
                  {match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt && match.isAssignedRouteLeader ? (
                    <button
                      className="button"
                      disabled={isWorking}
                      onClick={() => void startRoute(match.bookingId)}
                      type="button"
                    >
                      {i18n.t("crew_live.action.start_route")}
                    </button>
                  ) : null}
                  {match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt && !match.isAssignedRouteLeader ? (
                    <span className="result-badge">{i18n.t("crew_live.status.business_starts_route")}</span>
                  ) : null}
                  {match.bookingStatus === "confirmed" && match.onRouteConfirmedAt ? (
                    <button
                      className="button"
                      disabled={isWorking || match.beforeEvidenceCount === 0}
                      onClick={() => void startWork(match.bookingId)}
                      type="button"
                    >
                      {i18n.t("crew_live.action.start_work")}
                    </button>
                  ) : null}
                  {match.bookingStatus === "in-progress" ? (
                    <span className="result-badge">{i18n.t("crew_live.status.job_in_progress")}</span>
                  ) : null}
                  <a className="button-secondary" href={`tel:${match.providerPhone}`}>
                    {i18n.t("crew_live.action.call_business")}
                  </a>
                  <a
                    className="button-secondary"
                    href={addLocalePrefix(
                      `/help?bookingId=${encodeURIComponent(match.bookingId)}&issueType=general&subject=${encodeURIComponent(i18n.t("crew_live.support_subject"))}`,
                      i18n.locale
                    )}
                  >
                    {i18n.t("crew_live.action.get_help")}
                  </a>
                  {(match.bookingStatus === "requested" ||
                    (match.bookingStatus === "confirmed" && !match.onRouteConfirmedAt)) ? (
                    <button
                      className="button-danger"
                      disabled={isWorking}
                      onClick={() => confirmCancelCrewMatch(match.id)}
                      type="button"
                    >
                      {i18n.t("crew_live.action.cancel_assignment")}
                    </button>
                  ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      <WorkspaceSection id="crew-preferences" title={i18n.t("workspace.settings")}>
      <section className="grid-three">
        <article className="card">
          <h2>{matches.length}</h2>
          <p>{i18n.t("crew_live.metric.matched_jobs")}</p>
        </article>
        <article className="card">
          <h2>{acceptedMatches.length}</h2>
          <p>{i18n.t("crew_live.metric.accepted_jobs")}</p>
        </article>
        <article className="card">
          <h2>{crewMember?.cancellationCount ?? 0}</h2>
          <p>{i18n.t("crew_live.metric.calloffs")}</p>
        </article>
      </section>

      <section className="card">
        <div className="search-result-title">
          <div>
            <h2>{crewMember?.fullName}</h2>
            <p>{i18n.t("crew_live.profile_help")}</p>
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
                {formatCategory(i18n, skill)}
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
                {formatDay(i18n, day)}
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
            {i18n.t("crew_signup.minus_miles")}
          </button>
          <span>{i18n.t("crew_live.travel_miles", { distance: crewMember?.willingToTravelMiles ?? 0 })}</span>
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
            {i18n.t("crew_signup.plus_miles")}
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
            {crewMember?.winterWorkEnabled ? i18n.t("crew_live.winter_on") : i18n.t("crew_live.winter_off")}
          </button>
        </div>
        <p className="muted-copy">{i18n.t("crew_live.reliability_warning")}</p>
      </section>

      </WorkspaceSection>
    </div>
  );
}
