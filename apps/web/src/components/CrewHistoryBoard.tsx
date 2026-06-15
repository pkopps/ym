"use client";

import { CrewPayoutLedgerEntry } from "@yardmatch/contracts";
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

export function CrewHistoryBoard() {
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
        setErrorMessage(error instanceof Error ? error.message : "Unable to load crew history right now.");
      }
    })();
  }, [sessionReady, session?.role, session?.token]);

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
        <h2>Loading crew history...</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Crew member login required</h2>
        <p>Log in to see completed work, payout status, and exportable earnings history.</p>
        <div className="cta-row">
          <a className="button" href="/login/crew">
            Go to crew login
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
          <h2>{entries.length}</h2>
          <p>Payout records</p>
        </article>
        <article className="card">
          <h2>{paidEntries.length}</h2>
          <p>Paid shifts</p>
        </article>
        <article className="card">
          <h2>{formatCurrency(totalPaidCents)}</h2>
          <p>Total paid</p>
        </article>
      </section>

      {entries.length === 0 ? (
        <section className="card">
          <h2>No completed work yet</h2>
          <p>Completed shifts and payout records will show up here once jobs close out.</p>
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
                <strong>{formatCurrency(entry.amountCents)}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>Service date</h3>
                  <p>{formatDateTime(entry.serviceDateIso)}</p>
                  <p>{entry.bookingId}</p>
                </div>
                <div>
                  <h3>Address</h3>
                  <p>{entry.addressLine}</p>
                </div>
                <div>
                  <h3>Payout</h3>
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
