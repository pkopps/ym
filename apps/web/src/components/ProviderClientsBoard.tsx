"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderClientsOverview } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { hasMapPoint } from "../lib/provider-client-map";

function MapLoading() {
  const i18n = useI18n();
  return <div className="client-map-loading" role="status">{i18n.t("provider_clients.loading")}</div>;
}
function MapUnavailable() {
  const i18n = useI18n();
  return <div className="client-map-loading" role="status">{i18n.t("provider_clients.map_error")}</div>;
}
const ClientMap = dynamic(() => import("./ProviderClientMap").catch(() => MapUnavailable), { ssr: false, loading: MapLoading });

export function ProviderClientsBoard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const token = session?.role === "provider" ? session.token : undefined;
  const [result, setResult] = useState<{ token: string; data?: ProviderClientsOverview; failed?: boolean }>();
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "recurring" | "one_time">("all");
  const [period, setPeriod] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [listPosition, setListPosition] = useState({ filter: "", page: 0 });
  const local = (href: string) => addLocalePrefix(href, i18n.locale);
  const data = result?.token === token ? result?.data : undefined;
  const failed = result?.token === token && result?.failed;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    createAuthenticatedWebApiClient().getProviderClients().then((data) => {
      if (!cancelled) setResult({ token, data });
    }).catch(() => {
      if (!cancelled) setResult({ token, failed: true });
    });
    return () => { cancelled = true; };
  }, [token, revision]);

  const properties = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(i18n.locale);
    const now = Date.now();
    const end = now + Number(period) * 86_400_000;
    return (data?.properties ?? []).filter((property) => {
      const address = property.address;
      return (kind === "all" || property.recurring === (kind === "recurring")) &&
        (period === "all" || property.upcomingVisits.some((visit) => Date.parse(visit.scheduledEndIso) >= now && Date.parse(visit.scheduledStartIso) < end)) &&
        (!needle || [property.customerName, address.line1, address.line2, address.city, address.state, address.postalCode].join(" ").toLocaleLowerCase(i18n.locale).includes(needle));
    });
  }, [data, query, kind, period, i18n.locale]);
  const selected = properties.find((property) => property.id === selectedId);
  const filterKey = JSON.stringify([query, kind, period, revision]);
  const pageCount = Math.max(1, Math.ceil(properties.length / 50));
  const listPage = listPosition.filter === filterKey ? Math.min(listPosition.page, pageCount - 1) : 0;
  const visibleProperties = properties.slice(listPage * 50, (listPage + 1) * 50);
  const selectProperty = useCallback((id: string) => {
    setSelectedId(id);
    const index = properties.findIndex(property => property.id === id);
    if (index >= 0) setListPosition({ filter: filterKey, page: Math.floor(index / 50) });
  }, [properties, filterKey]);
  const missingLocations = properties.filter((property) => !hasMapPoint(property.address.point)).length;
  const clearFilters = () => { setQuery(""); setKind("all"); setPeriod("all"); };
  const reload = () => { setResult(undefined); setRevision((value) => value + 1); };

  if (!sessionReady) return <MapLoading />;
  if (!token) return <section className="card provider-clients-access">
    <h1>{i18n.t("provider_clients.login_title")}</h1><p>{i18n.t("provider_clients.login_body")}</p>
    <a className="button" href={local("/login/provider")}>{i18n.t("provider_clients.login")}</a>
  </section>;

  return <>
    <header className="provider-clients-heading">
      <div><span className="eyebrow">{data?.companyName ?? i18n.t("provider_clients.nav")}</span>
        <h1>{i18n.t("provider_clients.title")}</h1><p>{i18n.t("provider_clients.description")}</p></div>
      <div className="provider-clients-heading-actions">
        <button className="button-secondary" type="button" onClick={reload} disabled={!data && !failed}>{i18n.t("provider_clients.refresh")}</button>
        <a className="button-secondary" href={local("/provider/management")}>{i18n.t("provider_clients.open_jobs")}</a>
      </div>
    </header>
    {failed ? <section className="card" role="alert"><p>{i18n.t("provider_clients.error")}</p><button className="button" onClick={reload}>{i18n.t("provider_clients.retry")}</button></section>
      : !data ? <MapLoading />
      : data.properties.length === 0 ? <section className="card provider-clients-empty"><span aria-hidden="true">⌂</span><h2>{i18n.t("provider_clients.empty_title")}</h2><p>{i18n.t("provider_clients.empty_body")}</p></section>
      : <div className="provider-clients-workspace">
        <aside className="provider-clients-sidebar" aria-label={i18n.t("provider_clients.list")}>
          <div className="provider-clients-filters">
            <span className="eyebrow">{i18n.t("provider_clients.any_time")}</span>
            <h2 aria-live="polite">{i18n.t("provider_clients.properties", { count: properties.length })}</h2>
            <div className="provider-clients-tabs" role="group" aria-label={i18n.t("provider_clients.nav")}>
              {(["all", "recurring", "one_time"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{i18n.t(`provider_clients.${value}`)}</button>)}
            </div>
            <label className="provider-clients-search"><span className="sr-only">{i18n.t("provider_clients.search")}</span><input type="search" value={query} placeholder={i18n.t("provider_clients.search")} onChange={(event) => setQuery(event.target.value)} /></label>
            <label className="provider-clients-period"><span>{i18n.t("provider_clients.period")}</span><select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="all">{i18n.t("provider_clients.any_time")}</option><option value="7">{i18n.t("provider_clients.next_week")}</option><option value="30">{i18n.t("provider_clients.next_month")}</option>
            </select></label>
          </div>
          <div className="provider-clients-list">
            {properties.length === 0 ? <div className="provider-clients-no-results" role="status"><p>{i18n.t("provider_clients.no_results")}</p><button className="button-secondary" onClick={clearFilters}>{i18n.t("provider_clients.clear")}</button></div> : visibleProperties.map((property) => <button className="provider-client-row" key={property.id} type="button" aria-pressed={selected?.id === property.id} onClick={() => selectProperty(property.id)}>
              <span className="provider-client-row-icon" aria-hidden="true">⌂</span><span className="provider-client-row-copy"><strong>{property.customerName}</strong><span>{property.address.line1}{property.address.line2 ? `, ${property.address.line2}` : ""}</span><span>{property.address.city}, {property.address.state} {property.address.postalCode}</span><small className={property.recurring ? "client-recurring" : ""}>{i18n.t(property.recurring ? "provider_clients.recurring" : "provider_clients.one_time")}</small>{!hasMapPoint(property.address.point) ? <small>{i18n.t("provider_clients.no_location")}</small> : null}</span><span aria-hidden="true">›</span>
            </button>)}
          </div>
          {pageCount > 1 ? <nav className="provider-clients-pagination" aria-label={i18n.t("provider_clients.list")}>
            <button className="button-secondary" disabled={listPage === 0} onClick={() => setListPosition({ filter: filterKey, page: listPage - 1 })}>{i18n.t("provider_clients.previous_page")}</button>
            <span aria-live="polite">{i18n.t("provider_clients.page_summary", { page: listPage + 1, pages: pageCount })}</span>
            <button className="button-secondary" disabled={listPage + 1 >= pageCount} onClick={() => setListPosition({ filter: filterKey, page: listPage + 1 })}>{i18n.t("provider_clients.next_page")}</button>
          </nav> : null}
        </aside>
        <section className="provider-clients-main" aria-label={i18n.t("provider_clients.map_label")}>
          <ClientMap properties={properties} selectedId={selected?.id} onSelect={selectProperty} />
          {missingLocations > 0 ? <p className="provider-clients-location-note" role="status">{i18n.t("provider_clients.missing_locations", { count: missingLocations })}</p> : null}
          {selected ? <section className="provider-client-detail" aria-label={selected.customerName} aria-live="polite">
            <div className="provider-client-detail-heading"><div><span className="eyebrow">{i18n.t(selected.recurring ? "provider_clients.recurring" : "provider_clients.one_time")}</span><h2>{selected.customerName}</h2><p>{selected.address.line1}{selected.address.line2 ? `, ${selected.address.line2}` : ""} · {selected.address.city}, {selected.address.state} {selected.address.postalCode}</p></div><button className="provider-client-close" aria-label={i18n.t("provider_clients.close")} onClick={() => setSelectedId(undefined)}>×</button></div>
            {selected.address.geocodePrecision === "city" || selected.address.geocodePrecision === "postal-code" ? <p>{i18n.t("provider_clients.approximate")}</p> : null}
            <dl className="provider-client-facts"><div><dt>{i18n.t("provider_clients.next_visit")}</dt><dd>{selected.upcomingVisits[0] ? <>{i18n.formatDate(selected.upcomingVisits[0].scheduledStartIso, { dateStyle: "medium", timeStyle: "short" })}<small>{i18n.t(serviceCategoryToI18nKey(selected.upcomingVisits[0].category))} · {i18n.t(`provider_mobile.schedule.status.${selected.upcomingVisits[0].status === "in-progress" ? "in_progress" : selected.upcomingVisits[0].status}`)}</small></> : i18n.t("provider_clients.no_visit")}</dd></div><div><dt>{i18n.t("provider_clients.completed")}</dt><dd>{i18n.formatNumber(selected.completedVisitCount)}</dd></div>{selected.lastCompletedAt ? <div><dt>{i18n.t("provider_clients.last_visit")}</dt><dd>{i18n.formatDate(selected.lastCompletedAt, { dateStyle: "medium" })}</dd></div> : null}</dl>
            <a className="button-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([selected.address.line1, selected.address.line2, selected.address.city, selected.address.state, selected.address.postalCode, selected.address.country].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer">{i18n.t("provider_clients.directions")} ↗</a>
          </section> : <p className="provider-client-hint">{i18n.t("provider_clients.select")}</p>}
        </section>
      </div>}
  </>;
}
