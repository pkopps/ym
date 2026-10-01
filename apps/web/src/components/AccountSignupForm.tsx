"use client";

import { FormEvent, useEffect, useState } from "react";
import { Address, ServiceCategory, formatBookingWindowSummary } from "@yardmatch/contracts";
import { addLocalePrefix, stripLocalePrefix } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { createWebApiClient, getWebAuthDevice, saveStoredSession } from "../lib/api";
import { buildSocialAuthRedirectUri } from "../lib/socialAuth";
import { readBookingDraft } from "../lib/bookingJourney";
import { SignupIdentityOptions } from "./SignupIdentityOptions";
import {
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  customerCustomTimingWindowOptions,
  customerTimingOptions
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

function parseCarriedPoint(searchParams: ReturnType<typeof useSearchParams>) {
  const latitudeValue = searchParams.get("lat")?.trim();
  const longitudeValue = searchParams.get("lng")?.trim();
  if (!latitudeValue || !longitudeValue) {
    return undefined;
  }

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }

  return { latitude, longitude };
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
  const i18n = useI18n();
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
  const carriedCity = role === "customer" ? getSearchParamValue(searchParams, "city") : "";
  const carriedState = role === "customer" ? getSearchParamValue(searchParams, "state") : "";
  const carriedPostalCode = role === "customer" ? getSearchParamValue(searchParams, "postalCode") : "";
  const carriedPoint = role === "customer" ? parseCarriedPoint(searchParams) : undefined;
  const carriedSlotLabel = formatCarriedSlotLabel(carriedSlot);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(15);
  const [bookingAddress, setBookingAddress] = useState<Address>();
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(carriedCity);
  const [state, setState] = useState(carriedState);
  const [postalCode, setPostalCode] = useState(carriedPostalCode);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const shouldShowCustomerIntent = role === "customer" && (carriedService || carriedTiming || carriedArea || carriedProviderName);
  const postSignupRedirectPath = buildPostSignupRedirectPath();
  const localizedPostSignupRedirectPath = addLocalePrefix(postSignupRedirectPath, i18n.locale);
  const customerLoginHref = addLocalePrefix(
    `/login/customer?returnTo=${encodeURIComponent(localizedPostSignupRedirectPath)}`,
    i18n.locale
  );
  const socialRedirectUri = buildSocialAuthRedirectUri({ role, returnTo: localizedPostSignupRedirectPath });

  useEffect(() => {
    setIsHydrated(true);
    const draftId = searchParams.get("draft");
    const draft = role === "customer" && draftId ? readBookingDraft(draftId) : undefined;
    if (draft) {
      setBookingAddress(draft.address); setLine1(draft.address.line1); setLine2(draft.address.line2 ?? "");
      setCity(draft.address.city); setState(draft.address.state); setPostalCode(draft.address.postalCode);
    }
  }, [role, searchParams]);

  function buildPostSignupRedirectPath() {
    if (role === "provider") {
      return "/provider/management";
    }

    const bookingReturn = stripLocalePrefix(searchParams.get("returnTo") ?? "").path;
    if (/^\/customer\/booking\/review\?draft=[a-zA-Z0-9-]{16,80}$/.test(bookingReturn)) return bookingReturn;
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
      setErrorMessage(i18n.t("auth_signup.error.passwords_mismatch"));
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setErrorMessage(i18n.t("auth_signup.error.contact_address_required"));
      return;
    }

    if (role === "provider" && !companyName.trim()) {
      setErrorMessage(i18n.t("auth_signup.error.business_name_required"));
      return;
    }

    const canReuseCarriedPoint = Boolean(
      carriedPoint &&
      city.trim().toLowerCase() === carriedCity.toLowerCase() &&
      state.trim().toUpperCase() === carriedState.toUpperCase() &&
      postalCode.trim() === carriedPostalCode
    );
    const address: Address = {
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      city: city.trim(),
      state: state.trim().toUpperCase(),
      postalCode: postalCode.trim(),
      country: "US",
      point: bookingAddress && city.trim().toLowerCase() === bookingAddress.city.toLowerCase() && state.trim().toUpperCase() === bookingAddress.state.toUpperCase() && postalCode.trim() === bookingAddress.postalCode
        ? bookingAddress.point : canReuseCarriedPoint && carriedPoint ? carriedPoint : buildEstimatedPoint(state, postalCode)
    };
    const resolvedServiceRadiusMiles = Number.isFinite(serviceRadiusMiles)
      ? Math.min(60, Math.max(5, serviceRadiusMiles))
      : 15;

    try {
      setIsSubmitting(true);
      const api = createWebApiClient(i18n.locale);
      const envelope = await api.registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        role,
        address,
        device: getWebAuthDevice(),
        ...(role === "provider"
          ? {
              companyName: companyName.trim(),
              serviceRadiusMiles: resolvedServiceRadiusMiles,
              categories: defaultProviderCategories
            }
          : {
              propertyLabel: i18n.t("auth_signup.default_property_label")
            })
      });

      if (envelope.user.role !== role) {
        throw new Error(
          i18n.t("auth_signup.error.role_mismatch", {
            actualRole: envelope.user.role,
            expectedRole: role
          })
        );
      }

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.push(localizedPostSignupRedirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("auth_signup.error.create_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card auth-signup-card">
      <form data-analytics-form="signup" className="auth-form-stack" onSubmit={handleSubmit}>
        {shouldShowCustomerIntent ? <details className="auth-intent-compact">
          <summary>{carriedProviderName || i18n.t("journey.review_request")} · {carriedService ? i18n.t(serviceCategoryToI18nKey(carriedService)) : carriedArea}</summary>
          <p>{carriedSlotLabel} · {carriedArea}</p><p>{i18n.t("journey.saved_details")}</p>
        </details> : null}
        <SignupIdentityOptions redirectUri={socialRedirectUri} role={role} />
        <div className="form-grid">
          <label className="form-field form-field--full">
            <span>{i18n.t("auth_signup.field.full_name")}</span>
            <input
              disabled={!isHydrated || isSubmitting}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={i18n.t("auth_signup.placeholder.full_name")}
              value={fullName}
            />
          </label>
          {role === "provider" ? (
            <label className="form-field form-field--full">
              <span>{i18n.t("auth_signup.field.business_name")}</span>
              <input
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={i18n.t("auth_signup.placeholder.business_name_example")}
                value={companyName}
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.email")}</span>
            <input onChange={(event) => setEmail(event.target.value)} placeholder={i18n.t("auth_signup.placeholder.email")} value={email} />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.phone")}</span>
            <input onChange={(event) => setPhone(event.target.value)} placeholder="555-0300" value={phone} />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.password")}</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder={i18n.t("auth_signup.placeholder.password")}
              type="password"
              value={password}
            />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.confirm_password")}</span>
            <input
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={i18n.t("auth_signup.placeholder.confirm_password")}
              type="password"
              value={confirmPassword}
            />
          </label>
          <label className="form-field form-field--full">
            <span>{i18n.t(role === "provider" ? "auth_signup.field.business_address" : "auth_signup.field.service_address")}</span>
            <input onChange={(event) => setLine1(event.target.value)} placeholder={i18n.t("auth_signup.placeholder.street")} value={line1} />
          </label>
          <label className="form-field form-field--full">
            <span>{i18n.t("auth_signup.field.address_line_2")}</span>
            <input onChange={(event) => setLine2(event.target.value)} placeholder={i18n.t("auth_signup.placeholder.optional")} value={line2} />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.city")}</span>
            <input onChange={(event) => setCity(event.target.value)} placeholder={i18n.t("auth_signup.placeholder.city")} value={city} />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.state")}</span>
            <input onChange={(event) => setState(event.target.value)} placeholder="NJ" value={state} />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.zip")}</span>
            <input onChange={(event) => setPostalCode(event.target.value)} placeholder="08005" value={postalCode} />
          </label>
          {role === "provider" ? (
            <label className="form-field">
              <span>{i18n.t("auth_signup.field.service_radius")}</span>
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
          {i18n.t("auth_signup.password_helper")}
        </p>

        {errorMessage ? (
          <div className="list-panel" role="alert">
            <strong>{i18n.t("auth_signup.error_title")}</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button" disabled={!isHydrated || isSubmitting} type="submit">
            {isSubmitting ? i18n.t("auth_signup.creating") : i18n.t("auth_signup.create_account")}
          </button>
          {role === "customer" ? (
            <a className="button-secondary" href={customerLoginHref}>
              {i18n.t("auth_signup.log_in_continue")}
            </a>
          ) : null}
          <a className="button-secondary" href={addLocalePrefix(role === "provider" ? "/provider" : "/auth", i18n.locale)}>
            {i18n.t("common.actions.back")}
          </a>
        </div>


      </form>
    </section>
  );
}
