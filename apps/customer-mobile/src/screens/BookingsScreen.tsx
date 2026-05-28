import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import {
  customerPastBookings,
  customerReviewOpportunitiesPreview,
  customerUpcomingBookings
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getCustomerMobileTracker } from "../lib/tracking";

type ViewMode = "upcoming" | "past";

export function BookingsScreen() {
  const tracker = getCustomerMobileTracker();
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [selectedBookingId, setSelectedBookingId] = useState(
    customerReviewOpportunitiesPreview.find((opportunity) => opportunity.canReviewNow)?.bookingId ??
      customerReviewOpportunitiesPreview[0]?.bookingId
  );
  const [overallRating, setOverallRating] = useState(5);
  const [timelinessRating, setTimelinessRating] = useState(5);
  const [detailRating, setDetailRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const readyOpportunity = customerReviewOpportunitiesPreview.find(
    (opportunity) => opportunity.bookingId === selectedBookingId
  );

  const submitReview = () => {
    if (!readyOpportunity?.canReviewNow || reviewText.trim().length === 0) {
      return;
    }

    void tracker.track(MarketplaceTelemetryEventCatalog.providerReviewSubmitted, {
      app: "customer",
      bookingId: readyOpportunity.bookingId,
      overallRating,
      timelinessRating,
      detailRating
    });
    setSubmittedMessage(`Review saved for ${readyOpportunity.providerName}.`);
    setReviewText("");
  };

  return (
    <ScreenShell eyebrow="Bookings" title="Manage services" description="Upcoming and past jobs.">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "past"} label="Past" onPress={() => setViewMode("past")} />
      </View>

      {viewMode === "upcoming" ? (
        <InfoCard title="Upcoming jobs" description={`${customerUpcomingBookings.length} scheduled`}>
          <View style={styles.list}>
            {customerUpcomingBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingRow}>
                <View style={styles.bookingCopy}>
                  <Text style={styles.bookingTitle}>{booking.serviceLabel}</Text>
                  <Text style={styles.bookingMeta}>
                    {booking.dateLabel} • {booking.timeLabel}
                  </Text>
                  <Text style={styles.bookingMeta}>{booking.providerName}</Text>
                  <Text style={styles.bookingMeta}>{booking.propertyLabel}</Text>
                  <Text style={styles.bookingNote}>{booking.addressChangeState}</Text>
                </View>
                <StatusBadge label="Scheduled" tone="success" />
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <>
          <InfoCard title="Past jobs" description={`${customerPastBookings.length} completed`}>
            <View style={styles.list}>
              {customerPastBookings.map((booking) => (
                <Pressable
                  key={booking.id}
                  onPress={() => setSelectedBookingId(booking.id)}
                  style={styles.bookingRow}
                >
                  <View style={styles.bookingCopy}>
                    <Text style={styles.bookingTitle}>{booking.serviceLabel}</Text>
                    <Text style={styles.bookingMeta}>{booking.providerName}</Text>
                    <Text style={styles.bookingMeta}>
                      {booking.dateLabel} • {booking.timeLabel}
                    </Text>
                  </View>
                  <StatusBadge
                    label={booking.status === "needs-review" ? "Review" : "Done"}
                    tone={booking.status === "needs-review" ? "warning" : "success"}
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
              <Pressable onPress={submitReview} style={styles.submitButton}>
                <Text style={styles.submitButtonLabel}>Submit review</Text>
              </Pressable>
              {submittedMessage ? <Text style={styles.successText}>{submittedMessage}</Text> : null}
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
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <View style={styles.ratingField}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => onChange(value)}>
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
  bookingCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  bookingTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  bookingMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  bookingNote: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 20
  },
  statusBadge: {
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
  },
  successText: {
    color: BrandTokens.colors.success,
    fontWeight: "600"
  }
});
