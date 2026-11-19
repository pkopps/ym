"use client";

import { type ProviderCredentialStatus, type ProviderProfile, type ProviderCredentialType } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { useRef, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { readEvidenceImage } from "../lib/imageUploads";

const credentialTypes: ProviderCredentialType[] = ["business-registration", "general-liability-insurance", "workers-compensation", "commercial-auto-insurance", "pesticide-applicator-license"];
const MAX_PDF_BYTES = 1_500_000;
const typeLabelKeys = {
  "business-registration": "provider_credentials.type.business_registration",
  "general-liability-insurance": "provider_credentials.type.general_liability_insurance",
  "workers-compensation": "provider_credentials.type.workers_compensation",
  "commercial-auto-insurance": "provider_credentials.type.commercial_auto_insurance",
  "pesticide-applicator-license": "provider_credentials.type.pesticide_applicator_license"
} as const satisfies Record<ProviderCredentialType, string>;
const statusLabelKeys = {
  "pending-review": "provider_credentials.status.pending_review",
  verified: "provider_credentials.status.verified",
  rejected: "provider_credentials.status.rejected",
  expired: "provider_credentials.status.expired"
} as const satisfies Record<ProviderCredentialStatus, string>;

function readPdf(file: File, tooLarge: string): Promise<string> {
  if (file.size > MAX_PDF_BYTES) return Promise.reject(new Error(tooLarge));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error(tooLarge)));
    reader.readAsDataURL(file);
  });
}

export function ProviderCredentialsPanel({ provider, onUpdated }: { provider: ProviderProfile; onUpdated: (provider: ProviderProfile) => void }) {
  const i18n = useI18n();
  const typeLabel = (value: ProviderCredentialType) => i18n.t(typeLabelKeys[value]);
  const [type, setType] = useState<ProviderCredentialType>("business-registration");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!referenceNumber.trim() && !file) {
      setMessage(i18n.t("provider_credentials.error.nothing_to_send"));
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const documentDataUrl = file
        ? file.type === "application/pdf" ? await readPdf(file, i18n.t("provider_credentials.error.too_large")) : await readEvidenceImage(file)
        : undefined;
      onUpdated(await createAuthenticatedWebApiClient().submitProviderCredential({
        type, referenceNumber: referenceNumber.trim() || undefined, documentDataUrl, jurisdiction: provider.address.state,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59Z`).toISOString() : undefined
      }));
      setMessage(i18n.t("provider_credentials.submitted"));
      setReferenceNumber("");
      setFile(undefined);
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) { setMessage(error instanceof Error ? error.message : i18n.t("provider_credentials.error.generic")); }
    finally { setWorking(false); }
  }
  const statusLabel = (status: ProviderCredentialStatus, expired: boolean) => i18n.t(expired ? statusLabelKeys.expired : statusLabelKeys[status]);
  return <section className="list-panel" id="provider-credentials">
    <h3>{i18n.t("provider_credentials.title")}</h3>
    <p>{i18n.t("provider_credentials.body")}</p>
    <ul>{provider.credentialReadiness?.requirements.map(requirement => <li key={requirement.type}><strong>{typeLabel(requirement.type)}</strong>: {requirement.reason}</li>)}</ul>
    {provider.credentials?.length ? <ul>{provider.credentials.map(credential => <li key={credential.id}>
      {typeLabel(credential.type)}: {statusLabel(credential.status, Boolean(credential.expiresAt && Date.parse(credential.expiresAt) <= Date.now()))}
      {credential.documentUrl ? ` · ${i18n.t("provider_credentials.document_attached")}` : ""}
      {credential.reviewNotes ? ` — ${credential.reviewNotes}` : ""}
    </li>)}</ul> : null}
    <form className="auth-form-stack" onSubmit={submit} noValidate>
      <label className="form-field">{i18n.t("provider_credentials.field.type")}<select aria-label={i18n.t("provider_credentials.field.type")} value={type} onChange={event => setType(event.target.value as ProviderCredentialType)}>{credentialTypes.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}</select></label>
      <label className="form-field">{i18n.t("provider_credentials.field.document")}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0])} /><small>{i18n.t("provider_credentials.field.document_help")}</small></label>
      <label className="form-field">{i18n.t("provider_credentials.field.reference")}<input value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} /></label>
      <label className="form-field">{i18n.t("provider_credentials.field.expires")}<input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
      <button className="button-secondary" disabled={working} type="submit">{working ? i18n.t("provider_credentials.sending") : i18n.t("provider_credentials.submit")}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </section>;
}
