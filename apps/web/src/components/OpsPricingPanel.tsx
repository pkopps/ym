"use client";
import { useEffect, useState, type FormEvent } from "react";
import { defaultServiceStartingPrices, parsePriceDollars, type ServiceCategory, type ZipServiceMinimumRecord } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { createAuthenticatedWebApiClient } from "../lib/api";
export function OpsPricingPanel() {
  const i18n = useI18n();
  const [zip, setZip] = useState("08005");
  const [category, setCategory] = useState<ServiceCategory>("lawn-mowing");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [records, setRecords] = useState<ZipServiceMinimumRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true; setRecords([]); setMessage(""); setError("");
    if (/^\d{5}$/.test(zip)) createAuthenticatedWebApiClient().getOpsPricingMinimums(zip)
      .then(rows => { if (active) setRecords(rows); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [zip]);
  const selected = records.find(row => row.category === category);
  async function save(event: FormEvent) {
    event.preventDefault(); const cents = parsePriceDollars(amount); if (!cents || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const record = await createAuthenticatedWebApiClient().updateZipServiceMinimum({ postalCode: zip, category, minimumStartingPriceCents: cents, reason });
      setRecords(current => [...current.filter(row => row.category !== record.category), record]);
      setAmount(""); setReason(""); setMessage(i18n.t("pricing.saved"));
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("pricing.error")); }
    finally { setBusy(false); }
  }
  return <section className="card stack-md"><h2>{i18n.t("pricing.ops_title")}</h2><p>{i18n.t("pricing.ops_description")}</p>
    <form onSubmit={save} className="stack-md"><div className="form-grid">
      <label className="form-field"><span>{i18n.t("pricing.zip")}</span><input value={zip} disabled={busy} pattern="[0-9]{5}" maxLength={5} required onChange={e => setZip(e.target.value)} /></label>
      <label className="form-field"><span>{i18n.t("pricing.service")}</span><select value={category} disabled={busy} onChange={e => setCategory(e.target.value as ServiceCategory)}>{(Object.keys(defaultServiceStartingPrices) as ServiceCategory[]).map(item => <option value={item} key={item}>{i18n.t(serviceCategoryLabelKeys[item])}</option>)}</select></label>
      <label className="form-field"><span>{i18n.t("pricing.new_minimum")}</span><input type="number" min="0.01" max="10000" step="0.01" required disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label className="form-field"><span>{i18n.t("pricing.reason")}</span><input required minLength={5} maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
    </div><p>{selected ? i18n.t("pricing.minimum", { amount: i18n.formatCurrency(selected.minimumStartingPriceCents, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }) : i18n.t("pricing.not_configured")}</p>
    <button className="button" disabled={busy || !parsePriceDollars(amount)}>{i18n.t("pricing.save_minimum")}</button></form>
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {selected?.history.length ? <details><summary>{i18n.t("pricing.history")}</summary><ul>{[...selected.history].reverse().map((entry, index) => <li key={index}>{i18n.formatDate(entry.changedAt, { dateStyle: "short", timeStyle: "short" })} · {i18n.formatCurrency(entry.minimumStartingPriceCents, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {entry.changedBy} — {entry.reason}</li>)}</ul></details> : null}
  </section>;
}
