"use client";

import type { ProviderCrewMember } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

/** The provider's own crew: invite people by email and take them off the crew. */
export function ProviderCrewPanel({ crew, onChanged }: { crew: ProviderCrewMember[]; onChanged: (crew: ProviderCrewMember[]) => void }) {
  const i18n = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      const result = await createAuthenticatedWebApiClient().inviteProviderCrewMember({ fullName, email, phone: phone || undefined });
      onChanged(result.crew);
      setMessage(result.invite === "joined" ? i18n.t("provider_crew.joined", { name: fullName.trim() }) : i18n.t("provider_crew.invited", { email: email.trim() }));
      setFullName(""); setEmail(""); setPhone("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : i18n.t("provider_crew.error"));
    } finally {
      setWorking(false);
    }
  }

  async function remove(member: ProviderCrewMember) {
    if (!window.confirm(i18n.t("provider_crew.remove_confirm", { name: member.fullName }))) return;
    setWorking(true);
    setMessage("");
    try {
      onChanged((await createAuthenticatedWebApiClient().removeProviderCrewMember({ crewMemberId: member.crewMemberId })).crew);
      setMessage(i18n.t("provider_crew.removed", { name: member.fullName }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : i18n.t("provider_crew.error"));
    } finally {
      setWorking(false);
    }
  }

  return <div className="stack-md">
    {crew.length ? <ul className="provider-crew-list">{crew.map(member => <li key={member.crewMemberId}>
      <div><strong>{member.fullName}</strong><span>{member.email}</span></div>
      <button className="button-secondary" disabled={working} type="button" onClick={() => void remove(member)}>{i18n.t("provider_crew.remove")}</button>
    </li>)}</ul> : <p>{i18n.t("provider_crew.empty")}</p>}
    <form className="auth-form-stack" onSubmit={invite}>
      <h3>{i18n.t("provider_crew.invite_title")}</h3>
      <label className="form-field">{i18n.t("provider_crew.field.name")}<input required autoComplete="off" value={fullName} onChange={event => setFullName(event.target.value)} /></label>
      <label className="form-field">{i18n.t("provider_crew.field.email")}<input required type="email" autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="form-field">{i18n.t("provider_crew.field.phone")}<input type="tel" autoComplete="off" value={phone} onChange={event => setPhone(event.target.value)} /></label>
      <button className="button" disabled={working} type="submit">{working ? i18n.t("provider_crew.sending") : i18n.t("provider_crew.invite")}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </div>;
}
