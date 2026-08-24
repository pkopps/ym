import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  Booking,
  BookingArrivalTracking,
  CustomerProperty,
  CustomerReviewOpportunity,
  PaymentRecord
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createCustomerMobileApiClient } from "../lib/api";
import { buildTrackingDetail, buildTrackingSummary, findTrackableBooking } from "../lib/arrivalTracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

const bookingWindowLabelKeys: Record<string, TranslationKey> = {
  morning: "booking.window.morning.label",
  afternoon: "booking.window.afternoon.label",
  "late-afternoon-night": "booking.window.late_afternoon_night.label"
};

const bookingWindowRangeKeys: Record<string, TranslationKey> = {
  morning: "booking.window.morning.range",
  afternoon: "booking.window.afternoon.range",
  "late-afternoon-night": "booking.window.late_afternoon_night.range"
};

function getBookingWindowKey(iso: string) {
  const hour = new Date(iso).getHours();
  if (hour < 12) {
    return "morning";
  }

  if (hour < 16) {
    return "afternoon";
  }

  return "late-afternoon-night";
}

function formatBookingWindow(i18n: I18nInstance, iso: string) {
  const key = getBookingWindowKey(iso);
  return i18n.t("booking.window.summary", {
    label: i18n.t(bookingWindowLabelKeys[key]),
    range: i18n.t(bookingWindowRangeKeys[key])
  });
}

function formatBookingStatusLabel(i18n: I18nInstance, booking: Booking) {
  if (booking.status === "requested") {
    return i18n.t("mobile.dashboard.booking.waiting_confirmation");
  }

  if (booking.status === "in-progress") {
    return i18n.t("mobile.dashboard.booking.work_in_progress");
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return i18n.t("mobile.dashboard.booking.running_behind");
  }

  if (booking.onRouteConfirmedAt) {
    return i18n.t("mobile.dashboard.booking.crew_on_way");
  }

  return i18n.t("mobile.dashboard.booking.upcoming_visit");
}

type HomeStepStatus = "complete" | "current" | "pending";

function getHomeStepStatus(stepIndex: number, activeStepIndex: number): HomeStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function getPaymentLabel(i18n: I18nInstance, payment?: PaymentRecord) {
  if (!payment) {
    return i18n.t("mobile.bookings.lifecycle.after_confirm");
  }

  if (payment.status === "captured") {
    return i18n.t("mobile.bookings.payment.paid");
  }

  if (payment.status === "pending") {
    return i18n.t("mobile.dashboard.payment.ready");
  }

  if (payment.status === "failed") {
    return i18n.t("mobile.dashboard.payment.retry");
  }

  if (payment.status === "refunded") {
    return i18n.t("mobile.bookings.payment.refunded");
  }

  return payment.status;
}

function getHomePaymentLabel(i18n: I18nInstance, booking?: Booking, payment?: PaymentRecord) {
  if (booking?.status === "requested" && payment?.status !== "captured") {
    return i18n.t("mobile.bookings.lifecycle.after_confirm");
  }

  if (booking?.status === "confirmed" && !payment) {
    return i18n.t("mobile.dashboard.payment.ready");
  }

  return getPaymentLabel(i18n, payment);
}

function needsCheckout(booking: Booking, payment?: PaymentRecord) {
  return (
    booking.status === "confirmed" &&
    payment?.status !== "captured" &&
    payment?.status !== "refunded"
  );
}

function getCheckoutActionLabel(i18n: I18nInstance, payment?: PaymentRecord) {
  if (payment?.status === "failed") {
    return i18n.t("mobile.bookings.action.retry_payment");
  }

  if (payment?.status === "pending") {
    return i18n.t("customer_live.action.continue_checkout");
  }

  return i18n.t("mobile.dashboard.action.pay_now");
}

export function DashboardScreen({
  onStartBooking,
  onOpenBookings
}: {
  onStartBooking?: () => void;
  onOpenBookings?: () => void;
}) {
  const i18n = useI18n();
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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
      ? i18n.t("mobile.dashboard.action.track_arrival")
      : primaryCardKind === "review"
        ? i18n.t("customer_live.review.leave")
        : primaryCardKind === "booking" && nextBooking
          ? nextBookingNeedsCheckout
            ? getCheckoutActionLabel(i18n, nextBookingPayment)
            : formatBookingStatusLabel(i18n, nextBooking)
          : i18n.t("mobile.dashboard.action.request_service");
  const homeSteps = [
    {
      label: i18n.t("mobile.dashboard.step.request"),
      value: nextBooking
        ? nextBooking.status === "requested"
          ? i18n.t("mobile.dashboard.step.provider_review")
          : i18n.t("mobile.dashboard.step.booked")
        : i18n.t("mobile.dashboard.step.start")
    },
    {
      label: i18n.t("mobile.dashboard.step.pay"),
      value: nextBooking ? getHomePaymentLabel(i18n, nextBooking, nextBookingPayment) : i18n.t("mobile.dashboard.step.after_match")
    },
    {
      label: i18n.t("mobile.dashboard.step.track"),
      value: tracking || nextBooking?.onRouteConfirmedAt
        ? i18n.t("provider_live.step.live")
        : nextBooking
          ? i18n.t("mobile.dashboard.step.visit_day")
          : i18n.t("mobile.dashboard.step.after_pay")
    },
    {
      label: i18n.t("mobile.dashboard.step.review"),
      value: reviewReady ? i18n.t("mobile.dashboard.payment.ready") : i18n.t("mobile.bookings.lifecycle.after_visit")
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
      const [bookingList, nextProperties, reviewResponse] = await Promise.all([
        api.getBookings({ limit: 50 }),
        api.getCustomerProperties(),
        api.getCustomerReviewOpportunities()
      ]);
      const payments = await api.getPayments(bookingList.map((booking) => booking.id));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.load_account"));
    } finally {
      setIsInitialLoading(false);
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
      setStatusMessage(i18n.t("mobile.bookings.message.checkout_opened"));
      await Linking.openURL(checkout.checkoutUrl);
      await loadHome();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_checkout"));
    } finally {
      setIsWorking(false);
    }
  }

  if (isInitialLoading && bookings.length === 0 && properties.length === 0 && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("mobile.dashboard.eyebrow")}
        title={i18n.t("mobile.dashboard.title")}
        description={i18n.t("mobile.dashboard.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={3} showAvatar />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={2} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("mobile.dashboard.eyebrow")}
      title={i18n.t("mobile.dashboard.title")}
      description={i18n.t("mobile.dashboard.description")}
    >
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <View style={styles.homePathCard} accessibilityLabel={i18n.t("mobile.dashboard.home_progress")}>
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
            <Text style={styles.homeFocusLabel}>{i18n.t("mobile.dashboard.now")}</Text>
            <Text style={styles.homeFocusValue}>{homeNowLabel}</Text>
          </View>
          <View style={styles.homeFocusItem}>
            <Text style={styles.homeFocusLabel}>{i18n.t("customer_live.label.property")}</Text>
            <Text style={styles.homeFocusValue}>{activeProperty?.label ?? i18n.t("mobile.book.add_property")}</Text>
          </View>
        </View>
      </View>

      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}

      {primaryCardKind === "tracking" && tracking && activeTrackingBookingId ? (
        <InfoCard
          title={buildTrackingSummary(i18n, tracking)}
          description={
            providerNamesById[activeTrackingBooking?.providerId ?? ""] ?? i18n.t("mobile.dashboard.booking.crew_on_way")
          }
        >
          <Text style={styles.primaryLine}>{tracking.message}</Text>
          {buildTrackingDetail(i18n, tracking) ? (
            <Text style={styles.secondaryLine}>{buildTrackingDetail(i18n, tracking)}</Text>
          ) : null}
          <View style={styles.actionStack}>
            <Pressable onPress={() => setIsTrackingModalVisible(true)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{i18n.t("mobile.dashboard.action.track_arrival")}</Text>
            </Pressable>
            <Pressable onPress={onOpenBookings} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{i18n.t("mobile.dashboard.action.open_visit")}</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "booking" && nextBooking ? (
        <InfoCard
          title={nextBookingNeedsCheckout ? getCheckoutActionLabel(i18n, nextBookingPayment) : formatBookingStatusLabel(i18n, nextBooking)}
          description={formatBookingWindow(i18n, nextBooking.scheduledStartIso)}
        >
          <Text style={styles.primaryLine}>
            {providerNamesById[nextBooking.providerId] ?? i18n.t("mobile.dashboard.landscaping_business")}
          </Text>
          <Text style={styles.secondaryLine}>{nextBooking.serviceAddress.line1}</Text>
          {nextBooking.lateEtaIso && !nextBooking.onRouteConfirmedAt ? (
            <Text style={styles.noteLine}>
              {i18n.t("mobile.dashboard.now_around", {
                time: i18n.formatDate(nextBooking.lateEtaIso, { timeStyle: "short" })
              })}
            </Text>
          ) : null}
          {nextBookingNeedsCheckout ? (
            <Text style={styles.noteLine}>
              {i18n.t("mobile.bookings.next.payment_due", {
                price: i18n.formatCurrency(nextBooking.totalCents)
              })}
            </Text>
          ) : null}
          <View style={styles.actionStack}>
            {nextBookingNeedsCheckout ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void payWithStripe(nextBooking)}
                style={[styles.primaryButton, isWorking && styles.primaryButtonDisabled]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isWorking ? i18n.t("mobile.dashboard.loading.opening") : getCheckoutActionLabel(i18n, nextBookingPayment)}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>{i18n.t("mobile.dashboard.action.see_visit")}</Text>
              </Pressable>
            )}
            <Pressable onPress={nextBookingNeedsCheckout ? onOpenBookings : onStartBooking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {nextBookingNeedsCheckout
                  ? i18n.t("mobile.dashboard.action.open_visit")
                  : i18n.t("mobile.dashboard.action.book_another_visit")}
              </Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "review" && reviewReady ? (
        <InfoCard title={i18n.t("mobile.dashboard.review.title")} description={reviewReady.providerName}>
          <Text style={styles.secondaryLine}>{reviewReady.reason}</Text>
          <View style={styles.actionStack}>
            <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{i18n.t("customer_live.review.leave")}</Text>
            </Pressable>
            <Pressable onPress={onStartBooking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{i18n.t("mobile.dashboard.action.book_again")}</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "property" && activeProperty ? (
        <InfoCard title={i18n.t("mobile.dashboard.property.title")} description={activeProperty.label}>
          <Text style={styles.primaryLine}>{activeProperty.address.line1}</Text>
          <Text style={styles.secondaryLine}>
            {activeProperty.address.city}, {activeProperty.address.state} {activeProperty.address.postalCode}
          </Text>
          <View style={styles.actionStack}>
            <Pressable onPress={onStartBooking} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{i18n.t("mobile.dashboard.action.book_this_property")}</Text>
            </Pressable>
            <Pressable onPress={onOpenBookings} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{i18n.t("mobile.dashboard.action.open_visits")}</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : null}

      {primaryCardKind === "empty" ? (
        <InfoCard title={i18n.t("mobile.dashboard.empty.title")} description={i18n.t("mobile.dashboard.empty.description")}>
          <View style={styles.actionStack}>
            <Pressable onPress={onStartBooking} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{i18n.t("mobile.dashboard.action.get_matched")}</Text>
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
