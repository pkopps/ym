"use client";

import {
  Address,
  CrewAvailabilityDay,
  CrewMemberSchedulePreference,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient, saveStoredSession } from "../lib/api";
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

function formatCategory(category: ServiceCategory) {
  return categoryLabels[category];
}

function formatSchedulePreference(preference: CrewMemberSchedulePreference) {
  return preference.replaceAll("-", " ");
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
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setErrorMessage("Add your contact and home-base details to create a crew profile.");
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
      const api = createWebApiClient();
      const envelope = await api.registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        role: "crew-member",
        address: normalizedAddress,
        categories,
        availableWeekdays,
        willingToTravelMiles,
        preferredSchedule,
        hasOwnEquipment,
        winterWorkEnabled
      });

      if (envelope.user.role !== "crew-member") {
        throw new Error("Use a crew account in the crew workspace.");
      }

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.push("/crew");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this crew account right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card crew-signup-card">
      <form className="auth-form-stack" onSubmit={handleSubmit}>
        <div className="crew-signup-review">
          <div>
            <span className="eyebrow">{opportunityId ? "Opening selected" : "Crew profile"}</span>
            <h2>{opportunityId ? "Confirm your fit" : "Create your profile"}</h2>
            <p>
              {opportunityId
                ? "These details carry over from the opening you picked."
                : "YardMatch uses this to recommend nearby crew work."}
            </p>
          </div>
          <div className="crew-signup-review__grid">
            <div>
              <span>Skills</span>
              <strong>{formatPreviewList(categories, formatCategory)}</strong>
            </div>
            <div>
              <span>Days</span>
              <strong>{formatPreviewList(availableWeekdays, (day) => day)}</strong>
            </div>
            <div>
              <span>Radius</span>
              <strong>{willingToTravelMiles} miles</strong>
            </div>
            <div>
              <span>Schedule</span>
              <strong>{formatSchedulePreference(preferredSchedule)}</strong>
            </div>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>Account</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Full name</span>
              <input
                autoComplete="name"
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Maya Brooks"
                value={fullName}
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                value={email}
              />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input
                autoComplete="tel"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="555-0300"
                value={phone}
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                type="password"
                value={password}
              />
            </label>
            <label className="form-field">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>Home base</h3>
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>Home base</span>
              <input
                autoComplete="street-address"
                onChange={(event) => setLine1(event.target.value)}
                placeholder="170 5th Ave"
                value={line1}
              />
            </label>
            <label className="form-field">
              <span>City</span>
              <input autoComplete="address-level2" onChange={(event) => setCity(event.target.value)} value={city} />
            </label>
            <label className="form-field">
              <span>State</span>
              <input autoComplete="address-level1" onChange={(event) => setState(event.target.value)} value={state} />
            </label>
            <label className="form-field">
              <span>ZIP</span>
              <input autoComplete="postal-code" onChange={(event) => setPostalCode(event.target.value)} value={postalCode} />
            </label>
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>Skills</h3>
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
                  {formatCategory(category)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="crew-fit-panel__group">
          <h3>Days</h3>
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
          <h3>Preferences</h3>
          <div className="chip-row">
            {scheduleOptions.map((schedule) => (
              <button
                className={preferredSchedule === schedule ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
                key={schedule}
                onClick={() => setPreferredSchedule(schedule)}
                type="button"
              >
                {formatSchedulePreference(schedule)}
              </button>
            ))}
            <button
              className={hasOwnEquipment ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
              onClick={() => setHasOwnEquipment((current) => !current)}
              type="button"
            >
              Own equipment
            </button>
            <button
              className={winterWorkEnabled ? "button crew-fit-chip" : "button-secondary crew-fit-chip"}
              onClick={() => setWinterWorkEnabled((current) => !current)}
              type="button"
            >
              Winter work
            </button>
          </div>
          <div className="crew-fit-radius">
            <button
              className="button-secondary"
              onClick={() => setWillingToTravelMiles((current) => Math.max(5, current - 5))}
              type="button"
            >
              -5 miles
            </button>
            <span>{willingToTravelMiles} miles</span>
            <button
              className="button-secondary"
              onClick={() => setWillingToTravelMiles((current) => Math.min(60, current + 5))}
              type="button"
            >
              +5 miles
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="list-panel" role="alert">
            <strong>Signup failed</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create crew account"}
          </button>
          <a className="button-secondary" href="/crew">
            Back
          </a>
        </div>

        <SignupIdentityOptions role="crew-member" />
      </form>
    </section>
  );
}
