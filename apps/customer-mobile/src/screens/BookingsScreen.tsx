import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import {
  BookingArrivalTracking,
  Booking,
  CustomerProviderConversationThread,
  formatBookingWindowSummary,
  getBookingExceptionLabel,
  PaymentRecord,
  CustomerReviewOpportunity,
  ReviewScore
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { buildTrackingSummary } from "../lib/arrivalTracking";
import { getCustomerMobileTracker } from "../lib/tracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

type ViewMode = "upcoming" | "past";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function addOneDay(iso: string) {
  return new Date(new Date(iso).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function BookingsScreen({
  onOpenAccount
}: {
  onOpenAccount?: () => void;
}) {
  const tracker = getCustomerMobileTracker();
  const { envelope } = useCustomerSession();
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | undefined>();
  const [overallRating, setOverallRating] = useState<ReviewScore>(5);
  const [timelinessRating, setTimelinessRating] = useState<ReviewScore>(5);
  const [detailRating, setDetailRating] = useState<ReviewScore>(5);
  const [reviewText, setReviewText] = useState("");
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, string>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, string>>({});
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
  const [showManageByBookingId, setShowManageByBookingId] = useState<Record<string, boolean>>({});

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.status === "requested" ||
            booking.status === "confirmed" ||
            booking.status === "in-progress" ||
            (booking.status === "disputed" &&
              new Date(booking.scheduledStartIso).getTime() >= Date.now())
        )
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso)),
    [bookings]
  );

  const pastBookings = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.status === "completed" ||
            booking.status === "cancelled" ||
            booking.status === "refunded" ||
            (booking.status === "disputed" &&
              new Date(booking.scheduledStartIso).getTime() < Date.now())
        )
        .sort((left, right) => right.scheduledStartIso.localeCompare(left.scheduledStartIso)),
    [bookings]
  );

  const readyOpportunity = reviewOpportunities.find(
    (opportunity) => opportunity.bookingId === selectedBookingId
  );

  async function loadBookings() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);

      const [bookingList, reviewResponse, payments] = await Promise.all([
        api.getBookings(),
        api.getCustomerReviewOpportunities(),
        api.getPayments()
      ]);

      const uniqueProviderIds = [...new Set(bookingList.map((booking) => booking.providerId))];
      const providers = await Promise.all(
        uniqueProviderIds.map(async (providerId) => {
          try {
            return await api.getProviderProfile(providerId);
          } catch {
            return undefined;
          }
        })
      );

      setProviderNamesById(
        providers.reduce<Record<string, string>>((accumulator, provider) => {
          if (provider) {
            accumulator[provider.id] = provider.companyName;
          }
          return accumulator;
        }, {})
      );
      setBookings(bookingList);
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
      setSelectedBookingId(
        reviewResponse.opportunities.find((opportunity) => opportunity.canReviewNow)?.bookingId ??
          reviewResponse.opportunities[0]?.bookingId
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load bookings.");
    }
  }

  useEffect(() => {
    void loadBookings();
  }, [envelope?.session.token]);

  const submitReview = async () => {
    if (!readyOpportunity?.canReviewNow || reviewText.trim().length === 0 || !envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createProviderReview({
        bookingId: readyOpportunity.bookingId,
        overallRating,
        timelinessRating,
        attentionToDetailRating: detailRating,
        reviewText: reviewText.trim()
      });
      void tracker.track(MarketplaceTelemetryEventCatalog.providerReviewSubmitted, {
        app: "customer",
        bookingId: readyOpportunity.bookingId,
        overallRating,
        timelinessRating,
        detailRating
      });
      setSubmittedMessage(`Review saved for ${readyOpportunity.providerName}.`);
      setReviewText("");
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setIsWorking(false);
    }
  };

  async function cancelBooking(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.cancelBooking({ bookingId });
      setSubmittedMessage("Booking cancelled.");
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel booking.");
    } finally {
      setIsWorking(false);
    }
  }

  async function rescheduleBooking(booking: Booking) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.rescheduleBooking({
        bookingId: booking.id,
        scheduledStartIso: addOneDay(booking.scheduledStartIso),
        scheduledEndIso: addOneDay(booking.scheduledEndIso)
      });
      setSubmittedMessage("Booking moved to the next day.");
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reschedule booking.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openDispute(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    const reason = (disputeDrafts[bookingId] ?? "").trim();
    if (!reason) {
      setErrorMessage("Add a dispute reason first.");
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createBookingDispute({
        bookingId,
        reason
      });
      setSubmittedMessage("Dispute opened. YardMatch support now has the booking context.");
      await loadBookings();
      onOpenAccount?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open this dispute.");
    } finally {
      setIsWorking(false);
    }
  }

  async function requestRefundReview(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    const payment = getPaymentRecord(bookingId);
    const reason = (refundDrafts[bookingId] ?? "").trim();

    if (!payment) {
      setErrorMessage("There is no payment on file for this booking yet.");
      return;
    }

    if (!reason) {
      setErrorMessage("Add a refund reason first.");
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createRefund({
        paymentId: payment.id,
        reason
      });
      setSubmittedMessage("Refund review requested. YardMatch support now has the payment and booking context.");
      await loadBookings();
      onOpenAccount?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to request a refund review.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openCustomerChat(booking: Booking) {
    if (!envelope?.session.token || !booking.onRouteConfirmedAt) {
      return;
    }

    try {
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveChatBookingId(booking.id);
      setChatThread(await api.getCustomerProviderConversationThread(undefined, booking.id));
    } catch (error) {
      if (error instanceof Error && /Conversation not found/.test(error.message)) {
        setActiveChatBookingId(booking.id);
        setChatThread(undefined);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to open chat.");
    }
  }

  async function sendCustomerChat(bookingId: string) {
    if (!envelope?.session.token || !chatDraft.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setChatThread(
        await api.sendCustomerProviderMessage({
          threadId: chatThread?.thread.id,
          bookingId,
          body: chatDraft.trim()
        })
      );
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openArrivalTracking(booking: Booking) {
    if (!envelope?.session.token || !booking.onRouteConfirmedAt) {
      return;
    }

    try {
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setTracking(await api.getBookingTracking(booking.id));
      setActiveTrackingBookingId(booking.id);
      setIsTrackingModalVisible(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load arrival tracking.");
    }
  }

  async function refreshArrivalTracking() {
    if (!envelope?.session.token || !activeTrackingBookingId) {
      return;
    }

    const api = createCustomerMobileApiClient();
    api.setAuthToken(envelope.session.token);
    setTracking(await api.getBookingTracking(activeTrackingBookingId));
  }

  function getPaymentRecord(bookingId: string) {
    return paymentsByBookingId[bookingId];
  }

  function toggleManagePanel(bookingId: string) {
    setShowManageByBookingId((current) => ({
      ...current,
      [bookingId]: !current[bookingId]
    }));
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
      return "Checkout started";
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

  function getBookingStatusSummary(booking: Booking) {
    if (booking.onRouteConfirmedAt) {
      if (activeTrackingBookingId === booking.id && tracking) {
        return `${buildTrackingSummary(tracking)} • Business chat is open.`;
      }

      return "Crew is on the way. Business chat is open.";
    }

    if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
      const delayedTime = new Date(booking.lateEtaIso).toLocaleTimeString(undefined, {
        timeStyle: "short"
      });
      return booking.lateReason
        ? `Running behind until around ${delayedTime} • ${booking.lateReason}`
        : `Running behind until around ${delayedTime}`;
    }

    if (booking.activeExceptionType) {
      return booking.activeExceptionNotes
        ? `${getBookingExceptionLabel(booking.activeExceptionType)} • ${booking.activeExceptionNotes}`
        : getBookingExceptionLabel(booking.activeExceptionType);
    }

    if (booking.status === "disputed") {
      return booking.disputeReason ? `Disputed • ${booking.disputeReason}` : "Disputed";
    }

    if (booking.status === "confirmed") {
      return "Confirmed and ready.";
    }

    if (booking.status === "requested") {
      return "Requested and waiting on the provider.";
    }

    if (booking.status === "in-progress") {
      return "Work is in progress.";
    }

    return booking.status;
  }

  async function payWithStripe(booking: Booking) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const checkout = await api.createCheckoutSession({
        bookingId: booking.id,
        successPath: "/customer/dashboard?payment=stripe-success",
        cancelPath: "/customer/dashboard?payment=stripe-cancelled"
      });
      setSubmittedMessage("Stripe checkout opened in your browser.");
      await Linking.openURL(checkout.checkoutUrl);
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open Stripe checkout.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Bookings" title="Your visits" description="Upcoming and past visits.">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "past"} label="Past" onPress={() => setViewMode("past")} />
      </View>

      {submittedMessage ? (
        <InfoCard title="Updated" description={submittedMessage} />
      ) : null}

      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {viewMode === "upcoming" ? (
        <InfoCard title="Coming up" description={`${upcomingBookings.length} scheduled`}>
          {upcomingBookings.length > 0 ? (
            <View style={styles.list}>
              {upcomingBookings.map((booking) => {
                const payment = getPaymentRecord(booking.id);
                const isCheckoutReady =
                  !booking.onRouteConfirmedAt &&
                  (booking.status === "requested" || booking.status === "confirmed") &&
                  payment?.status !== "captured";
                const isManageOpen = showManageByBookingId[booking.id];

                return (
                  <View key={booking.id} style={styles.liveCard}>
                    <View style={styles.visitHeader}>
                      <View style={styles.bookingCopy}>
                        <Text style={styles.bookingTitle}>{booking.category.replaceAll("-", " ")}</Text>
                        <Text style={styles.bookingMeta}>
                          {providerNamesById[booking.providerId] ?? "Landscaping business"}
                        </Text>
                      </View>
                      <StatusBadge
                        label={
                          booking.status === "confirmed"
                            ? "Confirmed"
                            : booking.status === "in-progress"
                              ? "In progress"
                              : booking.status === "disputed"
                                ? "Disputed"
                                : "Requested"
                        }
                        tone={booking.status === "disputed" ? "warning" : "success"}
                      />
                    </View>
                    <View style={styles.visitFacts}>
                      <Text style={styles.visitFact}>{formatBookingWindowSummary(booking.scheduledStartIso)}</Text>
                      <Text style={styles.visitFact}>{getPaymentLabel(payment)}</Text>
                    </View>
                    <Text style={styles.bookingNote}>{getBookingStatusSummary(booking)}</Text>
                    <View style={styles.actionPanel}>
                      {booking.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openArrivalTracking(booking)}
                          style={styles.primaryAction}
                        >
                          <Text style={styles.primaryActionLabel}>Track crew</Text>
                        </Pressable>
                      ) : null}
                      {isCheckoutReady ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void payWithStripe(booking)}
                          style={styles.primaryAction}
                        >
                          <Text style={styles.primaryActionLabel}>
                            {payment?.status === "pending" ? "Continue checkout" : "Pay now"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {booking.activeExceptionType ? (
                        <Pressable onPress={() => onOpenAccount?.()} style={styles.primaryAction}>
                          <Text style={styles.primaryActionLabel}>Open support</Text>
                        </Pressable>
                      ) : null}
                      {booking.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openCustomerChat(booking)}
                          style={styles.secondaryAction}
                        >
                          <Text style={styles.secondaryActionLabel}>Message</Text>
                        </Pressable>
                      ) : null}
                      {booking.status !== "cancelled" && booking.status !== "refunded" ? (
                        <Pressable
                          onPress={() => toggleManagePanel(booking.id)}
                          style={styles.secondaryAction}
                        >
                          <Text style={styles.secondaryActionLabel}>{isManageOpen ? "Hide" : "Manage"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {isManageOpen ? (
                      <View style={styles.managePanel}>
                        <View style={styles.detailStack}>
                          <Text style={styles.detailLabel}>Visit details</Text>
                          <Text style={styles.bookingMeta}>{formatDateTime(booking.scheduledStartIso)}</Text>
                          <Text style={styles.bookingMeta}>{booking.serviceAddress.line1}</Text>
                          <Text style={styles.bookingMeta}>{booking.status}</Text>
                        </View>
                        {booking.status === "requested" || booking.status === "confirmed" ? (
                          <View style={styles.inlineActions}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void rescheduleBooking(booking)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>Move to next day</Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void cancelBooking(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>Cancel</Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {booking.activeExceptionType ? (
                          <Pressable onPress={() => onOpenAccount?.()} style={styles.secondaryAction}>
                            <Text style={styles.secondaryActionLabel}>Open account support</Text>
                          </Pressable>
                        ) : null}
                        {booking.status !== "cancelled" &&
                        booking.status !== "refunded" &&
                        booking.status !== "requested" &&
                        booking.status !== "disputed" ? (
                          <>
                            <TextInput
                              onChangeText={(value) =>
                                setDisputeDrafts((current) => ({
                                  ...current,
                                  [booking.id]: value
                                }))
                              }
                              placeholder="Why are you disputing this service?"
                              placeholderTextColor={BrandTokens.colors.muted}
                              style={[styles.input, styles.compactInput]}
                              value={disputeDrafts[booking.id] ?? ""}
                            />
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void openDispute(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>Open dispute</Text>
                            </Pressable>
                          </>
                        ) : null}
                        {canRequestRefundReview(booking, getPaymentRecord(booking.id)) ||
                        getPaymentRecord(booking.id)?.refundReviewStatus === "requested" ||
                        getPaymentRecord(booking.id)?.refundReviewStatus === "denied" ? (
                          <>
                            <TextInput
                              editable={getPaymentRecord(booking.id)?.refundReviewStatus !== "requested"}
                              onChangeText={(value) =>
                                setRefundDrafts((current) => ({
                                  ...current,
                                  [booking.id]: value
                                }))
                              }
                              placeholder={
                                getPaymentRecord(booking.id)?.refundReviewStatus === "requested"
                                  ? "Refund review in progress"
                                  : "Why should YardMatch review this payment?"
                              }
                              placeholderTextColor={BrandTokens.colors.muted}
                              style={[styles.input, styles.compactInput]}
                              value={
                                getPaymentRecord(booking.id)?.refundReviewStatus === "requested"
                                  ? getPaymentRecord(booking.id)?.refundReason ?? ""
                                  : refundDrafts[booking.id] ?? ""
                              }
                            />
                            <Pressable
                              disabled={
                                isWorking ||
                                getPaymentRecord(booking.id)?.refundReviewStatus === "requested" ||
                                !canRequestRefundReview(booking, getPaymentRecord(booking.id))
                              }
                              onPress={() => void requestRefundReview(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>
                                {getPaymentRecord(booking.id)?.refundReviewStatus === "requested"
                                  ? "Refund review open"
                                  : "Request refund review"}
                              </Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                    {booking.onRouteConfirmedAt && activeChatBookingId === booking.id ? (
                      <View style={styles.chatStack}>
                        {(chatThread?.messages ?? []).map((message) => (
                          <View key={message.id} style={styles.chatBubble}>
                            <Text style={styles.bookingTitle}>
                              {message.senderRole === "customer"
                                ? "You"
                                : providerNamesById[booking.providerId] ?? "Business"}
                            </Text>
                            <Text style={styles.bookingMeta}>{message.body}</Text>
                          </View>
                        ))}
                        <TextInput
                          multiline
                          onChangeText={setChatDraft}
                          placeholder="Message the business owner."
                          placeholderTextColor={BrandTokens.colors.muted}
                          style={styles.input}
                          value={chatDraft}
                        />
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void sendCustomerChat(booking.id)}
                          style={styles.submitButton}
                        >
                          <Text style={styles.submitButtonLabel}>{isWorking ? "Sending..." : "Send message"}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyState}>
              Your next visit will show up here.
            </Text>
          )}
        </InfoCard>
      ) : (
        <>
          <InfoCard title="Past visits" description={`${pastBookings.length} completed or closed`}>
            {pastBookings.length > 0 ? (
              <View style={styles.list}>
                {pastBookings.map((booking) => (
                  <Pressable
                    key={booking.id}
                    onPress={() => setSelectedBookingId(booking.id)}
                    style={styles.bookingRow}
                  >
                    <View style={styles.bookingCopy}>
                      <Text style={styles.bookingTitle}>{booking.category.replaceAll("-", " ")}</Text>
                      <Text style={styles.bookingMeta}>{providerNamesById[booking.providerId] ?? "Landscaping business"}</Text>
                      <Text style={styles.bookingMeta}>{formatDateTime(booking.scheduledStartIso)}</Text>
                      {booking.disputeReason ? (
                        <Text style={styles.bookingMeta}>{booking.disputeReason}</Text>
                      ) : null}
                    </View>
                    <StatusBadge
                      label={
                        booking.status === "completed"
                          ? "Done"
                          : booking.status === "disputed"
                            ? "Disputed"
                            : booking.status
                      }
                      tone={booking.status === "completed" ? "success" : "warning"}
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyState}>
                Completed visits will show up here.
              </Text>
            )}
          </InfoCard>

          {pastBookings.length > 0 || readyOpportunity ? (
            readyOpportunity?.canReviewNow ? (
              <InfoCard title={`Review ${readyOpportunity.providerName}`} description="Post-service only">
                <RatingField label="Overall" rating={overallRating} onChange={setOverallRating} />
                <RatingField label="Timeliness" rating={timelinessRating} onChange={setTimelinessRating} />
                <RatingField label="Detail" rating={detailRating} onChange={setDetailRating} />
                <TextInput
                  multiline
                  onChangeText={setReviewText}
                  placeholder="How did it go?"
                  placeholderTextColor={BrandTokens.colors.muted}
                  style={styles.input}
                  value={reviewText}
                />
                <Pressable disabled={isWorking} onPress={() => void submitReview()} style={styles.submitButton}>
                  <Text style={styles.submitButtonLabel}>{isWorking ? "Working..." : "Submit review"}</Text>
                </Pressable>
              </InfoCard>
            ) : (
              <InfoCard title="Review status" description={readyOpportunity?.providerName ?? "No review selected"}>
                <Text style={styles.bookingMeta}>{readyOpportunity?.reason ?? "Nothing needs your attention right now."}</Text>
              </InfoCard>
            )
          ) : null}
        </>
      )}
      <ArrivalTrackingModal
        onClose={() => setIsTrackingModalVisible(false)}
        onRefresh={() => void refreshArrivalTracking()}
        providerName={
          providerNamesById[bookings.find((booking) => booking.id === activeTrackingBookingId)?.providerId ?? ""]
        }
        tracking={tracking}
        visible={isTrackingModalVisible && Boolean(tracking)}
      />
    </ScreenShell>
  );
}

function ModeButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({
  label,
  tone
}: {
  label: string;
  tone: "success" | "warning";
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === "success" ? styles.statusBadgeSuccess : styles.statusBadgeWarning
      ]}
    >
      <Text
        style={[
          styles.statusBadgeLabel,
          tone === "success" ? styles.statusBadgeLabelSuccess : styles.statusBadgeLabelWarning
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function RatingField({
  label,
  rating,
  onChange
}: {
  label: string;
  rating: ReviewScore;
  onChange: (rating: ReviewScore) => void;
}) {
  return (
    <View style={styles.ratingField}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => onChange(value as ReviewScore)}>
            <MaterialIcons
              color={value <= rating ? BrandTokens.colors.accent : BrandTokens.colors.border}
              name={value <= rating ? "star" : "star-border"}
              size={26}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  modeButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  modeLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modeLabelActive: {
    color: "#ffffff"
  },
  list: {
    gap: BrandTokens.spacing.md
  },
  bookingRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  liveCard: {
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md,
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  visitHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  visitFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  visitFact: {
    borderRadius: 999,
    backgroundColor: "rgba(20, 40, 29, 0.06)",
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  bookingCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  bookingTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  bookingMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  bookingNote: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 20
  },
  emptyState: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  detailStack: {
    gap: BrandTokens.spacing.sm
  },
  detailLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  actionPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  managePanel: {
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  inlineActions: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm,
    flexWrap: "wrap"
  },
  chatStack: {
    gap: BrandTokens.spacing.sm
  },
  chatBubble: {
    gap: BrandTokens.spacing.xs
  },
  secondaryAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  secondaryActionLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  primaryAction: {
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  primaryActionLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  statusBadgeSuccess: {
    backgroundColor: "rgba(35, 117, 79, 0.12)"
  },
  statusBadgeWarning: {
    backgroundColor: "rgba(226, 154, 69, 0.16)"
  },
  statusBadgeLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  statusBadgeLabelSuccess: {
    color: BrandTokens.colors.success
  },
  statusBadgeLabelWarning: {
    color: BrandTokens.colors.accent
  },
  ratingField: {
    gap: BrandTokens.spacing.xs
  },
  ratingLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  ratingRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.xs
  },
  input: {
    minHeight: 92,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: BrandTokens.spacing.md,
    color: BrandTokens.colors.ink,
    textAlignVertical: "top"
  },
  compactInput: {
    minHeight: 72
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
