"use client";

import {
  ProviderConnectStatusResponse,
  ProviderPayoutLedgerResponse
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
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
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [ledger, setLedger] = useState<ProviderPayoutLedgerResponse | undefined>();
  const [connectStatus, setConnectStatus] = useState<ProviderConnectStatusResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isStartingOnboarding, setIsStartingOnboarding] = useState(false);

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
    void Promise.allSettled([api.getProviderPayoutLedger(), api.getProviderConnectStatus()])
      .then(([payoutLedgerResult, payoutConnectStatusResult]) => {
        if (payoutLedgerResult.status === "fulfilled") {
          setLedger(payoutLedgerResult.value);
        }
        if (payoutConnectStatusResult.status === "fulfilled") {
          setConnectStatus(payoutConnectStatusResult.value);
        }
        const failedResult = [payoutLedgerResult, payoutConnectStatusResult].find(
          (result) => result.status === "rejected"
        );
        if (failedResult?.status === "rejected") {
          throw failedResult.reason;
        }
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load payout ledger.");
      });
  }, [sessionReady, session?.token, session?.role]);

  async function startConnectOnboarding() {
    try {
      setIsStartingOnboarding(true);
      setErrorMessage(undefined);
      const response = await createAuthenticatedWebApiClient().startProviderConnectOnboarding();
      window.location.assign(response.onboardingUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : i18n.t("provider_payments.connect.error")
      );
      setIsStartingOnboarding(false);
    }
  }

  const heldEntries = useMemo(
    () => ledger?.entries.filter((entry) => entry.status === "on-hold") ?? [],
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
    if (blockedAmountCents > 0) {
      return 1;
    }

    if ((ledger?.totalNetReadyCents ?? 0) > 0) {
      return 2;
    }

    return paidEntries.length > 0 ? 3 : 0;
  })();
  const payoutSteps = [
    {
      label: i18n.t("ops_auto.provider_payments_board.earned_y7j3br"),
      value: formatCurrency(ledger?.totalGrossCapturedCents ?? 0)
    },
    {
      label: i18n.t("ops_auto.provider_payments_board.hold_1cc0v"),
      value: blockedAmountCents > 0 ? formatCurrency(blockedAmountCents) : `${ledger?.payoutSchedule?.holdPeriodHours ?? 0}h`
    },
    {
      label: i18n.t("ops_auto.provider_payments_board.ready_1axoqr"),
      value: formatCurrency(ledger?.totalNetReadyCents ?? 0)
    },
    {
      label: i18n.t("ops_auto.provider_payments_board.paid_1h5gs"),
      value: `${paidEntries.length} job${paidEntries.length === 1 ? "" : "s"}`
    }
  ].map((step, index) => ({
    ...step,
    status: getPayoutStepStatus(index, activePayoutStepIndex)
  }));

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>{i18n.t("ops_auto.provider_payments_board.loading_payments_tj6gdn")}</h2>
        <p>{i18n.t("ops_auto.provider_payments_board.checking_the_provider_payout_ledger_nbvpgl")}</p>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("ops_auto.provider_payments_board.provider_login_required_hd0xut")}</h2>
        <p>{i18n.t("ops_auto.provider_payments_board.use_a_business_owner_account_to_view_the_hhfsyg")}</p>
        <div className="cta-row">
          <a className="button" href="/login/provider">
            {i18n.t("ops_auto.provider_payments_board.go_to_provider_login_wv0crr")} </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("ops_auto.provider_payments_board.something_needs_attention_gocolx")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="card provider-payment-overview" data-testid="provider-connect-status">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("provider_payments.connect.eyebrow")}</span>
            <h2>
              {connectStatus?.transferReady
                ? i18n.t("provider_payments.connect.ready")
                : connectStatus?.account
                  ? i18n.t("provider_payments.connect.finish")
                  : i18n.t("provider_payments.connect.start")}
            </h2>
            <p>{i18n.t("provider_payments.connect.body")}</p>
          </div>
          <span className={connectStatus?.transferReady ? "result-badge" : "result-badge result-badge--neutral"}>
            {connectStatus?.transferReady
              ? i18n.t("provider_payments.connect.active")
              : connectStatus?.account?.onboardingStatus?.replaceAll("-", " ") ??
                i18n.t("provider_payments.connect.not_started")}
          </span>
        </div>
        <div className="provider-wallet-note">
          <strong>{i18n.t("provider_payments.connect.configuration.title")}</strong>
          <p>{i18n.t("provider_payments.connect.configuration.body")}</p>
        </div>
        {!connectStatus?.stripeConfigured ? (
          <p className="warning-copy">{i18n.t("provider_payments.connect.unavailable")}</p>
        ) : null}
        {!connectStatus?.transferReady ? (
          <button
            className="button"
            disabled={!connectStatus?.stripeConfigured || isStartingOnboarding}
            onClick={() => void startConnectOnboarding()}
            type="button"
          >
            {isStartingOnboarding
              ? i18n.t("provider_payments.connect.opening")
              : connectStatus?.account
                ? i18n.t("provider_payments.connect.continue")
                : i18n.t("provider_payments.connect.begin")}
          </button>
        ) : null}
      </section>

      <section className="card provider-payment-overview">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("ops_auto.provider_payments_board.payouts_eirlgt")}</span>
            <h2>{payoutStateLabel}</h2>
            <p>{i18n.t("ops_auto.provider_payments_board.completed_jobs_holds_crew_reserve_and_weekly_payout_dfqply")}</p>
          </div>
          <span className={blockedAmountCents > 0 ? "result-badge result-badge--neutral" : "result-badge"}>
            {ledger?.entries.length ?? 0} entries
          </span>
        </div>

        <div className="provider-payout-spine" aria-label={i18n.t("ops_auto.provider_payments_board.payout_path_c1mbsv")}>
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

        <div className="provider-payment-summary-grid" aria-label={i18n.t("ops_auto.provider_payments_board.payout_summary_wzv0s4")}>
          <div>
            <span>{i18n.t("ops_auto.provider_payments_board.ready_now_f307uh")}</span>
            <strong>{formatCurrency(ledger?.totalNetReadyCents ?? 0)}</strong>
            <p>
              {ledger?.payoutSchedule.instantPayoutsEnabled
                ? `${formatCurrency(ledger.payoutSchedule.instantPayoutEligibleCents)} instant eligible`
                : "Weekly payout"}
            </p>
          </div>
          <div>
            <span>{i18n.t("ops_auto.provider_payments_board.next_payout_lkuj71")}</span>
            <strong>{ledger?.payoutSchedule ? formatDateTime(ledger.payoutSchedule.nextWeeklyPayoutDateIso) : "—"}</strong>
            <p>{ledger?.payoutSchedule ? `${ledger.payoutSchedule.holdPeriodHours}h standard hold` : "Schedule pending"}</p>
          </div>
          <div>
            <span>{i18n.t("ops_auto.provider_payments_board.blocked_r6bt1o")}</span>
            <strong>{formatCurrency(blockedAmountCents)}</strong>
            <p>
              {blockedAmountCents > 0
                ? `${formatCurrency(ledger?.pendingCustomerPaymentCents ?? 0)} awaiting customer payment`
                : "No payout blockers"}
            </p>
          </div>
          <div>
            <span>{i18n.t("provider_payments.crew.responsibility")}</span>
            <strong>{i18n.t("provider_payments.crew.provider_managed")}</strong>
            <p>{i18n.t("provider_payments.crew.no_yardmatch_transfer")}</p>
          </div>
        </div>

        <div className="cta-row">
          <a className="button" href="/provider/management">
            {i18n.t("ops_auto.provider_payments_board.open_management_aa9gvt")} </a>
          <a className="button-secondary" href="/help">
            {i18n.t("ops_auto.provider_payments_board.payout_help_c1haor")} </a>
        </div>

        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">{i18n.t("ops_auto.provider_payments_board.ledger_totals_wik9pi")}</summary>
          <div className="service-card-disclosure__body">
            <div className="provider-payment-summary-grid">
              <div>
                <span>{i18n.t("ops_auto.provider_payments_board.scheduled_uhfekt")}</span>
                <strong>{formatCurrency(ledger?.totalNetScheduledCents ?? 0)}</strong>
                <p>{i18n.t("ops_auto.provider_payments_board.provider_net_already_assigned_to_a_future_run_oc2d3o")}</p>
              </div>
              <div>
                <span>{i18n.t("ops_auto.provider_payments_board.captured_8vldq")}</span>
                <strong>{formatCurrency(ledger?.totalGrossCapturedCents ?? 0)}</strong>
                <p>{i18n.t("ops_auto.provider_payments_board.customer_revenue_captured_before_provider_and_crew_split_483tsw")}</p>
              </div>
              <div>
                <span>{i18n.t("ops_auto.provider_payments_board.instant_minimum_7i3x67")}</span>
                <strong>{ledger?.payoutSchedule ? formatCurrency(ledger.payoutSchedule.instantPayoutMinimumCents) : "—"}</strong>
                <p>{ledger?.payoutSchedule.instantPayoutsEnabled ? "Instant payouts are on." : "Weekly payouts only."}</p>
              </div>
              <div>
                <span>{i18n.t("ops_auto.provider_payments_board.holds_15mctw")}</span>
                <strong>{heldEntries.length}</strong>
                <p>{i18n.t("ops_auto.provider_payments_board.refund_or_dispute_review_keeps_these_out_of_na3ey1")}</p>
              </div>
            </div>
          </div>
        </details>
      </section>

      <section className="grid-two">
        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">{i18n.t("ops_auto.provider_payments_board.provider_net_48ldrm")}</span>
              <h2>{i18n.t("ops_auto.provider_payments_board.upcoming_provider_payouts_ccq8qq")}</h2>
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
            <p>{i18n.t("ops_auto.provider_payments_board.no_completed_work_has_reached_the_payout_ledger_abce8x")}</p>
          )}
        </article>

        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">{i18n.t("provider_payments.crew.eyebrow")}</span>
              <h2>{i18n.t("provider_payments.crew.title")}</h2>
            </div>
          </div>

          <p>{i18n.t("provider_payments.crew.body")}</p>

          <div className="provider-wallet-note">
            <strong>{i18n.t("provider_payments.crew.records.title")}</strong>
            <p>{i18n.t("provider_payments.crew.records.body")}</p>
          </div>

          <div className="provider-wallet-note">
            <strong>{i18n.t("provider_payments.crew.compliance.title")}</strong>
            <p>{i18n.t("provider_payments.crew.compliance.body")}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
