"use client";

import { Booking, PaymentRecord } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
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

function formatPaymentLabel(payment?: PaymentRecord) {
  if (!payment) {
    return "No payment recorded";
  }

  if (payment.status === "captured") {
    return "Paid";
  }

  if (payment.status === "refunded") {
    return "Refunded";
  }

  if (payment.status === "failed") {
    return "Payment failed";
  }

  return "Payment pending";
}

export function CustomerHistoryBoard() {
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadHistory() {
    if (!session || session.role !== "customer") {
      return;
    }

    try {
      setIsLoadingHistory(true);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const [bookingList, payments] = await Promise.all([api.getBookings(), api.getPayments()]);
      const historicalBookings = bookingList
        .filter((booking) =>
          ["completed", "cancelled", "refunded", "disputed"].includes(booking.status)
        )
        .sort((left, right) => right.scheduledStartIso.localeCompare(left.scheduledStartIso));

      const providerIds = [...new Set(historicalBookings.map((booking) => booking.providerId))];
      const providerProfiles = await Promise.all(
        providerIds.map(async (providerId) => {
          try {
            return await api.getProviderProfile(providerId);
          } catch {
            return undefined;
          }
        })
      );

      setProviderNamesById(
        providerProfiles.reduce<Record<string, string>>((accumulator, provider) => {
          if (provider) {
            accumulator[provider.id] = provider.companyName;
          }
          return accumulator;
        }, {})
      );
      setBookings(historicalBookings);
      setPaymentsByBookingId(
        payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
          const current = accumulator[payment.bookingId];
          if (!current || current.updatedAt < payment.updatedAt) {
            accumulator[payment.bookingId] = payment;
          }
          return accumulator;
        }, {})
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load service history right now.");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "customer") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
    void loadHistory();
  }, [sessionReady, session?.role, session?.token]);

  if (!sessionReady || (!accessDenied && isLoadingHistory && bookings.length === 0 && !errorMessage)) {
    return (
      <section className="card">
        <h2>Loading past visits...</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Log in to see past visits</h2>
        <p>See completed visits, cancellations, refunds, and billing history.</p>
        <div className="cta-row">
          <a className="button" href="/login/customer">
            Log in
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>We couldn't load past visits</h2>
          <p>{errorMessage}</p>
          <div className="cta-row">
            <button className="button" disabled={isLoadingHistory} onClick={() => void loadHistory()} type="button">
              {isLoadingHistory ? "Trying again..." : "Try again"}
            </button>
          </div>
        </section>
      ) : null}

      {bookings.length === 0 ? (
        <section className="card">
          <h2>No past visits yet</h2>
          <p>Completed, cancelled, refunded, and disputed visits will show up here.</p>
          <div className="cta-row">
            <a className="button" href="/customer/dashboard?flow=request">
              Request service
            </a>
          </div>
        </section>
      ) : (
        <section aria-label="Past visits" className="stack-lg">
          {bookings.map((booking) => {
            const payment = paymentsByBookingId[booking.id];
            return (
              <article className="history-card" key={booking.id}>
                <div className="history-card__header">
                  <div>
                    <span className="eyebrow">{booking.category.replaceAll("-", " ")}</span>
                    <h2>{providerNamesById[booking.providerId] ?? "Landscaping business"}</h2>
                  </div>
                  <strong>{booking.status.replaceAll("-", " ")}</strong>
                </div>
                <div className="history-card__grid">
                  <div>
                    <h3>Schedule</h3>
                    <p>{formatDateTime(booking.scheduledStartIso)}</p>
                  </div>
                  <div>
                    <h3>Address</h3>
                    <p>{booking.serviceAddress.line1}</p>
                    <p>
                      {booking.serviceAddress.city}, {booking.serviceAddress.state}{" "}
                      {booking.serviceAddress.postalCode}
                    </p>
                  </div>
                  <div>
                    <h3>Billing</h3>
                    <p>{formatCurrency(booking.totalCents)}</p>
                    <p>{formatPaymentLabel(payment)}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
