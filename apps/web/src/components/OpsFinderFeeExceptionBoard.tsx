"use client";

import type { OpsFinderFeeExceptionItem } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDateTime(iso?: string) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/** Finder-fee charges to providers' cards that failed, are retrying, or stalled mid-attempt. */
export function OpsFinderFeeExceptionBoard() {
  const i18n = useI18n();
  const [items, setItems] = useState<OpsFinderFeeExceptionItem[] | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    void createAuthenticatedWebApiClient().getOpsSupportSummary()
      .then(summary => setItems(summary.finderFeeExceptions))
      .catch(() => setErrorMessage(i18n.t("ops_finder_fees.load_error")));
  }, [i18n]);

  const statusLabel = (status: OpsFinderFeeExceptionItem["status"]) => i18n.t(`ops_finder_fees.status.${status}` as Parameters<typeof i18n.t>[0]);

  return (
    <section className="card">
      <h2>{i18n.t("ops_finder_fees.title")}</h2>
      <p>{i18n.t("ops_finder_fees.description")}</p>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {items && items.length === 0 ? <p>{i18n.t("ops_finder_fees.empty")}</p> : null}
      {items?.map(item => (
        <article className="list-panel" key={item.chargeId}>
          <div className="search-result-title">
            <div>
              <h3>{item.providerName ?? item.providerId} • {formatCurrency(item.feeCents)}</h3>
              <p>{item.customerName ?? item.customerId}</p>
            </div>
            <span className="result-badge">{statusLabel(item.status)}</span>
          </div>
          <p>{item.lastFailureReason ?? i18n.t("ops_finder_fees.no_reason")}</p>
          <p>
            {i18n.t("ops_finder_fees.attempts", { count: item.attemptCount })} • {i18n.t("ops_finder_fees.last_attempt")} {formatDateTime(item.lastAttemptAt)}
            {item.nextAttemptAt ? <> • {i18n.t("ops_finder_fees.next_attempt")} {formatDateTime(item.nextAttemptAt)}</> : null}
          </p>
          <p>{i18n.t("ops_finder_fees.booking")} {item.bookingId}</p>
        </article>
      ))}
    </section>
  );
}
