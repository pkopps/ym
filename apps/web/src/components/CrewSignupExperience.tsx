"use client";

import {
  Address,
  CrewAvailabilityDay,
  CrewMemberSchedulePreference,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient, getWebAuthDevice, saveStoredSession } from "../lib/api";
import { SignupIdentityOptions } from "./SignupIdentityOptions";

const dayOptions: CrewAvailabilityDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const categoryOptions: ServiceCategory[] = [
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
const scheduleOptions: CrewMemberSchedulePreference[] = ["flex", "full-time", "part-time", "seasonal"];
function buildEstimatedPoint(state: string, postalCode: string) {
  const normalizedState = state.trim().toUpperCase();
  const stateSignal =
    normalizedState.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 40;
  const zipDigits = Number(postalCode.replace(/\D/g, "").slice(0, 5) || "10001");

  return {
    latitude: Number((25 + stateSignal * 0.5 + (zipDigits % 90) * 0.02).toFixed(5)),
    longitude: Number((-124 + stateSignal * 0.6 + (zipDigits % 120) * 0.03).toFixed(5))
  };
}

function schedulePreferenceKey(preference: CrewMemberSchedulePreference): TranslationKey {
  switch (preference) {
    case "full-time":
      return "crew_signup.schedule.full_time";
    case "part-time":
      return "crew_signup.schedule.part_time";
    case "seasonal":
      return "crew_signup.schedule.seasonal";
    case "flex":
      return "crew_signup.schedule.flex";
  }
}

function formatPreviewList<T extends string>(items: T[], formatter: (item: T) => string) {
  const visibleItems = items.slice(0, 2).map(formatter);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return `${visibleItems.join(", ")}${hiddenCount > 0 ? ` +${hiddenCount}` : ""}`;
}

function parseQueryList<T extends string>(value: string | null, allowedValues: T[], fallback: T[]) {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => allowedValues.includes(item as T));
  return parsed.length > 0 ? parsed : fallback;
}

function toggleRequiredValue<T extends string>(current: T[], value: T) {
  if (!current.includes(value)) {
    return [...current, value];
  }

  return current.length === 1 ? current : current.filter((item) => item !== value);
}

export function CrewSignupExperience() {
  const i18n = useI18n();
  const router = useRouter();
  const [opportunityId, setOpportunityId] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>(["lawn-mowing", "seasonal-cleanup"]);
  const [availableWeekdays, setAvailableWeekdays] = useState<CrewAvailabilityDay[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri"
  ]);
  const [preferredSchedule, setPreferredSchedule] = useState<CrewMemberSchedulePreference>("flex");
  const [hasOwnEquipment, setHasOwnEquipment] = useState(false);
  const [winterWorkEnabled, setWinterWorkEnabled] = useState(true);
  const [willingToTravelMiles, setWillingToTravelMiles] = useState(20);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOpportunityId(params.get("opportunityId") ?? "");
    setCategories(parseQueryList(params.get("categories"), categoryOptions, ["lawn-mowing", "seasonal-cleanup"]));
    setAvailableWeekdays(parseQueryList(params.get("days"), dayOptions, ["Mon", "Tue", "Wed", "Thu", "Fri"]));

    const nextSchedule = params.get("preferredSchedule");
    if (scheduleOptions.includes(nextSchedule as CrewMemberSchedulePreference)) {
      setPreferredSchedule(nextSchedule as CrewMemberSchedulePreference);
    }
    setHasOwnEquipment(params.get("hasOwnEquipment") === "true");
    setWinterWorkEnabled(params.get("winterWorkEnabled") !== "false");

    const nextRadius = Number(params.get("willingToTravelMiles"));
    if (Number.isFinite(nextRadius)) {
      setWillingToTravelMiles(Math.min(60, Math.max(5, nextRadius)));
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (password !== confirmPassword) {
      setErrorMessage(i18n.t("auth_signup.error.passwords_mismatch"));
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setErrorMessage(i18n.t("crew_signup.error.contact_home_base_required"));
      return;
    }

    const normalizedAddress: Address = {
      line1: line1.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      postalCode: postalCode.trim(),
      country: "US",
      point: buildEstimatedPoint(state, postalCode)
    };

    try {
      setIsSubmitting(true);
      const api = createWebApiClient(i18n.locale);
      const envelope = await api.registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        role: "crew-member",
        address: normalizedAddress,
        device: getWebAuthDevice(),
        categories,
        availableWeekdays,
        willingToTravelMiles,
        preferredSchedule,
        hasOwnEquipment,
        winterWorkEnabled
      });

      if (envelope.user.role !== "crew-member") {
        throw new Error(i18n.t("crew_signup.error.wrong_role"));
      }

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      if (opportunityId) {
        const authenticatedApi = createWebApiClient(i18n.locale);
        authenticatedApi.setAuthToken(envelope.session.token);
        await authenticatedApi.claimPublicCrewOpportunity({ opportunityId });
      }

      router.push(addLocalePrefix("/crew", i18n.locale));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_signup.error.create_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card crew-signup-card">
      <form className="auth-form-stack" onSubmit={handleSubmit}>
        <div className="crew-signup-review">
          <div>
            <span className="eyebrow">
              {i18n.t(opportunityId ? "crew_signup.review.opening_selected" : "crew_signup.review.profile")}
            </span>
            <h2>{i18n.t(opportunityId ? "crew_signup.review.confirm_fit" : "crew_signup.review.create_profile")}</h2>
            <p>
              {opportunityId
                ? i18n.t("crew_signup.review.carryover")
                : i18n.t("crew_signup.review.recommend")}
            </p>
          </div>
          <div className="crew-signup-review__grid">
            <div>
              <span>{i18n.t("crew_signup.skills")}</span>
              <strong>{formatPreviewList(categories, (category) => i18n.t(serviceCategoryToI18nKey(category)))}</strong>
            </div>
            <div>
              <span>{i18n.t("crew_signup.days")}</span>
              <strong>{formatPreviewList(availableWeekdays, (day) => day)}</strong>
            </div>
            <div>
              <span>{i18n.t("crew_signup.radius")}</span>
              <strong>{i18n.t("common.format.miles", { count: willingToTravelMiles })}</strong>
            </div>
            <div>
              <span>{i18n.t("crew_signup.schedule")}</span>
              <strong>{i18n.t(schedulePreferenceKey(preferredSchedule))}</strong>
            </div>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>{i18n.t("crew_signup.account")}</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.full_name")}</span>
              <input
                autoComplete="name"
                onChange={(event) => setFullName(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.full_name")}
                value={fullName}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.email")}</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.email")}
                value={email}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.phone")}</span>
              <input
                autoComplete="tel"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="555-0300"
                value={phone}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.password")}</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.password")}
                type="password"
                value={password}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.confirm_password")}</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.confirm_password")}
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>{i18n.t("crew_signup.home_base")}</h3>
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>{i18n.t("crew_signup.home_base")}</span>
              <input
                autoComplete="street-address"
                onChange={(event) => setLine1(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.street")}
                value={line1}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.city")}</span>
              <input autoComplete="address-level2" onChange={(event) => setCity(event.target.value)} value={city} />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.state")}</span>
              <input autoComplete="address-level1" onChange={(event) => setState(event.target.value)} value={state} />
            </label>
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.zip")}</span>
              <input autoComplete="postal-code" onChange={(event) => setPostalCode(event.target.value)} value={postalCode} />
            </label>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>{i18n.t("crew_signup.skills")}</h3>
          <div className="chip-row">
            {categoryOptions.map((category) => {
              const active = categories.includes(category);
              return (
                <button
                  className={active ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                  key={category}
                  onClick={() => setCategories((current) => toggleRequiredValue(current, category))}
                  type="button"
                >
                  {i18n.t(serviceCategoryToI18nKey(category))}
                </button>
              );
            })}
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>{i18n.t("crew_signup.days")}</h3>
          <div className="chip-row">
            {dayOptions.map((day) => {
              const active = availableWeekdays.includes(day);
              return (
                <button
                  className={active ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                  key={day}
                  onClick={() => setAvailableWeekdays((current) => toggleRequiredValue(current, day))}
                  type="button"
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>{i18n.t("crew_signup.preferences")}</h3>
          <div className="chip-row">
            {scheduleOptions.map((schedule) => (
              <button
                className={preferredSchedule === schedule ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                key={schedule}
                onClick={() => setPreferredSchedule(schedule)}
                type="button"
              >
                {i18n.t(schedulePreferenceKey(schedule))}
              </button>
            ))}
            <button
              className={hasOwnEquipment ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
              onClick={() => setHasOwnEquipment((current) => !current)}
              type="button"
            >
              {i18n.t("crew_signup.own_equipment")}
            </button>
            <button
              className={winterWorkEnabled ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
              onClick={() => setWinterWorkEnabled((current) => !current)}
              type="button"
            >
              {i18n.t("crew_signup.winter_work")}
            </button>
          </div>
          <div className="crew-fit-radius">
            <button
              className="button-secondary"
              onClick={() => setWillingToTravelMiles((current) => Math.max(5, current - 5))}
              type="button"
            >
              {i18n.t("crew_signup.minus_miles")}
            </button>
            <span>{i18n.t("common.format.miles", { count: willingToTravelMiles })}</span>
            <button
              className="button-secondary"
              onClick={() => setWillingToTravelMiles((current) => Math.min(60, current + 5))}
              type="button"
            >
              {i18n.t("crew_signup.plus_miles")}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="list-panel" role="alert">
            <strong>{i18n.t("auth_signup.error_title")}</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? i18n.t("auth_signup.creating") : i18n.t("crew_signup.create_account")}
          </button>
          <a className="button-secondary" href={addLocalePrefix("/crew", i18n.locale)}>
            {i18n.t("common.actions.back")}
          </a>
        </div>

        <SignupIdentityOptions role="crew-member" />
      </form>
    </section>
  );
}
