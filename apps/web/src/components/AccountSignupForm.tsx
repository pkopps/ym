"use client";

import { FormEvent, useState } from "react";
import { Address, ServiceCategory } from "@yardmatch/contracts";
import { useRouter } from "next/navigation";
import { createWebApiClient, saveStoredSession } from "../lib/api";
import { SignupIdentityOptions } from "./SignupIdentityOptions";

type AccountSignupRole = "customer" | "provider";

const defaultProviderCategories: ServiceCategory[] = ["lawn-mowing", "seasonal-cleanup"];

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

export function AccountSignupForm({ role }: { role: AccountSignupRole }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(15);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      router.push(role === "provider" ? "/provider/management" : "/customer/dashboard?flow=request");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this account right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card">
      <form className="auth-form-stack" onSubmit={handleSubmit}>
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

        <SignupIdentityOptions role={role} />
      </form>
    </section>
  );
}
