import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import {
  I18nInstance,
  TranslationKey
} from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import {
  BookingArrivalTracking,
  Booking,
  CustomerProviderConversationThread,
  getBookingServiceWindow,
  PaymentRecord,
  CustomerReviewOpportunity,
  PropertyPhotoArea,
  ReviewScore
} from "@yardmatch/contracts";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createCustomerMobileApiClient } from "../lib/api";
import { buildTrackingSummary } from "../lib/arrivalTracking";
import { getCustomerMobileTracker } from "../lib/tracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

type ViewMode = "upcoming" | "past";
type VisitStepStatus = "complete" | "current" | "pending";
type VisitPrimaryActionKind = "checkout" | "support" | "track";

const propertyPhotoAreas: PropertyPhotoArea[] = [
  "lawn",
  "shrubs",
  "garden-beds",
  "trees",
  "driveway",
  "walkways",
  "gutters",
  "other"
];

const photoAreaLabelKeys: Record<PropertyPhotoArea, TranslationKey> = {
  lawn: "photo.area.lawn",
  shrubs: "photo.area.shrubs",
  "garden-beds": "photo.area.garden_beds",
  trees: "photo.area.trees",
  driveway: "photo.area.driveway",
  walkways: "photo.area.walkways",
  gutters: "photo.area.gutters",
  other: "photo.area.other"
};

interface VisitNextStep {
  action?: VisitPrimaryActionKind;
  detail: string;
  label: string;
}

const bookingWindowLabelKeys: Record<ReturnType<typeof getBookingServiceWindow>["key"], TranslationKey> = {
  morning: "booking.window.morning.label",
  afternoon: "booking.window.afternoon.label",
  "late-afternoon-night": "booking.window.late_afternoon_night.label"
};

const bookingWindowRangeKeys: Record<ReturnType<typeof getBookingServiceWindow>["key"], TranslationKey> = {
  morning: "booking.window.morning.range",
  afternoon: "booking.window.afternoon.range",
  "late-afternoon-night": "booking.window.late_afternoon_night.range"
};

const bookingExceptionKeys: Record<Booking["activeExceptionType"] & string, TranslationKey> = {
  "customer-no-show": "booking.exception.customer_no_show",
  "customer-not-ready": "booking.exception.customer_not_ready",
  "unable-to-access-property": "booking.exception.unable_to_access_property",
  "service-could-not-be-completed": "booking.exception.service_could_not_be_completed"
};

function formatDateTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    timeStyle: "short"
  });
}

function formatPrice(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents, "USD", { maximumFractionDigits: 0 });
}

function formatBookingWindow(i18n: I18nInstance, iso: string) {
  const window = getBookingServiceWindow(iso);
  return i18n.t("booking.window.summary", {
    label: i18n.t(bookingWindowLabelKeys[window.key]),
    range: i18n.t(bookingWindowRangeKeys[window.key])
  });
}

function formatServiceLabel(i18n: I18nInstance, booking: Booking) {
  return i18n.t(serviceCategoryToI18nKey(booking.category));
}

function getBookingExceptionLabel(i18n: I18nInstance, booking: Booking) {
  return booking.activeExceptionType ? i18n.t(bookingExceptionKeys[booking.activeExceptionType]) : "";
}

function addOneDay(iso: string) {
  return new Date(new Date(iso).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function getVisitStepStatus(stepIndex: number, activeStepIndex: number): VisitStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function canOpenDisputeForBooking(booking: Booking) {
  return (
    booking.status === "completed" ||
    booking.status === "in-progress" ||
    (booking.status === "confirmed" && Boolean(booking.onRouteConfirmedAt))
  );
}

export function BookingsScreen({
  onOpenAccount
}: {
  onOpenAccount?: () => void;
}) {
  const i18n = useI18n();
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
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, string>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, string>>({});
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | undefined>();
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
  const [showManageByBookingId, setShowManageByBookingId] = useState<Record<string, boolean>>({});
  const [photoAreaByBookingId, setPhotoAreaByBookingId] = useState<Record<string, PropertyPhotoArea>>({});
  const [photoNoteByBookingId, setPhotoNoteByBookingId] = useState<Record<string, string>>({});

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
  const canSubmitReview = Boolean(readyOpportunity?.canReviewNow && reviewText.trim().length > 0);

  async function loadBookings() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);

      const [activePage, historyPage, reviewResponse] = await Promise.all([
        api.getBookingsPage({ limit: 50, scope: "active" }),
        api.getBookingsPage({ limit: 20, scope: "history" }),
        api.getCustomerReviewOpportunities()
      ]);
      const bookingList = [...activePage.items, ...historyPage.items];
      const payments = await api.getPayments(bookingList.map((booking) => booking.id));

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
      setHistoryNextCursor(historyPage.pageInfo.nextCursor);
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.bookings.error.load_visits"));
    } finally {
      setIsInitialLoading(false);
    }
  }

  async function loadMoreHistory() {
    if (!envelope?.session.token || !historyNextCursor || isLoadingMoreHistory) {
      return;
    }

    try {
      setIsLoadingMoreHistory(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const page = await api.getBookingsPage({
        cursor: historyNextCursor,
        limit: 20,
        scope: "history"
      });
      const payments = await api.getPayments(page.items.map((booking) => booking.id));
      const providerIds = [
        ...new Set(
          page.items
            .map((booking) => booking.providerId)
            .filter((providerId) => !providerNamesById[providerId])
        )
      ];
      const providers = await Promise.all(
        providerIds.map(async (providerId) => {
          try {
            return await api.getProviderProfile(providerId);
          } catch {
            return undefined;
          }
        })
      );

      setProviderNamesById((current) => ({
        ...current,
        ...providers.reduce<Record<string, string>>((accumulator, provider) => {
          if (provider) {
            accumulator[provider.id] = provider.companyName;
          }
          return accumulator;
        }, {})
      }));
      setBookings((current) => [...current, ...page.items]);
      setPaymentsByBookingId((current) => ({
        ...current,
        ...payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
          accumulator[payment.bookingId] = payment;
          return accumulator;
        }, {})
      }));
      setHistoryNextCursor(page.pageInfo.nextCursor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.bookings.error.load_visits"));
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, [envelope?.session.token]);

  const submitReview = async () => {
    if (!readyOpportunity?.canReviewNow || !envelope?.session.token) {
      return;
    }

    if (reviewText.trim().length === 0) {
      setErrorMessage(i18n.t("customer_live.error.review_note_required"));
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
        timelinessRating: showReviewDetails ? timelinessRating : overallRating,
        attentionToDetailRating: showReviewDetails ? detailRating : overallRating,
        reviewText: reviewText.trim()
      });
      void tracker.track("action_clicked", {action: "providerReviewSubmitted",
        app: "customer",
        bookingId: readyOpportunity.bookingId,
        overallRating,
        timelinessRating,
        detailRating
      });
      setSubmittedMessage(i18n.t("mobile.bookings.message.review_saved", { provider: readyOpportunity.providerName }));
      setReviewText("");
      setShowReviewDetails(false);
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.submit_review"));
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
      setSubmittedMessage(i18n.t("customer_live.message.booking_cancelled"));
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.cancel_booking"));
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
      setSubmittedMessage(i18n.t("mobile.bookings.message.moved_next_day"));
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.reschedule_booking"));
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
      setErrorMessage(i18n.t("customer_live.error.dispute_reason_required"));
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
      setSubmittedMessage(i18n.t("mobile.bookings.message.dispute_opened"));
      await loadBookings();
      onOpenAccount?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_dispute"));
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
      setErrorMessage(i18n.t("customer_live.error.no_payment"));
      return;
    }

    if (!reason) {
      setErrorMessage(i18n.t("customer_live.error.refund_reason_required"));
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
      setSubmittedMessage(i18n.t("mobile.bookings.message.refund_review_requested"));
      await loadBookings();
      onOpenAccount?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.request_refund"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_chat"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.send_message"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.load_tracking"));
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
      return i18n.t("customer_live.payment.not_paid");
    }

    if (payment.refundReviewStatus === "requested") {
      return i18n.t("customer_live.payment.refund_review_progress");
    }

    if (payment.refundReviewStatus === "denied") {
      return i18n.t("customer_live.payment.refund_denied");
    }

    if (payment.status === "captured") {
      return i18n.t("mobile.bookings.payment.paid");
    }

    if (payment.status === "pending") {
      return i18n.t("mobile.bookings.payment.checkout_started");
    }

    if (payment.status === "failed") {
      return i18n.t("customer_live.payment.needs_attention");
    }

    if (payment.status === "refunded") {
      return i18n.t("mobile.bookings.payment.refunded");
    }

    return i18n.t("customer_live.payment.on_file");
  }

  function getVisitPaymentLabel(booking: Booking, payment?: PaymentRecord) {
    if (booking.status === "requested" && payment?.status !== "captured") {
      return i18n.t("customer_live.payment.after_provider_confirms");
    }

    if (!payment && booking.status === "confirmed") {
      return i18n.t("customer_live.payment.ready_for_checkout");
    }

    return getPaymentLabel(payment);
  }

  function canRequestRefundReview(booking: Booking, payment?: PaymentRecord) {
    return booking.status === "completed" && payment?.status === "captured" && payment.refundable;
  }

  function getBookingStatusLabel(booking: Booking) {
    if (booking.status === "confirmed") {
      return i18n.t("mobile.bookings.status.confirmed");
    }

    if (booking.status === "in-progress") {
      return i18n.t("mobile.bookings.status.in_progress");
    }

    if (booking.status === "disputed") {
      return i18n.t("mobile.bookings.status.disputed");
    }

    if (booking.status === "completed") {
      return i18n.t("customer_live.done");
    }

    if (booking.status === "cancelled") {
      return i18n.t("mobile.bookings.status.cancelled");
    }

    if (booking.status === "refunded") {
      return i18n.t("mobile.bookings.payment.refunded");
    }

    return i18n.t("mobile.bookings.status.requested");
  }

  function getBookingStatusSummary(booking: Booking) {
    if (booking.onRouteConfirmedAt) {
      if (activeTrackingBookingId === booking.id && tracking) {
        return i18n.t("mobile.bookings.status.tracking_chat_open", {
          tracking: buildTrackingSummary(i18n, tracking)
        });
      }

      return i18n.t("mobile.bookings.status.crew_on_way_chat");
    }

    if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
      const delayedTime = formatTime(i18n, booking.lateEtaIso);
      return booking.lateReason
        ? i18n.t("mobile.bookings.status.running_behind_reason", {
            time: delayedTime,
            reason: booking.lateReason
          })
        : i18n.t("mobile.bookings.status.running_behind", { time: delayedTime });
    }

    if (booking.activeExceptionType) {
      const exceptionLabel = getBookingExceptionLabel(i18n, booking);
      return booking.activeExceptionNotes
        ? i18n.t("mobile.bookings.status.exception_notes", {
            label: exceptionLabel,
            notes: booking.activeExceptionNotes
          })
        : exceptionLabel;
    }

    if (booking.status === "disputed") {
      return booking.disputeReason
        ? i18n.t("mobile.bookings.status.disputed_reason", { reason: booking.disputeReason })
        : i18n.t("mobile.bookings.status.disputed");
    }

    if (booking.status === "confirmed") {
      return i18n.t("mobile.bookings.status.confirmed_ready");
    }

    if (booking.status === "requested") {
      return i18n.t("mobile.bookings.status.requested_waiting");
    }

    if (booking.status === "in-progress") {
      return i18n.t("mobile.bookings.status.work_in_progress");
    }

    return booking.status;
  }

  function getVisitNextStep(booking: Booking, payment?: PaymentRecord): VisitNextStep {
    if (booking.activeExceptionType || booking.status === "disputed") {
      return {
        action: "support",
        detail: booking.activeExceptionNotes ?? i18n.t("mobile.bookings.next.support_context"),
        label: i18n.t("mobile.bookings.action.open_support")
      };
    }

    if (booking.onRouteConfirmedAt) {
      return {
        action: "track",
        detail: i18n.t("mobile.bookings.next.crew_on_way"),
        label: i18n.t("customer_live.action.track_crew")
      };
    }

    if (booking.status === "requested") {
      return {
        detail: i18n.t("mobile.bookings.next.pay_after_confirm"),
        label: i18n.t("mobile.book.provider_reviews")
      };
    }

    if (booking.status === "confirmed" && payment?.status !== "captured") {
      if (payment?.status === "failed") {
        return {
          action: "checkout",
          detail: i18n.t("mobile.bookings.next.payment_failed"),
          label: i18n.t("mobile.bookings.action.retry_payment")
        };
      }

      return {
        action: "checkout",
        detail: i18n.t("mobile.bookings.next.payment_due", {
          price: formatPrice(i18n, booking.totalCents)
        }),
        label:
          payment?.status === "pending"
            ? i18n.t("customer_live.action.continue_checkout")
            : i18n.t("customer_live.action.pay_now")
      };
    }

    if (booking.status === "in-progress") {
      return {
        detail: i18n.t("mobile.bookings.status.work_in_progress"),
        label: i18n.t("mobile.bookings.next.service_underway")
      };
    }

    if (payment?.status === "captured") {
      return {
        detail: i18n.t("mobile.bookings.next.tracking_on_visit_day"),
        label: i18n.t("mobile.bookings.next.paid_ready")
      };
    }

    return {
      detail: getBookingStatusSummary(booking),
      label: i18n.t("mobile.bookings.next.visit_status")
    };
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
      setSubmittedMessage(i18n.t("mobile.bookings.message.checkout_opened"));
      await Linking.openURL(checkout.checkoutUrl);
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_checkout"));
    } finally {
      setIsWorking(false);
    }
  }

  async function addPropertyPhoto(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(i18n.t("mobile.bookings.photos.permission_required"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.3
      });
      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId,
        phase: "before",
        imageDataUrl: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`,
        photoArea: photoAreaByBookingId[bookingId] ?? "lawn",
        note: photoNoteByBookingId[bookingId]?.trim() || undefined
      });
      setPhotoNoteByBookingId((current) => ({ ...current, [bookingId]: "" }));
      setSubmittedMessage(i18n.t("mobile.bookings.photos.uploaded"));
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.bookings.photos.upload_error"));
    } finally {
      setIsWorking(false);
    }
  }

  async function updatePhotoMarketingUse(bookingId: string, status: "granted" | "denied" | "revoked") {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.updateBookingPhotoMarketingUse({ bookingId, status });
      setSubmittedMessage(i18n.t("mobile.bookings.photos.preference_saved"));
      await loadBookings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.bookings.photos.consent_error"));
    } finally {
      setIsWorking(false);
    }
  }

  if (isInitialLoading && bookings.length === 0 && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("mobile.bookings.eyebrow")}
        title={i18n.t("mobile.bookings.title")}
        description={i18n.t("mobile.bookings.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction showAvatar />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction showAvatar />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("mobile.bookings.eyebrow")}
      title={i18n.t("mobile.bookings.title")}
      description={i18n.t("mobile.bookings.description")}
    >
      <View style={styles.modeRow}>
        <ModeButton
          active={viewMode === "upcoming"}
          label={i18n.t("mobile.bookings.tab.upcoming")}
          onPress={() => setViewMode("upcoming")}
        />
        <ModeButton active={viewMode === "past"} label={i18n.t("mobile.bookings.tab.past")} onPress={() => setViewMode("past")} />
      </View>

      {submittedMessage ? (
        <InfoCard title={i18n.t("provider_live.updated")} description={submittedMessage} />
      ) : null}

      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {viewMode === "upcoming" ? (
        <InfoCard
          title={i18n.t("mobile.bookings.coming_up")}
          description={i18n.t("mobile.bookings.scheduled_count", { count: upcomingBookings.length })}
        >
          {upcomingBookings.length > 0 ? (
            <View style={styles.list}>
              {upcomingBookings.map((booking) => {
                const payment = getPaymentRecord(booking.id);
                const paymentLabel = getVisitPaymentLabel(booking, payment);
                const isManageOpen = showManageByBookingId[booking.id];
                const nextStep = getVisitNextStep(booking, payment);
                const primaryActionKind = nextStep.action;
                const canModifyVisit = booking.status === "requested" || booking.status === "confirmed";
                const canOpenDisputeTools = canOpenDisputeForBooking(booking);
                const canShowRefundTools =
                  canRequestRefundReview(booking, payment) ||
                  payment?.refundReviewStatus === "requested" ||
                  payment?.refundReviewStatus === "denied";
                const canShowVisitOptions =
                  canModifyVisit || Boolean(booking.activeExceptionType) || canOpenDisputeTools || canShowRefundTools;
                const visitOptionsLabel =
                  booking.activeExceptionType
                    ? i18n.t("mobile.bookings.action.support")
                    : canModifyVisit
                      ? i18n.t("mobile.bookings.action.options")
                      : canOpenDisputeTools || canShowRefundTools
                        ? i18n.t("mobile.bookings.action.get_help")
                        : i18n.t("mobile.bookings.action.options");

                return (
                  <View key={booking.id} style={styles.liveCard}>
                    <View style={styles.visitHeader}>
                      <View style={styles.bookingCopy}>
                        <Text style={styles.bookingTitle}>{formatServiceLabel(i18n, booking)}</Text>
                        <Text style={styles.bookingMeta}>
                          {providerNamesById[booking.providerId] ?? i18n.t("mobile.bookings.landscaping_business")}
                        </Text>
                      </View>
                      <StatusBadge
                        label={getBookingStatusLabel(booking)}
                        tone={booking.status === "disputed" ? "warning" : "success"}
                      />
                    </View>

                    <VisitLifecycle booking={booking} payment={payment} paymentLabel={paymentLabel} i18n={i18n} />

                    <View style={styles.nextActionCard}>
                      <Text style={styles.nextActionEyebrow}>{i18n.t("customer_live.next")}</Text>
                      <Text style={styles.nextActionTitle}>{nextStep.label}</Text>
                      <Text style={styles.nextActionDetail}>{nextStep.detail}</Text>
                      {primaryActionKind === "track" ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openArrivalTracking(booking)}
                          style={styles.nextPrimaryAction}
                        >
                          <Text style={styles.nextPrimaryActionLabel}>{nextStep.label}</Text>
                        </Pressable>
                      ) : null}
                      {primaryActionKind === "checkout" ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void payWithStripe(booking)}
                          style={styles.nextPrimaryAction}
                        >
                          <Text style={styles.nextPrimaryActionLabel}>{nextStep.label}</Text>
                        </Pressable>
                      ) : null}
                      {primaryActionKind === "support" ? (
                        <Pressable onPress={() => onOpenAccount?.()} style={styles.nextPrimaryAction}>
                          <Text style={styles.nextPrimaryActionLabel}>{nextStep.label}</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.visitSummaryGrid}>
                      <View style={styles.visitSummaryItem}>
                        <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.label.when")}</Text>
                        <Text style={styles.visitSummaryValue}>
                          {formatBookingWindow(i18n, booking.scheduledStartIso)}
                        </Text>
                      </View>
                      <View style={styles.visitSummaryItem}>
                        <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.label.payment")}</Text>
                        <Text style={styles.visitSummaryValue}>{paymentLabel}</Text>
                      </View>
                      <View style={styles.visitSummaryItem}>
                        <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.label.property")}</Text>
                        <Text style={styles.visitSummaryValue}>{booking.serviceAddress.line1}</Text>
                      </View>
                      <View style={styles.visitSummaryItem}>
                        <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.progress.price")}</Text>
                        <Text style={styles.visitSummaryValue}>{formatPrice(i18n, booking.totalCents)}</Text>
                      </View>
                    </View>

                    <View style={styles.actionPanel}>
                      {booking.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openCustomerChat(booking)}
                          style={styles.secondaryAction}
                        >
                          <Text style={styles.secondaryActionLabel}>{i18n.t("customer_live.action.message_business")}</Text>
                        </Pressable>
                      ) : null}
                      {booking.status !== "cancelled" && booking.status !== "refunded" ? (
                        canShowVisitOptions ? (
                          <Pressable
                            onPress={() => toggleManagePanel(booking.id)}
                            style={styles.secondaryAction}
                          >
                            <Text style={styles.secondaryActionLabel}>
                              {isManageOpen ? i18n.t("common.actions.close") : visitOptionsLabel}
                            </Text>
                          </Pressable>
                        ) : null
                      ) : null}
                    </View>
                    {isManageOpen && canShowVisitOptions ? (
                      <View style={styles.managePanel}>
                        <View style={styles.detailStack}>
                          <Text style={styles.detailLabel}>
                            {visitOptionsLabel === i18n.t("mobile.bookings.action.get_help")
                              ? i18n.t("mobile.bookings.action.help")
                              : i18n.t("customer_live.progress.details")}
                          </Text>
                          <Text style={styles.bookingMeta}>{formatDateTime(i18n, booking.scheduledStartIso)}</Text>
                          <Text style={styles.bookingMeta}>{booking.serviceAddress.line1}</Text>
                          <Text style={styles.bookingMeta}>{getBookingStatusLabel(booking)}</Text>
                        </View>
                        {canModifyVisit ? (
                          <View style={styles.photoPanel}>
                            <Text style={styles.detailLabel}>{i18n.t("mobile.bookings.photos.title")}</Text>
                            <Text style={styles.bookingMeta}>{i18n.t("mobile.bookings.photos.body")}</Text>
                            <View style={styles.photoAreaRow}>
                              {propertyPhotoAreas.map((area) => {
                                const isActive = (photoAreaByBookingId[booking.id] ?? "lawn") === area;
                                return (
                                  <Pressable
                                    key={area}
                                    onPress={() =>
                                      setPhotoAreaByBookingId((current) => ({ ...current, [booking.id]: area }))
                                    }
                                    style={[styles.photoAreaChip, isActive && styles.photoAreaChipActive]}
                                  >
                                    <Text style={[styles.photoAreaChipLabel, isActive && styles.photoAreaChipLabelActive]}>
                                      {i18n.t(photoAreaLabelKeys[area])}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <TextInput
                              maxLength={240}
                              onChangeText={(value) =>
                                setPhotoNoteByBookingId((current) => ({ ...current, [booking.id]: value }))
                              }
                              placeholder={i18n.t("mobile.bookings.photos.note_placeholder")}
                              placeholderTextColor={BrandTokens.colors.muted}
                              style={[styles.input, styles.compactInput]}
                              value={photoNoteByBookingId[booking.id] ?? ""}
                            />
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void addPropertyPhoto(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>{i18n.t("mobile.bookings.photos.add")}</Text>
                            </Pressable>
                            {booking.serviceEvidence.some(
                              (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo"
                            ) ? (
                              <View style={styles.photoRow}>
                                {booking.serviceEvidence
                                  .filter(
                                    (evidence) =>
                                      evidence.phase === "before" &&
                                      evidence.evidenceType === "photo" &&
                                      evidence.imageDataUrl
                                  )
                                  .map((evidence) => (
                                    <View key={evidence.id} style={styles.photoTile}>
                                      <Image source={{ uri: evidence.imageDataUrl }} style={styles.photoImage} />
                                      <Text style={styles.photoCaption}>
                                        {i18n.t(photoAreaLabelKeys[evidence.photoArea ?? "other"])}
                                      </Text>
                                    </View>
                                  ))}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                        {canModifyVisit ? (
                          <View style={styles.inlineActions}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void rescheduleBooking(booking)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>{i18n.t("mobile.bookings.action.move_next_day")}</Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void cancelBooking(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>{i18n.t("customer_live.action.cancel_booking")}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {booking.activeExceptionType ? (
                          <Pressable onPress={() => onOpenAccount?.()} style={styles.secondaryAction}>
                            <Text style={styles.secondaryActionLabel}>{i18n.t("mobile.bookings.action.open_support")}</Text>
                          </Pressable>
                        ) : null}
                        {canOpenDisputeTools ? (
                          <>
                            <TextInput
                              onChangeText={(value) =>
                                setDisputeDrafts((current) => ({
                                  ...current,
                                  [booking.id]: value
                                }))
                              }
                              placeholder={i18n.t("mobile.bookings.placeholder.dispute_service")}
                              placeholderTextColor={BrandTokens.colors.muted}
                              style={[styles.input, styles.compactInput]}
                              value={disputeDrafts[booking.id] ?? ""}
                            />
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void openDispute(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>{i18n.t("customer_live.action.open_dispute")}</Text>
                            </Pressable>
                          </>
                        ) : null}
                        {canShowRefundTools ? (
                          <>
                            <TextInput
                              editable={payment?.refundReviewStatus !== "requested"}
                              onChangeText={(value) =>
                                setRefundDrafts((current) => ({
                                  ...current,
                                  [booking.id]: value
                                }))
                              }
                              placeholder={
                                payment?.refundReviewStatus === "requested"
                                  ? i18n.t("customer_live.payment.refund_review_progress")
                                  : i18n.t("customer_live.refund.placeholder")
                              }
                              placeholderTextColor={BrandTokens.colors.muted}
                              style={[styles.input, styles.compactInput]}
                              value={
                                payment?.refundReviewStatus === "requested"
                                  ? payment?.refundReason ?? ""
                                  : refundDrafts[booking.id] ?? ""
                              }
                            />
                            <Pressable
                              disabled={
                                isWorking ||
                                payment?.refundReviewStatus === "requested" ||
                                !canRequestRefundReview(booking, payment)
                              }
                              onPress={() => void requestRefundReview(booking.id)}
                              style={styles.secondaryAction}
                            >
                              <Text style={styles.secondaryActionLabel}>
                                {payment?.refundReviewStatus === "requested"
                                  ? i18n.t("mobile.bookings.refund_review_open")
                                  : i18n.t("customer_live.action.request_refund_review")}
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
                                ? i18n.t("customer_live.chat.you")
                                : providerNamesById[booking.providerId] ?? i18n.t("mobile.bookings.business")}
                            </Text>
                            <Text style={styles.bookingMeta}>{message.body}</Text>
                          </View>
                        ))}
                        <Text style={styles.bookingMeta}>{i18n.t("chat.safety_notice")}</Text>
                        <TextInput
                          multiline
                          onChangeText={setChatDraft}
                          placeholder={i18n.t("mobile.bookings.placeholder.message_owner")}
                          placeholderTextColor={BrandTokens.colors.muted}
                          style={styles.input}
                          value={chatDraft}
                        />
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void sendCustomerChat(booking.id)}
                          style={styles.submitButton}
                        >
                          <Text style={styles.submitButtonLabel}>
                            {isWorking ? i18n.t("chat.sending") : i18n.t("mobile.bookings.action.send_message")}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyState}>
              {i18n.t("mobile.bookings.empty.upcoming")}
            </Text>
          )}
        </InfoCard>
      ) : (
        <>
          {readyOpportunity?.canReviewNow ? (
            <InfoCard title={i18n.t("mobile.bookings.review_visit")} description={readyOpportunity.providerName}>
              <RatingField
                label={i18n.t("customer_live.review.rating")}
                rating={overallRating}
                onChange={(rating) => {
                  setOverallRating(rating);
                  if (!showReviewDetails) {
                    setTimelinessRating(rating);
                    setDetailRating(rating);
                  }
                }}
              />
              <TextInput
                multiline
                onChangeText={setReviewText}
                placeholder={i18n.t("mobile.bookings.placeholder.review")}
                placeholderTextColor={BrandTokens.colors.muted}
                style={styles.input}
                value={reviewText}
              />
              <Pressable
                onPress={() => setShowReviewDetails((current) => !current)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>
                  {showReviewDetails ? i18n.t("common.actions.close") : i18n.t("mobile.bookings.detail_ratings")}
                </Text>
              </Pressable>
              {showReviewDetails ? (
                <View style={styles.reviewDetailStack}>
                  <RatingField label={i18n.t("mobile.bookings.timeliness")} rating={timelinessRating} onChange={setTimelinessRating} />
                  <RatingField label={i18n.t("mobile.bookings.detail")} rating={detailRating} onChange={setDetailRating} />
                </View>
              ) : null}
              <Pressable
                disabled={isWorking || !canSubmitReview}
                onPress={() => void submitReview()}
                style={[styles.submitButton, !canSubmitReview && styles.submitButtonDisabled]}
              >
                <Text style={styles.submitButtonLabel}>
                  {isWorking ? i18n.t("mobile.bookings.working") : i18n.t("mobile.bookings.submit_review")}
                </Text>
              </Pressable>
            </InfoCard>
          ) : null}

          <InfoCard
            title={i18n.t("mobile.bookings.past_visits")}
            description={i18n.t("mobile.bookings.completed_closed_count", { count: pastBookings.length })}
          >
            {pastBookings.length > 0 ? (
              <View style={styles.list}>
                {pastBookings.map((booking) => {
                  const payment = getPaymentRecord(booking.id);
                  const isSelected = selectedBookingId === booking.id;
                  const canOpenDisputeTools = canOpenDisputeForBooking(booking);
                  const canShowRefundTools =
                    canRequestRefundReview(booking, payment) ||
                    payment?.refundReviewStatus === "requested" ||
                    payment?.refundReviewStatus === "denied";
                  const beforePhotos = booking.serviceEvidence.filter(
                    (evidence) =>
                      evidence.phase === "before" && evidence.evidenceType === "photo" && evidence.imageDataUrl
                  );
                  const afterPhotos = booking.serviceEvidence.filter(
                    (evidence) =>
                      evidence.phase === "after" && evidence.evidenceType === "photo" && evidence.imageDataUrl
                  );
                  const marketingUseStatus = [...beforePhotos, ...afterPhotos].find(
                    (evidence) => evidence.marketingUseStatus
                  )?.marketingUseStatus;

                  return (
                    <View key={booking.id} style={[styles.pastVisitCard, isSelected && styles.pastVisitCardActive]}>
                      <Pressable onPress={() => setSelectedBookingId(booking.id)} style={styles.bookingRow}>
                        <View style={styles.bookingCopy}>
                          <Text style={styles.bookingTitle}>{formatServiceLabel(i18n, booking)}</Text>
                          <Text style={styles.bookingMeta}>
                            {providerNamesById[booking.providerId] ?? i18n.t("mobile.bookings.landscaping_business")}
                          </Text>
                          <Text style={styles.bookingMeta}>{formatDateTime(i18n, booking.scheduledStartIso)}</Text>
                          {booking.disputeReason ? (
                            <Text style={styles.bookingMeta}>{booking.disputeReason}</Text>
                          ) : null}
                        </View>
                        <StatusBadge
                          label={
                            booking.status === "completed"
                              ? i18n.t("customer_live.done")
                              : booking.status === "disputed"
                                ? i18n.t("mobile.bookings.status.disputed")
                                : getBookingStatusLabel(booking)
                          }
                          tone={booking.status === "completed" ? "success" : "warning"}
                        />
                      </Pressable>

                      {isSelected ? (
                        <View style={styles.managePanel}>
                          <View style={styles.visitSummaryGrid}>
                            <View style={styles.visitSummaryItem}>
                              <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.label.payment")}</Text>
                              <Text style={styles.visitSummaryValue}>{getPaymentLabel(payment)}</Text>
                            </View>
                            <View style={styles.visitSummaryItem}>
                              <Text style={styles.visitSummaryLabel}>{i18n.t("customer_live.progress.price")}</Text>
                              <Text style={styles.visitSummaryValue}>{formatPrice(i18n, booking.totalCents)}</Text>
                            </View>
                          </View>
                          {beforePhotos.length > 0 || afterPhotos.length > 0 ? (
                            <View style={styles.photoPanel}>
                              <Text style={styles.detailLabel}>{i18n.t("mobile.bookings.photos.before_after")}</Text>
                              {(["before", "after"] as const).map((phase) => {
                                const photos = phase === "before" ? beforePhotos : afterPhotos;
                                return (
                                  <View key={phase} style={styles.detailStack}>
                                    <Text style={styles.bookingTitle}>
                                      {phase === "before"
                                        ? i18n.t("customer_history.photos.before")
                                        : i18n.t("customer_history.photos.after")}
                                    </Text>
                                    {photos.length > 0 ? (
                                      <View style={styles.photoRow}>
                                        {photos.map((photo) => (
                                          <View key={photo.id} style={styles.photoTile}>
                                            <Image source={{ uri: photo.imageDataUrl }} style={styles.photoImage} />
                                            <Text style={styles.photoCaption}>
                                              {i18n.t(photoAreaLabelKeys[photo.photoArea ?? "other"])}
                                            </Text>
                                          </View>
                                        ))}
                                      </View>
                                    ) : (
                                      <Text style={styles.bookingMeta}>{i18n.t("customer_history.photos.none")}</Text>
                                    )}
                                  </View>
                                );
                              })}
                              {booking.status === "completed" && beforePhotos.length > 0 && afterPhotos.length > 0 ? (
                                <View style={styles.detailStack}>
                                  <Text style={styles.bookingTitle}>{i18n.t("customer_history.photos.marketing_title")}</Text>
                                  <Text style={styles.bookingMeta}>{i18n.t("customer_history.photos.marketing_body")}</Text>
                                  <Text style={styles.bookingMeta}>
                                    {marketingUseStatus === "granted"
                                      ? i18n.t("customer_history.photos.marketing_granted")
                                      : marketingUseStatus === "denied"
                                        ? i18n.t("customer_history.photos.marketing_denied")
                                        : marketingUseStatus === "revoked"
                                          ? i18n.t("customer_history.photos.marketing_revoked")
                                          : i18n.t("customer_history.photos.marketing_private")}
                                  </Text>
                                  <View style={styles.inlineActions}>
                                    {marketingUseStatus === "granted" ? (
                                      <Pressable
                                        disabled={isWorking}
                                        onPress={() => void updatePhotoMarketingUse(booking.id, "revoked")}
                                        style={styles.secondaryAction}
                                      >
                                        <Text style={styles.secondaryActionLabel}>
                                          {i18n.t("customer_history.photos.revoke_marketing")}
                                        </Text>
                                      </Pressable>
                                    ) : (
                                      <>
                                        <Pressable
                                          disabled={isWorking}
                                          onPress={() => void updatePhotoMarketingUse(booking.id, "granted")}
                                          style={styles.secondaryAction}
                                        >
                                          <Text style={styles.secondaryActionLabel}>
                                            {i18n.t("customer_history.photos.allow_marketing")}
                                          </Text>
                                        </Pressable>
                                        {marketingUseStatus !== "denied" ? (
                                          <Pressable
                                            disabled={isWorking}
                                            onPress={() => void updatePhotoMarketingUse(booking.id, "denied")}
                                            style={styles.secondaryAction}
                                          >
                                            <Text style={styles.secondaryActionLabel}>
                                              {i18n.t("customer_history.photos.keep_private")}
                                            </Text>
                                          </Pressable>
                                        ) : null}
                                      </>
                                    )}
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                          {canOpenDisputeTools ? (
                            <>
                              <TextInput
                                onChangeText={(value) =>
                                  setDisputeDrafts((current) => ({
                                    ...current,
                                    [booking.id]: value
                                  }))
                                }
                                placeholder={i18n.t("mobile.bookings.placeholder.what_wrong")}
                                placeholderTextColor={BrandTokens.colors.muted}
                                style={[styles.input, styles.compactInput]}
                                value={disputeDrafts[booking.id] ?? ""}
                              />
                              <Pressable
                                disabled={isWorking}
                                onPress={() => void openDispute(booking.id)}
                                style={styles.secondaryAction}
                              >
                                <Text style={styles.secondaryActionLabel}>{i18n.t("customer_live.action.open_dispute")}</Text>
                              </Pressable>
                            </>
                          ) : null}
                          {canShowRefundTools ? (
                            <>
                              <TextInput
                                editable={payment?.refundReviewStatus !== "requested"}
                                onChangeText={(value) =>
                                  setRefundDrafts((current) => ({
                                    ...current,
                                    [booking.id]: value
                                  }))
                                }
                                placeholder={
                                  payment?.refundReviewStatus === "requested"
                                    ? i18n.t("customer_live.payment.refund_review_progress")
                                    : i18n.t("customer_live.refund.placeholder")
                                }
                                placeholderTextColor={BrandTokens.colors.muted}
                                style={[styles.input, styles.compactInput]}
                                value={
                                  payment?.refundReviewStatus === "requested"
                                    ? payment?.refundReason ?? ""
                                    : refundDrafts[booking.id] ?? ""
                                }
                              />
                              <Pressable
                                disabled={
                                  isWorking ||
                                  payment?.refundReviewStatus === "requested" ||
                                  !canRequestRefundReview(booking, payment)
                                }
                                onPress={() => void requestRefundReview(booking.id)}
                                style={styles.secondaryAction}
                              >
                                <Text style={styles.secondaryActionLabel}>
                                  {payment?.refundReviewStatus === "requested"
                                    ? i18n.t("mobile.bookings.refund_review_open")
                                    : i18n.t("customer_live.action.request_refund_review")}
                                </Text>
                              </Pressable>
                            </>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                {historyNextCursor ? (
                  <Pressable
                    disabled={isLoadingMoreHistory}
                    onPress={() => void loadMoreHistory()}
                    style={styles.secondaryAction}
                  >
                    <Text style={styles.secondaryActionLabel}>
                      {isLoadingMoreHistory
                        ? i18n.t("customer_history.loading_more")
                        : i18n.t("customer_history.load_more")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.emptyState}>
                {i18n.t("mobile.bookings.empty.past")}
              </Text>
            )}
          </InfoCard>

          {readyOpportunity && !readyOpportunity.canReviewNow ? (
            <InfoCard title={i18n.t("mobile.bookings.review_status")} description={readyOpportunity.providerName}>
              <Text style={styles.bookingMeta}>{readyOpportunity.reason}</Text>
            </InfoCard>
          ) : null}
        </>
      )}
      <ArrivalTrackingModal
        onClose={() => setIsTrackingModalVisible(false)}
        onRefresh={() => void refreshArrivalTracking()}
        providerName={
          providerNamesById[bookings.find((booking) => booking.id === activeTrackingBookingId)?.providerId ?? ""] ??
          i18n.t("mobile.bookings.business")
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

function VisitLifecycle({
  booking,
  i18n,
  payment,
  paymentLabel
}: {
  booking: Booking;
  i18n: I18nInstance;
  payment?: PaymentRecord;
  paymentLabel: string;
}) {
  const isPaid = payment?.status === "captured" || payment?.status === "refunded";
  const isRequested = booking.status === "requested";
  const activeStepIndex =
    booking.status === "completed"
      ? 3
      : booking.onRouteConfirmedAt || booking.status === "in-progress"
        ? 2
        : isPaid
          ? 2
          : isRequested
            ? 0
            : 1;
  const arrivalValue =
    booking.onRouteConfirmedAt
      ? i18n.t("customer_live.status.crew_on_way")
      : booking.status === "in-progress"
        ? i18n.t("mobile.bookings.lifecycle.working")
        : isPaid
          ? i18n.t("mobile.bookings.lifecycle.waiting")
          : i18n.t("mobile.bookings.lifecycle.after_pay");
  const steps = [
    {
      label: i18n.t("customer_live.progress.request"),
      value: isRequested ? i18n.t("mobile.book.provider_reviews") : i18n.t("mobile.bookings.status.confirmed")
    },
    {
      label: i18n.t("mobile.book.pay"),
      value: isRequested && payment?.status !== "captured" ? i18n.t("mobile.bookings.lifecycle.after_confirm") : paymentLabel
    },
    {
      label: i18n.t("mobile.bookings.lifecycle.arrival"),
      value: arrivalValue
    },
    {
      label: i18n.t("mobile.bookings.lifecycle.review"),
      value: booking.status === "completed" ? i18n.t("provider_live.step.ready") : i18n.t("mobile.bookings.lifecycle.after_visit")
    }
  ].map((step, index) => ({
    ...step,
    status: getVisitStepStatus(index, activeStepIndex)
  }));

  return (
    <View style={styles.visitPath} accessibilityLabel={i18n.t("mobile.bookings.visit_progress_aria")}>
      {steps.map((step, index) => (
        <View key={step.label} style={[styles.visitPathStep, styles[`visitPathStep_${step.status}`]]}>
          <View style={[styles.visitPathIndex, styles[`visitPathIndex_${step.status}`]]}>
            <Text style={[styles.visitPathIndexLabel, styles[`visitPathIndexLabel_${step.status}`]]}>
              {index + 1}
            </Text>
          </View>
          <View style={styles.visitPathCopy}>
            <Text style={styles.visitPathLabel}>{step.label}</Text>
            <Text numberOfLines={2} style={styles.visitPathValue}>
              {step.value}
            </Text>
          </View>
        </View>
      ))}
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
  pastVisitCard: {
    gap: BrandTokens.spacing.md,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: BrandTokens.spacing.md
  },
  pastVisitCardActive: {
    borderColor: "rgba(47, 125, 76, 0.28)",
    backgroundColor: BrandTokens.colors.surfaceStrong
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
  visitPath: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  visitPathStep: {
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
  visitPathStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  visitPathStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  visitPathStep_pending: {
    opacity: 0.82
  },
  visitPathIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  visitPathIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  visitPathIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  visitPathIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  visitPathIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  visitPathIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  visitPathIndexLabel_current: {
    color: "#ffffff"
  },
  visitPathIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  visitPathCopy: {
    flex: 1,
    gap: 2
  },
  visitPathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  visitPathValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  visitSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  visitSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  visitSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  visitSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  nextActionCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(47, 125, 76, 0.18)",
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: BrandTokens.spacing.sm,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  nextActionEyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  nextActionTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22
  },
  nextActionDetail: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  nextPrimaryAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    marginTop: BrandTokens.spacing.xs,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  nextPrimaryActionLabel: {
    color: "#ffffff",
    fontWeight: "700"
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
  photoPanel: {
    gap: BrandTokens.spacing.sm,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: BrandTokens.spacing.md
  },
  photoAreaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.xs
  },
  photoAreaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.sm,
    paddingVertical: BrandTokens.spacing.xs
  },
  photoAreaChipActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  photoAreaChipLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12
  },
  photoAreaChipLabelActive: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  photoTile: {
    width: 112,
    gap: BrandTokens.spacing.xs
  },
  photoImage: {
    width: 112,
    height: 88,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.border
  },
  photoCaption: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12
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
  reviewDetailStack: {
    gap: BrandTokens.spacing.md
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
  submitButtonDisabled: {
    opacity: 0.56
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
