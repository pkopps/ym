"use client";

import {
  OpsBookingExceptionSummaryItem,
  OpsFinancialExceptionSummaryResponse,
  OpsPayoutHoldSummaryItem,
  OpsRefundSummaryItem
} from "@yardmatch/contracts";
import type { I18nInstance } from "@yardmatch/i18n";
import { useEffect, useState } from "react";
import { getBookingExceptionLabel } from "@yardmatch/contracts";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not available";
  }

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function RefundReviewRow({ i18n, item }: { i18n: I18nInstance; item: OpsRefundSummaryItem }) {
  return (
    <article className="list-panel">
      <div className="search-result-title">
        <div>
          <h3>{item.providerName ?? "Provider"} • {formatCurrency(item.amountCents)}</h3>
          <p>
            {item.customerName ?? "Customer"} {i18n.t("ops_auto.ops_financial_exception_board.requested_48fgfk")} {formatDateTime(item.refundRequestedAt)}
          </p>
        </div>
        <span className="result-badge">{item.refundReviewStatus ?? item.paymentStatus}</span>
      </div>
      <p>{item.refundReason ?? "No refund reason recorded."}</p>
      <p>
        {i18n.t("ops_auto.ops_financial_exception_board.booking_sllqux")} {item.bookingId} {i18n.t("ops_auto.ops_financial_exception_board.payment_3e2qdk")} {item.paymentId} {i18n.t("ops_auto.ops_financial_exception_board.booking_state_97p5ys")} {item.bookingStatus}
      </p>
    </article>
  );
}

function PayoutHoldRow({ i18n, item }: { i18n: I18nInstance; item: OpsPayoutHoldSummaryItem }) {
  return (
    <article className="list-panel">
      <div className="search-result-title">
        <div>
          <h3>{item.providerName ?? "Provider"} • {formatCurrency(item.amountCents)}</h3>
          <p>
            {item.customerName ?? "Customer"} {i18n.t("ops_auto.ops_financial_exception_board.opened_mrnt47")} {formatDateTime(item.openedAt)}
          </p>
        </div>
        <span className="result-badge">{item.holdReason === "refund-review" ? "refund review" : "dispute"}</span>
      </div>
      <p>{item.notes ?? "No hold note recorded."}</p>
      <p>
        {item.category.replaceAll("-", " ")} {i18n.t("ops_auto.ops_financial_exception_board.booking_state_97p5ys")} {item.bookingStatus}
        {item.paymentStatus ? ` • payment ${item.paymentStatus}` : ""}
        {item.openedByRole ? ` • opened by ${item.openedByRole}` : ""}
      </p>
      <p>
        {i18n.t("ops_auto.ops_financial_exception_board.booking_sllqux")} {item.bookingId}
        {item.paymentId ? ` • payment ${item.paymentId}` : ""}
      </p>
    </article>
  );
}

function ExceptionRow({ i18n, item }: { i18n: I18nInstance; item: OpsBookingExceptionSummaryItem }) {
  return (
    <article className="list-panel">
      <div className="search-result-title">
        <div>
          <h3>{getBookingExceptionLabel(item.exceptionType)}</h3>
          <p>
            {item.providerName ?? "Provider"} • {item.customerName ?? "Customer"} • {item.category.replaceAll("-", " ")}
          </p>
        </div>
        <span className="result-badge">{item.bookingStatus}</span>
      </div>
      <p>{i18n.t("ops_auto.ops_financial_exception_board.reported_5zre31")} {formatDateTime(item.reportedAt)}</p>
      {item.notes ? <p>{item.notes}</p> : null}
      <p>{i18n.t("ops_auto.ops_financial_exception_board.booking_sllqux")} {item.bookingId}</p>
    </article>
  );
}

export function OpsFinancialExceptionBoard() {
  const i18n = useI18n();
  const [summary, setSummary] = useState<OpsFinancialExceptionSummaryResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadSummary() {
    const api = createAuthenticatedWebApiClient();
    setSummary(await api.getOpsSupportSummary());
  }

  useEffect(() => {
    void loadSummary().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load refund and exception reporting.");
    });
  }, []);

  return (
    <section className="card">
      <span className="eyebrow">{i18n.t("ops_auto.ops_financial_exception_board.refunds_and_field_exceptions_3al1hk")}</span>
      <h2>{i18n.t("ops_auto.ops_financial_exception_board.track_open_billing_reviews_and_service_issues_from_1ubnlr")}</h2>
      <p>
        {i18n.t("ops_auto.ops_financial_exception_board.this_view_summarizes_customer_refund_reviews_payout_holds_l44l7j")} </p>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {summary ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{summary.refundReviewOpenCount}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.open_refund_reviews_q5s1k9")}</p>
            </article>
            <article className="card">
              <h2>{summary.payoutHoldCount}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.payouts_currently_on_hold_u4hy4z")}</p>
            </article>
            <article className="card">
              <h2>{formatCurrency(summary.refundedAmountLast30DaysCents)}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.refunded_in_the_last_30_days_6lelo1")}</p>
            </article>
          </div>

          <div className="grid-three">
            <article className="card">
              <h2>{summary.activeBookingExceptionCount}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.active_booking_exceptions_c4l3ff")}</p>
            </article>
            <article className="card">
              <h2>{summary.disputedBookingCount}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.disputed_bookings_f06zfq")}</p>
            </article>
            <article className="card">
              <h2>{summary.openBillingTicketCount}</h2>
              <p>{i18n.t("ops_auto.ops_financial_exception_board.open_billing_tickets_a5vybw")}</p>
            </article>
          </div>

          <div className="grid-two">
            <article className="list-panel">
              <h3>{i18n.t("ops_auto.ops_financial_exception_board.payout_holds_i4ib3u")}</h3>
              <div className="stack-md" style={{ paddingBottom: 0 }}>
                {summary.payoutHolds.length > 0 ? (
                  summary.payoutHolds.map((item) => (
                    <PayoutHoldRow i18n={i18n} item={item} key={`${item.bookingId}:${item.paymentId ?? item.holdReason}`} />
                  ))
                ) : (
                  <p>{i18n.t("ops_auto.ops_financial_exception_board.no_payout_holds_right_now_9n1q5f")}</p>
                )}
              </div>
            </article>

            <div className="stack-lg">
              <article className="list-panel">
                <h3>{i18n.t("ops_auto.ops_financial_exception_board.open_refund_reviews_q5s1k9")}</h3>
                <div className="stack-md" style={{ paddingBottom: 0 }}>
                  {summary.refundReviews.length > 0 ? (
                    summary.refundReviews.map((item) => <RefundReviewRow i18n={i18n} item={item} key={item.paymentId} />)
                  ) : (
                    <p>{i18n.t("ops_auto.ops_financial_exception_board.no_open_refund_reviews_right_now_5kt3ci")}</p>
                  )}
                </div>
              </article>

              <article className="list-panel">
                <h3>{i18n.t("ops_auto.ops_financial_exception_board.active_field_exceptions_fasmzg")}</h3>
                <div className="stack-md" style={{ paddingBottom: 0 }}>
                  {summary.activeExceptions.length > 0 ? (
                    summary.activeExceptions.map((item) => <ExceptionRow i18n={i18n} item={item} key={item.bookingId} />)
                  ) : (
                    <p>{i18n.t("ops_auto.ops_financial_exception_board.no_active_field_exceptions_right_now_5gavbr")}</p>
                  )}
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : (
        <p>{i18n.t("ops_auto.ops_financial_exception_board.loading_refund_and_exception_reporting_hfdy0y")}</p>
      )}
    </section>
  );
}
