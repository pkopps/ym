import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

type ReviewOpportunity = {
  bookingId: string;
  providerName: string;
  completedAtLabel: string;
  canReviewNow: boolean;
  reviewAlreadySubmitted: boolean;
  reason: string;
};

const demoOpportunities: ReviewOpportunity[] = [
  {
    bookingId: "YM-BOOKING-2048",
    providerName: "GreenStride Lawn Co.",
    completedAtLabel: "Completed Apr 28 at 2:40 PM",
    canReviewNow: false,
    reviewAlreadySubmitted: false,
    reason: "Review email scheduled for 48 hours after service completion."
  },
  {
    bookingId: "YM-BOOKING-1982",
    providerName: "TerraCut Studio",
    completedAtLabel: "Completed Apr 25 at 11:15 AM",
    canReviewNow: true,
    reviewAlreadySubmitted: false,
    reason: "Ready for review now."
  },
  {
    bookingId: "YM-BOOKING-1904",
    providerName: "Cedarstone Landscaping",
    completedAtLabel: "Completed Apr 18 at 4:05 PM",
    canReviewNow: false,
    reviewAlreadySubmitted: true,
    reason: "Review already submitted."
  }
];

export function BookingsScreen() {
  const [opportunities, setOpportunities] = useState<ReviewOpportunity[]>(demoOpportunities);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("YM-BOOKING-1982");
  const [overallRating, setOverallRating] = useState(5);
  const [timelinessRating, setTimelinessRating] = useState(5);
  const [attentionToDetailRating, setAttentionToDetailRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.bookingId === selectedBookingId);

  // This local review flow keeps the prototype interactive until live auth and booking data are wired in.
  const submitReview = () => {
    if (!selectedOpportunity || !selectedOpportunity.canReviewNow || reviewText.trim().length === 0) {
      return;
    }

    setOpportunities((current) =>
      current.map((opportunity) =>
        opportunity.bookingId === selectedOpportunity.bookingId
          ? {
              ...opportunity,
              canReviewNow: false,
              reviewAlreadySubmitted: true,
              reason: "Review submitted from the mobile app."
            }
          : opportunity
      )
    );
    setSubmittedMessage(
      `Saved ${overallRating}/5 overall, ${timelinessRating}/5 timeliness, and ${attentionToDetailRating}/5 attention to detail for ${selectedOpportunity.providerName}.`
    );
    setReviewText("");
  };

  return (
    <ScreenShell
      eyebrow="Bookings"
      title="Manage upcoming service, address changes, and post-service reviews from one place."
      description="Customers should only see operational states that matter to their own bookings and follow-up actions."
    >
      <InfoCard
        title="Upcoming booking actions"
        description="Requested bookings can still update immediately, while confirmed jobs more than 24 hours out route address changes for provider review."
      >
        <Text>Blocked if the new address is out of radius or the service window is too close</Text>
      </InfoCard>
      <InfoCard
        title="Review timing"
        description="Reviews are tied to completed bookings only and unlock from a booking-specific invite 48 hours after completion."
      >
        <Text>Channel mix: email invite plus in-app prompt for the same booking</Text>
      </InfoCard>
      <InfoCard
        title="Sample review states"
        description="The booking list can show waiting on invite, ready to review, or already reviewed without exposing any generic provider review path."
      >
        <View style={styles.list}>
          {opportunities.map((opportunity) => (
            <Pressable
              key={opportunity.bookingId}
              onPress={() => setSelectedBookingId(opportunity.bookingId)}
              style={[
                styles.reviewRow,
                selectedBookingId === opportunity.bookingId && styles.reviewRowSelected
              ]}
            >
              <View style={styles.reviewRowHeader}>
                <Text style={styles.reviewProvider}>{opportunity.providerName}</Text>
                <Text style={styles.reviewStatus}>
                  {opportunity.reviewAlreadySubmitted
                    ? "Reviewed"
                    : opportunity.canReviewNow
                      ? "Ready"
                      : "Pending"}
                </Text>
              </View>
              <Text style={styles.reviewMeta}>{opportunity.bookingId}</Text>
              <Text style={styles.reviewMeta}>{opportunity.completedAtLabel}</Text>
              <Text style={styles.reviewReason}>{opportunity.reason}</Text>
            </Pressable>
          ))}
        </View>
      </InfoCard>
      {selectedOpportunity?.canReviewNow && !selectedOpportunity.reviewAlreadySubmitted ? (
        <InfoCard
          title={`Review ${selectedOpportunity.providerName}`}
          description="Customers can rate the landscaping business owner only after the completed service invite unlocks."
        >
          <RatingField
            label="Overall"
            rating={overallRating}
            onChange={setOverallRating}
          />
          <RatingField
            label="Timeliness"
            rating={timelinessRating}
            onChange={setTimelinessRating}
          />
          <RatingField
            label="Attention to detail"
            rating={attentionToDetailRating}
            onChange={setAttentionToDetailRating}
          />
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Free-text review</Text>
            <TextInput
              multiline
              onChangeText={setReviewText}
              placeholder="Tell other customers how the business owner and crew performed."
              placeholderTextColor={BrandTokens.colors.muted}
              style={styles.input}
              value={reviewText}
            />
          </View>
          <Pressable onPress={submitReview} style={styles.submitButton}>
            <Text style={styles.submitButtonLabel}>Submit post-service review</Text>
          </Pressable>
          {submittedMessage ? <Text style={styles.successText}>{submittedMessage}</Text> : null}
        </InfoCard>
      ) : null}
      <InfoCard
        title="Booking history snapshot"
        description="Bookings preserve the original service address, provider, payment, and review status for support and auditability."
      />
    </ScreenShell>
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
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => onChange(value)}>
            <MaterialIcons
              color={value <= rating ? BrandTokens.colors.accent : BrandTokens.colors.border}
              name={value <= rating ? "star" : "star-border"}
              size={28}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  reviewRow: {
    borderColor: BrandTokens.colors.border,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    gap: BrandTokens.spacing.xs,
    padding: BrandTokens.spacing.md
  },
  reviewRowSelected: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  reviewRowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  reviewProvider: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  reviewStatus: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  reviewMeta: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12
  },
  reviewReason: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  formField: {
    gap: BrandTokens.spacing.sm
  },
  fieldLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  ratingRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.xs
  },
  input: {
    borderColor: BrandTokens.colors.border,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    color: BrandTokens.colors.ink,
    minHeight: 120,
    padding: BrandTokens.spacing.md,
    textAlignVertical: "top"
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: BrandTokens.colors.primary,
    borderRadius: BrandTokens.radius.sm,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  successText: {
    color: BrandTokens.colors.success,
    lineHeight: 22
  }
});
