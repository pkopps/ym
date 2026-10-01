"use client";

import { Booking, PaymentRecord, PropertyPhotoArea } from "@yardmatch/contracts";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { LoadingSkeleton } from "./LoadingSkeleton";

function paymentLabelKey(payment?: PaymentRecord): TranslationKey {
  if (!payment) {
    return "customer_history.payment.none";
  }

  if (payment.status === "captured") {
    if (payment.refundedAmountCents) return "complaint.partially_refunded";
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

const photoAreaLabelKeys: Record<PropertyPhotoArea, TranslationKey> = {
  lawn: "photo.area.lawn",
  shrubs: "photo.area.shrubs",
  "garden-beds": "photo.area.garden_beds",
  trees: "photo.area.trees",
  driveway: "photo.area.driveway",
  walkways: "photo.area.walkways",
  gutters: "photo.area.gutters",
  other: "photo.area.other"
};

export function CustomerHistoryBoard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [workingBookingId, setWorkingBookingId] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  async function updatePhotoMarketingUse(bookingId: string, status: "granted" | "denied" | "revoked") {
    try {
      setWorkingBookingId(bookingId);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const updatedBooking = await api.updateBookingPhotoMarketingUse({ bookingId, status });
      setBookings((current) =>
        current.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_history.photos.consent_error"));
    } finally {
      setWorkingBookingId(undefined);
    }
  }

  async function loadHistory(cursor?: string) {
    if (!session || session.role !== "customer") {
      return;
    }

    try {
      setIsLoadingHistory(true);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const page = await api.getBookingsPage({ cursor, limit: 20, scope: "history" });
      const historicalBookings = page.items;
      const payments = await api.getPayments(historicalBookings.map((booking) => booking.id));

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

      setProviderNamesById((current) => ({
        ...current,
        ...providerProfiles.reduce<Record<string, string>>((accumulator, provider) => {
          if (provider) {
            accumulator[provider.id] = provider.companyName;
          }
          return accumulator;
        }, {})
      }));
      setBookings((current) => cursor ? [...current, ...historicalBookings] : historicalBookings);
      setPaymentsByBookingId((current) => ({
        ...(cursor ? current : {}),
        ...payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
          const current = accumulator[payment.bookingId];
          if (!current || current.updatedAt < payment.updatedAt) {
            accumulator[payment.bookingId] = payment;
          }
          return accumulator;
        }, {})
      }));
      setNextCursor(page.pageInfo.nextCursor);
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
      <LoadingSkeleton cardCount={3} className="grid-three" label={i18n.t("customer_history.loading")} showAvatar />
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
          <p aria-live="polite">
            {i18n.t("customer_history.loaded_count", { count: bookings.length })}
          </p>
          {bookings.map((booking) => {
            const payment = paymentsByBookingId[booking.id];
            const beforePhotos = booking.serviceEvidence.filter(
              (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo" && evidence.imageDataUrl
            );
            const afterPhotos = booking.serviceEvidence.filter(
              (evidence) => evidence.phase === "after" && evidence.evidenceType === "photo" && evidence.imageDataUrl
            );
            const marketingUseStatus = [...beforePhotos, ...afterPhotos].find(
              (evidence) => evidence.marketingUseStatus
            )?.marketingUseStatus;
            return (
              <article className="history-card" key={booking.id}>
                <div className="history-card__header">
                  <div>
                    <span className="eyebrow">{(booking.services?.length ? booking.services.map(item => item.category) : [booking.category]).map(category => i18n.t(serviceCategoryToI18nKey(category))).join(" · ")}</span>
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
                {beforePhotos.length > 0 || afterPhotos.length > 0 ? (
                  <section className="service-history-photos">
                    <div className="service-history-photos__header">
                      <div>
                        <h3>{i18n.t("customer_history.photos.title")}</h3>
                        <p>{i18n.t("customer_history.photos.body")}</p>
                      </div>
                      <span className="result-badge result-badge--neutral">
                        {i18n.t("customer_history.photos.count", { count: beforePhotos.length + afterPhotos.length })}
                      </span>
                    </div>
                    <div className="before-after-grid">
                      {(["before", "after"] as const).map((phase) => {
                        const photos = phase === "before" ? beforePhotos : afterPhotos;
                        return (
                          <div className="before-after-column" key={phase}>
                            <strong>
                              {phase === "before"
                                ? i18n.t("customer_history.photos.before")
                                : i18n.t("customer_history.photos.after")}
                            </strong>
                            {photos.length > 0 ? (
                              <div className="service-photo-strip">
                                {photos.map((photo) => (
                                  <figure key={photo.id}>
                                    <img
                                      alt={
                                        phase === "before"
                                          ? i18n.t("customer_history.photos.before_alt")
                                          : i18n.t("customer_history.photos.after_alt")
                                      }
                                      src={photo.imageDataUrl}
                                    />
                                    <figcaption>
                                      {i18n.t(photoAreaLabelKeys[photo.photoArea ?? "other"])}
                                      {photo.note ? ` • ${photo.note}` : ""}
                                    </figcaption>
                                  </figure>
                                ))}
                              </div>
                            ) : (
                              <p>{i18n.t("customer_history.photos.none")}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {booking.status === "completed" && beforePhotos.length > 0 && afterPhotos.length > 0 ? (
                      <div className="photo-consent-panel">
                        <div>
                          <strong>{i18n.t("customer_history.photos.marketing_title")}</strong>
                          <p>{i18n.t("customer_history.photos.marketing_body")}</p>
                          <p>
                            {marketingUseStatus === "granted"
                              ? i18n.t("customer_history.photos.marketing_granted")
                              : marketingUseStatus === "denied"
                                ? i18n.t("customer_history.photos.marketing_denied")
                                : marketingUseStatus === "revoked"
                                  ? i18n.t("customer_history.photos.marketing_revoked")
                                  : i18n.t("customer_history.photos.marketing_private")}
                          </p>
                        </div>
                        <div className="cta-row">
                          {marketingUseStatus !== "granted" ? (
                            <button
                              className="button-secondary"
                              disabled={workingBookingId === booking.id}
                              onClick={() => void updatePhotoMarketingUse(booking.id, "granted")}
                              type="button"
                            >
                              {i18n.t("customer_history.photos.allow_marketing")}
                            </button>
                          ) : (
                            <button
                              className="button-secondary"
                              disabled={workingBookingId === booking.id}
                              onClick={() => void updatePhotoMarketingUse(booking.id, "revoked")}
                              type="button"
                            >
                              {i18n.t("customer_history.photos.revoke_marketing")}
                            </button>
                          )}
                          {marketingUseStatus !== "granted" && marketingUseStatus !== "denied" ? (
                            <button
                              className="button-secondary"
                              disabled={workingBookingId === booking.id}
                              onClick={() => void updatePhotoMarketingUse(booking.id, "denied")}
                              type="button"
                            >
                              {i18n.t("customer_history.photos.keep_private")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </article>
            );
          })}
          {nextCursor ? (
            <div className="cta-row">
              <button
                className="button-secondary"
                disabled={isLoadingHistory}
                onClick={() => void loadHistory(nextCursor)}
                type="button"
              >
                {isLoadingHistory
                  ? i18n.t("customer_history.loading_more")
                  : i18n.t("customer_history.load_more")}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
