"use client";

import { FormEvent, useState } from "react";
import { Address, ServiceCategory, formatBookingWindowSummary } from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { createWebApiClient, saveStoredSession } from "../lib/api";
import { SignupIdentityOptions } from "./SignupIdentityOptions";
import {
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  customerCustomTimingWindowOptions,
  customerTimingOptions,
  getCustomerTimingLabel
} from "./PublicMarketplaceSearchShell";

type AccountSignupRole = "customer" | "provider";

const defaultProviderCategories: ServiceCategory[] = ["lawn-mowing", "seasonal-cleanup"];
const customerTimingValues = new Set<CustomerTimingPreference>([
  ...customerTimingOptions.map((option) => option.value),
  "custom-date",
  "custom-range"
]);
const customerCustomTimingWindowValues = new Set<CustomerCustomTimingWindow>(
  customerCustomTimingWindowOptions.map((option) => option.value)
);

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

function getSearchParamValue(searchParams: ReturnType<typeof useSearchParams>, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function parseServiceCategory(value: string | null): ServiceCategory | undefined {
  if (!value || !Object.prototype.hasOwnProperty.call(serviceCategoryLabels, value)) {
    return undefined;
  }

  return value as ServiceCategory;
}

function parseCustomerTiming(value: string | null): CustomerTimingPreference | undefined {
  if (!value || !customerTimingValues.has(value as CustomerTimingPreference)) {
    return undefined;
  }

  return value as CustomerTimingPreference;
}

function parseCustomTimingWindow(value: string | null): CustomerCustomTimingWindow {
  if (!value || !customerCustomTimingWindowValues.has(value as CustomerCustomTimingWindow)) {
    return "morning";
  }

  return value as CustomerCustomTimingWindow;
}

function formatCarriedSlotLabel(value: string) {
  if (!value) {
    return "";
  }

  try {
    return formatBookingWindowSummary(value);
  } catch {
    return "";
  }
}

export function AccountSignupForm({ role }: { role: AccountSignupRole }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const carriedService = role === "customer" ? parseServiceCategory(searchParams.get("service")) : undefined;
  const carriedTiming = role === "customer" ? parseCustomerTiming(searchParams.get("when")) : undefined;
  const carriedCustomDate = role === "customer" ? getSearchParamValue(searchParams, "date") || getSearchParamValue(searchParams, "start") : "";
  const carriedCustomWindow = role === "customer" ? parseCustomTimingWindow(searchParams.get("window")) : "morning";
  const carriedArea = role === "customer" ? getSearchParamValue(searchParams, "area") : "";
  const carriedProviderId = role === "customer" ? getSearchParamValue(searchParams, "providerId") : "";
  const carriedProviderName = role === "customer" ? getSearchParamValue(searchParams, "providerName") : "";
  const carriedProviderRank = role === "customer" ? getSearchParamValue(searchParams, "rank") : "";
  const carriedSlot = role === "customer" ? getSearchParamValue(searchParams, "slot") : "";
  const carriedSlotLabel = formatCarriedSlotLabel(carriedSlot);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(15);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(() => (role === "customer" ? getSearchParamValue(searchParams, "city") : ""));
  const [state, setState] = useState(() => (role === "customer" ? getSearchParamValue(searchParams, "state") : ""));
  const [postalCode, setPostalCode] = useState(() =>
    role === "customer" ? getSearchParamValue(searchParams, "postalCode") : ""
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shouldShowCustomerIntent = role === "customer" && (carriedService || carriedTiming || carriedArea || carriedProviderName);
  const postSignupRedirectPath = buildPostSignupRedirectPath();
  const socialRedirectUri =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/auth/complete?role=${encodeURIComponent(role)}&returnTo=${encodeURIComponent(postSignupRedirectPath)}`;

  function buildPostSignupRedirectPath() {
    if (role === "provider") {
      return "/provider/management";
    }

    const redirectParams = new URLSearchParams({ flow: "request" });
    if (carriedService) {
      redirectParams.set("service", carriedService);
    }
    if (carriedTiming) {
      redirectParams.set("when", carriedTiming);
    }
    if ((carriedTiming === "custom-date" || carriedTiming === "custom-range") && carriedCustomDate) {
      redirectParams.set("date", carriedCustomDate);
      redirectParams.set("window", carriedCustomWindow);
    }
    if (carriedProviderId) {
      redirectParams.set("providerId", carriedProviderId);
    }
    if (carriedProviderName) {
      redirectParams.set("providerName", carriedProviderName);
    }
    if (carriedProviderRank) {
      redirectParams.set("rank", carriedProviderRank);
    }
    if (carriedSlot) {
      redirectParams.set("slot", carriedSlot);
    }

    return `/customer/dashboard?${redirectParams.toString()}`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setErrorMessage("Add your contact and address details to create the account.");
      return;
    }

    if (role === "provider" && !companyName.trim()) {
      setErrorMessage("Add your business name to create a provider account.");
      return;
    }

    const address: Address = {
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      city: city.trim(),
      state: state.trim().toUpperCase(),
      postalCode: postalCode.trim(),
      country: "US",
      point: buildEstimatedPoint(state, postalCode)
    };
    const resolvedServiceRadiusMiles = Number.isFinite(serviceRadiusMiles)
      ? Math.min(60, Math.max(5, serviceRadiusMiles))
      : 15;

    try {
      setIsSubmitting(true);
      const api = createWebApiClient();
      const envelope = await api.registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        role,
        address,
        ...(role === "provider"
          ? {
              companyName: companyName.trim(),
              serviceRadiusMiles: resolvedServiceRadiusMiles,
              categories: defaultProviderCategories
            }
          : {
              propertyLabel: "Primary property"
            })
      });

      if (envelope.user.role !== role) {
        throw new Error(`This account was created as ${envelope.user.role}, not ${role}.`);
      }

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.push(postSignupRedirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this account right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card auth-signup-card">
      <form className="auth-form-stack" onSubmit={handleSubmit}>
        {shouldShowCustomerIntent ? (
          <div className="auth-intent-panel">
            <div className="auth-intent-panel__header">
              <div>
                <span className="eyebrow">Selected request</span>
                <h2>{carriedProviderName || "YardMatch request"}</h2>
              </div>
              {carriedProviderRank ? <span className="result-badge">Match {carriedProviderRank}</span> : null}
            </div>
            <div className="auth-intent-panel__grid" aria-label="Signup request summary">
              {carriedService ? (
                <div>
                  <span>Service</span>
                  <strong>{serviceCategoryLabels[carriedService]}</strong>
                </div>
              ) : null}
              {carriedTiming ? (
                <div>
                  <span>When</span>
                  <strong>{getCustomerTimingLabel(carriedTiming, carriedCustomDate, carriedCustomWindow)}</strong>
                </div>
              ) : null}
              {carriedSlotLabel ? (
                <div>
                  <span>Opening</span>
                  <strong>{carriedSlotLabel}</strong>
                </div>
              ) : null}
              {carriedArea ? (
                <div>
                  <span>Area</span>
                  <strong>{carriedArea}</strong>
                </div>
              ) : null}
            </div>
            <p className="auth-intent-panel__note">Create your account to save the property and continue the request. No payment yet.</p>
          </div>
        ) : null}
        <div className="form-grid">
          <label className="form-field form-field--full">
            <span>Full name</span>
            <input onChange={(event) => setFullName(event.target.value)} placeholder="Maya Brooks" value={fullName} />
          </label>
          {role === "provider" ? (
            <label className="form-field form-field--full">
              <span>Business name</span>
              <input
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="GreenStride Lawn Care"
                value={companyName}
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" value={email} />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input onChange={(event) => setPhone(event.target.value)} placeholder="555-0300" value={phone} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              type="password"
              value={password}
            />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
              type="password"
              value={confirmPassword}
            />
          </label>
          <label className="form-field form-field--full">
            <span>{role === "provider" ? "Business address" : "Service address"}</span>
            <input onChange={(event) => setLine1(event.target.value)} placeholder="170 5th Ave" value={line1} />
          </label>
          <label className="form-field form-field--full">
            <span>Address line 2</span>
            <input onChange={(event) => setLine2(event.target.value)} placeholder="Optional" value={line2} />
          </label>
          <label className="form-field">
            <span>City</span>
            <input onChange={(event) => setCity(event.target.value)} placeholder="Barnegat" value={city} />
          </label>
          <label className="form-field">
            <span>State</span>
            <input onChange={(event) => setState(event.target.value)} placeholder="NJ" value={state} />
          </label>
          <label className="form-field">
            <span>ZIP</span>
            <input onChange={(event) => setPostalCode(event.target.value)} placeholder="08005" value={postalCode} />
          </label>
          {role === "provider" ? (
            <label className="form-field">
              <span>Service radius</span>
              <input
                max={60}
                min={5}
                onChange={(event) => setServiceRadiusMiles(Number(event.target.value))}
                type="number"
                value={serviceRadiusMiles}
              />
            </label>
          ) : null}
        </div>

        <p className="auth-helper">
          Passwords must be at least 8 characters and include uppercase, lowercase, and a number.
        </p>

        {errorMessage ? (
          <div className="list-panel" role="alert">
            <strong>Signup failed</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
          <a className="button-secondary" href={role === "provider" ? "/provider" : "/auth"}>
            Back
          </a>
        </div>

        <SignupIdentityOptions redirectUri={socialRedirectUri} role={role} />
      </form>
    </section>
  );
}
