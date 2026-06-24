"use client";

import { OpsPayoutRunPreviewResponse } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

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
      <span className="eyebrow">Payout operations</span>
      <h2>Preview the next provider and crew payout runs.</h2>
      <p>
        This board shows which provider balances are ready now, what is still held up by payment or refund state,
        and how the next grouped payout dates will look before real bank-transfer rails are turned on.
      </p>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {preview ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{formatCurrency(preview.totalProviderReadyCents)}</h2>
              <p>Provider net ready now</p>
            </article>
            <article className="card">
              <h2>{formatCurrency(preview.totalCrewReadyCents)}</h2>
              <p>Crew share ready now</p>
            </article>
            <article className="card">
              <h2>{preview.providerInstantEligibleCount}</h2>
              <p>Providers eligible for instant payout</p>
            </article>
          </div>

          <div className="grid-three">
            <article className="card">
              <h2>{formatCurrency(preview.totalAwaitingCustomerPaymentCents)}</h2>
              <p>Still waiting on customer payment</p>
            </article>
            <article className="card">
              <h2>{preview.onHoldEntryCount}</h2>
              <p>Payout entries on hold</p>
            </article>
            <article className="card">
              <h2>{formatDateTime(preview.crewNextWeeklyPayoutDateIso)}</h2>
              <p>Next crew payout run</p>
            </article>
          </div>

          <div className="stack-md">
            {preview.providerRuns.map((run) => (
              <article className="list-panel" key={run.runDateIso}>
                <div className="search-result-title">
                  <div>
                    <h3>{formatDateTime(run.runDateIso)}</h3>
                    <p>
                      {run.providerCount} providers • {run.bookingCount} completed jobs
                    </p>
                  </div>
                  <span className="result-badge">{formatCurrency(run.providerNetCents)}</span>
                </div>
                <p>Crew share in the same run: {formatCurrency(run.crewShareCents)}</p>
              </article>
            ))}
            {preview.providerRuns.length === 0 ? <p>No provider payout runs are ready yet.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
