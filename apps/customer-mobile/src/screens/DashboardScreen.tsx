import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  Booking,
  BookingArrivalTracking,
  CustomerProperty,
  CustomerReviewOpportunity,
  formatBookingWindowSummary
} from "@yardmatch/contracts";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { buildTrackingDetail, buildTrackingSummary, findTrackableBooking } from "../lib/arrivalTracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function DashboardScreen({
  onStartBooking,
  onOpenBookings
}: {
  onStartBooking?: () => void;
  onOpenBookings?: () => void;
}) {
  const { envelope } = useCustomerSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const nextBooking = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.status === "requested" ||
            booking.status === "confirmed" ||
            booking.status === "in-progress"
        )
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [bookings]
  );
  const activeProperty = properties.find((property) => property.isDefault) ?? properties[0];
  const reviewReady = reviewOpportunities.find((opportunity) => opportunity.canReviewNow);

  async function loadTracking(bookingId: string, token = envelope?.session.token) {
    if (!token) {
      return;
    }

    const api = createCustomerMobileApiClient();
    api.setAuthToken(token);
    setTracking(await api.getBookingTracking(bookingId));
    setActiveTrackingBookingId(bookingId);
  }

  async function loadHome() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [bookingList, nextProperties, reviewResponse] = await Promise.all([
        api.getBookings(),
        api.getCustomerProperties(),
        api.getCustomerReviewOpportunities()
      ]);
      const uniqueProviderIds = [...new Set(bookingList.map((booking) => booking.providerId))];
      const providers = await Promise.all(uniqueProviderIds.map((providerId) => api.getProviderProfile(providerId)));
      setProviderNamesById(
        providers.reduce<Record<string, string>>((accumulator, provider) => {
          accumulator[provider.id] = provider.companyName;
          return accumulator;
        }, {})
      );
      setBookings(bookingList);
      setProperties(nextProperties);
      setReviewOpportunities(reviewResponse.opportunities);
      const trackableBooking = findTrackableBooking(bookingList);
      if (trackableBooking) {
        try {
          await loadTracking(trackableBooking.id, envelope.session.token);
        } catch {
          setTracking(undefined);
          setActiveTrackingBookingId(undefined);
        }
      } else {
        setTracking(undefined);
        setActiveTrackingBookingId(undefined);
        setIsTrackingModalVisible(false);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load your account.");
    }
  }

  useEffect(() => {
    void loadHome();
  }, [envelope?.session.token]);

  useEffect(() => {
    if (!activeTrackingBookingId || !envelope?.session.token) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadTracking(activeTrackingBookingId, envelope.session.token).catch(() => undefined);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [activeTrackingBookingId, envelope?.session.token]);

  return (
    <ScreenShell eyebrow="Home" title="Your next service">
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <View style={styles.statRow}>
        <StatCard
          label="Upcoming"
          value={`${
            bookings.filter(
              (booking) =>
                booking.status === "requested" ||
                booking.status === "confirmed" ||
                booking.status === "in-progress"
            ).length
          }`}
        />
        <StatCard label="Ready reviews" value={`${reviewOpportunities.filter((opportunity) => opportunity.canReviewNow).length}`} />
        <StatCard label="Saved homes" value={`${properties.length}`} />
      </View>

      {tracking && activeTrackingBookingId ? (
        <Pressable onPress={() => setIsTrackingModalVisible(true)}>
          <InfoCard
            title={buildTrackingSummary(tracking)}
            description={providerNamesById[bookings.find((booking) => booking.id === activeTrackingBookingId)?.providerId ?? ""] ?? "Crew on the way"}
          >
            <Text style={styles.primaryLine}>{tracking.message}</Text>
            {buildTrackingDetail(tracking) ? (
              <Text style={styles.secondaryLine}>{buildTrackingDetail(tracking)}</Text>
            ) : null}
            <Pressable onPress={() => setIsTrackingModalVisible(true)} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>Open full map</Text>
            </Pressable>
          </InfoCard>
        </Pressable>
      ) : null}

      {nextBooking ? (
        <InfoCard
          title={nextBooking.category.replaceAll("-", " ")}
          description={formatBookingWindowSummary(nextBooking.scheduledStartIso)}
        >
          <Text style={styles.primaryLine}>{providerNamesById[nextBooking.providerId] ?? "Landscaping business"}</Text>
          <Text style={styles.secondaryLine}>{nextBooking.serviceAddress.line1}</Text>
          <Text style={styles.noteLine}>{nextBooking.status.replaceAll("-", " ")}</Text>
          {nextBooking.lateEtaIso && !nextBooking.onRouteConfirmedAt ? (
            <Text style={styles.secondaryLine}>
              Running behind • now around{" "}
              {new Date(nextBooking.lateEtaIso).toLocaleTimeString(undefined, { timeStyle: "short" })}
            </Text>
          ) : null}
          <Pressable onPress={onOpenBookings} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Open bookings</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {activeProperty ? (
        <InfoCard title={activeProperty.label} description="Active property">
          <Text style={styles.primaryLine}>{activeProperty.address.line1}</Text>
          <Text style={styles.secondaryLine}>
            {activeProperty.address.city}, {activeProperty.address.state} {activeProperty.address.postalCode}
          </Text>
          <Pressable onPress={onStartBooking} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Book this property</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {reviewReady ? (
        <InfoCard title="Review ready" description="Open Bookings to leave your review.">
          <Text style={styles.primaryLine}>{reviewReady.providerName}</Text>
          <Text style={styles.secondaryLine}>{reviewReady.reason}</Text>
          <Pressable onPress={onOpenBookings} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Leave review</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      <ArrivalTrackingModal
        onClose={() => setIsTrackingModalVisible(false)}
        onRefresh={
          activeTrackingBookingId
            ? () => {
                void loadTracking(activeTrackingBookingId);
              }
            : undefined
        }
        providerName={
          providerNamesById[bookings.find((booking) => booking.id === activeTrackingBookingId)?.providerId ?? ""]
        }
        tracking={tracking}
        visible={isTrackingModalVisible && Boolean(tracking)}
      />
    </ScreenShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md
  },
  statCard: {
    flex: 1,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.xs
  },
  statValue: {
    color: BrandTokens.colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  statLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 13,
    fontWeight: "600"
  },
  primaryLine: {
    color: BrandTokens.colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 21
  },
  noteLine: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 21
  },
  linkButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
