"use client";

import { type ProviderProfile, type ProviderCredentialType } from "@yardmatch/contracts";
import { useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

const credentialTypes: ProviderCredentialType[] = ["business-registration", "general-liability-insurance", "workers-compensation", "commercial-auto-insurance", "pesticide-applicator-license"];

export function ProviderCredentialsPanel({ provider, onUpdated }: { provider: ProviderProfile; onUpdated: (provider: ProviderProfile) => void }) {
  const [type, setType] = useState<ProviderCredentialType>("business-registration");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      onUpdated(await createAuthenticatedWebApiClient().submitProviderCredential({ type, referenceNumber, jurisdiction: provider.address.state, expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59Z`).toISOString() : undefined }));
      setMessage("Credential submitted for review.");
      setReferenceNumber("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit credential."); }
    finally { setWorking(false); }
  }
  return <section className="list-panel">
    <h3>Business credentials</h3>
    <p>Submit your registration or policy reference for review. Marketplace approval and payout setup are separate. Your business engages, supervises, insures, and compensates its crew.</p>
    <ul>{provider.credentialReadiness?.requirements.map(requirement => <li key={requirement.type}>{requirement.label}: {requirement.reason}</li>)}</ul>
    <ul>{provider.credentials?.map(credential => <li key={credential.id}>{credential.type.replaceAll("-", " ")}: {credential.expiresAt && Date.parse(credential.expiresAt) <= Date.now() ? "expired" : credential.status} {credential.reviewNotes ? `— ${credential.reviewNotes}` : ""}</li>)}</ul>
    <form className="auth-form-stack" onSubmit={submit}>
      <label className="form-field">Credential type<select aria-label="Credential type" value={type} onChange={event => setType(event.target.value as ProviderCredentialType)}>{credentialTypes.map(value => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label>
      <label className="form-field">Registration or policy reference<input required value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} /></label>
      <label className="form-field">Credential expiration<input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
      <button className="button-secondary" disabled={working} type="submit">Submit credential</button>
    </form>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
