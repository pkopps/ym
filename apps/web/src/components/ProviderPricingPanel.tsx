"use client";
import { useEffect, useState } from "react";
import { defaultServiceStartingPrices, parsePriceDollars, type ProviderPricingOverview, type ProviderServicePrice, type ServiceCategory } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { createAuthenticatedWebApiClient, createWebApiClient } from "../lib/api";

type Props = { postalCode: string; categories: ServiceCategory[]; onChange?: (prices: ProviderServicePrice[]) => void };
export function ProviderPricingPanel({ postalCode, categories, onChange }: Props) {
  const i18n = useI18n();
  const [zipInput, setZipInput] = useState(postalCode.slice(0, 5));
  const [rows, setRows] = useState<ProviderPricingOverview["prices"]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadedZip, setLoadedZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const zip = (onChange ? postalCode : zipInput).trim().slice(0, 5);
  const categoriesKey = categories.join(",");
  useEffect(() => {
    let active = true;
    setRows([]); setLoadedZip(""); setError(""); setMessage(""); onChange?.([]);
    if (!/^\d{5}$/.test(zip)) return;
    setBusy(true);
    const api = onChange ? createWebApiClient() : createAuthenticatedWebApiClient();
    const request = onChange ? api.getZipServiceMinimums(zip).then(minimums => ({ postalCode: zip,
      prices: (categoriesKey.split(",") as ServiceCategory[]).filter(Boolean).map(category => {
        const minimumStartingPriceCents = minimums.find(row => row.category === category)?.minimumStartingPriceCents;
        return { category, minimumStartingPriceCents, effectiveStartingPriceCents: Math.max(defaultServiceStartingPrices[category], minimumStartingPriceCents ?? 0) };
      }) })) : api.getProviderPricing(zip);
    request.then(result => {
      if (!active) return;
      setRows(result.prices); setLoadedZip(zip);
      setValues(Object.fromEntries(result.prices.map(row => [row.category, (row.effectiveStartingPriceCents / 100).toFixed(2)])));
      onChange?.(result.prices.filter(row => row.minimumStartingPriceCents !== undefined).map(row => ({ postalCode: zip, category: row.category, startingPriceCents: row.effectiveStartingPriceCents })));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : i18n.t("pricing.error")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [zip, categoriesKey, onChange, i18n]);
  function change(category: ServiceCategory, value: string) {
    const next = { ...values, [category]: value }; setValues(next); setMessage("");
    onChange?.(rows.filter(row => row.minimumStartingPriceCents !== undefined).map(row => ({ postalCode: loadedZip, category: row.category, startingPriceCents: parsePriceDollars(next[row.category] ?? "") ?? 0 })));
  }
  const configured = rows.filter(row => row.minimumStartingPriceCents !== undefined);
  const invalid = configured.some(row => (parsePriceDollars(values[row.category] ?? "") ?? 0) < row.minimumStartingPriceCents!);
  async function save() {
    if (busy || invalid || loadedZip !== zip || !configured.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await createAuthenticatedWebApiClient().updateProviderPricing(configured.map(row => ({ postalCode: loadedZip, category: row.category, startingPriceCents: parsePriceDollars(values[row.category])! })));
      setRows(result.prices); setMessage(i18n.t("pricing.saved"));
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("pricing.error")); }
    finally { setBusy(false); }
  }
  return <section className="stack-md" aria-label={i18n.t("pricing.title")}>
    <div><h2>{i18n.t("pricing.title")}</h2><p>{i18n.t("pricing.description")}</p></div>
    {!onChange ? <label className="form-field"><span>{i18n.t("pricing.zip")}</span><input inputMode="numeric" maxLength={5} value={zipInput} onChange={e => setZipInput(e.target.value)} /></label> : <p>{i18n.t("pricing.zip")}: {zip || "—"}</p>}
    {busy && !rows.length ? <p role="status">{i18n.t("pricing.loading")}</p> : null}
    <div className="form-grid">{rows.map(row => <label className="form-field" key={row.category}>
      <span>{i18n.t(serviceCategoryLabelKeys[row.category])}</span>
      {row.minimumStartingPriceCents !== undefined ? <>
        <input aria-label={`${i18n.t(serviceCategoryLabelKeys[row.category])} — ${i18n.t("pricing.starting")}`} type="number" step="0.01" min={row.minimumStartingPriceCents / 100} max={10000} required disabled={busy || loadedZip !== zip} value={values[row.category] ?? ""} onChange={e => change(row.category, e.target.value)} />
        <small>{i18n.t("pricing.minimum", { amount: i18n.formatCurrency(row.minimumStartingPriceCents) })}</small>
        {row.savedStartingPriceCents !== undefined && row.savedStartingPriceCents < row.minimumStartingPriceCents ? <small>{i18n.t("pricing.raised")}</small> : null}
      </> : <small>{i18n.t("pricing.unavailable")}</small>}
    </label>)}</div>
    {!/^\d{5}$/.test(zip) ? <p>{i18n.t("pricing.enter_zip")}</p> : null}
    <p className="auth-helper">{i18n.t("pricing.existing")}</p>
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {!onChange ? <button className="button" type="button" disabled={busy || invalid || loadedZip !== zip || !configured.length} onClick={() => void save()}>{i18n.t("pricing.save")}</button> : null}
  </section>;
}
