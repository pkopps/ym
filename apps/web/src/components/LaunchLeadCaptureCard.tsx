"use client";

import { CreateLaunchLeadRequest, LaunchLeadContactPreference, ServiceCategory } from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";
import { getLaunchAttributionContext, persistLaunchLeadId } from "../lib/launchAttribution";

const contactMethodOptions: LaunchLeadContactPreference[] = ["email", "phone", "text"];
const serviceOptions: ServiceCategory[] = [
  "lawn-mowing",
  "seasonal-cleanup",
  "hedge-trimming",
  "mulch-installation",
  "weed-control",
  "gutter-cleaning"
];

export function LaunchLeadCaptureCard({
  requestSource,
  title,
  description,
  defaultAreaLabel,
  defaultServiceCategory
}: {
  requestSource: string;
  title?: string;
  description?: string;
  defaultAreaLabel?: string;
  defaultServiceCategory?: ServiceCategory;
}) {
  const api = createWebApiClient();
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<LaunchLeadContactPreference>("email");
  const [areaLabel, setAreaLabel] = useState(defaultAreaLabel ?? "");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | "">(defaultServiceCategory ?? "");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    setAreaLabel(defaultAreaLabel ?? "");
  }, [defaultAreaLabel]);

  useEffect(() => {
    setServiceCategory(defaultServiceCategory ?? "");
  }, [defaultServiceCategory]);

  async function handleSubmit() {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);

      const lead = await api.createLaunchLead({
        sourceChannel: "website",
        requestSource,
        attribution: getLaunchAttributionContext(),
        contactName,
        email,
        phone: phone.trim() || undefined,
        preferredContactMethod,
        areaLabel,
        serviceCategory: serviceCategory || undefined,
        message
      } satisfies CreateLaunchLeadRequest);
      persistLaunchLeadId(lead.id);

      setStatusMessage("Thanks. YardMatch will follow up within the launch response window.");
      setContactName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send that follow-up request right now.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <article className="card">
      <span className="eyebrow">Launch follow-up</span>
      <h2>{title ?? "Need help before you book?"}</h2>
      <p>
        {description ??
          "If you are not ready to go straight into the request flow, YardMatch can follow up, confirm coverage, and help you choose the right next step."}
      </p>
      <p>Email is the default contact path, with phone or text available when you ask for it.</p>
      <div className="form-grid">
        <label className="form-field">
          <span>Name</span>
          <input onChange={(event) => setContactName(event.target.value)} value={contactName} />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder="homeowner@example.com"
            type="email"
            value={email}
          />
        </label>
        <label className="form-field">
          <span>Phone</span>
          <input
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Optional unless you want text or phone follow-up"
            type="tel"
            value={phone}
          />
        </label>
        <label className="form-field">
          <span>Preferred follow-up</span>
          <select
            onChange={(event) => setPreferredContactMethod(event.target.value as LaunchLeadContactPreference)}
            value={preferredContactMethod}
          >
            {contactMethodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Town or area</span>
          <input onChange={(event) => setAreaLabel(event.target.value)} value={areaLabel} />
        </label>
        <label className="form-field">
          <span>Service</span>
          <select onChange={(event) => setServiceCategory(event.target.value as ServiceCategory | "")} value={serviceCategory}>
            <option value="">Not sure yet</option>
            {serviceOptions.map((option) => (
              <option key={option} value={option}>
                {serviceCategoryLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field form-field--full">
          <span>What do you need help with?</span>
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell YardMatch what service you need, when you need it, and anything that might affect coverage or pricing."
            rows={4}
            value={message}
          />
        </label>
      </div>
      <div className="cta-row" style={{ marginTop: "1rem" }}>
        <button className="button" disabled={isWorking} onClick={() => void handleSubmit()} type="button">
          {isWorking ? "Sending..." : "Request follow-up"}
        </button>
      </div>
      {statusMessage ? <p style={{ marginTop: "1rem" }}>{statusMessage}</p> : null}
      {errorMessage ? <p style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
    </article>
  );
}
