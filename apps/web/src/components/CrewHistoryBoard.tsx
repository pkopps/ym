"use client";

import { CrewPayoutLedgerEntry } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

export function CrewHistoryBoard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [entries, setEntries] = useState<CrewPayoutLedgerEntry[]>([]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);

    void (async () => {
      try {
        const api = createAuthenticatedWebApiClient();
        const ledger = await api.getCrewPayoutLedger();
        setEntries(
          ledger.entries
            .slice()
            .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso))
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_history.load_error"));
      }
    })();
  }, [i18n, sessionReady, session?.role, session?.token]);

  const paidEntries = useMemo(
    () => entries.filter((entry) => entry.status === "paid"),
    [entries]
  );
  const totalPaidCents = useMemo(
    () => paidEntries.reduce((total, entry) => total + entry.amountCents, 0),
    [paidEntries]
  );

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>{i18n.t("crew_history.loading")}</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("crew_history.login_required")}</h2>
        <p>{i18n.t("crew_history.login_body")}</p>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/login/crew", i18n.locale)}>
            {i18n.t("crew_history.login_cta")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("common.state.needs_attention")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{entries.length}</h2>
          <p>{i18n.t("crew_history.metric.payout_records")}</p>
        </article>
        <article className="card">
          <h2>{paidEntries.length}</h2>
          <p>{i18n.t("crew_history.metric.paid_shifts")}</p>
        </article>
        <article className="card">
          <h2>{i18n.formatCurrency(totalPaidCents)}</h2>
          <p>{i18n.t("crew_history.metric.total_paid")}</p>
        </article>
      </section>

      {entries.length === 0 ? (
        <section className="card">
          <h2>{i18n.t("crew_history.empty.title")}</h2>
          <p>{i18n.t("crew_history.empty.body")}</p>
        </section>
      ) : (
        <section className="stack-lg">
          {entries.map((entry) => (
            <article className="history-card" key={entry.id}>
              <div className="history-card__header">
                <div>
                  <span className="eyebrow">{entry.serviceLabel}</span>
                  <h2>{entry.providerCompanyName}</h2>
                </div>
                <strong>{i18n.formatCurrency(entry.amountCents)}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>{i18n.t("crew_history.service_date")}</h3>
                  <p>{i18n.formatDate(entry.serviceDateIso, { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p>{entry.bookingId}</p>
                </div>
                <div>
                  <h3>{i18n.t("common.label.address")}</h3>
                  <p>{entry.addressLine}</p>
                </div>
                <div>
                  <h3>{i18n.t("crew_history.payout")}</h3>
                  <p>{entry.status.replaceAll("-", " ")}</p>
                  <p>{entry.note}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
