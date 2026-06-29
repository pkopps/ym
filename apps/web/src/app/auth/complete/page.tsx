"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Address, MarketplaceRole, PlaceSuggestion } from "@yardmatch/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { createWebApiClient, saveStoredSession } from "../../../lib/api";

const redirectByRole: Record<MarketplaceRole, string> = {
  customer: "/customer/dashboard",
  provider: "/provider/management",
  ops: "/ops",
  "crew-member": "/crew"
};

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("authStatus");
  const role = (searchParams.get("role") as MarketplaceRole | null) ?? "customer";
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
  const api = useMemo(() => createWebApiClient(), []);

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
      setErrorMessage("The social sign-in callback was missing session details.");
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

    router.replace(redirectByRole[role] ?? "/");
    router.refresh();
  }, [role, router, searchParams, status]);

  async function handleSearchAddress() {
    if (addressQuery.trim().length < 3) {
      setErrorMessage("Enter at least a few characters so we can find your address.");
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage("");
      const result = await api.searchPlaces(addressQuery.trim());
      setSuggestions(result.suggestions);
      setAddressSearchMessage(result.searchMessage ?? "");
      if (result.suggestions.length === 0) {
        setErrorMessage("No matching addresses were found yet. Try a fuller street, city, or ZIP.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to search addresses right now.");
      setAddressSearchMessage("");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pendingToken = searchParams.get("pendingToken");
    if (!pendingToken) {
      setErrorMessage("The social signup session is missing. Start again from the sign-up page.");
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

      router.replace(redirectByRole[envelope.user.role]);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to finish the social signup right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "success") {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">Finishing sign-in</span>
          <h1>Taking you into YardMatch.</h1>
          <p>Saving your session and opening the right workspace.</p>
        </section>
      </main>
    );
  }

  if (status === "pending-signup") {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">Finish your account</span>
          <h1>One more step to create your YardMatch profile.</h1>
          <p>We already verified your email. Add the contact and address details your role needs.</p>
        </section>

        <section className="card">
          <form className="auth-form-stack" onSubmit={handleSubmit}>
            <div className="list-panel">
              <strong>{searchParams.get("email")}</strong>
              <p>
                {role === "provider"
                  ? "Business owner"
                  : role === "ops"
                    ? "Operations"
                    : role === "crew-member"
                      ? "Crew member"
                      : "Property owner"}{" "}
                account
              </p>
            </div>

            <div className="form-grid">
              <label className="form-field form-field--full">
                <span>Full name</span>
                <input onChange={(event) => setFullName(event.target.value)} value={fullName} />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input onChange={(event) => setPhone(event.target.value)} placeholder="555-0100" value={phone} />
              </label>
              {role === "provider" ? (
                <label className="form-field">
                  <span>Company name</span>
                  <input
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Your business name"
                    value={companyName}
                  />
                </label>
              ) : null}
              <label className="form-field form-field--full">
                <span>Address search</span>
                <div className="cta-row">
                  <input
                    onChange={(event) => setAddressQuery(event.target.value)}
                    placeholder="Search your address, city, or ZIP"
                    value={addressQuery}
                  />
                  <button className="button-secondary" disabled={isSearching} onClick={() => void handleSearchAddress()} type="button">
                    {isSearching ? "Searching..." : "Find address"}
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
                    <p>{suggestion.matchReason ?? (suggestion.source === "google-geocoding" ? "Google-verified area" : "Suggested area")}</p>
                  </button>
                ))}
              </div>
            ) : addressSearchMessage ? (
              <p>{addressSearchMessage}</p>
            ) : null}

            <div className="list-panel">
              <strong>Selected address</strong>
              <p>
                {address.line1
                  ? `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`
                  : "Search and choose your address before continuing."}
              </p>
            </div>

            {errorMessage ? (
              <div className="list-panel" role="alert">
                <strong>We still need one more thing</strong>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className="cta-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating account..." : "Finish account"}
              </button>
              <a
                className="button-secondary"
                href={
                  role === "provider"
                    ? "/auth/provider/create"
                    : role === "ops"
                      ? "/help"
                      : role === "crew-member"
                        ? "/auth/crew"
                        : "/auth/customer"
                }
              >
                Start over
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
        <span className="eyebrow">Sign-in issue</span>
        <h1>We couldn&apos;t finish that social sign-in.</h1>
        <p>{errorMessage || "Try again, or use your email and password while we sort it out."}</p>
      </section>

      <section className="card">
        <div className="cta-row">
          <a
            className="button"
            href={
              role === "provider"
                ? "/login/provider"
                : role === "ops"
                  ? "/login/ops"
                  : role === "crew-member"
                    ? "/login/crew"
                    : "/login/customer"
            }
          >
            Back to login
          </a>
          <a
            className="button-secondary"
            href={
              role === "provider"
                ? "/auth/provider/create"
                : role === "ops"
                  ? "/help"
                  : role === "crew-member"
                    ? "/auth/crew"
                    : "/auth/customer"
            }
          >
            Try sign up again
          </a>
        </div>
      </section>
    </main>
  );
}
