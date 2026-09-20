"use client";

import { CreateLaunchLeadRequest, LaunchLeadContactPreference, ServiceCategory } from "@yardmatch/contracts";
import { type TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryLabelKeys, serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";
import { getLaunchAttributionContext, persistLaunchLeadId } from "../lib/launchAttribution";

const contactMethodOptions: LaunchLeadContactPreference[] = ["email", "phone", "text"];
const contactMethodLabelKeys: Record<LaunchLeadContactPreference, TranslationKey> = {
  email: "launch_lead.contact.email",
  "platform-message": "launch_lead.contact.platform_message",
  phone: "launch_lead.contact.phone",
  text: "launch_lead.contact.text"
};
const serviceOptions = Object.keys(serviceCategoryLabelKeys) as ServiceCategory[];

export function LaunchLeadCaptureCard({
  requestSource,
  title,
  description,
  defaultAreaLabel,
  defaultServiceCategory,
  defaultMessage
}: {
  requestSource: string;
  title?: string;
  description?: string;
  defaultAreaLabel?: string;
  defaultServiceCategory?: ServiceCategory;
  defaultMessage?: string;
}) {
  const i18n = useI18n();
  const api = createWebApiClient();
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<LaunchLeadContactPreference>("email");
  const [areaLabel, setAreaLabel] = useState(defaultAreaLabel ?? "");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | "">(defaultServiceCategory ?? "");
  const [message, setMessage] = useState(defaultMessage ?? "");
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

      setStatusMessage(i18n.t("launch_lead.status.submitted"));
      setContactName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("launch_lead.error.submit"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <article className="card">
      <span className="eyebrow">{i18n.t("launch_lead.eyebrow")}</span>
      <h2>{title ?? i18n.t("launch_lead.title")}</h2>
      <p>
        {description ??
          i18n.t("launch_lead.description")}
      </p>
      <p>{i18n.t("launch_lead.default_contact")}</p>
      <div className="form-grid">
        <label className="form-field">
          <span>{i18n.t("launch_lead.name")}</span>
          <input onChange={(event) => setContactName(event.target.value)} value={contactName} />
        </label>
        <label className="form-field">
          <span>{i18n.t("launch_lead.contact.email")}</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder={i18n.t("launch_lead.email_placeholder")}
            type="email"
            value={email}
          />
        </label>
        <label className="form-field">
          <span>{i18n.t("launch_lead.contact.phone")}</span>
          <input
            onChange={(event) => setPhone(event.target.value)}
            placeholder={i18n.t("launch_lead.phone_placeholder")}
            type="tel"
            value={phone}
          />
        </label>
        <label className="form-field">
          <span>{i18n.t("launch_lead.preferred_follow_up")}</span>
          <select
            onChange={(event) => setPreferredContactMethod(event.target.value as LaunchLeadContactPreference)}
            value={preferredContactMethod}
          >
            {contactMethodOptions.map((option) => (
              <option key={option} value={option}>
                {i18n.t(contactMethodLabelKeys[option])}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{i18n.t("launch_lead.area")}</span>
          <input onChange={(event) => setAreaLabel(event.target.value)} value={areaLabel} />
        </label>
        <label className="form-field">
          <span>{i18n.t("customer_live.label.service")}</span>
          <select onChange={(event) => setServiceCategory(event.target.value as ServiceCategory | "")} value={serviceCategory}>
            <option value="">{i18n.t("launch_lead.not_sure")}</option>
            {serviceOptions.map((option) => (
              <option key={option} value={option}>
                {i18n.t(serviceCategoryToI18nKey(option))}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field form-field--full">
          <span>{i18n.t("launch_lead.help_question")}</span>
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder={i18n.t("launch_lead.help_placeholder")}
            rows={4}
            value={message}
          />
        </label>
      </div>
      <div className="cta-row" style={{ marginTop: "1rem" }}>
        <button data-analytics-action="send-coverage-inquiry" className="button" disabled={isWorking} onClick={() => void handleSubmit()} type="button">
          {isWorking ? i18n.t("chat.sending") : i18n.t("launch_lead.request_follow_up")}
        </button>
      </div>
      {statusMessage ? <p style={{ marginTop: "1rem" }}>{statusMessage}</p> : null}
      {errorMessage ? <p style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
    </article>
  );
}
