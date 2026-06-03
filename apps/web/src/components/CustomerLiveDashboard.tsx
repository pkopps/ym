"use client";

import {
  Booking,
  CustomerProviderConversationThread,
  CustomerProfile,
  CustomerProperty,
  CustomerReviewOpportunity,
  InstantQuoteResponse,
  ProviderProfile,
  SearchProvidersResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient, loadStoredSession } from "../lib/api";
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
  const [sessionReady, setSessionReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile | undefined>();
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("lawn-mowing");
  const [quote, setQuote] = useState<InstantQuoteResponse | undefined>();
  const [providerResults, setProviderResults] = useState<SearchProvidersResponse | undefined>();
  const [loadingState, setLoadingState] = useState<"idle" | "loading">("idle");
  const [bookingMessage, setBookingMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [rescheduleDrafts, setRescheduleDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");

  const activeProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const nextBooking = bookings
    .filter(
      (booking) =>
        booking.status !== "completed" &&
        booking.status !== "refunded" &&
        booking.status !== "cancelled"
    )
    .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0];

  async function loadDashboard() {
    const session = loadStoredSession();
    if (!session || session.role !== "customer") {
      setAccessDenied(true);
      setSessionReady(true);
      return;
    }

    setAccessDenied(false);
    const api = createAuthenticatedWebApiClient();
    const [meResponse, propertyList, bookingList, reviewResponse] = await Promise.all([
      api.getCurrentUser(),
      api.getCustomerProperties(),
      api.getBookings(),
      api.getCustomerReviewOpportunities()
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
    setReviewOpportunities(reviewResponse.opportunities);
    setSessionReady(true);

    if (!selectedPropertyId && propertyList[0]) {
      setSelectedPropertyId(propertyList[0].id);
    }
  }

  useEffect(() => {
    void loadDashboard().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load your customer account.");
      setSessionReady(true);
    });
  }, []);

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

    try {
      const api = createAuthenticatedWebApiClient();
      const results = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedCategory],
        dateIso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        estimatedDurationMinutes: quote?.estimatedDurationMinutes
      });
      setProviderResults(results);
    } catch (error) {
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
      setBookingMessage(`Booked ${provider.companyName} for ${formatDateTime(slot.startIso)}.`);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your booking right now.");
    } finally {
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

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>Welcome back, {customer?.fullName?.split(" ")[0] ?? "there"}.</h1>
        <p>
          {nextBooking
            ? `Next service ${formatDateTime(nextBooking.scheduledStartIso)} with ${providerNamesById[nextBooking.providerId] ?? "your landscaper"}`
            : "You do not have an upcoming service yet."}
        </p>
      </section>

      {bookingMessage ? (
        <section className="card">
          <h2>Booking confirmed</h2>
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
        {providerResults ? (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {providerResults.providers.map((provider) => {
              const slot = providerResults.suggestedSlots.find((candidate) => candidate.providerId === provider.id);
              return (
                <article className="list-panel" key={provider.id}>
                  <div className="search-result-title">
                    <h3>{provider.companyName}</h3>
                    {provider.sponsoredListingEnabled ? <span className="result-badge">Sponsored</span> : null}
                  </div>
                  <p>
                    {provider.rating.toFixed(1)} overall • {provider.timelinessRating.toFixed(1)} punctuality
                  </p>
                  <p>
                    Radius {provider.serviceRadiusMiles} miles • {slot ? `Slot ${formatDateTime(slot.startIso)}` : "No open slot"}
                  </p>
                  <div className="cta-row">
                    <button
                      className="button"
                      disabled={!slot || loadingState === "loading"}
                      onClick={() => void handleCreateBooking(provider)}
                      type="button"
                    >
                      Book this slot
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>Search after the quote to see live provider matches and bookable slots.</p>
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
                    <p>{formatDateTime(booking.scheduledStartIso)}</p>
                    <p>{formatDateTime(booking.scheduledEndIso)}</p>
                  </div>
                  <div>
                    <h3>Notes</h3>
                    <p>{booking.notes || "No extra notes."}</p>
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
                      <a
                        className="button-secondary"
                        href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=service-quality&subject=${encodeURIComponent("On-route support")}`}
                      >
                        Get help
                      </a>
                    </div>
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
