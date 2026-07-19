"use client";

import { OpsPayoutRunPreviewResponse } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function OpsPayoutRunBoard() {
  const i18n = useI18n();
  const [preview, setPreview] = useState<OpsPayoutRunPreviewResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const api = createAuthenticatedWebApiClient();
    void api.getOpsPayoutPreview().then(setPreview).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load payout run preview.");
    });
  }, []);

  return (
    <section className="card">
      <span className="eyebrow">{i18n.t("ops_auto.ops_payout_run_board.payout_operations_dfvhqe")}</span>
      <h2>{i18n.t("ops_auto.ops_payout_run_board.preview_the_next_provider_and_crew_payout_runs_tr8tix")}</h2>
      <p>
        {i18n.t("ops_auto.ops_payout_run_board.this_board_shows_which_provider_balances_are_ready_c2tgil")} </p>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {preview ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{formatCurrency(preview.totalProviderReadyCents)}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.provider_net_ready_now_xloywp")}</p>
            </article>
            <article className="card">
              <h2>{formatCurrency(preview.totalCrewReadyCents)}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.crew_share_ready_now_si3gah")}</p>
            </article>
            <article className="card">
              <h2>{preview.providerInstantEligibleCount}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.providers_eligible_for_instant_payout_exbhyx")}</p>
            </article>
          </div>

          <div className="grid-three">
            <article className="card">
              <h2>{formatCurrency(preview.totalAwaitingCustomerPaymentCents)}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.still_waiting_on_customer_payment_t1lyii")}</p>
            </article>
            <article className="card">
              <h2>{preview.onHoldEntryCount}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.payout_entries_on_hold_fyfix6")}</p>
            </article>
            <article className="card">
              <h2>{formatDateTime(preview.crewNextWeeklyPayoutDateIso)}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.next_crew_payout_run_8lryub")}</p>
            </article>
          </div>

          <div className="stack-md">
            {preview.providerRuns.map((run) => (
              <article className="list-panel" key={run.runDateIso}>
                <div className="search-result-title">
                  <div>
                    <h3>{formatDateTime(run.runDateIso)}</h3>
                    <p>
                      {run.providerCount} {i18n.t("ops_auto.ops_payout_run_board.providers_y5a9lw")} {run.bookingCount} {i18n.t("ops_auto.ops_payout_run_board.completed_jobs_ow7sp7")} </p>
                  </div>
                  <span className="result-badge">{formatCurrency(run.providerNetCents)}</span>
                </div>
                <p>{i18n.t("ops_auto.ops_payout_run_board.crew_share_in_the_same_run_42858h")} {formatCurrency(run.crewShareCents)}</p>
              </article>
            ))}
            {preview.providerRuns.length === 0 ? <p>{i18n.t("ops_auto.ops_payout_run_board.no_provider_payout_runs_are_ready_yet_ng3sil")}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
