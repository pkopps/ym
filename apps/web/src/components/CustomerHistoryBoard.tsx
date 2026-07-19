"use client";

import { Booking, PaymentRecord } from "@yardmatch/contracts";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

function paymentLabelKey(payment?: PaymentRecord): TranslationKey {
  if (!payment) {
    return "customer_history.payment.none";
  }

  if (payment.status === "captured") {
    return "customer_history.payment.paid";
  }

  if (payment.status === "refunded") {
    return "customer_history.payment.refunded";
  }

  if (payment.status === "failed") {
    return "customer_history.payment.failed";
  }

  return "customer_history.payment.pending";
}

export function CustomerHistoryBoard() {
  const i18n = useI18n();
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_history.load_error"));
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
        <h2>{i18n.t("customer_history.loading")}</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("customer_history.login_required")}</h2>
        <p>{i18n.t("customer_history.login_body")}</p>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/login/customer", i18n.locale)}>
            {i18n.t("nav.log_in")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("customer_history.error_title")}</h2>
          <p>{errorMessage}</p>
          <div className="cta-row">
            <button className="button" disabled={isLoadingHistory} onClick={() => void loadHistory()} type="button">
              {isLoadingHistory ? i18n.t("common.actions.trying_again") : i18n.t("common.actions.try_again")}
            </button>
          </div>
        </section>
      ) : null}

      {bookings.length === 0 ? (
        <section className="card">
          <h2>{i18n.t("customer_history.empty.title")}</h2>
          <p>{i18n.t("customer_history.empty.body")}</p>
          <div className="cta-row">
            <a className="button" href={addLocalePrefix("/customer/dashboard?flow=request", i18n.locale)}>
              {i18n.t("customer_history.request_service")}
            </a>
          </div>
        </section>
      ) : (
        <section aria-label={i18n.t("nav.user.past_visits")} className="stack-lg">
          {bookings.map((booking) => {
            const payment = paymentsByBookingId[booking.id];
            return (
              <article className="history-card" key={booking.id}>
                <div className="history-card__header">
                  <div>
                    <span className="eyebrow">{booking.category.replaceAll("-", " ")}</span>
                    <h2>{providerNamesById[booking.providerId] ?? i18n.t("market.home.provider.landscaping_business")}</h2>
                  </div>
                  <strong>{booking.status.replaceAll("-", " ")}</strong>
                </div>
                <div className="history-card__grid">
                  <div>
                    <h3>{i18n.t("crew_signup.schedule")}</h3>
                    <p>{i18n.formatDate(booking.scheduledStartIso, { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <div>
                    <h3>{i18n.t("common.label.address")}</h3>
                    <p>{booking.serviceAddress.line1}</p>
                    <p>
                      {booking.serviceAddress.city}, {booking.serviceAddress.state}{" "}
                      {booking.serviceAddress.postalCode}
                    </p>
                  </div>
                  <div>
                    <h3>{i18n.t("customer_history.billing")}</h3>
                    <p>{i18n.formatCurrency(booking.totalCents)}</p>
                    <p>{i18n.t(paymentLabelKey(payment))}</p>
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
