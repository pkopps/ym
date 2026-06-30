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

type ProviderPayoutEntry = ProviderPayoutLedgerResponse["entries"][number];
type PayoutStepStatus = "complete" | "current" | "pending";

function formatPayoutStatus(status: ProviderPayoutEntry["status"]) {
  switch (status) {
    case "awaiting-customer-payment":
      return "Awaiting payment";
    case "on-hold":
      return "On hold";
    case "scheduled":
      return "Scheduled";
    case "ready":
      return "Ready";
    case "paid":
      return "Paid";
    case "reversed":
      return "Reversed";
  }
}

function getPayoutStatusClass(status: ProviderPayoutEntry["status"]) {
  if (status === "ready" || status === "paid") {
    return "provider-staffing-badge provider-staffing-badge--healthy";
  }

  if (status === "on-hold" || status === "reversed" || status === "awaiting-customer-payment") {
    return "provider-staffing-badge provider-staffing-badge--warning";
  }

  return "provider-staffing-badge";
}

function getPayoutStepStatus(stepIndex: number, activeStepIndex: number): PayoutStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
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

  const heldEntries = useMemo(
    () => ledger?.entries.filter((entry) => entry.status === "on-hold") ?? [],
    [ledger?.entries]
  );
  const crewQueueEntries = useMemo(
    () =>
      ledger?.entries.filter((entry) => entry.status === "ready" || entry.status === "scheduled" || entry.status === "on-hold") ??
      [],
    [ledger?.entries]
  );
  const heldProviderNetCents = useMemo(
    () => heldEntries.reduce((sum, entry) => sum + entry.providerNetAmountCents, 0),
    [heldEntries]
  );
  const blockedAmountCents = (ledger?.pendingCustomerPaymentCents ?? 0) + heldProviderNetCents;
  const payoutStateLabel =
    blockedAmountCents > 0 ? "Needs attention" : (ledger?.totalNetReadyCents ?? 0) > 0 ? "Ready now" : "On track";
  const paidEntries = ledger?.entries.filter((entry) => entry.status === "paid") ?? [];
  const activePayoutStepIndex = (() => {
    if (blockedAmountCents > 0 || crewQueueEntries.length > 0) {
      return 1;
    }

    if ((ledger?.totalNetReadyCents ?? 0) > 0) {
      return 2;
    }

    return paidEntries.length > 0 ? 3 : 0;
  })();
  const payoutSteps = [
    {
      label: "Earned",
      value: formatCurrency(ledger?.totalGrossCapturedCents ?? 0)
    },
    {
      label: "Hold",
      value: blockedAmountCents > 0 ? formatCurrency(blockedAmountCents) : `${ledger?.payoutSchedule?.holdPeriodHours ?? 0}h`
    },
    {
      label: "Ready",
      value: formatCurrency(ledger?.totalNetReadyCents ?? 0)
    },
    {
      label: "Paid",
      value: `${paidEntries.length} job${paidEntries.length === 1 ? "" : "s"}`
    }
  ].map((step, index) => ({
    ...step,
    status: getPayoutStepStatus(index, activePayoutStepIndex)
  }));

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

      <section className="card provider-payment-overview">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Payouts</span>
            <h2>{payoutStateLabel}</h2>
            <p>Completed jobs, holds, crew reserve, and weekly payout timing.</p>
          </div>
          <span className={blockedAmountCents > 0 ? "result-badge result-badge--neutral" : "result-badge"}>
            {ledger?.entries.length ?? 0} entries
          </span>
        </div>

        <div className="provider-payout-spine" aria-label="Payout path">
          {payoutSteps.map((step, index) => (
            <div className={`provider-payout-spine__step provider-payout-spine__step--${step.status}`} key={step.label}>
              <span className="provider-payout-spine__index">{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.value}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="provider-payment-summary-grid" aria-label="Payout summary">
          <div>
            <span>Ready now</span>
            <strong>{formatCurrency(ledger?.totalNetReadyCents ?? 0)}</strong>
            <p>
              {ledger?.payoutSchedule.instantPayoutsEnabled
                ? `${formatCurrency(ledger.payoutSchedule.instantPayoutEligibleCents)} instant eligible`
                : "Weekly payout"}
            </p>
          </div>
          <div>
            <span>Next payout</span>
            <strong>{ledger?.payoutSchedule ? formatDateTime(ledger.payoutSchedule.nextWeeklyPayoutDateIso) : "—"}</strong>
            <p>{ledger?.payoutSchedule ? `${ledger.payoutSchedule.holdPeriodHours}h standard hold` : "Schedule pending"}</p>
          </div>
          <div>
            <span>Blocked</span>
            <strong>{formatCurrency(blockedAmountCents)}</strong>
            <p>
              {blockedAmountCents > 0
                ? `${formatCurrency(ledger?.pendingCustomerPaymentCents ?? 0)} awaiting customer payment`
                : "No payout blockers"}
            </p>
          </div>
          <div>
            <span>Crew reserve</span>
            <strong>{formatCurrency(ledger?.totalCrewOwedCents ?? 0)}</strong>
            <p>{crewQueueEntries.length} crew payout item{crewQueueEntries.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="cta-row">
          <a className="button" href="/provider/management">
            Open management
          </a>
          <a className="button-secondary" href="/help">
            Payout help
          </a>
        </div>

        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">Ledger totals</summary>
          <div className="service-card-disclosure__body">
            <div className="provider-payment-summary-grid">
              <div>
                <span>Scheduled</span>
                <strong>{formatCurrency(ledger?.totalNetScheduledCents ?? 0)}</strong>
                <p>Provider net already assigned to a future run.</p>
              </div>
              <div>
                <span>Captured</span>
                <strong>{formatCurrency(ledger?.totalGrossCapturedCents ?? 0)}</strong>
                <p>Customer revenue captured before provider and crew split.</p>
              </div>
              <div>
                <span>Instant minimum</span>
                <strong>{ledger?.payoutSchedule ? formatCurrency(ledger.payoutSchedule.instantPayoutMinimumCents) : "—"}</strong>
                <p>{ledger?.payoutSchedule.instantPayoutsEnabled ? "Instant payouts are on." : "Weekly payouts only."}</p>
              </div>
              <div>
                <span>Holds</span>
                <strong>{heldEntries.length}</strong>
                <p>Refund or dispute review keeps these out of payout.</p>
              </div>
            </div>
          </div>
        </details>
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
                  <span className={getPayoutStatusClass(entry.status)}>{formatPayoutStatus(entry.status)}</span>
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

          {crewQueueEntries.length > 0 ? (
            crewQueueEntries.map((entry) => (
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
                  <span className={getPayoutStatusClass(entry.status)}>{formatPayoutStatus(entry.status)}</span>
                </div>
              </div>
            ))
          ) : (
            <p>No crew payout items are queued yet.</p>
          )}

          <div className="provider-wallet-note">
            <strong>Still ahead</strong>
            <p>
              Bank-transfer rails and instant cash-out controls remain separate roadmap work. This view shows what
              is earned, reserved for crew, and blocked by payment or review state.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
