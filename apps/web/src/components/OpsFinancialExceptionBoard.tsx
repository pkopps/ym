"use client";

import {
  MarketplaceApiClient,
  OpsBookingExceptionSummaryItem,
  OpsFinancialExceptionSummaryResponse,
  OpsPayoutHoldSummaryItem,
  OpsRefundSummaryItem
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { getBookingExceptionLabel } from "@yardmatch/contracts";
import { getWebApiBaseUrl } from "../lib/api";

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

function RefundReviewRow({ item }: { item: OpsRefundSummaryItem }) {
  return (
    <article className="list-panel">
      <div className="search-result-title">
        <div>
          <h3>{item.providerName ?? "Provider"} • {formatCurrency(item.amountCents)}</h3>
          <p>
            {item.customerName ?? "Customer"} • requested {formatDateTime(item.refundRequestedAt)}
          </p>
        </div>
        <span className="result-badge">{item.refundReviewStatus ?? item.paymentStatus}</span>
      </div>
      <p>{item.refundReason ?? "No refund reason recorded."}</p>
      <p>
        Booking {item.bookingId} • payment {item.paymentId} • booking state {item.bookingStatus}
      </p>
    </article>
  );
}

function PayoutHoldRow({ item }: { item: OpsPayoutHoldSummaryItem }) {
  return (
    <article className="list-panel">
      <div className="search-result-title">
        <div>
          <h3>{item.providerName ?? "Provider"} • {formatCurrency(item.amountCents)}</h3>
          <p>
            {item.customerName ?? "Customer"} • opened {formatDateTime(item.openedAt)}
          </p>
        </div>
        <span className="result-badge">{item.holdReason === "refund-review" ? "refund review" : "dispute"}</span>
      </div>
      <p>{item.notes ?? "No hold note recorded."}</p>
      <p>
        {item.category.replaceAll("-", " ")} • booking state {item.bookingStatus}
        {item.paymentStatus ? ` • payment ${item.paymentStatus}` : ""}
        {item.openedByRole ? ` • opened by ${item.openedByRole}` : ""}
      </p>
      <p>
        Booking {item.bookingId}
        {item.paymentId ? ` • payment ${item.paymentId}` : ""}
      </p>
    </article>
  );
}

function ExceptionRow({ item }: { item: OpsBookingExceptionSummaryItem }) {
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
      <p>Reported {formatDateTime(item.reportedAt)}</p>
      {item.notes ? <p>{item.notes}</p> : null}
      <p>Booking {item.bookingId}</p>
    </article>
  );
}

export function OpsFinancialExceptionBoard() {
  const [summary, setSummary] = useState<OpsFinancialExceptionSummaryResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadSummary() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    setSummary(await api.getOpsSupportSummary());
  }

  useEffect(() => {
    void loadSummary().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load refund and exception reporting.");
    });
  }, []);

  return (
    <section className="card">
      <span className="eyebrow">Refunds and field exceptions</span>
      <h2>Track open billing reviews and service issues from one ops board.</h2>
      <p>
        This view summarizes customer refund reviews, payout holds, disputed jobs, and active field exceptions
        so ops can see where money and service risk are accumulating.
      </p>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {summary ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{summary.refundReviewOpenCount}</h2>
              <p>Open refund reviews</p>
            </article>
            <article className="card">
              <h2>{summary.payoutHoldCount}</h2>
              <p>Payouts currently on hold</p>
            </article>
            <article className="card">
              <h2>{formatCurrency(summary.refundedAmountLast30DaysCents)}</h2>
              <p>Refunded in the last 30 days</p>
            </article>
          </div>

          <div className="grid-three">
            <article className="card">
              <h2>{summary.activeBookingExceptionCount}</h2>
              <p>Active booking exceptions</p>
            </article>
            <article className="card">
              <h2>{summary.disputedBookingCount}</h2>
              <p>Disputed bookings</p>
            </article>
            <article className="card">
              <h2>{summary.openBillingTicketCount}</h2>
              <p>Open billing tickets</p>
            </article>
          </div>

          <div className="grid-two">
            <article className="list-panel">
              <h3>Payout holds</h3>
              <div className="stack-md" style={{ paddingBottom: 0 }}>
                {summary.payoutHolds.length > 0 ? (
                  summary.payoutHolds.map((item) => (
                    <PayoutHoldRow item={item} key={`${item.bookingId}:${item.paymentId ?? item.holdReason}`} />
                  ))
                ) : (
                  <p>No payout holds right now.</p>
                )}
              </div>
            </article>

            <div className="stack-lg">
              <article className="list-panel">
                <h3>Open refund reviews</h3>
                <div className="stack-md" style={{ paddingBottom: 0 }}>
                  {summary.refundReviews.length > 0 ? (
                    summary.refundReviews.map((item) => <RefundReviewRow item={item} key={item.paymentId} />)
                  ) : (
                    <p>No open refund reviews right now.</p>
                  )}
                </div>
              </article>

              <article className="list-panel">
                <h3>Active field exceptions</h3>
                <div className="stack-md" style={{ paddingBottom: 0 }}>
                  {summary.activeExceptions.length > 0 ? (
                    summary.activeExceptions.map((item) => <ExceptionRow item={item} key={item.bookingId} />)
                  ) : (
                    <p>No active field exceptions right now.</p>
                  )}
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : (
        <p>Loading refund and exception reporting.</p>
      )}
    </section>
  );
}
