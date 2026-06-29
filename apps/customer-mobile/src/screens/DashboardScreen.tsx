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

function formatBookingStatusLabel(booking: Booking) {
  if (booking.status === "requested") {
    return "Waiting for confirmation";
  }

  if (booking.status === "in-progress") {
    return "Work in progress";
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return "Running behind";
  }

  if (booking.onRouteConfirmedAt) {
    return "Crew on the way";
  }

  return "Upcoming visit";
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
  const activeTrackingBooking = activeTrackingBookingId
    ? bookings.find((booking) => booking.id === activeTrackingBookingId)
    : undefined;
  const primaryCardKind = tracking && activeTrackingBookingId
    ? "tracking"
    : nextBooking
      ? "booking"
      : reviewReady
        ? "review"
        : activeProperty
          ? "property"
          : "empty";

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
    <ScreenShell
      eyebrow="Home"
      title="Home"
      description="See what matters now."
    >
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {primaryCardKind === "tracking" && tracking && activeTrackingBookingId ? (
        <InfoCard
          title={buildTrackingSummary(tracking)}
          description={
            providerNamesById[activeTrackingBooking?.providerId ?? ""] ?? "Crew on the way"
          }
        >
          <Text style={styles.primaryLine}>{tracking.message}</Text>
          {buildTrackingDetail(tracking) ? (
            <Text style={styles.secondaryLine}>{buildTrackingDetail(tracking)}</Text>
          ) : null}
          <View style={styles.actionStack}>
            <Pressable onPress={() => setIsTrackingModalVisible(true)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Track arrival</Text>
            </Pressable>
            <Pressable onPress={onOpenBookings} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Open booking</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "booking" && nextBooking ? (
        <InfoCard
          title={formatBookingStatusLabel(nextBooking)}
          description={formatBookingWindowSummary(nextBooking.scheduledStartIso)}
        >
          <Text style={styles.primaryLine}>
            {providerNamesById[nextBooking.providerId] ?? "Landscaping business"}
          </Text>
          <Text style={styles.secondaryLine}>{nextBooking.serviceAddress.line1}</Text>
          {nextBooking.lateEtaIso && !nextBooking.onRouteConfirmedAt ? (
            <Text style={styles.noteLine}>
              Now around{" "}
              {new Date(nextBooking.lateEtaIso).toLocaleTimeString(undefined, { timeStyle: "short" })}
            </Text>
          ) : null}
          <View style={styles.actionStack}>
            <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>
                {nextBooking.status === "requested" ? "See booking" : "See visit"}
              </Text>
            </Pressable>
            <Pressable onPress={onStartBooking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Book another visit</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "review" && reviewReady ? (
        <InfoCard title="Leave your review" description={reviewReady.providerName}>
          <Text style={styles.secondaryLine}>{reviewReady.reason}</Text>
          <View style={styles.actionStack}>
            <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Leave review</Text>
            </Pressable>
            <Pressable onPress={onStartBooking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Book again</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "property" && activeProperty ? (
        <InfoCard title="Start your next visit" description={activeProperty.label}>
          <Text style={styles.primaryLine}>{activeProperty.address.line1}</Text>
          <Text style={styles.secondaryLine}>
            {activeProperty.address.city}, {activeProperty.address.state} {activeProperty.address.postalCode}
          </Text>
          <View style={styles.actionStack}>
            <Pressable onPress={onStartBooking} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Book this property</Text>
            </Pressable>
            <Pressable onPress={onOpenBookings} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Open bookings</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "empty" ? (
        <InfoCard title="Start your first visit" description="Pick a service and we’ll match the best fit.">
          <View style={styles.actionStack}>
            <Pressable onPress={onStartBooking} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Get matched</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {tracking &&
      activeTrackingBookingId &&
      activeTrackingBooking &&
      nextBooking &&
      activeTrackingBooking.id !== nextBooking.id ? (
        <InfoCard
          title={formatBookingStatusLabel(nextBooking)}
          description={formatBookingWindowSummary(nextBooking.scheduledStartIso)}
        >
          <Text style={styles.primaryLine}>
            {providerNamesById[nextBooking.providerId] ?? "Landscaping business"}
          </Text>
          <Text style={styles.secondaryLine}>{nextBooking.serviceAddress.line1}</Text>
          <Pressable onPress={onOpenBookings} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>See visit</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {reviewReady && primaryCardKind !== "review" ? (
        <InfoCard title="Ready to review" description={reviewReady.providerName}>
          <Text style={styles.secondaryLine}>{reviewReady.reason}</Text>
          <Pressable onPress={onOpenBookings} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Leave review</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {activeProperty && primaryCardKind !== "property" ? (
        <InfoCard title={activeProperty.label} description="Ready for your next visit">
          <Text style={styles.primaryLine}>{activeProperty.address.line1}</Text>
          <Text style={styles.secondaryLine}>
            {activeProperty.address.city}, {activeProperty.address.state} {activeProperty.address.postalCode}
          </Text>
          <Pressable onPress={onStartBooking} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Book this property</Text>
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

const styles = StyleSheet.create({
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
  actionStack: {
    gap: BrandTokens.spacing.sm
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderColor: BrandTokens.colors.primary,
    borderWidth: 1,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
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
