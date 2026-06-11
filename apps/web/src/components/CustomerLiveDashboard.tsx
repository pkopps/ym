"use client";

import {
  BookingArrivalTracking,
  Booking,
  CustomerProviderConversationThread,
  CustomerProfile,
  CustomerProperty,
  CustomerReviewOpportunity,
  formatBookingWindowSummary,
  getBookingExceptionLabel,
  InstantQuoteResponse,
  PaymentRecord,
  ProviderProfile,
  SearchProvidersResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { ArrivalTrackingPanel } from "./ArrivalTrackingPanel";
import { FloatingChatWindow } from "./FloatingChatWindow";

const serviceOptions: Array<{ label: string; value: ServiceCategory }> = [
  { label: "Lawn mowing", value: "lawn-mowing" },
  { label: "Hedge trimming", value: "hedge-trimming" },
  { label: "Mulch installation", value: "mulch-installation" },
  { label: "Seasonal cleanup", value: "seasonal-cleanup" },
  { label: "Weed control", value: "weed-control" },
  { label: "Leaf blowing", value: "leaf-blowing" }
];

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

function formatEta(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function toDateTimeLocalValue(iso: string) {
  const value = new Date(iso);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CustomerLiveDashboard() {
  const searchParams = useSearchParams();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile | undefined>();
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("lawn-mowing");
  const [quote, setQuote] = useState<InstantQuoteResponse | undefined>();
  const [providerResults, setProviderResults] = useState<SearchProvidersResponse | undefined>();
  const [loadingState, setLoadingState] = useState<"idle" | "loading">("idle");
  const [providerSearchState, setProviderSearchState] = useState<"idle" | "loading" | "loaded">("idle");
  const [bookingMessage, setBookingMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, string>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, string>>({});
  const [rescheduleDrafts, setRescheduleDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [paymentActionHandled, setPaymentActionHandled] = useState(false);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [activeTracking, setActiveTracking] = useState<BookingArrivalTracking | undefined>();

  const activeProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const providerCards =
    providerResults?.rankedProviders.map((result) => ({
      provider: result.provider,
      ranking: result,
      slot:
        result.suggestedSlot ??
        providerResults.suggestedSlots.find((candidate) => candidate.providerId === result.provider.id)
    })) ??
    providerResults?.providers.map((provider) => ({
      provider,
      ranking: undefined,
      slot: providerResults.suggestedSlots.find((candidate) => candidate.providerId === provider.id)
    })) ??
    [];
  const providersWithWindows = providerCards.filter((item) => item.slot);
  const nextBooking = bookings
    .filter(
      (booking) =>
        booking.status !== "completed" &&
        booking.status !== "refunded" &&
        booking.status !== "cancelled"
    )
    .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0];

  async function loadDashboard() {
    if (!session || session.role !== "customer") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
    const api = createAuthenticatedWebApiClient();
    const [meResponse, propertyList, bookingList, reviewResponse, payments] = await Promise.all([
      api.getCurrentUser(),
      api.getCustomerProperties(),
      api.getBookings(),
      api.getCustomerReviewOpportunities(),
      api.getPayments()
    ]);

    const uniqueProviderIds = [...new Set(bookingList.map((booking) => booking.providerId))];
    const providerProfiles = await Promise.all(
      uniqueProviderIds.map(async (providerId) => {
        try {
          return await api.getProviderProfile(providerId);
        } catch {
          return undefined;
        }
      })
    );

    setProviderNamesById(
      providerProfiles.reduce<Record<string, string>>((accumulator: Record<string, string>, profile) => {
        if (profile) {
          accumulator[profile.id] = profile.companyName;
        }
        return accumulator;
      }, {})
    );

    setCustomer(meResponse.user as CustomerProfile);
    setProperties(propertyList);
    setBookings(
      bookingList.sort((left, right) => right.scheduledStartIso.localeCompare(left.scheduledStartIso))
    );
    setRescheduleDrafts(
      bookingList.reduce<Record<string, { start: string; end: string }>>((accumulator, booking) => {
        accumulator[booking.id] = {
          start: toDateTimeLocalValue(booking.scheduledStartIso),
          end: toDateTimeLocalValue(booking.scheduledEndIso)
        };
        return accumulator;
      }, {})
    );
    setPaymentsByBookingId(
      payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
        const current = accumulator[payment.bookingId];
        if (!current || current.updatedAt < payment.updatedAt) {
          accumulator[payment.bookingId] = payment;
        }
        return accumulator;
      }, {})
    );
    setReviewOpportunities(reviewResponse.opportunities);

    if (!selectedPropertyId && propertyList[0]) {
      setSelectedPropertyId(propertyList[0].id);
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

    void loadDashboard().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load your customer account.");
    });
  }, [sessionReady, session?.token, session?.role]);

  useEffect(() => {
    if (!sessionReady || paymentActionHandled) {
      return;
    }

    const checkoutSessionId = searchParams.get("session_id");
    const paymentState = searchParams.get("payment");

    if (!checkoutSessionId && !paymentState) {
      return;
    }

    const clearPaymentParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("session_id");
      nextUrl.searchParams.delete("payment");
      window.history.replaceState({}, "", nextUrl.toString());
    };

    if (paymentState === "stripe-cancelled") {
      setBookingMessage("Stripe checkout cancelled.");
      setPaymentActionHandled(true);
      clearPaymentParams();
      return;
    }

    if (!checkoutSessionId) {
      return;
    }

    setPaymentActionHandled(true);
    setLoadingState("loading");
    setErrorMessage(undefined);

    void (async () => {
      try {
        const api = createAuthenticatedWebApiClient();
        await api.finalizeCheckoutSession({
          checkoutSessionId
        });
        await loadDashboard();
        setBookingMessage("Stripe payment received.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to confirm your Stripe payment right now."
        );
      } finally {
        setLoadingState("idle");
        clearPaymentParams();
      }
    })();
  }, [paymentActionHandled, searchParams, sessionReady]);

  async function handleQuote() {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextQuote = await api.createInstantQuote({
        address: activeProperty.address,
        category: selectedCategory,
        propertyId: activeProperty.id
      });
      setQuote(nextQuote);
      setProviderResults(undefined);
      setProviderSearchState("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to build a quote right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleSearchProviders() {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setProviderSearchState("loading");

    try {
      const api = createAuthenticatedWebApiClient();
      const results = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedCategory],
        dateIso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        estimatedDurationMinutes: quote?.estimatedDurationMinutes
      });
      setProviderResults(results);
      setProviderSearchState("loaded");
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unable to search providers right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCreateBooking(provider: ProviderProfile) {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
      return;
    }

    const slot = providerResults?.suggestedSlots.find((candidate) => candidate.providerId === provider.id);
    if (!slot || !quote) {
      setErrorMessage("Pick a provider with an available slot first.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createBooking({
        providerId: provider.id,
        serviceAddress: activeProperty.address,
        servicePropertyId: activeProperty.id,
        category: selectedCategory,
        scheduledStartIso: slot.startIso,
        scheduledEndIso: slot.endIso,
        notes: "Booked from the live YardMatch customer dashboard.",
        totalCents: quote.estimatedPriceCents
      });
      setBookingMessage(`Booked ${provider.companyName} for the ${formatBookingWindowSummary(slot.startIso)} window.`);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your booking right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleStartCheckout(booking: Booking) {
    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const checkout = await api.createCheckoutSession({
        bookingId: booking.id,
        successPath: "/customer/dashboard?payment=stripe-success",
        cancelPath: "/customer/dashboard?payment=stripe-cancelled"
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to open Stripe checkout right now."
      );
      setLoadingState("idle");
    }
  }

  async function handleSubmitReview(opportunity: CustomerReviewOpportunity) {
    const reviewText = (reviewDrafts[opportunity.bookingId] ?? "Great job, arrived on time and left the property clean.").trim();

    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createProviderReview({
        bookingId: opportunity.bookingId,
        overallRating: 5,
        timelinessRating: 5,
        attentionToDetailRating: 5,
        reviewText
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit your review right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.cancelBooking({ bookingId });
      setBookingMessage("Booking cancelled.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel this booking right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRescheduleBooking(bookingId: string) {
    const draft = rescheduleDrafts[bookingId];
    if (!draft) {
      setErrorMessage("Pick a new date and time first.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.rescheduleBooking({
        bookingId,
        scheduledStartIso: new Date(draft.start).toISOString(),
        scheduledEndIso: new Date(draft.end).toISOString()
      });
      setBookingMessage("Booking rescheduled.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reschedule this booking right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleOpenDispute(bookingId: string) {
    const reason = (disputeDrafts[bookingId] ?? "").trim();
    if (!reason) {
      setErrorMessage("Tell us why you need to dispute this booking.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createBookingDispute({
        bookingId,
        reason
      });
      setBookingMessage("Dispute opened. YardMatch support now has the booking context.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open this dispute right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRequestRefundReview(bookingId: string) {
    const payment = getPaymentRecord(bookingId);
    const reason = (refundDrafts[bookingId] ?? "").trim();

    if (!payment) {
      setErrorMessage("There is no payment on file for this booking yet.");
      return;
    }

    if (!reason) {
      setErrorMessage("Tell us why you need a refund review.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createRefund({
        paymentId: payment.id,
        reason
      });
      setBookingMessage("Refund review requested. YardMatch support now has the payment and booking context.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to request a refund review right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function openCustomerChat(bookingId: string) {
    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextThread = await api.getCustomerProviderConversationThread(undefined, bookingId);
      setActiveChatBookingId(bookingId);
      setChatThread(nextThread);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open business chat right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function openArrivalTracking(bookingId: string) {
    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const tracking = await api.getBookingTracking(bookingId);
      setActiveTrackingBookingId(bookingId);
      setActiveTracking(tracking);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load arrival tracking right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function sendCustomerChat(bookingId: string) {
    const body = chatDraft.trim();
    if (!body) {
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextThread = await api.sendCustomerProviderMessage({
        threadId: chatThread?.thread.id,
        bookingId,
        body
      });
      setChatThread(nextThread);
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send your message right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  if (!sessionReady) {
    return (
      <section className="container stack-lg">
        <section className="card">
          <h2>Loading your account...</h2>
        </section>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <main className="container stack-lg">
        <section className="card">
          <h2>Customer login required</h2>
          <p>Start by searching for service, or log in to manage existing bookings.</p>
          <div className="cta-row">
            <a className="button-secondary" href="/customer">
              Search services
            </a>
            <a className="button" href="/login/customer">
              Log in
            </a>
          </div>
        </section>
      </main>
    );
  }

  function getPaymentRecord(bookingId: string) {
    return paymentsByBookingId[bookingId];
  }

  function getPaymentLabel(payment?: PaymentRecord) {
    if (!payment) {
      return "Not paid";
    }

    if (payment.refundReviewStatus === "requested") {
      return "Refund review in progress";
    }

    if (payment.refundReviewStatus === "denied") {
      return "Refund request denied";
    }

    if (payment.status === "captured") {
      return "Paid";
    }

    if (payment.status === "pending") {
      return "Awaiting Stripe checkout";
    }

    if (payment.status === "failed") {
      return "Payment needs attention";
    }

    if (payment.status === "refunded") {
      return "Refunded";
    }

    return "Payment on file";
  }

  function canRequestRefundReview(booking: Booking, payment?: PaymentRecord) {
    return booking.status === "completed" && payment?.status === "captured" && payment.refundable;
  }

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>Welcome back, {customer?.fullName?.split(" ")[0] ?? "there"}.</h1>
        <p>
          {nextBooking
            ? `Next service ${formatBookingWindowSummary(nextBooking.scheduledStartIso)} with ${providerNamesById[nextBooking.providerId] ?? "your landscaper"}`
            : "You do not have an upcoming service yet."}
        </p>
        {nextBooking?.lateEtaIso && !nextBooking.onRouteConfirmedAt ? (
          <p>
            Running behind. New target: {formatEta(nextBooking.lateEtaIso)}.
            {nextBooking.lateReason ? ` ${nextBooking.lateReason}` : ""}
          </p>
        ) : null}
        {nextBooking?.activeExceptionType ? (
          <p>
            Update: {getBookingExceptionLabel(nextBooking.activeExceptionType)}.
            {nextBooking.activeExceptionNotes ? ` ${nextBooking.activeExceptionNotes}` : ""}
          </p>
        ) : null}
      </section>

      {bookingMessage ? (
        <section className="card">
          <h2>Update</h2>
          <p>{bookingMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <h2>Something needs attention</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{properties.length}</h2>
          <p>Saved properties</p>
        </article>
        <article className="card">
          <h2>
            {
              bookings.filter(
                (booking) =>
                  booking.status !== "completed" &&
                  booking.status !== "cancelled" &&
                  booking.status !== "refunded"
              ).length
            }
          </h2>
          <p>Open bookings</p>
        </article>
        <article className="card">
          <h2>{reviewOpportunities.filter((opportunity) => opportunity.canReviewNow).length}</h2>
          <p>Reviews ready now</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Book a service</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Property</span>
              <select
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                value={selectedPropertyId}
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Service</span>
              <select
                onChange={(event) => setSelectedCategory(event.target.value as ServiceCategory)}
                value={selectedCategory}
              >
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <button className="button" disabled={loadingState === "loading"} onClick={handleQuote} type="button">
              {loadingState === "loading" ? "Working..." : "Get instant quote"}
            </button>
            <button
              className="button-secondary"
              disabled={!quote || loadingState === "loading"}
              onClick={handleSearchProviders}
              type="button"
            >
              Find landscapers
            </button>
          </div>
          {activeProperty ? (
            <p>
              {activeProperty.address.line1}, {activeProperty.address.city}, {activeProperty.address.state}
            </p>
          ) : null}
        </article>

        <article className="card">
          <h2>Quote preview</h2>
          {quote ? (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              <article className="list-panel">
                <h3>{formatCurrency(quote.estimatedPriceCents)}</h3>
                <p>
                  {quote.estimatedDurationMinutes} minutes • {quote.confidenceTier} confidence
                </p>
              </article>
              <article className="list-panel">
                <h3>Property estimate</h3>
                <p>
                  Turf {quote.measurements.turfSqFt} sq ft • Shrubs {quote.measurements.shrubBedSqFt} sq ft
                </p>
              </article>
              <article className="list-panel">
                <h3>Summary</h3>
                <p>{quote.estimateSummary}</p>
              </article>
            </div>
          ) : (
            <p>Pick a property and service, then get a live quote from the API.</p>
          )}
        </article>
      </section>

      <section className="card">
        <h2>Nearby landscapers</h2>
        {providerSearchState === "loading" ? (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <article className="list-panel">
              <h3>Checking nearby coverage</h3>
              <p>Looking at route openings, service radius, and live availability for this property.</p>
            </article>
            <article className="list-panel">
              <h3>This can take a moment</h3>
              <p>If a lot of businesses serve your area, YardMatch sorts the closest openings first.</p>
            </article>
          </div>
        ) : providerResults ? (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {providerResults.providers.length === 0 ? (
              <article className="list-panel">
                <h3>No landscaping businesses are live in this area yet.</h3>
                <p>We do not have a provider serving this property right now. Try a nearby city or contact support so we can flag the area for expansion.</p>
                <div className="cta-row">
                  <a className="button-secondary" href="/help?issueType=general&subject=Need service in my area">
                    Request service in this area
                  </a>
                </div>
              </article>
            ) : null}
            {providerResults.providers.length > 0 && providersWithWindows.length === 0 ? (
              <article className="list-panel">
                <h3>Businesses cover this area, but nothing is open in this window.</h3>
                <p>Try another service window, another property, or check back later as route openings change throughout the day.</p>
              </article>
            ) : null}
            {providerCards.map(({ provider, ranking, slot }) => {
              return (
                <article className="list-panel" key={provider.id}>
                  <div className="search-result-title">
                    <h3>{provider.companyName}</h3>
                    {provider.sponsoredListingEnabled ? <span className="result-badge">Sponsored</span> : null}
                  </div>
                  <p>
                    {provider.rating.toFixed(1)} overall • {provider.timelinessRating.toFixed(1)} punctuality
                  </p>
                  {ranking ? (
                    <p>
                      {ranking.distanceMiles.toFixed(1)} miles away • {ranking.reasons.join(" • ")}
                    </p>
                  ) : null}
                    <p>
                      Radius {provider.serviceRadiusMiles} miles •{" "}
                      {slot ? `${formatBookingWindowSummary(slot.startIso)} window` : "No open slot"}
                    </p>
                  <div className="cta-row">
                    <button
                      className="button"
                      disabled={!slot || loadingState === "loading"}
                      onClick={() => void handleCreateBooking(provider)}
                      type="button"
                    >
                      Book this window
                    </button>
                  </div>
                  {!slot ? (
                    <p style={{ marginTop: "0.75rem" }}>
                      This business serves the area, but it does not have an open route window right now.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p>Search after the quote to see live provider matches and open route windows.</p>
        )}
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Your bookings</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {bookings.map((booking) => (
              <article className="history-card" key={booking.id}>
                <div className="history-card__header">
                  <div>
                    <span className="eyebrow">{booking.category.replaceAll("-", " ")}</span>
                    <h2>{booking.status}</h2>
                    <p>{providerNamesById[booking.providerId] ?? "Landscaping business"}</p>
                  </div>
                  <strong>{formatCurrency(booking.totalCents)}</strong>
                </div>
                <div className="history-card__grid">
                  <div>
                    <h3>Address</h3>
                    <p>{booking.serviceAddress.line1}</p>
                    <p>
                      {booking.serviceAddress.city}, {booking.serviceAddress.state} {booking.serviceAddress.postalCode}
                    </p>
                  </div>
                  <div>
                    <h3>Schedule</h3>
                    <p>{formatBookingWindowSummary(booking.scheduledStartIso)}</p>
                    <p>{formatDateTime(booking.scheduledStartIso)}</p>
                  </div>
                  <div>
                    <h3>Notes</h3>
                    <p>{booking.notes || "No extra notes."}</p>
                  </div>
                  <div>
                    <h3>Payment</h3>
                    <p>{getPaymentLabel(getPaymentRecord(booking.id))}</p>
                    {getPaymentRecord(booking.id)?.paidAt ? (
                      <p>{formatDateTime(getPaymentRecord(booking.id)?.paidAt as string)}</p>
                    ) : null}
                  </div>
                </div>
                {booking.status === "requested" || booking.status === "confirmed" ? (
                  <>
                    <div className="form-grid" style={{ marginTop: "1rem" }}>
                      <label className="form-field">
                        <span>New start</span>
                        <input
                          onChange={(event) =>
                            setRescheduleDrafts((current) => ({
                              ...current,
                              [booking.id]: {
                                start: event.target.value,
                                end: current[booking.id]?.end ?? toDateTimeLocalValue(booking.scheduledEndIso)
                              }
                            }))
                          }
                          type="datetime-local"
                          value={rescheduleDrafts[booking.id]?.start ?? toDateTimeLocalValue(booking.scheduledStartIso)}
                        />
                      </label>
                      <label className="form-field">
                        <span>New end</span>
                        <input
                          onChange={(event) =>
                            setRescheduleDrafts((current) => ({
                              ...current,
                              [booking.id]: {
                                start:
                                  current[booking.id]?.start ?? toDateTimeLocalValue(booking.scheduledStartIso),
                                end: event.target.value
                              }
                            }))
                          }
                          type="datetime-local"
                          value={rescheduleDrafts[booking.id]?.end ?? toDateTimeLocalValue(booking.scheduledEndIso)}
                        />
                      </label>
                    </div>
                    <div className="cta-row" style={{ marginTop: "1rem" }}>
                      <button
                        className="button"
                        disabled={
                          loadingState === "loading" || getPaymentRecord(booking.id)?.status === "captured"
                        }
                        onClick={() => void handleStartCheckout(booking)}
                        type="button"
                      >
                        {getPaymentRecord(booking.id)?.status === "pending"
                          ? "Continue Stripe checkout"
                          : "Pay with Stripe"}
                      </button>
                      <button
                        className="button-secondary"
                        disabled={loadingState === "loading"}
                        onClick={() => void handleRescheduleBooking(booking.id)}
                        type="button"
                      >
                        Reschedule
                      </button>
                      <button
                        className="button-secondary"
                        disabled={loadingState === "loading"}
                        onClick={() => void handleCancelBooking(booking.id)}
                        type="button"
                      >
                        Cancel booking
                      </button>
                      <a
                        className="button-secondary"
                        href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=general&subject=${encodeURIComponent("Booking support")}`}
                      >
                        Get help
                      </a>
                    </div>
                  </>
                ) : null}
                {booking.lateEtaIso && !booking.onRouteConfirmedAt ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>Delay update</h3>
                    <p>
                      {providerNamesById[booking.providerId] ?? "The landscaping business"} is running behind.
                    </p>
                    <p>
                      New target: {formatEta(booking.lateEtaIso)}.
                      {booking.lateReason ? ` ${booking.lateReason}` : ""}
                    </p>
                  </div>
                ) : null}
                {booking.activeExceptionType ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>{getBookingExceptionLabel(booking.activeExceptionType)}</h3>
                    <p>
                      {providerNamesById[booking.providerId] ?? "The landscaping business"} flagged an issue with this
                      visit.
                    </p>
                    <p>
                      {booking.activeExceptionNotes ?? "Check in with the business or support to work out the next step."}
                    </p>
                    <div className="cta-row">
                      <a
                        className="button-secondary"
                        href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=service-quality&subject=${encodeURIComponent(
                          getBookingExceptionLabel(booking.activeExceptionType)
                        )}`}
                      >
                        Get help
                      </a>
                    </div>
                  </div>
                ) : null}
                {booking.status === "disputed" ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>Booking disputed</h3>
                    <p>
                      {booking.disputeReason ?? "A dispute was opened for this booking."}
                    </p>
                    <p>
                      YardMatch support can now step in with the full booking context.
                    </p>
                    <div className="cta-row">
                      <a
                        className="button-secondary"
                        href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=service-quality&subject=${encodeURIComponent("Disputed booking support")}`}
                      >
                        Open support
                      </a>
                    </div>
                  </div>
                ) : null}
                {booking.onRouteConfirmedAt ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>Business chat</h3>
                    <p>
                      Crew is on the way. You can now message{" "}
                      {providerNamesById[booking.providerId] ?? "the landscaping business"}.
                    </p>
                    <div className="cta-row">
                      <button
                        className="button-secondary"
                        disabled={loadingState === "loading"}
                        onClick={() => void openCustomerChat(booking.id)}
                        type="button"
                      >
                        Message business
                      </button>
                      <button
                        className="button-secondary"
                        disabled={loadingState === "loading"}
                        onClick={() => void openArrivalTracking(booking.id)}
                        type="button"
                      >
                        Track crew
                      </button>
                      <a
                        className="button-secondary"
                        href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=service-quality&subject=${encodeURIComponent("On-route support")}`}
                      >
                        Get help
                      </a>
                    </div>
                  </div>
                ) : null}
                {activeTrackingBookingId === booking.id && activeTracking ? (
                  <ArrivalTrackingPanel
                    subtitle={providerNamesById[booking.providerId] ?? "Landscaping business"}
                    title="Crew on the way"
                    tracking={activeTracking}
                  />
                ) : null}
                {booking.status !== "cancelled" &&
                booking.status !== "refunded" &&
                booking.status !== "requested" &&
                booking.status !== "disputed" ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>Need to dispute this service?</h3>
                    <p>Open a formal dispute so YardMatch support can step in with the booking context attached.</p>
                    <div className="form-grid" style={{ marginTop: "1rem" }}>
                      <label className="form-field form-field--full">
                        <span>Dispute reason</span>
                        <textarea
                          rows={3}
                          value={disputeDrafts[booking.id] ?? ""}
                          onChange={(event) =>
                            setDisputeDrafts((current) => ({
                              ...current,
                              [booking.id]: event.target.value
                            }))
                          }
                          placeholder="What went wrong with this service?"
                        />
                      </label>
                    </div>
                    <div className="cta-row" style={{ marginTop: "1rem" }}>
                      <button
                        className="button-secondary"
                        disabled={loadingState === "loading"}
                        onClick={() => void handleOpenDispute(booking.id)}
                        type="button"
                      >
                        Open dispute
                      </button>
                    </div>
                  </div>
                ) : null}
                {(canRequestRefundReview(booking, getPaymentRecord(booking.id)) ||
                  getPaymentRecord(booking.id)?.refundReviewStatus === "requested" ||
                  getPaymentRecord(booking.id)?.refundReviewStatus === "denied") ? (
                  <div className="list-panel" style={{ marginTop: "1rem" }}>
                    <h3>Refund review</h3>
                    <p>
                      {getPaymentRecord(booking.id)?.refundReviewStatus === "requested"
                        ? "YardMatch support is reviewing this refund request. Payouts stay on hold until the review is resolved."
                        : getPaymentRecord(booking.id)?.refundReviewStatus === "denied"
                          ? `The last refund review was denied.${getPaymentRecord(booking.id)?.refundDecisionNotes ? ` ${getPaymentRecord(booking.id)?.refundDecisionNotes}` : ""}`
                          : "If this completed service needs a billing review, send a refund request with the reason below."}
                    </p>
                    {getPaymentRecord(booking.id)?.refundReviewStatus !== "requested" ? (
                      <>
                        <div className="form-grid" style={{ marginTop: "1rem" }}>
                          <label className="form-field form-field--full">
                            <span>Refund reason</span>
                            <textarea
                              rows={3}
                              value={refundDrafts[booking.id] ?? ""}
                              onChange={(event) =>
                                setRefundDrafts((current) => ({
                                  ...current,
                                  [booking.id]: event.target.value
                                }))
                              }
                              placeholder="Why should YardMatch review this payment?"
                            />
                          </label>
                        </div>
                        <div className="cta-row" style={{ marginTop: "1rem" }}>
                          <button
                            className="button-secondary"
                            disabled={loadingState === "loading" || !canRequestRefundReview(booking, getPaymentRecord(booking.id))}
                            onClick={() => void handleRequestRefundReview(booking.id)}
                            type="button"
                          >
                            Request refund review
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Reviews</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {reviewOpportunities.length === 0 ? <p>No review invites yet.</p> : null}
            {reviewOpportunities.map((opportunity) => (
              <article className="list-panel" key={opportunity.bookingId}>
                <h3>{opportunity.providerName}</h3>
                <p>{opportunity.reason}</p>
                {opportunity.canReviewNow && !opportunity.reviewAlreadySubmitted ? (
                  <>
                    <textarea
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [opportunity.bookingId]: event.target.value
                        }))
                      }
                      placeholder="Share what went well."
                      rows={3}
                      value={reviewDrafts[opportunity.bookingId] ?? ""}
                    />
                    <div className="cta-row">
                      <button
                        className="button"
                        onClick={() => void handleSubmitReview(opportunity)}
                        type="button"
                      >
                        Submit 5-star review
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{opportunity.reviewAlreadySubmitted ? "Review submitted." : "Review not ready yet."}</p>
                )}
              </article>
            ))}
          </div>
        </article>
      </section>
      {activeChatBookingId && chatThread ? (
        <FloatingChatWindow
          busy={loadingState === "loading"}
          draft={chatDraft}
          inputPlaceholder="Message the business about arrival or access."
          isOpen={Boolean(activeChatBookingId)}
          launcherLabel="Open chat"
          messages={chatThread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            senderLabel:
              message.senderRole === "customer"
                ? "You"
                : providerNamesById[chatThread.thread.providerId] ?? chatThread.thread.providerName,
            isCurrentUser: message.senderRole === "customer"
          }))}
          onClose={() => {
            setActiveChatBookingId(undefined);
            setChatThread(undefined);
            setChatDraft("");
          }}
          onDraftChange={setChatDraft}
          onOpen={() => undefined}
          onSend={() => void sendCustomerChat(activeChatBookingId)}
          subtitle={chatThread.thread.providerName}
          title="Business chat"
        />
      ) : null}
    </main>
  );
}
