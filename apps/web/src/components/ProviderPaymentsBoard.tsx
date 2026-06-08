"use client";

import { ProviderPayoutLedgerResponse } from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

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

export function ProviderPaymentsBoard() {
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [ledger, setLedger] = useState<ProviderPayoutLedgerResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "provider") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
    setErrorMessage(undefined);
    const api = createAuthenticatedWebApiClient();
    void api
      .getProviderPayoutLedger()
      .then((response) => setLedger(response))
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load payout ledger.");
      });
  }, [sessionReady, session?.token, session?.role]);

  const readyEntries = useMemo(
    () => ledger?.entries.filter((entry) => entry.status === "ready") ?? [],
    [ledger?.entries]
  );
  const scheduledEntries = useMemo(
    () => ledger?.entries.filter((entry) => entry.status === "scheduled") ?? [],
    [ledger?.entries]
  );
  const heldEntries = useMemo(
    () => ledger?.entries.filter((entry) => entry.status === "on-hold") ?? [],
    [ledger?.entries]
  );

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>Loading payments…</h2>
        <p>Checking the provider payout ledger.</p>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Provider login required</h2>
        <p>Use a business owner account to view the payout ledger and crew earnings queue.</p>
        <div className="cta-row">
          <a className="button" href="/login/provider">
            Go to provider login
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>Something needs attention</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{formatCurrency(ledger?.totalNetReadyCents ?? 0)}</h2>
          <p>Provider net ready</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(ledger?.totalNetScheduledCents ?? 0)}</h2>
          <p>Provider net scheduled</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(ledger?.pendingCustomerPaymentCents ?? 0)}</h2>
          <p>Waiting on customer payment</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(ledger?.totalCrewOwedCents ?? 0)}</h2>
          <p>Crew share reserved</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(ledger?.totalGrossCapturedCents ?? 0)}</h2>
          <p>Captured customer revenue</p>
        </article>
        <article className="card">
          <h2>{ledger?.entries.length ?? 0}</h2>
          <p>Ledger entries</p>
        </article>
      </section>

      <section className="provider-capacity-alert provider-capacity-alert--healthy">
        <div>
          <span className="eyebrow">Payout status</span>
          <h2>Completed work now feeds a real payout ledger, even before bank-transfer rails are fully live.</h2>
          <p>
            Provider net and crew share now come from actual completed bookings, accepted crew matches,
            captured customer payments, and refund state. Weekly payouts and instant cash-out rules are the next layer.
          </p>
        </div>
        <div className="cta-row">
          <a className="button" href="/provider/management">
            Open management portal
          </a>
          <a className="button-secondary" href="/help">
            Read payout policy
          </a>
        </div>
      </section>

      <section className="grid-two">
        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Provider net</span>
              <h2>Upcoming provider payouts</h2>
            </div>
          </div>

          {ledger?.entries.length ? (
            ledger.entries.map((entry) => (
              <div className="provider-payout-row" key={entry.id}>
                <div>
                  <strong>{entry.customerName}</strong>
                  <p>
                    {entry.serviceLabel} • {entry.addressLine}
                  </p>
                  <p>
                    {formatDateTime(entry.serviceDateIso)}
                    {entry.availableAtIso ? ` • Available ${formatDateTime(entry.availableAtIso)}` : ""}
                  </p>
                  <p>{entry.note}</p>
                </div>
                <div className="provider-payout-row__meta">
                  <strong>{formatCurrency(entry.providerNetAmountCents)}</strong>
                  <span
                    className={`provider-staffing-badge ${
                      entry.status === "ready"
                        ? "provider-staffing-badge--healthy"
                        : entry.status === "reversed" || entry.status === "on-hold"
                          ? "provider-staffing-badge--warning"
                          : ""
                    }`}
                  >
                    {entry.status.replaceAll("-", " ")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p>No completed work has reached the payout ledger yet.</p>
          )}
        </article>

        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Crew share</span>
              <h2>Crew payout queue</h2>
            </div>
          </div>

          {readyEntries.length + scheduledEntries.length + heldEntries.length > 0 ? (
            [...readyEntries, ...scheduledEntries, ...heldEntries].map((entry) => (
              <div className="provider-payout-row" key={`${entry.id}-crew`}>
                <div>
                  <strong>{entry.crewMembersAssigned} assigned crew member{entry.crewMembersAssigned === 1 ? "" : "s"}</strong>
                  <p>
                    {entry.serviceLabel} • {entry.addressLine}
                  </p>
                  <p>{entry.note}</p>
                </div>
                <div className="provider-payout-row__meta">
                  <strong>{formatCurrency(entry.crewShareCents)}</strong>
                  <span
                    className={`provider-staffing-badge ${
                      entry.status === "ready"
                        ? "provider-staffing-badge--healthy"
                        : entry.status === "on-hold"
                          ? "provider-staffing-badge--warning"
                          : ""
                    }`}
                  >
                    {entry.status.replaceAll("-", " ")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p>No crew payout items are queued yet.</p>
          )}

          <div className="provider-wallet-note">
            <strong>Next step</strong>
            <p>
              Bank accounts, weekly disbursement runs, and instant cash-out remain separate roadmap work.
              This ledger shows what is actually earned and what is still blocked by payment or refund state.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
