"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Address, MarketplaceRole, PlaceSuggestion } from "@yardmatch/contracts";
import { addLocalePrefix, stripLocalePrefix, type SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useRouter, useSearchParams } from "next/navigation";
import { createWebApiClient, saveStoredSession } from "../../../lib/api";
import { getRoleRedirectPath } from "../../../lib/redirects";

const redirectByRole: Record<MarketplaceRole, string> = {
  customer: "/customer/dashboard",
  provider: "/provider/management",
  ops: "/ops",
  "crew-member": "/crew"
};

function localizeRedirectPath(path: string, locale: SupportedLocale) {
  return stripLocalePrefix(path).locale ? path : addLocalePrefix(path, locale);
}

function createEmptyAddress(): Address {
  return {
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    point: {
      latitude: 0,
      longitude: 0
    }
  };
}

export default function AuthCompletePage() {
  const i18n = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("authStatus");
  const role = (searchParams.get("role") as MarketplaceRole | null) ?? "customer";
  const returnTo = searchParams.get("returnTo");
  const [fullName, setFullName] = useState(searchParams.get("fullName") ?? "");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [address, setAddress] = useState<Address>(createEmptyAddress());
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressSearchMessage, setAddressSearchMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(searchParams.get("message") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const api = useMemo(() => createWebApiClient(i18n.locale), [i18n.locale]);

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    const token = searchParams.get("token");
    const expiresAtIso = searchParams.get("expiresAtIso");
    const email = searchParams.get("email");
    const userId = searchParams.get("userId");
    const storedFullName = searchParams.get("fullName");
    if (!token || !expiresAtIso || !email || !userId || !storedFullName) {
      setErrorMessage(i18n.t("auth_complete.error.missing_session_details"));
      return;
    }

    saveStoredSession({
      token,
      role,
      internalScope: undefined,
      email,
      userId,
      fullName: storedFullName,
      expiresAtIso
    });

    router.replace(localizeRedirectPath(getRoleRedirectPath(role, returnTo, redirectByRole[role] ?? "/"), i18n.locale));
    router.refresh();
  }, [i18n, returnTo, role, router, searchParams, status]);

  async function handleSearchAddress() {
    if (addressQuery.trim().length < 3) {
      setErrorMessage(i18n.t("auth_complete.error.address_too_short"));
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage("");
      const result = await api.searchPlaces(addressQuery.trim());
      setSuggestions(result.suggestions);
      setAddressSearchMessage(result.searchMessage ?? "");
      if (result.suggestions.length === 0) {
        setErrorMessage(i18n.t("auth_complete.error.no_addresses"));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("auth_complete.error.address_search_failed"));
      setAddressSearchMessage("");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pendingToken = searchParams.get("pendingToken");
    if (!pendingToken) {
      setErrorMessage(i18n.t("auth_complete.error.missing_signup_session"));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const envelope = await api.completeSocialSignup({
        pendingToken,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        address,
        ...(role === "provider" && companyName.trim() ? { companyName: companyName.trim() } : {})
      });

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        internalScope: envelope.user.role === "ops" ? envelope.user.internalScope : undefined,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.replace(localizeRedirectPath(getRoleRedirectPath(envelope.user.role, returnTo, redirectByRole[envelope.user.role]), i18n.locale));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("auth_complete.error.finish_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "success") {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">{i18n.t("auth_complete.success.eyebrow")}</span>
          <h1>{i18n.t("auth_complete.success.title")}</h1>
          <p>{i18n.t("auth_complete.success.body")}</p>
        </section>
      </main>
    );
  }

  if (status === "pending-signup") {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">{i18n.t("auth_complete.pending.eyebrow")}</span>
          <h1>{i18n.t("auth_complete.pending.title")}</h1>
          <p>{i18n.t("auth_complete.pending.body")}</p>
        </section>

        <section className="card">
          <form className="auth-form-stack" onSubmit={handleSubmit}>
            <div className="list-panel">
              <strong>{searchParams.get("email")}</strong>
              <p>
                {i18n.t(
                  role === "provider"
                    ? "auth_complete.role.provider"
                    : role === "ops"
                      ? "auth_complete.role.ops"
                      : role === "crew-member"
                        ? "auth_complete.role.crew"
                        : "auth_complete.role.customer"
                )}
              </p>
            </div>

            <div className="form-grid">
              <label className="form-field form-field--full">
                <span>{i18n.t("auth_signup.field.full_name")}</span>
                <input onChange={(event) => setFullName(event.target.value)} value={fullName} />
              </label>
              <label className="form-field">
                <span>{i18n.t("auth_signup.field.phone")}</span>
                <input onChange={(event) => setPhone(event.target.value)} placeholder="555-0100" value={phone} />
              </label>
              {role === "provider" ? (
                <label className="form-field">
                  <span>{i18n.t("auth_complete.field.company_name")}</span>
                  <input
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder={i18n.t("auth_complete.placeholder.business_name")}
                    value={companyName}
                  />
                </label>
              ) : null}
              <label className="form-field form-field--full">
                <span>{i18n.t("auth_complete.field.address_search")}</span>
                <div className="cta-row">
                  <input
                    onChange={(event) => setAddressQuery(event.target.value)}
                    placeholder={i18n.t("auth_complete.placeholder.address_search")}
                    value={addressQuery}
                  />
                  <button className="button-secondary" disabled={isSearching} onClick={() => void handleSearchAddress()} type="button">
                    {isSearching ? i18n.t("auth_complete.searching") : i18n.t("auth_complete.find_address")}
                  </button>
                </div>
              </label>
            </div>

            {suggestions.length > 0 ? (
              <div className="stack-sm">
                {suggestions.map((suggestion) => (
                  <button
                    className="list-panel"
                    key={suggestion.id}
                    onClick={() => {
                      setAddress(suggestion.address);
                      setAddressQuery(suggestion.label);
                      setSuggestions([]);
                    }}
                    style={{ textAlign: "left", width: "100%" }}
                    type="button"
                  >
                    <strong>{suggestion.label}</strong>
                    <p>
                      {suggestion.address.line1}, {suggestion.address.city}, {suggestion.address.state}{" "}
                      {suggestion.address.postalCode}
                    </p>
                    <p>
                      {suggestion.matchReason ??
                        i18n.t(
                          suggestion.source === "google-geocoding"
                            ? "customer.search.google_verified_area"
                            : "customer.search.suggested_area"
                        )}
                    </p>
                  </button>
                ))}
              </div>
            ) : addressSearchMessage ? (
              <p>{addressSearchMessage}</p>
            ) : null}

            <div className="list-panel">
              <strong>{i18n.t("auth_complete.selected_address")}</strong>
              <p>
                {address.line1
                  ? `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`
                  : i18n.t("auth_complete.choose_address")}
              </p>
            </div>

            {errorMessage ? (
              <div className="list-panel" role="alert">
                <strong>{i18n.t("auth_complete.error_title")}</strong>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className="cta-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? i18n.t("auth_signup.creating") : i18n.t("auth_complete.finish_account")}
              </button>
              <a
                className="button-secondary"
                href={addLocalePrefix(
                  role === "provider"
                    ? "/auth/provider/create"
                    : role === "ops"
                      ? "/help"
                      : role === "crew-member"
                        ? "/auth/crew"
                        : "/auth/customer",
                  i18n.locale
                )}
              >
                {i18n.t("auth_complete.start_over")}
              </a>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("auth_complete.issue.eyebrow")}</span>
        <h1>{i18n.t("auth_complete.issue.title")}</h1>
        <p>{errorMessage || i18n.t("auth_complete.issue.body")}</p>
      </section>

      <section className="card">
        <div className="cta-row">
          <a
            className="button"
            href={addLocalePrefix(
              role === "provider"
                ? "/login/provider"
                : role === "ops"
                  ? "/login/ops"
                  : role === "crew-member"
                    ? "/login/crew"
                    : "/login/customer",
              i18n.locale
            )}
          >
            {i18n.t("auth_complete.back_to_login")}
          </a>
          <a
            className="button-secondary"
            href={addLocalePrefix(
              role === "provider"
                ? "/auth/provider/create"
                : role === "ops"
                  ? "/help"
                  : role === "crew-member"
                    ? "/auth/crew"
                    : "/auth/customer",
              i18n.locale
            )}
          >
            {i18n.t("auth_complete.try_signup_again")}
          </a>
        </div>
      </section>
    </main>
  );
}
