import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import {
  Booking,
  CustomerProviderConversationThread,
  CustomerReviewOpportunity,
  ReviewScore
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
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

export function BookingsScreen() {
  const tracker = getCustomerMobileTracker();
  const { envelope } = useCustomerSession();
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | undefined>();
  const [overallRating, setOverallRating] = useState<ReviewScore>(5);
  const [timelinessRating, setTimelinessRating] = useState<ReviewScore>(5);
  const [detailRating, setDetailRating] = useState<ReviewScore>(5);
  const [reviewText, setReviewText] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "requested" || booking.status === "confirmed")
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
            booking.status === "refunded"
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

      const [bookingList, reviewResponse] = await Promise.all([
        api.getBookings(),
        api.getCustomerReviewOpportunities()
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

  return (
    <ScreenShell eyebrow="Bookings" title="Manage services" description="Upcoming and past jobs.">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "past"} label="Past" onPress={() => setViewMode("past")} />
      </View>

      {submittedMessage ? (
        <InfoCard title="Updated" description={submittedMessage} />
      ) : null}

      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {viewMode === "upcoming" ? (
        <InfoCard title="Upcoming jobs" description={`${upcomingBookings.length} scheduled`}>
          <View style={styles.list}>
            {upcomingBookings.map((booking) => (
              <View key={booking.id} style={styles.liveCard}>
                <View style={styles.bookingCopy}>
                  <Text style={styles.bookingTitle}>{booking.category.replaceAll("-", " ")}</Text>
                  <Text style={styles.bookingMeta}>{providerNamesById[booking.providerId] ?? "Landscaping business"}</Text>
                  <Text style={styles.bookingMeta}>{formatDateTime(booking.scheduledStartIso)}</Text>
                  <Text style={styles.bookingMeta}>{booking.serviceAddress.line1}</Text>
                  <Text style={styles.bookingNote}>{booking.status}</Text>
                  {booking.onRouteConfirmedAt ? (
                    <Text style={styles.bookingMeta}>Crew is on the way. Business chat is open.</Text>
                  ) : null}
                </View>
                <StatusBadge label={booking.status === "confirmed" ? "Confirmed" : "Requested"} tone="success" />
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
                  {booking.onRouteConfirmedAt ? (
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void openCustomerChat(booking)}
                      style={styles.secondaryAction}
                    >
                      <Text style={styles.secondaryActionLabel}>Message business</Text>
                    </Pressable>
                  ) : null}
                </View>
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
            ))}
          </View>
        </InfoCard>
      ) : (
        <>
          <InfoCard title="Past jobs" description={`${pastBookings.length} completed or closed`}>
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
                  </View>
                  <StatusBadge
                    label={booking.status === "completed" ? "Done" : booking.status}
                    tone={booking.status === "completed" ? "success" : "warning"}
                  />
                </Pressable>
              ))}
            </View>
          </InfoCard>

          {readyOpportunity?.canReviewNow ? (
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
          )}
        </>
      )}
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
    gap: BrandTokens.spacing.sm,
    paddingBottom: BrandTokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.colors.border
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
