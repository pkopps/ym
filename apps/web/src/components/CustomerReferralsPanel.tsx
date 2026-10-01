"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildReferralInvitationHref, type CustomerReferral, type CustomerReferralChannel, type CustomerReferralsOverview } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function CustomerReferralsPanel() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  // A keyed form discards private state immediately when the signed-in identity changes.
  if (!sessionReady) return <div className="container"><LoadingSkeleton label={i18n.t("common.loading.content")} /></div>;
  if (session?.role !== "customer") return <section className="container referral-page stack-lg">
    <h1>{i18n.t("referrals.title")}</h1><p>{i18n.t("referrals.sign_in")}</p>
    <a className="button" href={addLocalePrefix("/login/customer", i18n.locale)}>{i18n.t("nav.log_in")}</a>
  </section>;
  return <ReferralForm key={session.token} />;
}

function ReferralForm() {
  const i18n = useI18n();
  const [overview, setOverview] = useState<CustomerReferralsOverview>();
  const [friendName, setFriendName] = useState("");
  const [channel, setChannel] = useState<CustomerReferralChannel>("email");
  const [contact, setContact] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<CustomerReferral>();
  const busy = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    createAuthenticatedWebApiClient().listCustomerReferrals().then((result) => {
      if (active) setOverview(result);
    }).catch(() => { if (active) setLoadError(i18n.t("referrals.load_error")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, i18n]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !overview) return;
    busy.current = true;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await createAuthenticatedWebApiClient().createCustomerReferral({ friendName, channel, contact, areaLabel, contactPermission: permission });
      setOverview((current) => current && ({ ...current,
        referrals: [result.referral, ...current.referrals.filter((item) => item.id !== result.referral.id)].slice(0, 100) }));
      setSelected(result.referral);
      setMessage(i18n.t(result.created ? "referrals.saved" : "referrals.duplicate"));
      setFriendName(""); setContact(""); setAreaLabel(""); setPermission(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : i18n.t("referrals.save_error")); }
    finally { busy.current = false; setSaving(false); }
  }

  const invitation = (referral: CustomerReferral) => i18n.t("referrals.invitation", {
    name: referral.friendName,
    url: overview ? new URL(addLocalePrefix("/customer", i18n.locale), overview.shareBaseUrl).toString() : ""
  });
  const href = (referral: CustomerReferral) => buildReferralInvitationHref(referral, i18n.t("referrals.subject"), invitation(referral),
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent));

  return <section className="container referral-page stack-lg">
    <div className="stack-sm"><h1>{i18n.t("referrals.title")}</h1><p>{i18n.t("referrals.description")}</p></div>
    <div className="referral-layout">
      <section className="card stack-lg">
        <p>{i18n.t("referrals.how")}</p>
        {loadError ? <div role="alert" className="stack-sm"><p>{loadError}</p><button className="button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>{i18n.t("referrals.retry")}</button></div> : null}
        <form className="stack-md" onSubmit={submit}>
          <fieldset disabled={saving || loading || !overview} className="referral-fields stack-md">
            <label className="stack-sm">{i18n.t("referrals.name")}<input autoComplete="off" required minLength={2} maxLength={80} value={friendName} onChange={(event) => setFriendName(event.target.value)} /></label>
            <label className="stack-sm">{i18n.t("referrals.channel")}<select value={channel} onChange={(event) => { setChannel(event.target.value as CustomerReferralChannel); setContact(""); setError(""); }}>
              <option value="email">{i18n.t("referrals.email")}</option><option value="phone">{i18n.t("referrals.phone")}</option>
            </select></label>
            <label className="stack-sm">{i18n.t(channel === "email" ? "referrals.email_address" : "referrals.phone_number")}<input type={channel === "email" ? "email" : "tel"} inputMode={channel === "email" ? "email" : "tel"} autoComplete="off" required maxLength={254} value={contact} onChange={(event) => setContact(event.target.value)} /></label>
            <label className="stack-sm">{i18n.t("referrals.area")}<input autoComplete="off" maxLength={100} value={areaLabel} onChange={(event) => setAreaLabel(event.target.value)} /></label>
            <label className="referral-permission"><input type="checkbox" required checked={permission} onChange={(event) => setPermission(event.target.checked)} /><span>{i18n.t("referrals.permission")}</span></label>
            <button className="button" type="submit">{i18n.t(saving ? "referrals.saving" : "referrals.save")}</button>
          </fieldset>
          {error ? <p role="alert">{error}</p> : null}
        </form>
        <small>{i18n.t("referrals.reward_note")}</small>
      </section>
      <section className="stack-lg">
        <div ref={resultRef} tabIndex={-1} className="referral-result stack-sm">
          {message ? <p role="status">{message}</p> : null}
          {selected ? <><h2>{selected.friendName}</h2><a className="button" href={href(selected)}>{i18n.t(selected.channel === "email" ? "referrals.open_email" : "referrals.open_text")}</a>
            <details><summary>{i18n.t("referrals.preview")}</summary><p className="referral-invitation">{invitation(selected)}</p></details></> : null}
        </div>
        <div className="stack-sm"><h2>{i18n.t("referrals.history")}</h2><p>{i18n.t("referrals.latest")}</p>
          <button className="button-secondary" type="button" disabled={loading || saving} onClick={() => setRefresh((value) => value + 1)}>{i18n.t("referrals.refresh")}</button></div>
        {loading ? <LoadingSkeleton label={i18n.t("common.loading.content")} /> : null}
        {!loading && !loadError && !overview?.referrals.length ? <p>{i18n.t("referrals.empty")}</p> : null}
        <ul className="referral-list stack-md">{overview?.referrals.map((referral) => <li key={referral.id} className="card stack-sm">
          <h3>{referral.friendName}</h3><span>{referral.contact}</span><small>{i18n.formatDate(referral.createdAt, { dateStyle: "medium" })} · {i18n.t(`referrals.status.${referral.status}`)}</small>
          <button type="button" className="button-secondary" onClick={() => { setSelected(referral); setMessage(""); requestAnimationFrame(() => resultRef.current?.focus()); }}>{i18n.t("referrals.preview")}</button>
        </li>)}</ul>
      </section>
    </div>
  </section>;
}
