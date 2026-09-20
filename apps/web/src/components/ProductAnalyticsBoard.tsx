"use client";
import { useEffect, useState } from "react";
import type { ProductAnalyticsReport } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { getWebApiBaseUrl, loadStoredSession } from "../lib/api";
export function ProductAnalyticsBoard() {
  const i18n = useI18n();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<ProductAnalyticsReport>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`${getWebApiBaseUrl()}/api/observability/product-analytics?days=${days}`, {
      signal: abort.signal, headers: {Authorization: `Bearer ${loadStoredSession()?.token ?? ""}`}
    }).then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data: ProductAnalyticsReport) => { setReport(data); setError(false); })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [days]);
  return <section className="card stack-lg" data-testid="product-analytics">
    <h2>{i18n.t("analytics.report")}</h2>
    <label>{i18n.t("analytics.period")} <select value={days} onChange={event => setDays(Number(event.target.value))}>
      {[7,30,90].map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>
    {error ? <p role="alert">{i18n.t("analytics.unavailable")}</p> : null}
    {report ? <>
      <p>{i18n.t(report.durable ? "analytics.durable" : "analytics.local")}</p>
      <p>{i18n.t("analytics.sample", {count: report.events})}</p>
      {report.lowSample || report.truncated ? <p role="status">{i18n.t("analytics.caution")}</p> : null}
      <div className="table-scroll"><table><caption>{i18n.t("analytics.funnel")}</caption><thead><tr>
        <th>{i18n.t("analytics.stage")}</th><th>{i18n.t("analytics.people")}</th><th>{i18n.t("analytics.rate")}</th>
      </tr></thead><tbody>{report.funnel.steps.map(step => <tr key={step.name}>
        <th scope="row">{step.name.replaceAll("_", " ")}</th><td>{step.people}</td>
        <td>{step.conversionRate === null ? "—" : `${Math.round(step.conversionRate * 100)}% (${step.people}/${step.previousStepPeople})`}</td>
      </tr>)}</tbody></table></div>
      <details><summary>{i18n.t("analytics.segments")}</summary><div className="table-scroll"><table><thead><tr>
        <th>{i18n.t("analytics.segment")}</th><th>{i18n.t("analytics.people")}</th><th>{i18n.t("analytics.requests")}</th><th>{i18n.t("analytics.completed")}</th>
      </tr></thead><tbody>{Object.entries(report.funnel.segments).map(([key,value]) => <tr key={key}>
        <th scope="row">{key}</th><td>{value.visitors}</td><td>{value.requested}</td><td>{value.completed}</td>
      </tr>)}</tbody></table></div></details>
      <details><summary>{i18n.t("analytics.actions")}</summary><ul>{Object.entries(report.actions).map(([key,count])=><li key={key}>{key}: {count}</li>)}</ul></details>
      <details><summary>{i18n.t("analytics.performance")}</summary><p>{i18n.t("analytics.performance_note")}</p><ul>{Object.entries(report.performance).map(([key,metric])=><li key={key}>{key}: {Math.round(metric.p75 * 1000)/1000} · n={metric.samples}</li>)}</ul></details>
      <details><summary>{i18n.t("analytics.reasons")}</summary><ul>{Object.entries(report.funnel.reasons).map(([key,count]) => <li key={key}>{key.replaceAll("_", " ")}: {count}</li>)}</ul></details>
      <details><summary>{i18n.t("analytics.economics")}</summary><p>{i18n.t("analytics.margin_note")}</p>
        {report.economics.map(row => <p key={row.status}>{row.status}: {row._count._all} · {i18n.t("analytics.platform_net")}: {i18n.formatCurrency(row._sum.platformNetRevenueCents ?? 0)} · {i18n.t("analytics.provider_net")}: {i18n.formatCurrency(row._sum.providerNetCents ?? 0)}</p>)}
      </details>
      {report.supply ? <details><summary>{i18n.t("analytics.supply")}</summary><p>{i18n.t("analytics.supply_note")}</p><dl>
        {Object.entries(report.supply).map(([key,value])=><div key={key}><dt>{i18n.t(`analytics.supply_${key}` as Parameters<typeof i18n.t>[0])}</dt><dd>{value}</dd></div>)}
      </dl></details> : null}
      <details><summary>{i18n.t("analytics.health")}</summary><dl>
        <dt>{i18n.t("analytics.last_event")}</dt><dd>{report.health.lastEventAt ?? "—"}</dd>
        <dt>{i18n.t("analytics.pending")}</dt><dd>{report.health.pendingWrites}</dd>
        <dt>{i18n.t("analytics.dropped")}</dt><dd>{report.health.dropped}</dd>
        <dt>PostHog</dt><dd>{i18n.t(report.health.exportConfigured ? "analytics.configured" : "analytics.not_configured")}: {report.health.exportBacklog}</dd>
        <dt>{i18n.t("analytics.last_failure")}</dt><dd>{report.health.lastFailureAt ?? "—"}</dd>
      </dl></details>
    </> : <p>{i18n.t("common.actions.trying_again")}</p>}
  </section>;
}
