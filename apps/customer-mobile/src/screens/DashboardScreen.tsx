import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  Booking,
  BookingArrivalTracking,
  CustomerProperty,
  CustomerReviewOpportunity,
  PaymentRecord,
  formatBookingWindowSummary
} from "@yardmatch/contracts";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { buildTrackingDetail, buildTrackingSummary, findTrackableBooking } from "../lib/arrivalTracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

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

type HomeStepStatus = "complete" | "current" | "pending";

function getHomeStepStatus(stepIndex: number, activeStepIndex: number): HomeStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function getPaymentLabel(payment?: PaymentRecord) {
  if (!payment) {
    return "After confirm";
  }

  if (payment.status === "captured") {
    return "Paid";
  }

  if (payment.status === "pending") {
    return "Ready";
  }

  if (payment.status === "failed") {
    return "Retry";
  }

  if (payment.status === "refunded") {
    return "Refunded";
  }

  return payment.status;
}

function getHomePaymentLabel(booking?: Booking, payment?: PaymentRecord) {
  if (booking?.status === "requested" && payment?.status !== "captured") {
    return "After confirm";
  }

  if (booking?.status === "confirmed" && !payment) {
    return "Ready";
  }

  return getPaymentLabel(payment);
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function needsCheckout(booking: Booking, payment?: PaymentRecord) {
  return (
    booking.status === "confirmed" &&
    payment?.status !== "captured" &&
    payment?.status !== "refunded"
  );
}

function getCheckoutActionLabel(payment?: PaymentRecord) {
  if (payment?.status === "failed") {
    return "Retry payment";
  }

  if (payment?.status === "pending") {
    return "Continue checkout";
  }

  return "Pay now";
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
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

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
  const nextBookingPayment = nextBooking ? paymentsByBookingId[nextBooking.id] : undefined;
  const nextBookingNeedsCheckout = nextBooking ? needsCheckout(nextBooking, nextBookingPayment) : false;
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
  const activeHomeStepIndex = (() => {
    if (primaryCardKind === "tracking" || nextBooking?.onRouteConfirmedAt || nextBooking?.status === "in-progress") {
      return 2;
    }

    if (primaryCardKind === "booking" && nextBooking) {
      if (nextBooking.status === "requested") {
        return 0;
      }

      return nextBookingNeedsCheckout ? 1 : 2;
    }

    if (primaryCardKind === "review") {
      return 3;
    }

    return 0;
  })();
  const homeNowLabel =
    primaryCardKind === "tracking"
      ? "Track arrival"
      : primaryCardKind === "review"
        ? "Leave review"
        : primaryCardKind === "booking" && nextBooking
          ? nextBookingNeedsCheckout
            ? getCheckoutActionLabel(nextBookingPayment)
            : formatBookingStatusLabel(nextBooking)
          : "Request service";
  const homeSteps = [
    {
      label: "Request",
      value: nextBooking ? (nextBooking.status === "requested" ? "Provider review" : "Booked") : "Start"
    },
    {
      label: "Pay",
      value: nextBooking ? getHomePaymentLabel(nextBooking, nextBookingPayment) : "After match"
    },
    {
      label: "Track",
      value: tracking || nextBooking?.onRouteConfirmedAt ? "Live" : nextBooking ? "Visit day" : "After pay"
    },
    {
      label: "Review",
      value: reviewReady ? "Ready" : "After visit"
    }
  ].map((step, index) => ({
    ...step,
    status: getHomeStepStatus(index, activeHomeStepIndex)
  }));

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
      const [bookingList, nextProperties, reviewResponse, payments] = await Promise.all([
        api.getBookings(),
        api.getCustomerProperties(),
        api.getCustomerReviewOpportunities(),
        api.getPayments()
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
      setPaymentsByBookingId(
        payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
          const current = accumulator[payment.bookingId];
          if (!current || current.updatedAt < payment.updatedAt) {
            accumulator[payment.bookingId] = payment;
          }
          return accumulator;
        }, {})
      );
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

  async function payWithStripe(booking: Booking) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setStatusMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const checkout = await api.createCheckoutSession({
        bookingId: booking.id,
        successPath: "/customer/dashboard?payment=stripe-success",
        cancelPath: "/customer/dashboard?payment=stripe-cancelled"
      });
      setStatusMessage("Stripe checkout opened in your browser.");
      await Linking.openURL(checkout.checkoutUrl);
      await loadHome();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open checkout.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="Home"
      title="Home"
      description="Your next step."
    >
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <View style={styles.homePathCard} accessibilityLabel="Home progress">
        <View style={styles.homePathGrid}>
          {homeSteps.map((step, index) => (
            <View key={step.label} style={[styles.homePathStep, styles[`homePathStep_${step.status}`]]}>
              <View style={[styles.homePathIndex, styles[`homePathIndex_${step.status}`]]}>
                <Text style={[styles.homePathIndexLabel, styles[`homePathIndexLabel_${step.status}`]]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.homePathCopy}>
                <Text style={styles.homePathLabel}>{step.label}</Text>
                <Text numberOfLines={2} style={styles.homePathValue}>
                  {step.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.homeFocusGrid}>
          <View style={styles.homeFocusItem}>
            <Text style={styles.homeFocusLabel}>Now</Text>
            <Text style={styles.homeFocusValue}>{homeNowLabel}</Text>
          </View>
          <View style={styles.homeFocusItem}>
            <Text style={styles.homeFocusLabel}>Property</Text>
            <Text style={styles.homeFocusValue}>{activeProperty?.label ?? "Add property"}</Text>
          </View>
        </View>
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}

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
              <Text style={styles.secondaryButtonLabel}>Open visit</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "booking" && nextBooking ? (
        <InfoCard
          title={nextBookingNeedsCheckout ? getCheckoutActionLabel(nextBookingPayment) : formatBookingStatusLabel(nextBooking)}
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
          {nextBookingNeedsCheckout ? (
            <Text style={styles.noteLine}>{formatPrice(nextBooking.totalCents)} due before the visit.</Text>
          ) : null}
          <View style={styles.actionStack}>
            {nextBookingNeedsCheckout ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void payWithStripe(nextBooking)}
                style={[styles.primaryButton, isWorking && styles.primaryButtonDisabled]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isWorking ? "Opening..." : getCheckoutActionLabel(nextBookingPayment)}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>See visit</Text>
              </Pressable>
            )}
            <Pressable onPress={nextBookingNeedsCheckout ? onOpenBookings : onStartBooking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {nextBookingNeedsCheckout ? "Open visit" : "Book another visit"}
              </Text>
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
              <Text style={styles.secondaryButtonLabel}>Open visits</Text>
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
  homePathCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.md
  },
  homePathGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  homePathStep: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 74,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.sm
  },
  homePathStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  homePathStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  homePathStep_pending: {
    opacity: 0.82
  },
  homePathIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  homePathIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  homePathIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  homePathIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  homePathIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  homePathIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  homePathIndexLabel_current: {
    color: "#ffffff"
  },
  homePathIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  homePathCopy: {
    flex: 1,
    gap: 2
  },
  homePathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  homePathValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  homeFocusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  homeFocusItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  homeFocusLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  homeFocusValue: {
    color: BrandTokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
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
  primaryButtonDisabled: {
    opacity: 0.46
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
  }
});
