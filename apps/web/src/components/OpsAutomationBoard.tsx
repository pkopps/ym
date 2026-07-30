"use client";

import { OpsAutomationRunRecord } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function OpsAutomationBoard() {
  const i18n = useI18n();
  const [runs, setRuns] = useState<OpsAutomationRunRecord[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadRuns() {
    const api = createAuthenticatedWebApiClient();
    const response = await api.getOpsAutomationRuns();
    setRuns(response.runs.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  useEffect(() => {
    void loadRuns().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("ops_automation.error.load"));
    });
  }, [i18n]);

  async function runDueSweeps() {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const result = await api.runDueOpsAutomation({ dryRun });
      setStatusMessage(
        i18n.t("ops_automation.status.completed", {
          completed: result.completedSweepCount,
          failed: result.failedSweepCount
        })
      );
      await loadRuns();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("ops_automation.error.run"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card" data-testid="ops-automation-board">
      <span className="eyebrow">{i18n.t("ops_automation.eyebrow")}</span>
      <h2>{i18n.t("ops_automation.title")}</h2>
      <p>{i18n.t("ops_automation.body")}</p>
      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <div className="cta-row">
        <label className="toggle-control">
          <input checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
          <span>{i18n.t("ops_automation.dry_run")}</span>
        </label>
        <button className="button-secondary" disabled={isWorking} onClick={() => void runDueSweeps()} type="button">
          {isWorking ? i18n.t("ops_automation.running") : i18n.t("ops_automation.run")}
        </button>
      </div>
      <div className="stack-lg ops-audit-list">
        {runs.length === 0 ? <p>{i18n.t("ops_automation.empty")}</p> : null}
        {runs.map((run) => (
          <article className="list-panel" key={run.id}>
            <div className="search-result-title">
              <div>
                <h3>{run.dryRun ? i18n.t("ops_automation.history.dry") : i18n.t("ops_automation.history.live")}</h3>
                <p>{formatDateTime(run.createdAt)} • {run.createdByOpsEmail}</p>
              </div>
              <span className="result-badge">
                {i18n.t("ops_automation.history.result", {
                  completed: run.completedSweepCount,
                  failed: run.failedSweepCount
                })}
              </span>
            </div>
            <p>
              {i18n.t("ops_automation.history.activity", {
                sent: run.sentNotificationCount,
                skipped: run.skippedCount
              })}
            </p>
            <ul className="timeline">
              {run.items.map((item) => (
                <li key={`${run.id}:${item.sweepKey}`}>
                  <strong>{item.status}</strong>
                  <span>{item.label}{item.errorMessage ? ` • ${item.errorMessage}` : ""}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
