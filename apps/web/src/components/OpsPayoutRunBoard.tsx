"use client";

import {
  OpsPayoutDisbursementRun,
  OpsPayoutRunPreviewResponse,
  ProviderTransferRecord
} from "@yardmatch/contracts";
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
  const [runs, setRuns] = useState<OpsPayoutDisbursementRun[]>([]);
  const [providerTransfers, setProviderTransfers] = useState<ProviderTransferRecord[]>([]);
  const [operatorNotes, setOperatorNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const crewTransferRecordCount =
    (preview?.disbursementBatches.filter((batch) => batch.recipientRole === "crew-member").length ?? 0) +
    runs.filter((run) => run.recipientRole === "crew-member").length;

  async function loadBoard() {
    const api = createAuthenticatedWebApiClient();
    const [nextPreview, nextRuns] = await Promise.all([
      api.getOpsPayoutPreview(),
      api.getOpsPayoutDisbursementRuns()
    ]);
    setPreview(nextPreview);
    setRuns(nextRuns.runs);
    setProviderTransfers(nextRuns.providerTransfers);
  }

  useEffect(() => {
    void loadBoard().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load payout run preview.");
    });
  }, []);

  async function createManualRun(previewBatchId: string) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const response = await api.createOpsPayoutDisbursementRun({
        previewBatchId,
        operatorNotes: operatorNotes[previewBatchId]?.trim() || undefined
      });
      setStatusMessage(
        response.created
          ? i18n.t("ops_payout.status.created")
          : i18n.t("ops_payout.status.existing")
      );
      await loadBoard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("ops_payout.error.create"));
    } finally {
      setIsWorking(false);
    }
  }

  async function executeRun(runId: string) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const response = await createAuthenticatedWebApiClient().executeOpsPayoutDisbursementRun({
        runId,
        confirmation: "execute-provider-transfers",
        operatorNotes: operatorNotes[runId]?.trim() ?? ""
      });
      setStatusMessage(
        i18n.t("ops_payout.status.executed", {
          transferred: response.transferredCount,
          existing: response.alreadyTransferredCount,
          failed: response.failedCount
        })
      );
      await loadBoard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("ops_payout.error.execute"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">{i18n.t("ops_auto.ops_payout_run_board.payout_operations_dfvhqe")}</span>
      <h2>{i18n.t("ops_auto.ops_payout_run_board.preview_the_next_provider_and_crew_payout_runs_tr8tix")}</h2>
      <p>
        {i18n.t("ops_auto.ops_payout_run_board.this_board_shows_which_provider_balances_are_ready_c2tgil")} </p>
      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {preview ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{formatCurrency(preview.totalProviderReadyCents)}</h2>
              <p>{i18n.t("ops_auto.ops_payout_run_board.provider_net_ready_now_xloywp")}</p>
            </article>
            <article className="card">
              <h2>{crewTransferRecordCount}</h2>
              <p>{i18n.t("ops_payout.policy.crew_transfer_records")}</p>
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
              <h2>{i18n.t("ops_payout.policy.provider_business")}</h2>
              <p>{i18n.t("ops_payout.policy.compensation_owner")}</p>
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
                <p>{i18n.t("ops_payout.policy.provider_settlement_only")}</p>
              </article>
            ))}
            {preview.providerRuns.length === 0 ? <p>{i18n.t("ops_auto.ops_payout_run_board.no_provider_payout_runs_are_ready_yet_ng3sil")}</p> : null}
          </div>

          <div className="stack-md" data-testid="ops-payout-batches">
            <h3>{i18n.t("ops_payout.preview.title")}</h3>
            <p>{i18n.t("ops_payout.preview.body")}</p>
            {preview.disbursementBatches.length === 0 ? <p>{i18n.t("ops_payout.preview.empty")}</p> : null}
            {preview.disbursementBatches.map((batch) => {
              const isProviderBatch = batch.recipientRole === "provider";
              const canCreateRecord =
                isProviderBatch &&
                ["ready-for-manual-review", "ready-for-transfer"].includes(batch.actionStatus) &&
                batch.entryCount > 0;
              return (
                <article className="list-panel" key={batch.id}>
                  <div className="search-result-title">
                    <div>
                      <h3>{batch.recipientRole === "provider" ? i18n.t("ops_payout.provider") : i18n.t("ops_payout.crew")}</h3>
                      <p>{formatDateTime(batch.runDateIso)} • {batch.entryCount} {i18n.t("ops_payout.entries")}</p>
                    </div>
                    <span className="result-badge">{batch.actionStatus.replaceAll("-", " ")}</span>
                  </div>
                  <p>{batch.manualActionLabel}</p>
                  <p>{formatCurrency(batch.totalCents)} • {batch.recipientCount} {i18n.t("ops_payout.recipients")}</p>
                  {!isProviderBatch ? <p className="warning-copy">{i18n.t("ops_payout.policy.legacy_crew_blocked")}</p> : null}
                  {batch.blockerReasons.map((reason) => <p className="warning-copy" key={reason}>{reason}</p>)}
                  <label className="form-field">
                    <span>{i18n.t("ops_payout.operator_notes")}</span>
                    <textarea
                      disabled={isWorking || !canCreateRecord}
                      onChange={(event) => setOperatorNotes((current) => ({ ...current, [batch.id]: event.target.value }))}
                      rows={2}
                      value={operatorNotes[batch.id] ?? ""}
                    />
                  </label>
                  <button
                    className="button-secondary"
                    disabled={isWorking || !canCreateRecord}
                    onClick={() => void createManualRun(batch.id)}
                    type="button"
                  >
                    {batch.actionStatus === "ready-for-transfer"
                      ? i18n.t("ops_payout.create_transfer_run")
                      : i18n.t("ops_payout.create_record")}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="stack-md" data-testid="ops-payout-history">
            <h3>{i18n.t("ops_payout.history.title")}</h3>
            {runs.length === 0 ? <p>{i18n.t("ops_payout.history.empty")}</p> : null}
            {runs.map((run) => {
              const runTransfers = providerTransfers.filter((transfer) =>
                run.entries.some((entry) => entry.bookingId === transfer.bookingId)
              );
              const canOfferExecution =
                run.railMode === "stripe-transfer" &&
                run.actionStatus === "ready-for-transfer" &&
                ["ready-for-transfer", "failed", "partially-transferred"].includes(run.status);
              const canExecute =
                canOfferExecution &&
                Date.parse(run.runDateIso) <= Date.now();
              return (
              <article className="list-panel" key={run.id}>
                <div className="search-result-title">
                  <div>
                    <h3>{run.recipientRole === "provider" ? i18n.t("ops_payout.provider") : i18n.t("ops_payout.crew")}</h3>
                    <p>{formatDateTime(run.createdAt)} • {run.createdByOpsEmail}</p>
                  </div>
                  <span className="result-badge">{run.status.replaceAll("-", " ")}</span>
                </div>
                <p>{formatCurrency(run.totalCents)} • {run.entryCount} {i18n.t("ops_payout.entries")}</p>
                {run.operatorNotes ? <p>{run.operatorNotes}</p> : null}
                {run.blockerReasons.map((reason) => (
                  <p className="warning-copy" key={reason}>{reason}</p>
                ))}
                {runTransfers.map((transfer) => (
                  <div key={transfer.id}>
                    <p>
                      {transfer.status.replaceAll("-", " ")} • {formatCurrency(transfer.amountCents)}
                      {transfer.stripeTransferId ? ` • ${transfer.stripeTransferId}` : ""}
                      {transfer.stripeTransferReversalId
                        ? ` • ${transfer.stripeTransferReversalId}`
                        : ""}
                    </p>
                    {transfer.failureReason ? (
                      <p className="warning-copy">{transfer.failureReason}</p>
                    ) : null}
                  </div>
                ))}
                {canOfferExecution ? (
                  <>
                    <label className="form-field">
                      <span>{i18n.t("ops_payout.execution_notes")}</span>
                      <textarea
                        disabled={isWorking || !canExecute}
                        onChange={(event) =>
                          setOperatorNotes((current) => ({
                            ...current,
                            [run.id]: event.target.value
                          }))
                        }
                        rows={2}
                        value={operatorNotes[run.id] ?? ""}
                      />
                    </label>
                    <button
                      className="button"
                      disabled={
                        isWorking ||
                        !canExecute ||
                        (operatorNotes[run.id]?.trim().length ?? 0) < 12
                      }
                      onClick={() => void executeRun(run.id)}
                      type="button"
                    >
                      {i18n.t("ops_payout.execute")}
                    </button>
                    {!canExecute && Date.parse(run.runDateIso) > Date.now() ? (
                      <p>{i18n.t("ops_payout.scheduled_execution")}</p>
                    ) : null}
                  </>
                ) : null}
              </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
