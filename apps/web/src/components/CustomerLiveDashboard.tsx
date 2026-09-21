"use client";

import { PaymentMethodGuide } from "./PaymentMethodGuide";
import { BookingSchedulePanel } from "./BookingSchedulePanel";

import {
  BookingArrivalTracking,
  Booking,
  buildCustomerProviderChoicePresentations,
  CustomerRetentionOpportunity,
  CustomerProviderConversationThread,
  CustomerProfile,
  CustomerProperty,
  CustomerReviewOpportunity,
  formatBookingWindowSummary,
  getBookingExceptionLabel,
  InstantQuoteResponse,
  MarketplaceProviderProfile,
  PaymentRecord,
  PropertyPhotoArea,
  RecurringServiceFrequency,
  RecurringServicePlanSummary,
  ReviewScore,
  SearchProvidersResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, type I18nInstance, type TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { readEvidenceImage } from "../lib/imageUploads";
import { getLaunchAttributionContext, getStoredLaunchLeadId } from "../lib/launchAttribution";
import { useStoredWebSession } from "../lib/session";
import { trackWebEvent } from "../lib/tracking";
import { ArrivalTrackingPanel } from "./ArrivalTrackingPanel";
import { CustomerHistoryBoard } from "./CustomerHistoryBoard";
import { FloatingChatWindow } from "./FloatingChatWindow";
import { LoadingSkeleton } from "./LoadingSkeleton";
import {
  CustomerCustomTimingWindow,
  buildDateIsoForCustomerTiming,
  customerCustomTimingWindowOptions,
  CustomerTimingPreference,
  customerTimingOptions,
  getDefaultCustomerCustomDateString,
  getMinimumCustomerCustomDateString,
  getCustomerTimingLabel
} from "./PublicMarketplaceSearchShell";

const serviceOptions: Array<{ labelKey: TranslationKey; value: ServiceCategory }> = [
  { labelKey: "service.category.lawn_mowing", value: "lawn-mowing" },
  { labelKey: "service.category.hedge_trimming", value: "hedge-trimming" },
  { labelKey: "service.category.mulch_installation", value: "mulch-installation" },
  { labelKey: "service.category.seasonal_cleanup", value: "seasonal-cleanup" },
  { labelKey: "service.category.weed_control", value: "weed-control" },
  { labelKey: "service.category.leaf_blowing", value: "leaf-blowing" }
];
const dashboardTimingOptions: Array<{ label?: string; labelKey?: TranslationKey; value: CustomerTimingPreference }> = [
  ...customerTimingOptions,
  { labelKey: "customer.timing.choose_date", value: "custom-date" }
];
const dashboardTimingValues = new Set<CustomerTimingPreference>(dashboardTimingOptions.map((option) => option.value));
const dashboardCustomWindowValues = new Set<CustomerCustomTimingWindow>(
  customerCustomTimingWindowOptions.map((option) => option.value)
);

const historicalBookingStatuses = new Set<Booking["status"]>([
  "completed",
  "cancelled",
  "refunded",
  "disputed"
]);

const propertyPhotoAreaOptions: Array<{ value: PropertyPhotoArea; labelKey: TranslationKey }> = [
  { value: "lawn", labelKey: "photo.area.lawn" },
  { value: "shrubs", labelKey: "photo.area.shrubs" },
  { value: "garden-beds", labelKey: "photo.area.garden_beds" },
  { value: "trees", labelKey: "photo.area.trees" },
  { value: "driveway", labelKey: "photo.area.driveway" },
  { value: "walkways", labelKey: "photo.area.walkways" },
  { value: "gutters", labelKey: "photo.area.gutters" },
  { value: "other", labelKey: "photo.area.other" }
];

function formatOpenWindow(i18n: I18nInstance, slot?: SearchProvidersResponse["suggestedSlots"][number]) {
  return slot ? formatBookingWindowSummary(slot.startIso) : i18n.t("customer_live.no_open_slot");
}

function formatProviderTrust(i18n: I18nInstance, provider: MarketplaceProviderProfile) {
  return i18n.t("market.home.provider.rating_line", {
    rating: provider.rating,
    count: provider.reviewCount
  });
}

function formatDateTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatEta(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
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

function formatRecurringFrequency(i18n: I18nInstance, frequency: RecurringServiceFrequency) {
  return frequency === "biweekly" ? i18n.t("customer_live.cadence.biweekly") : i18n.t("customer_live.cadence.weekly");
}

function customerWindowLabelKey(window: CustomerCustomTimingWindow): TranslationKey {
  return window === "morning"
    ? "customer.window.morning"
    : window === "afternoon"
      ? "customer.window.afternoon"
      : "customer.window.evening";
}

function getAlternativeTimingSuggestions(selectedTiming: CustomerTimingPreference) {
  const selectedIndex = customerTimingOptions.findIndex((option) => option.value === selectedTiming);

  if (selectedIndex === -1) {
    return customerTimingOptions.slice(0, 2);
  }

  return [...customerTimingOptions.slice(selectedIndex + 1), ...customerTimingOptions.slice(0, selectedIndex)].slice(0, 2);
}

function parseDashboardServiceParam(value: string | null): ServiceCategory {
  return serviceOptions.some((option) => option.value === value) ? (value as ServiceCategory) : "lawn-mowing";
}

function parseDashboardTimingParam(value: string | null): CustomerTimingPreference {
  if (value === "custom-range") {
    return "custom-date";
  }

  return dashboardTimingValues.has(value as CustomerTimingPreference)
    ? (value as CustomerTimingPreference)
    : "tomorrow-morning";
}

function parseDashboardCustomWindowParam(value: string | null): CustomerCustomTimingWindow {
  return dashboardCustomWindowValues.has(value as CustomerCustomTimingWindow)
    ? (value as CustomerCustomTimingWindow)
    : "morning";
}

function parseDashboardDateParam(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return getDefaultCustomerCustomDateString();
  }

  return value;
}

function formatRetentionTrigger(i18n: I18nInstance, trigger: CustomerRetentionOpportunity["trigger"]) {
  return trigger === "recent-completion"
    ? i18n.t("customer_live.retention.trigger.recent_completion")
    : trigger === "30-day-follow-up"
      ? i18n.t("customer_live.retention.trigger.30_day")
      : trigger === "60-day-follow-up"
        ? i18n.t("customer_live.retention.trigger.60_day")
        : trigger === "spring-season-window"
          ? i18n.t("customer_live.retention.trigger.spring")
          : trigger === "fall-season-window"
            ? i18n.t("customer_live.retention.trigger.fall")
            : i18n.t("customer_live.retention.trigger.90_day");
}

function formatRetentionLoyaltyLabel(i18n: I18nInstance, segment: CustomerRetentionOpportunity["loyaltySegment"]) {
  return segment === "provider-loyal"
    ? i18n.t("customer_live.retention.loyalty.provider_loyal")
    : segment === "repeat-customer"
      ? i18n.t("customer_live.retention.loyalty.repeat_customer")
      : i18n.t("customer_live.retention.loyalty.first_repeat");
}

function formatCompletedJobTrustLine(i18n: I18nInstance, completedJobCount: number) {
  return completedJobCount > 0
    ? i18n.t("customer_live.provider.completed_job_trust", { count: completedJobCount })
    : i18n.t("customer_live.provider.new_trust");
}

type RequestStepStatus = "complete" | "current" | "pending";

function getRequestStepStatus(stepIndex: number, activeStepIndex: number): RequestStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function formatBookingStatusTitle(i18n: I18nInstance, booking: Booking) {
  const update = booking.scheduleUpdates?.at(-1);
  if (update && ["active", "declined"].includes(update.state)) return i18n.t(update.kind === "weather" ? "schedule.weather" : update.kind === "reschedule" ? "schedule.proposal" : "schedule.late");
  if (booking.onRouteConfirmedAt) {
    return i18n.t("customer_live.status.crew_on_way");
  }

  if (booking.activeExceptionType) {
    return getBookingExceptionLabel(booking.activeExceptionType);
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return i18n.t("customer_live.status.running_behind");
  }

  switch (booking.status) {
    case "requested":
      return i18n.t("customer_live.status.waiting_confirmation");
    case "confirmed":
      return i18n.t("customer_live.status.visit_confirmed");
    case "in-progress":
      return i18n.t("customer_live.status.visit_in_progress");
    case "completed":
      return i18n.t("customer_live.status.visit_completed");
    default:
      return booking.status.replaceAll("-", " ");
  }
}

function formatSentenceTail(value: string) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function getBookingStateMessage(i18n: I18nInstance, booking: Booking, providerName: string, payment?: PaymentRecord) {
  if (payment?.status === "processing") return i18n.t("payments.processing.body");
  const update = booking.scheduleUpdates?.at(-1);
  if (update && ["active", "declined"].includes(update.state)) return i18n.t(update.kind === "weather" ? "schedule.weather_body" : update.kind === "reschedule" ? "schedule.proposal_body" : "customer_live.state.late", { provider: providerName });
  if (booking.onRouteConfirmedAt) {
    return i18n.t("customer_live.state.on_way", { provider: providerName });
  }

  if (booking.activeExceptionType) {
    return i18n.t("customer_live.state.exception", { provider: providerName });
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return i18n.t("customer_live.state.late", { provider: providerName });
  }

  switch (booking.status) {
    case "requested":
      return i18n.t("customer_live.state.requested", { provider: providerName });
    case "confirmed":
      return payment?.status === "pending"
        ? i18n.t("customer_live.state.confirmed_checkout", { provider: formatSentenceTail(providerName) })
        : i18n.t("customer_live.state.confirmed", { provider: formatSentenceTail(providerName) });
    case "in-progress":
      return i18n.t("customer_live.state.in_progress", { provider: providerName });
    default:
      return i18n.t("customer_live.state.attached", { provider: providerName });
  }
}

function getPriorityBookingCardTitle(i18n: I18nInstance, booking: Booking, payment?: PaymentRecord) {
  if (payment?.status === "processing") return i18n.t("payments.processing.title");
  if (booking.scheduleUpdates?.some(update => ["active", "declined"].includes(update.state))) return formatBookingStatusTitle(i18n, booking);
  if (booking.status === "confirmed" && payment?.status !== "captured") {
    return i18n.t("customer_live.finish_booking");
  }

  if (booking.status === "confirmed" && !booking.onRouteConfirmedAt && !booking.activeExceptionType && !booking.lateEtaIso && !booking.scheduleUpdates?.some(update => ["active", "declined"].includes(update.state))) {
    return i18n.t("customer_live.youre_set");
  }

  return formatBookingStatusTitle(i18n, booking);
}

export function CustomerLiveDashboard() {
  const i18n = useI18n();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const requestedFlow = searchParams.get("flow");
  const requestedService = parseDashboardServiceParam(searchParams.get("service"));
  const requestedTiming = parseDashboardTimingParam(searchParams.get("when"));
  const requestedCustomDate = parseDashboardDateParam(searchParams.get("date"));
  const requestedCustomWindow = parseDashboardCustomWindowParam(searchParams.get("window"));
  const requestedProviderId = searchParams.get("providerId")?.trim() ?? "";
  const requestedProviderName = searchParams.get("providerName")?.trim() ?? "";
  const dashboardView = requestedView === "history" ? "history" : "account";
  const historyOnlyView = dashboardView === "history";
  const requestFlow = requestedFlow === "request";
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile | undefined>();
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState<Record<string, PaymentRecord>>({});
  const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
  const [reviewOpportunities, setReviewOpportunities] = useState<CustomerReviewOpportunity[]>([]);
  const [retentionOpportunities, setRetentionOpportunities] = useState<CustomerRetentionOpportunity[]>([]);
  const [activeRetentionOpportunity, setActiveRetentionOpportunity] =
    useState<CustomerRetentionOpportunity | undefined>();
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>(requestedService);
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>(requestedTiming);
  const [selectedCustomDate, setSelectedCustomDate] = useState(requestedCustomDate);
  const [selectedCustomWindow, setSelectedCustomWindow] =
    useState<CustomerCustomTimingWindow>(requestedCustomWindow);
  const [quote, setQuote] = useState<InstantQuoteResponse | undefined>();
  const [providerResults, setProviderResults] = useState<SearchProvidersResponse | undefined>();
  const [loadingState, setLoadingState] = useState<"idle" | "loading">("idle");
  const [providerSearchState, setProviderSearchState] = useState<"idle" | "loading" | "loaded">("idle");
  const [selectedCadence, setSelectedCadence] = useState<"one-time" | RecurringServiceFrequency>("one-time");
  const [showAlternativeProviders, setShowAlternativeProviders] = useState(false);
  const [recurringPlans, setRecurringPlans] = useState<RecurringServicePlanSummary[]>([]);
  const [bookingMessage, setBookingMessage] = useState<string | undefined>();
  const [dashboardLoadError, setDashboardLoadError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [reviewRatings, setReviewRatings] = useState<Record<string, ReviewScore>>({});
  const [reviewComposerBookingId, setReviewComposerBookingId] = useState<string | undefined>();
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, string>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, string>>({});
  const [rescheduleDrafts, setRescheduleDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [activeChatBookingId, setActiveChatBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [paymentActionHandled, setPaymentActionHandled] = useState(false);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [activeTracking, setActiveTracking] = useState<BookingArrivalTracking | undefined>();
  const [photoAreaByBookingId, setPhotoAreaByBookingId] = useState<Record<string, PropertyPhotoArea>>({});
  const [photoNoteByBookingId, setPhotoNoteByBookingId] = useState<Record<string, string>>({});
  const trackedRetentionPromptIds = useRef(new Set<string>());

  const activeProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const timingLabel = getCustomerTimingLabel(selectedTiming, selectedCustomDate, selectedCustomWindow, i18n);
  const selectedServiceOption = serviceOptions.find((option) => option.value === selectedCategory);
  const selectedServiceLabel =
    selectedServiceOption ? i18n.t(selectedServiceOption.labelKey) : i18n.t("customer_live.selected_service");
  const selectedCadenceLabel =
    selectedCadence === "one-time" ? i18n.t("customer_live.cadence.one_time") : formatRecurringFrequency(i18n, selectedCadence);
  const baseProviderCards =
    providerResults?.rankedProviders.map((result) => ({
      provider: result.provider,
      ranking: result,
      slot:
        result.suggestedSlot ??
        providerResults.suggestedSlots.find((candidate) => candidate.providerId === result.provider.id)
    })) ??
    providerResults?.providers.map((provider) => ({
      provider,
      ranking: undefined,
      slot: providerResults.suggestedSlots.find((candidate) => candidate.providerId === provider.id)
    })) ??
    [];
  const providerCards = requestedProviderId
    ? [...baseProviderCards].sort((left, right) => {
        if (left.provider.id === requestedProviderId) {
          return -1;
        }
        if (right.provider.id === requestedProviderId) {
          return 1;
        }
        return 0;
      })
    : baseProviderCards;
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(providerResults?.rankedProviders ?? []);
  const providerChoicePresentationById = new Map(
    (providerResults?.rankedProviders ?? []).map((result, index) => [
      result.provider.id,
      providerChoicePresentations[index]
    ])
  );
  const recommendedProviderCard = providerCards[0];
  const alternativeProviderCards = providerCards.slice(1, 4);
  const selectedProviderWasRequested = Boolean(
    requestedProviderId && recommendedProviderCard?.provider.id === requestedProviderId
  );
  const selectedProviderLabel =
    selectedProviderWasRequested && requestedProviderName
      ? requestedProviderName
      : recommendedProviderCard?.provider.companyName;
  const recommendedChoicePresentation = recommendedProviderCard
    ? providerChoicePresentationById.get(recommendedProviderCard.provider.id)
    : undefined;
  const providersWithWindows = providerCards.filter((item) => item.slot);
  const alternativeTimingSuggestions = getAlternativeTimingSuggestions(selectedTiming);
  const activeRecurringPlans = recurringPlans.filter((summary) => summary.plan.status === "active");
  const pastRecurringPlans = recurringPlans.filter((summary) => summary.plan.status !== "active");
  const activeBookings = bookings.filter((booking) => !historicalBookingStatuses.has(booking.status));
  const actionableReviewOpportunities = reviewOpportunities.filter(
    (opportunity) => opportunity.canReviewNow && !opportunity.reviewAlreadySubmitted
  );
  const requestFlowActive =
    requestFlow ||
    Boolean(activeRetentionOpportunity) ||
    Boolean(quote) ||
    Boolean(providerResults) ||
    providerSearchState === "loading";
  const providerStepActive = providerSearchState !== "idle" || Boolean(providerResults);
  const hasAccountHistory = recurringPlans.length > 0 || bookings.length > 0 || reviewOpportunities.length > 0;
  const nextBooking = activeBookings.find(booking => booking.id === searchParams.get("bookingId")) ?? [...activeBookings].sort((left, right) =>
    left.scheduledStartIso.localeCompare(right.scheduledStartIso)
  )[0];
  const nextBookingProviderName = nextBooking
    ? providerNamesById[nextBooking.providerId] ?? "your landscaper"
    : undefined;
  const nextBookingPayment = nextBooking ? paymentsByBookingId[nextBooking.id] : undefined;
  const nextBookingNeedsCheckout =
    !nextBooking?.scheduleUpdates?.some(update => ["active", "declined"].includes(update.state)) &&
    Boolean(nextBooking) &&
    nextBooking.status === "confirmed" &&
    !(["captured", "processing", "refunded"].includes(nextBookingPayment?.status ?? ""));
  const nextBookingHasTracking = Boolean(nextBooking?.onRouteConfirmedAt);
  const nextBookingNeedsPrimarySupport = Boolean(
    nextBooking?.activeExceptionType || (nextBooking?.lateEtaIso && !nextBooking?.onRouteConfirmedAt)
  );
  const nextBookingHasPrimaryAction =
    nextBookingNeedsCheckout || nextBookingHasTracking || nextBookingNeedsPrimarySupport;
  const spotlightBooking = nextBooking ?? activeBookings[0];
  const additionalActiveBookings = spotlightBooking
    ? activeBookings.filter((booking) => booking.id !== spotlightBooking.id)
    : [];
  const primaryReviewOpportunity = actionableReviewOpportunities[0];
  const additionalReviewOpportunities = primaryReviewOpportunity
    ? actionableReviewOpportunities.filter(
        (opportunity) => opportunity.bookingId !== primaryReviewOpportunity.bookingId
      )
    : [];
  const primaryRecurringPlan = activeRecurringPlans[0];
  const primaryRetentionOpportunity = retentionOpportunities[0];
  const priorityCardKind = nextBooking
    ? "booking"
    : primaryReviewOpportunity
      ? "review"
      : primaryRetentionOpportunity
        ? "retention"
        : primaryRecurringPlan
          ? "plan"
          : "request";
  const additionalRecurringPlans = primaryRecurringPlan
    ? activeRecurringPlans.filter((summary) => summary.plan.id !== primaryRecurringPlan.plan.id)
    : activeRecurringPlans;
  const additionalRetentionOpportunities = primaryRecurringPlan
    ? retentionOpportunities
    : primaryRetentionOpportunity
      ? retentionOpportunities.filter((opportunity) => opportunity.id !== primaryRetentionOpportunity.id)
      : retentionOpportunities;
  const visibleActiveBookings = priorityCardKind === "booking" ? additionalActiveBookings : activeBookings;
  const sectionSpotlightBooking = visibleActiveBookings[0];
  const sectionAdditionalActiveBookings = sectionSpotlightBooking
    ? visibleActiveBookings.filter((booking) => booking.id !== sectionSpotlightBooking.id)
    : [];
  const visibleReviewOpportunities =
    priorityCardKind === "review" ? additionalReviewOpportunities : actionableReviewOpportunities;
  const sectionSpotlightReviewOpportunity = visibleReviewOpportunities[0];
  const sectionAdditionalReviewOpportunities = sectionSpotlightReviewOpportunity
    ? visibleReviewOpportunities.filter(
        (opportunity) => opportunity.bookingId !== sectionSpotlightReviewOpportunity.bookingId
      )
    : [];
  const visibleRecurringPlans = priorityCardKind === "plan" ? additionalRecurringPlans : activeRecurringPlans;
  const visibleRetentionOpportunities =
    priorityCardKind === "retention" ? additionalRetentionOpportunities : retentionOpportunities;
  const sectionSpotlightBookAgainOption = visibleRecurringPlans[0]
    ? { kind: "plan" as const, summary: visibleRecurringPlans[0] }
    : visibleRetentionOpportunities[0]
      ? { kind: "retention" as const, opportunity: visibleRetentionOpportunities[0] }
      : undefined;
  const sectionAdditionalRecurringPlans =
    sectionSpotlightBookAgainOption?.kind === "plan"
      ? visibleRecurringPlans.filter((summary) => summary.plan.id !== sectionSpotlightBookAgainOption.summary.plan.id)
      : visibleRecurringPlans;
  const sectionAdditionalRetentionOpportunities =
    sectionSpotlightBookAgainOption?.kind === "retention"
      ? visibleRetentionOpportunities.filter(
          (opportunity) => opportunity.id !== sectionSpotlightBookAgainOption.opportunity.id
        )
      : visibleRetentionOpportunities;
  const sectionAdditionalBookAgainOptionCount =
    sectionAdditionalRecurringPlans.length + sectionAdditionalRetentionOpportunities.length;
  const hasCurrentBookAgainOptions = Boolean(sectionSpotlightBookAgainOption) || sectionAdditionalBookAgainOptionCount > 0;
  const requestActiveStepIndex = recommendedProviderCard ? 3 : providerStepActive ? 2 : quote ? 1 : 0;
  const requestProgressSteps = [
    { label: i18n.t("customer_live.progress.details"), value: selectedServiceLabel },
    { label: i18n.t("customer_live.progress.price"), value: quote ? i18n.formatCurrency(quote.estimatedPriceCents) : i18n.t("customer_live.next") },
    {
      label: i18n.t("customer_live.progress.match"),
      value: recommendedProviderCard
        ? selectedProviderLabel ?? recommendedProviderCard.provider.companyName
        : providerSearchState === "loading"
          ? i18n.t("common.loading.checking")
          : i18n.t("customer_live.after_price")
    },
    {
      label: i18n.t("customer_live.progress.request"),
      value: recommendedProviderCard?.slot ? formatOpenWindow(i18n, recommendedProviderCard.slot) : i18n.t("customer_live.review")
    }
  ].map((step, index) => ({
    ...step,
    status: getRequestStepStatus(index, requestActiveStepIndex)
  }));

  function replaceDashboardSearchParams(nextValues: Record<string, string | undefined>) {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    for (const [key, value] of Object.entries(nextValues)) {
      if (value) {
        nextUrl.searchParams.set(key, value);
      } else {
        nextUrl.searchParams.delete(key);
      }
    }
    window.history.replaceState({}, "", nextUrl.toString());
  }

  function getActiveRetentionPreference() {
    if (!activeRetentionOpportunity || activeRetentionOpportunity.providerContinuityStatus !== "eligible") {
      return undefined;
    }

    return {
      priorProviderId: activeRetentionOpportunity.providerId,
      sourceBookingId: activeRetentionOpportunity.sourceBookingId,
      strategyKey: activeRetentionOpportunity.strategyKey,
      trigger: activeRetentionOpportunity.trigger,
      loyaltySegment: activeRetentionOpportunity.loyaltySegment,
      completedCategoryCount: activeRetentionOpportunity.completedCategoryCount,
      sameProviderCompletedCount: activeRetentionOpportunity.sameProviderCompletedCount
    };
  }

  function resetProviderStep() {
    setProviderResults(undefined);
    setProviderSearchState("idle");
    setShowAlternativeProviders(false);
  }

  function handleEditRequestDetails() {
    resetProviderStep();
    setBookingMessage(undefined);
    setErrorMessage(undefined);
  }

  async function loadDashboard() {
    if (!session || session.role !== "customer") {
      setAccessDenied(true);
      return;
    }

    setIsLoadingDashboard(true);
    setAccessDenied(false);
    setDashboardLoadError(undefined);
    const api = createAuthenticatedWebApiClient();
    try {
      const [
        meResponse,
        propertyList,
        bookingList,
        reviewResponse,
        retentionResponse,
        recurringPlanResponse
      ] = await Promise.all([
        api.getCurrentUser(),
        api.getCustomerProperties(),
        api.getBookings({ limit: 50 }),
        api.getCustomerReviewOpportunities(),
        api.getCustomerRetentionOpportunities(),
        api.getRecurringServicePlans()
      ]);
      const payments = await api.getPayments(bookingList.map((booking) => booking.id));

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
      setPaymentsByBookingId(
        payments.reduce<Record<string, PaymentRecord>>((accumulator, payment) => {
          const current = accumulator[payment.bookingId];
          if (!current || current.createdAt < payment.createdAt) {
            accumulator[payment.bookingId] = payment;
          }
          return accumulator;
        }, {})
      );
      setReviewOpportunities(reviewResponse.opportunities);
      setRetentionOpportunities(retentionResponse.opportunities);
      setRecurringPlans(recurringPlanResponse.plans);

      if (!selectedPropertyId && propertyList[0]) {
        setSelectedPropertyId(propertyList[0].id);
      }
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (historyOnlyView) {
      return;
    }

    if (!session || session.role !== "customer") {
      setAccessDenied(true);
      return;
    }

    void loadDashboard().catch((error) => {
      setDashboardLoadError(error instanceof Error ? error.message : "We couldn't load your account right now.");
    });
  }, [historyOnlyView, sessionReady, session?.token, session?.role]);

  useEffect(() => {
    if (!sessionReady || session?.role !== "customer" || historyOnlyView) return;
    let stopped = false;
    let fetching = false;
    const refreshTiming = async () => {
      if (document.visibilityState !== "visible" || fetching) return;
      fetching = true;
      try {
        const api = createAuthenticatedWebApiClient();
        const updated = await api.getBookings({ limit: 50 });
        const payments = await api.getPayments(updated.map(booking => booking.id));
        if (!stopped) {
          setBookings(updated);
          setPaymentsByBookingId(payments.reduce<Record<string, PaymentRecord>>((result, payment) => {
            if (!result[payment.bookingId] || result[payment.bookingId].createdAt < payment.createdAt) result[payment.bookingId] = payment;
            return result;
          }, {}));
        }
      } catch { /* Preserve the last known schedule; the next refresh can recover. */ }
      finally { fetching = false; }
    };
    const timer = window.setInterval(() => void refreshTiming(), 30000);
    document.addEventListener("visibilitychange", refreshTiming);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshTiming); };
  }, [historyOnlyView, sessionReady, session?.token, session?.role]);

  useEffect(() => {
    if (retentionOpportunities.length === 0) {
      return;
    }

    for (const opportunity of retentionOpportunities) {
      if (trackedRetentionPromptIds.current.has(opportunity.id)) {
        continue;
      }

      trackedRetentionPromptIds.current.add(opportunity.id);
      void trackWebEvent(MarketplaceTelemetryEventCatalog.retentionPromptPresented, {
        opportunityId: opportunity.id,
        opportunityKind: opportunity.kind,
        retentionStrategyKey: opportunity.strategyKey,
        retentionTrigger: opportunity.trigger,
        category: opportunity.category,
        daysSinceCompleted: opportunity.daysSinceCompleted,
        completedCategoryCount: opportunity.completedCategoryCount,
        sameProviderCompletedCount: opportunity.sameProviderCompletedCount,
        loyaltySegment: opportunity.loyaltySegment,
        recommendedCadence: opportunity.recommendedCadence,
        ...(opportunity.lastServiceGapDays !== undefined
          ? { lastServiceGapDays: opportunity.lastServiceGapDays }
          : {}),
        requestSource: "customer-web-dashboard"
      });
    }
  }, [retentionOpportunities]);

  useEffect(() => {
    if (!sessionReady || paymentActionHandled) {
      return;
    }

    const checkoutSessionId = searchParams.get("session_id");
    const paymentState = searchParams.get("payment");

    if (!checkoutSessionId && !paymentState) {
      return;
    }

    const clearPaymentParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("session_id");
      nextUrl.searchParams.delete("payment");
      window.history.replaceState({}, "", nextUrl.toString());
    };

    if (paymentState === "stripe-cancelled") {
      setBookingMessage(i18n.t("customer_live.message.stripe_cancelled"));
      setPaymentActionHandled(true);
      clearPaymentParams();
      return;
    }

    if (!checkoutSessionId) {
      return;
    }

    setPaymentActionHandled(true);
    setLoadingState("loading");
    setErrorMessage(undefined);

    void (async () => {
      try {
        const api = createAuthenticatedWebApiClient();
        const payment = await api.finalizeCheckoutSession({
          checkoutSessionId
        });
        await loadDashboard();
        if (payment.status === "failed") {
          setErrorMessage(i18n.t("customer_live.payment.needs_attention"));
        } else {
          // Processing stays on the live booking card so refresh can replace it with the final result.
          setBookingMessage(payment.status === "processing" ? undefined : i18n.t(
            payment.status === "captured" ? "customer_live.message.stripe_received" :
              payment.status === "refunded" ? "customer_history.payment.refunded" : "payments.pending.body"
          ));
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : i18n.t("customer_live.error.confirm_stripe")
        );
      } finally {
        setLoadingState("idle");
        clearPaymentParams();
      }
    })();
  }, [paymentActionHandled, searchParams, sessionReady]);

  async function handleQuote() {
    if (!activeProperty) {
      setErrorMessage(i18n.t("customer_live.error.choose_property"));
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
      await runProviderSearch(selectedTiming, nextQuote.estimatedDurationMinutes);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.build_quote"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function runProviderSearch(timingPreference: CustomerTimingPreference, durationMinutes = quote?.estimatedDurationMinutes) {
    if (!activeProperty) {
      setErrorMessage(i18n.t("customer_live.error.choose_property"));
      return;
    }

    if (timingPreference !== selectedTiming) {
      setSelectedTiming(timingPreference);
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);
    setProviderSearchState("loading");

    try {
      if (providerResults?.recommendationSessionId) {
        await trackWebEvent(MarketplaceTelemetryEventCatalog.recommendationDismissed, {
          recommendationSessionId: providerResults.recommendationSessionId,
          recommendedProviderId: providerResults.recommendedProviderId ?? "none",
          requestSource: activeRetentionOpportunity ? "customer-retention-nudge" : "customer-web-dashboard"
        });
      }

      const api = createAuthenticatedWebApiClient();
      const results = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedCategory],
        dateIso: buildDateIsoForCustomerTiming(timingPreference, selectedCustomDate, selectedCustomWindow),
        estimatedDurationMinutes: durationMinutes,
        requestSource: activeRetentionOpportunity ? "customer-retention-nudge" : "customer-web-dashboard",
        retentionPreference: getActiveRetentionPreference(),
        attribution: getLaunchAttributionContext()
      });
      setProviderResults(results);
      setShowAlternativeProviders(false);
      setProviderSearchState("loaded");
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.search_providers"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleSearchProviders() {
    await runProviderSearch(selectedTiming);
  }

  async function handleTryAnotherTiming(timingPreference: CustomerTimingPreference) {
    await runProviderSearch(timingPreference);
  }

  async function handleApplyRetentionOpportunity(opportunity: CustomerRetentionOpportunity) {
    const property = properties.find((candidate) => candidate.id === opportunity.propertyId);
    if (!property) {
      setErrorMessage(i18n.t("customer_live.error.saved_property_unavailable"));
      return;
    }

    setSelectedPropertyId(property.id);
    setSelectedCategory(opportunity.category);
    setSelectedCadence(opportunity.recommendedCadence);
    setSelectedTiming("tomorrow-morning");
    setShowAlternativeProviders(false);
    replaceDashboardSearchParams({ flow: "request" });
    setLoadingState("loading");
    setProviderSearchState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      await trackWebEvent(MarketplaceTelemetryEventCatalog.retentionPromptAccepted, {
        opportunityId: opportunity.id,
        opportunityKind: opportunity.kind,
        retentionStrategyKey: opportunity.strategyKey,
        retentionTrigger: opportunity.trigger,
        category: opportunity.category,
        daysSinceCompleted: opportunity.daysSinceCompleted,
        completedCategoryCount: opportunity.completedCategoryCount,
        sameProviderCompletedCount: opportunity.sameProviderCompletedCount,
        loyaltySegment: opportunity.loyaltySegment,
        recommendedCadence: opportunity.recommendedCadence,
        sourceBookingId: opportunity.sourceBookingId,
        providerId: opportunity.providerId,
        ...(opportunity.lastServiceGapDays !== undefined
          ? { lastServiceGapDays: opportunity.lastServiceGapDays }
          : {}),
        requestSource: "customer-retention-nudge"
      });

      const api = createAuthenticatedWebApiClient();
      setActiveRetentionOpportunity(opportunity);
      const nextQuote = await api.createInstantQuote({
        address: property.address,
        category: opportunity.category,
        propertyId: property.id
      });
      setQuote(nextQuote);

      const results = await api.searchProviders({
        address: property.address,
        categories: [opportunity.category],
        dateIso: buildDateIsoForCustomerTiming("tomorrow-morning"),
        estimatedDurationMinutes: nextQuote.estimatedDurationMinutes,
        requestSource: "customer-retention-nudge",
        retentionPreference:
          opportunity.providerContinuityStatus === "eligible"
            ? {
                priorProviderId: opportunity.providerId,
                sourceBookingId: opportunity.sourceBookingId,
                strategyKey: opportunity.strategyKey,
                trigger: opportunity.trigger,
                loyaltySegment: opportunity.loyaltySegment,
                completedCategoryCount: opportunity.completedCategoryCount,
                sameProviderCompletedCount: opportunity.sameProviderCompletedCount
              }
            : undefined,
        attribution: getLaunchAttributionContext()
      });

      setProviderResults(results);
      setProviderSearchState("loaded");
      setBookingMessage(
        opportunity.kind === "start-recurring-plan"
          ? i18n.t("customer_live.message.recurring_setup_ready")
          : i18n.t("customer_live.message.next_service_ready")
      );
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(
        error instanceof Error ? error.message : i18n.t("customer_live.error.prepare_followup")
      );
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleQueueNextRecurringPlan(summary: RecurringServicePlanSummary) {
    const property =
      properties.find((candidate) => candidate.id === summary.plan.servicePropertyId) ??
      properties.find(
        (candidate) =>
          candidate.address.line1 === summary.plan.serviceAddress.line1 &&
          candidate.address.postalCode === summary.plan.serviceAddress.postalCode
      );

    if (!property) {
      setErrorMessage(i18n.t("customer_live.error.saved_property_unavailable"));
      return;
    }

    setSelectedPropertyId(property.id);
    setSelectedCategory(summary.plan.category);
    setSelectedCadence(summary.plan.frequency);
    setSelectedTiming("tomorrow-morning");
    setShowAlternativeProviders(false);
    setActiveRetentionOpportunity(undefined);
    replaceDashboardSearchParams({ flow: "request" });
    setLoadingState("loading");
    setProviderSearchState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextQuote = await api.createInstantQuote({
        address: property.address,
        category: summary.plan.category,
        propertyId: property.id
      });
      setQuote(nextQuote);

      const results = await api.searchProviders({
        address: property.address,
        categories: [summary.plan.category],
        dateIso: buildDateIsoForCustomerTiming("tomorrow-morning"),
        estimatedDurationMinutes: nextQuote.estimatedDurationMinutes,
        requestSource: "customer-recurring-plan"
      });

      setProviderResults(results);
      setProviderSearchState("loaded");
      setBookingMessage(i18n.t("customer_live.message.next_repeat_ready"));
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(
        error instanceof Error ? error.message : i18n.t("customer_live.error.prepare_repeat")
      );
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCreateBooking(providerCard: (typeof providerCards)[number], rank: number) {
    if (!activeProperty) {
      setErrorMessage(i18n.t("customer_live.error.choose_property"));
      return;
    }

    const provider = providerCard.provider;
    const slot = providerCard.slot ?? providerResults?.suggestedSlots.find((candidate) => candidate.providerId === provider.id);
    if (!slot || !quote) {
      setErrorMessage(i18n.t("customer_live.error.pick_provider_slot"));
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const launchLeadId = getStoredLaunchLeadId();
      const requestSource = activeRetentionOpportunity ? "customer-retention-nudge" : "customer-web-dashboard";
      const retentionContext = activeRetentionOpportunity
        ? {
            opportunityId: activeRetentionOpportunity.id,
            sourceBookingId: activeRetentionOpportunity.sourceBookingId,
            kind: activeRetentionOpportunity.kind,
            strategyKey: activeRetentionOpportunity.strategyKey,
            trigger: activeRetentionOpportunity.trigger
          }
        : undefined;
      if (selectedCadence === "one-time") {
        await api.createBooking({
          providerId: provider.id,
          launchLeadId,
          serviceAddress: activeProperty.address,
          servicePropertyId: activeProperty.id,
          category: selectedCategory,
          scheduledStartIso: slot.startIso,
          scheduledEndIso: slot.endIso,
          notes: "Requested from the live YardMatch customer dashboard.",
          totalCents: quote.estimatedPriceCents,
          quoteToken: quote.quoteToken,
          recommendationSessionId: providerResults?.recommendationSessionId,
          recommendedProviderId: providerResults?.recommendedProviderId,
          selectedProviderRank: rank,
          viewedAlternativeProviders: showAlternativeProviders,
          requestSource,
          recommendationSource: requestSource,
          retentionContext,
          attribution: getLaunchAttributionContext()
        });
        setBookingMessage(
          i18n.t("customer_live.message.booking_requested", {
            provider: provider.companyName,
            window: formatBookingWindowSummary(slot.startIso)
          })
        );
      } else {
        const recurringPlan = await api.createRecurringServicePlan({
          providerId: provider.id,
          launchLeadId,
          serviceAddress: activeProperty.address,
          servicePropertyId: activeProperty.id,
          category: selectedCategory,
          scheduledStartIso: slot.startIso,
          scheduledEndIso: slot.endIso,
          notes: "Recurring service plan started from the live YardMatch customer dashboard.",
          totalCents: quote.estimatedPriceCents,
          quoteToken: quote.quoteToken,
          frequency: selectedCadence,
          recommendationSessionId: providerResults?.recommendationSessionId,
          recommendedProviderId: providerResults?.recommendedProviderId,
          selectedProviderRank: rank,
          viewedAlternativeProviders: showAlternativeProviders,
          requestSource,
          recommendationSource: requestSource,
          retentionContext,
          attribution: getLaunchAttributionContext()
        });
        setBookingMessage(
          i18n.t("customer_live.message.recurring_started", {
            cadence: formatRecurringFrequency(i18n, selectedCadence).toLowerCase(),
            provider: provider.companyName,
            window: formatBookingWindowSummary(recurringPlan.initialBooking.scheduledStartIso)
          })
        );
      }
      await loadDashboard();
      setActiveRetentionOpportunity(undefined);
      setQuote(undefined);
      setProviderResults(undefined);
      setShowAlternativeProviders(false);
      setProviderSearchState("idle");
      replaceDashboardSearchParams({ flow: undefined });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.create_booking"));
    } finally {
      setLoadingState("idle");
    }
  }

  function getProviderSelectionRank(providerId: string, fallbackRank: number) {
    const rankedIndex = providerResults?.rankedProviders.findIndex((result) => result.provider.id === providerId) ?? -1;
    return rankedIndex >= 0 ? rankedIndex + 1 : fallbackRank;
  }

  async function handleStartCheckout(booking: Booking) {
    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const checkout = await api.createCheckoutSession({
        bookingId: booking.id,
        successPath: "/customer/dashboard?payment=stripe-success",
        cancelPath: "/customer/dashboard?payment=stripe-cancelled"
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : i18n.t("customer_live.error.open_checkout")
      );
      setLoadingState("idle");
    }
  }

  async function handleSubmitReview(opportunity: CustomerReviewOpportunity) {
    const reviewText = (reviewDrafts[opportunity.bookingId] ?? "").trim();
    const rating = getReviewRating(opportunity.bookingId);

    if (!reviewText) {
      setErrorMessage(i18n.t("customer_live.error.review_note_required"));
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createProviderReview({
        bookingId: opportunity.bookingId,
        overallRating: rating,
        timelinessRating: rating,
        attentionToDetailRating: rating,
        reviewText,
        attribution: getLaunchAttributionContext()
      });
      setReviewComposerBookingId(undefined);
      setReviewDrafts((current) => {
        const next = { ...current };
        delete next[opportunity.bookingId];
        return next;
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.submit_review"));
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
      setBookingMessage(i18n.t("customer_live.message.booking_cancelled"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.cancel_booking"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCancelRecurringPlan(planId: string) {
    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.cancelRecurringServicePlan({
        planId,
        reason: i18n.t("customer_live.cancel_plan.reason")
      });
      setBookingMessage(i18n.t("customer_live.message.recurring_cancelled"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : i18n.t("customer_live.error.cancel_recurring")
      );
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRescheduleBooking(bookingId: string) {
    const draft = rescheduleDrafts[bookingId];
    if (!draft) {
      setErrorMessage(i18n.t("customer_live.error.pick_reschedule_time"));
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
      setBookingMessage(i18n.t("customer_live.message.booking_rescheduled"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.reschedule_booking"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleOpenDispute(bookingId: string) {
    const reason = (disputeDrafts[bookingId] ?? "").trim();
    if (!reason) {
      setErrorMessage(i18n.t("customer_live.error.dispute_reason_required"));
      return;
    }

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createBookingDispute({
        bookingId,
        reason
      });
      setBookingMessage(i18n.t("customer_live.message.dispute_opened"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_dispute"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRequestRefundReview(bookingId: string) {
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

    setLoadingState("loading");
    setErrorMessage(undefined);
    setBookingMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.createRefund({
        paymentId: payment.id,
        reason
      });
      setBookingMessage(i18n.t("customer_live.message.refund_review_requested"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.request_refund"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.open_chat"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function openArrivalTracking(bookingId: string) {
    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const tracking = await api.getBookingTracking(bookingId);
      setActiveTrackingBookingId(bookingId);
      setActiveTracking(tracking);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.load_tracking"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.send_message"));
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCustomerPropertyPhoto(bookingId: string, file: File) {
    setLoadingState("loading");
    setErrorMessage(undefined);

    try {
      const imageDataUrl = await readEvidenceImage(file);
      const api = createAuthenticatedWebApiClient();
      const updatedBooking = await api.addBookingEvidence({
        bookingId,
        phase: "before",
        imageDataUrl,
        photoArea: photoAreaByBookingId[bookingId] ?? "lawn",
        note: photoNoteByBookingId[bookingId]?.trim() || undefined
      });
      setBookings((current) =>
        current.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking))
      );
      setPhotoNoteByBookingId((current) => ({ ...current, [bookingId]: "" }));
      setBookingMessage(i18n.t("customer_live.photos.uploaded"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.photos.upload_error"));
    } finally {
      setLoadingState("idle");
    }
  }

  if (
    !sessionReady ||
    (!historyOnlyView &&
      !accessDenied &&
      isLoadingDashboard &&
      !dashboardLoadError &&
      !customer &&
      properties.length === 0 &&
      bookings.length === 0)
  ) {
    return (
      <section className="container stack-lg">
        <LoadingSkeleton
          cardCount={3}
          className="grid-three"
          label={i18n.t("customer_live.loading_account")}
          showAction
        />
      </section>
    );
  }

  if (accessDenied) {
    return (
      <main className="container stack-lg">
        <section className="card">
          <h2>{i18n.t("customer_live.login_required.title")}</h2>
          <p>{i18n.t("customer_live.login_required.body")}</p>
          <div className="cta-row">
            <a className="button-secondary" href={addLocalePrefix("/customer", i18n.locale)}>
              {i18n.t("customer_history.request_service")}
            </a>
            <a className="button" href={addLocalePrefix("/login/customer", i18n.locale)}>
              {i18n.t("nav.log_in")}
            </a>
          </div>
        </section>
      </main>
    );
  }

  function getPaymentRecord(bookingId: string) {
    return paymentsByBookingId[bookingId];
  }

  function getReviewRating(bookingId: string): ReviewScore {
    return reviewRatings[bookingId] ?? 5;
  }

  function renderRequestDetailsEditor(buttonLabel: string) {
    return (
      <>
        <p>{i18n.t("customer_live.request_editor.body")}</p>
        <div className="form-grid">
          <label className="form-field">
            <span>{i18n.t("customer_live.label.property")}</span>
            <select onChange={(event) => setSelectedPropertyId(event.target.value)} value={selectedPropertyId}>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{i18n.t("customer_live.label.service")}</span>
            <select
              onChange={(event) => setSelectedCategory(event.target.value as ServiceCategory)}
              value={selectedCategory}
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {i18n.t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{i18n.t("customer_live.label.when")}</span>
            <select
              onChange={(event) => setSelectedTiming(event.target.value as CustomerTimingPreference)}
              value={selectedTiming}
            >
              {dashboardTimingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelKey ? i18n.t(option.labelKey) : option.label ?? option.value}
                </option>
              ))}
            </select>
          </label>
          {selectedTiming === "custom-date" ? (
            <>
              <label className="form-field">
                <span>{i18n.t("customer_live.label.date")}</span>
                <input
                  min={getMinimumCustomerCustomDateString()}
                  onChange={(event) => setSelectedCustomDate(event.target.value)}
                  type="date"
                  value={selectedCustomDate}
                />
              </label>
              <label className="form-field">
                <span>{i18n.t("customer_live.label.window")}</span>
                <select
                  onChange={(event) => setSelectedCustomWindow(event.target.value as CustomerCustomTimingWindow)}
                  value={selectedCustomWindow}
                >
                  {customerCustomTimingWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {i18n.t(customerWindowLabelKey(option.value))}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="form-field">
            <span>{i18n.t("customer_live.label.cadence")}</span>
            <select
              onChange={(event) => setSelectedCadence(event.target.value as "one-time" | RecurringServiceFrequency)}
              value={selectedCadence}
            >
              <option value="one-time">{i18n.t("customer_live.cadence.one_time")}</option>
              <option value="weekly">{i18n.t("customer_live.cadence.weekly")}</option>
              <option value="biweekly">{i18n.t("customer_live.cadence.biweekly")}</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <button className="button" disabled={loadingState === "loading"} onClick={handleQuote} data-analytics-action="request-price-and-match" type="button">
            {loadingState === "loading" ? i18n.t("customer_live.working") : buttonLabel}
          </button>
        </div>
        {activeProperty ? (
          <p>
            {activeProperty.address.line1}, {activeProperty.address.city}, {activeProperty.address.state} •{" "}
            {timingLabel}
          </p>
        ) : null}
      </>
    );
  }

  function renderRequestProgress() {
    return (
      <section className="customer-request-spine" aria-label={i18n.t("customer_live.request_progress_aria")}>
        <ol className="customer-request-spine__steps">
          {requestProgressSteps.map((step, index) => (
            <li
              aria-current={step.status === "current" ? "step" : undefined}
              className={`customer-request-spine__step customer-request-spine__step--${step.status}`}
              key={step.label}
            >
              <span className="customer-request-spine__index">{index + 1}</span>
              <div>
                <strong>{step.label}</strong>

              </div>
            </li>
          ))}
        </ol>
        <details><summary>{selectedServiceLabel} · {timingLabel} — {i18n.t("journey.change_details")}</summary>
        <div className="customer-request-spine__summary" aria-label={i18n.t("customer_listings_hero.current_request")}>
          <div>
            <span>{i18n.t("customer_live.label.service")}</span>
            <strong>{selectedServiceLabel}</strong>
          </div>
          <div>
            <span>{i18n.t("customer_live.label.when")}</span>
            <strong>{timingLabel}</strong>
          </div>
          <div>
            <span>{i18n.t("customer_live.label.property")}</span>
            <strong>{activeProperty?.label ?? i18n.t("customer_live.choose_property")}</strong>
          </div>
          <div>
            <span>{i18n.t("customer_live.progress.price")}</span>
            <strong>{quote ? i18n.formatCurrency(quote.estimatedPriceCents) : i18n.t("customer_live.after_details")}</strong>
          </div>
        </div></details>
      </section>
    );
  }

  function renderActiveBookingCard(booking: Booking) {
    const providerName = providerNamesById[booking.providerId] ?? i18n.t("market.home.provider.landscaping_business");
    const paymentRecord = getPaymentRecord(booking.id);
    const paymentLabel = getBookingPaymentLabel(booking, paymentRecord);
    const canEditVisit = booking.status === "requested" || booking.status === "confirmed";
    const canStartCheckout = booking.status === "confirmed" && !["captured", "processing", "refunded"].includes(paymentRecord?.status ?? "");
    const canOpenDispute = booking.status !== "requested";
    const canReviewRefund =
      canRequestRefundReview(booking, paymentRecord) ||
      paymentRecord?.refundReviewStatus === "requested" ||
      paymentRecord?.refundReviewStatus === "denied";

    return (
      <article className="history-card">
        <div className="history-card__header">
          <div>
            <span className="eyebrow">{booking.category.replaceAll("-", " ")}</span>
            <h2>{formatBookingStatusTitle(i18n, booking)}</h2>
            <p>{providerName}</p>
          </div>
          <strong>{i18n.formatCurrency(booking.totalCents)}</strong>
        </div>
        <p className="history-card__summary">{getBookingStateMessage(i18n, booking, providerName, paymentRecord)}</p>
        <div className="chip-row">
          <span className="result-badge result-badge--neutral">
            {formatBookingWindowSummary(booking.scheduledStartIso)}
          </span>
          <span className="result-badge result-badge--neutral">{paymentLabel}</span>
        </div>
        {canStartCheckout ? <PaymentMethodGuide returningCustomer={bookings.some(visit => visit.status === "completed")} /> : null}
        <div className="cta-row">
          {canEditVisit && canStartCheckout ? (
            <button
              className="button"
              disabled={loadingState === "loading"}
              data-analytics-action="start-checkout" onClick={() => void handleStartCheckout(booking)}
              type="button"
            >
              {paymentRecord?.status === "pending"
                ? i18n.t("customer_live.action.continue_checkout")
                : i18n.t("customer_live.action.pay_now")}
            </button>
          ) : null}
          {booking.onRouteConfirmedAt ? (
            <>
              <button
                className="button-secondary"
                disabled={loadingState === "loading"}
                onClick={() => void openCustomerChat(booking.id)}
              type="button"
            >
                {i18n.t("customer_live.action.message_business")}
              </button>
              <button
                className="button-secondary"
                disabled={loadingState === "loading"}
                onClick={() => void openArrivalTracking(booking.id)}
              type="button"
            >
                {i18n.t("customer_live.action.track_crew")}
              </button>
            </>
          ) : null}
          <a
            className="button-secondary"
            href={addLocalePrefix(
              `/help?bookingId=${encodeURIComponent(booking.id)}&issueType=${encodeURIComponent(
                booking.onRouteConfirmedAt || booking.activeExceptionType ? "service-quality" : "general"
              )}&subject=${encodeURIComponent(
                booking.onRouteConfirmedAt
                  ? i18n.t("customer_live.subject.on_route")
                  : booking.activeExceptionType
                    ? getBookingExceptionLabel(booking.activeExceptionType)
                    : i18n.t("customer_live.subject.booking")
              )}`,
              i18n.locale
            )}
          >
            {i18n.t("crew_live.action.get_help")}
          </a>
        </div>
        <BookingSchedulePanel booking={booking} bookingId={booking.id} onUpdated={loadDashboard} />
        {!booking.scheduleUpdates?.length && booking.lateEtaIso && !booking.onRouteConfirmedAt ? (
          <div className="list-panel" style={{ marginTop: "1rem" }}>
            <h3>{i18n.t("customer_live.active_booking.delay_update")}</h3>
            <p>{i18n.t("customer_live.active_booking.running_behind", { provider: providerName })}</p>
            <p>
              {i18n.t("customer_live.active_booking.new_target", { eta: formatEta(i18n, booking.lateEtaIso) })}
              {booking.lateReason ? ` ${booking.lateReason}` : ""}
            </p>
          </div>
        ) : null}
        {booking.activeExceptionType ? (
          <div className="list-panel" style={{ marginTop: "1rem" }}>
            <h3>{getBookingExceptionLabel(booking.activeExceptionType)}</h3>
            <p>{i18n.t("customer_live.active_booking.flagged_issue", { provider: providerName })}</p>
            <p>
              {booking.activeExceptionNotes ??
                i18n.t("customer_live.active_booking.check_support")}
            </p>
          </div>
        ) : null}
        {activeTrackingBookingId === booking.id && activeTracking ? (
          <ArrivalTrackingPanel subtitle={providerName} title={i18n.t("customer_live.status.crew_on_way")} tracking={activeTracking} />
        ) : null}
        {canEditVisit ? (
          <section className="service-photo-panel" aria-label={i18n.t("customer_live.photos.title")}>
            <div>
              <h3>{i18n.t("customer_live.photos.title")}</h3>
              <p>{i18n.t("customer_live.photos.body")}</p>
            </div>
            <div className="form-grid service-photo-panel__form">
              <label className="form-field">
                <span>{i18n.t("customer_live.photos.area_label")}</span>
                <select
                  onChange={(event) =>
                    setPhotoAreaByBookingId((current) => ({
                      ...current,
                      [booking.id]: event.target.value as PropertyPhotoArea
                    }))
                  }
                  value={photoAreaByBookingId[booking.id] ?? "lawn"}
                >
                  {propertyPhotoAreaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {i18n.t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{i18n.t("customer_live.photos.note_label")}</span>
                <input
                  maxLength={240}
                  onChange={(event) =>
                    setPhotoNoteByBookingId((current) => ({
                      ...current,
                      [booking.id]: event.target.value
                    }))
                  }
                  placeholder={i18n.t("customer_live.photos.note_placeholder")}
                  value={photoNoteByBookingId[booking.id] ?? ""}
                />
              </label>
            </div>
            <label className="button-secondary evidence-upload-button">
              <span>{i18n.t("customer_live.photos.add")}</span>
              <input
                accept="image/*"
                aria-label={i18n.t("customer_live.photos.add")}
                capture="environment"
                className="visually-hidden"
                disabled={loadingState === "loading"}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) {
                    return;
                  }
                  void handleCustomerPropertyPhoto(booking.id, file).finally(() => {
                    input.value = "";
                  });
                }}
                type="file"
              />
            </label>
            {booking.serviceEvidence.some(
              (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo"
            ) ? (
              <div className="service-photo-strip">
                {booking.serviceEvidence
                  .filter((evidence) => evidence.phase === "before" && evidence.evidenceType === "photo" && evidence.imageDataUrl)
                  .map((evidence) => (
                    <figure key={evidence.id}>
                      <img alt={i18n.t("customer_live.photos.before_alt")} src={evidence.imageDataUrl} />
                      <figcaption>
                        {i18n.t(
                          propertyPhotoAreaOptions.find((option) => option.value === evidence.photoArea)?.labelKey ??
                            "photo.area.other"
                        )}
                      </figcaption>
                    </figure>
                  ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">{i18n.t("customer_live.active_booking.visit_details")}</summary>
          <div className="service-card-disclosure__body">
            <div className="history-card__grid">
              <div>
                <h3>{i18n.t("common.label.address")}</h3>
                <p>{booking.serviceAddress.line1}</p>
                <p>
                  {booking.serviceAddress.city}, {booking.serviceAddress.state}{" "}
                  {booking.serviceAddress.postalCode}
                </p>
              </div>
              <div>
                <h3>{i18n.t("crew_signup.schedule")}</h3>
                <p>{formatBookingWindowSummary(booking.scheduledStartIso)}</p>
                <p>{formatDateTime(i18n, booking.scheduledStartIso)}</p>
              </div>
              <div>
                <h3>{i18n.t("customer_live.label.notes")}</h3>
                <p>{booking.notes || i18n.t("customer_live.no_extra_notes")}</p>
              </div>
              <div>
                <h3>{i18n.t("customer_live.label.payment")}</h3>
                <p>{getPaymentLabel(paymentRecord)}</p>
                {paymentRecord?.paidAt ? <p>{formatDateTime(i18n, paymentRecord.paidAt)}</p> : null}
              </div>
            </div>
            {canEditVisit ? (
              <>
                <p className="history-card__detail-copy">
                  {i18n.t("customer_live.active_booking.change_copy")}
                </p>
                <div className="form-grid">
                  <label className="form-field">
                    <span>{i18n.t("customer_live.active_booking.new_start")}</span>
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
                      value={
                        rescheduleDrafts[booking.id]?.start ??
                        toDateTimeLocalValue(booking.scheduledStartIso)
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>{i18n.t("customer_live.active_booking.new_end")}</span>
                    <input
                      onChange={(event) =>
                        setRescheduleDrafts((current) => ({
                          ...current,
                          [booking.id]: {
                            start:
                              current[booking.id]?.start ??
                              toDateTimeLocalValue(booking.scheduledStartIso),
                            end: event.target.value
                          }
                        }))
                      }
                      type="datetime-local"
                      value={
                        rescheduleDrafts[booking.id]?.end ?? toDateTimeLocalValue(booking.scheduledEndIso)
                      }
                    />
                  </label>
                </div>
                <div className="cta-row">
                  <button
                    className="button-secondary"
                    disabled={loadingState === "loading"}
                    onClick={() => void handleRescheduleBooking(booking.id)}
                    type="button"
                  >
                    {i18n.t("customer_live.action.reschedule")}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={loadingState === "loading"}
                    onClick={() => void handleCancelBooking(booking.id)}
                    type="button"
                  >
                    {i18n.t("customer_live.action.cancel_booking")}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </details>
        {canOpenDispute || canReviewRefund ? (
          <details className="service-card-disclosure">
            <summary className="service-card-disclosure__summary">{i18n.t("customer_live.billing_support")}</summary>
            <div className="service-card-disclosure__body">
              {canOpenDispute ? (
                <div className="list-panel">
                  <h3>{i18n.t("customer_live.dispute.title")}</h3>
                  <p>{i18n.t("customer_live.dispute.body")}</p>
                  <div className="form-grid" style={{ marginTop: "1rem" }}>
                    <label className="form-field form-field--full">
                      <span>{i18n.t("customer_live.dispute.reason")}</span>
                      <textarea
                        rows={3}
                        value={disputeDrafts[booking.id] ?? ""}
                        onChange={(event) =>
                          setDisputeDrafts((current) => ({
                            ...current,
                            [booking.id]: event.target.value
                          }))
                        }
                        placeholder={i18n.t("customer_live.dispute.placeholder")}
                      />
                    </label>
                  </div>
                  <div className="cta-row" style={{ marginTop: "1rem" }}>
                    <button
                      className="button-secondary"
                      disabled={loadingState === "loading"}
                      onClick={() => void handleOpenDispute(booking.id)}
                      type="button"
                    >
                      {i18n.t("customer_live.action.open_dispute")}
                    </button>
                  </div>
                </div>
              ) : null}
              {canReviewRefund ? (
                <div className="list-panel">
                  <h3>{i18n.t("customer_live.refund.title")}</h3>
                  <a className="button" href={addLocalePrefix(`/help?bookingId=${encodeURIComponent(booking.id)}`, i18n.locale)}>{i18n.t("complaint.title")}</a>
                  <p>
                    {paymentRecord?.refundReviewStatus === "requested"
                      ? i18n.t("customer_live.refund.reviewing")
                      : paymentRecord?.refundReviewStatus === "denied"
                        ? i18n.t("customer_live.refund.denied", {
                            notes: paymentRecord?.refundDecisionNotes ? ` ${paymentRecord.refundDecisionNotes}` : ""
                          })
                        : i18n.t("customer_live.refund.body")}
                  </p>
                  {paymentRecord?.refundReviewStatus !== "requested" ? (
                    <>
                      <div className="form-grid" style={{ marginTop: "1rem" }}>
                        <label className="form-field form-field--full">
                          <span>{i18n.t("customer_live.refund.reason")}</span>
                          <textarea
                            rows={3}
                            value={refundDrafts[booking.id] ?? ""}
                            onChange={(event) =>
                              setRefundDrafts((current) => ({
                                ...current,
                                [booking.id]: event.target.value
                              }))
                            }
                            placeholder={i18n.t("customer_live.refund.placeholder")}
                          />
                        </label>
                      </div>
                      <div className="cta-row" style={{ marginTop: "1rem" }}>
                        <button
                          className="button-secondary"
                          disabled={loadingState === "loading" || !canRequestRefundReview(booking, paymentRecord)}
                          onClick={() => void handleRequestRefundReview(booking.id)}
                          type="button"
                        >
                          {i18n.t("customer_live.action.request_refund_review")}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </article>
    );
  }

  function renderReviewOpportunityCard(
    opportunity: CustomerReviewOpportunity,
    variant: "card" | "panel" = "panel"
  ) {
    const composerOpen = reviewComposerBookingId === opportunity.bookingId;
    const selectedRating = getReviewRating(opportunity.bookingId);

    return (
      <article className={`${variant === "card" ? "card" : "list-panel"} customer-review-card`}>
        <div className="search-result-title">
          <div>
            <span className="eyebrow">{i18n.t("customer_live.review.ready")}</span>
            <h2>{opportunity.providerName}</h2>
            <p>{opportunity.reason}</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">
              {i18n.t(serviceCategoryToI18nKey(opportunity.category))}
            </span>
            {opportunity.completedAt ? (
              <span className="result-badge result-badge--neutral">
                {formatDateTime(i18n, opportunity.completedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="customer-review-card__grid" aria-label={i18n.t("customer_live.review.summary_aria")}>
          <div>
            <span>{i18n.t("customer_live.label.service")}</span>
            <strong>{i18n.t(serviceCategoryToI18nKey(opportunity.category))}</strong>
          </div>
          <div>
            <span>{i18n.t("customer_live.review.completed")}</span>
            <strong>{opportunity.completedAt ? formatDateTime(i18n, opportunity.completedAt) : i18n.t("customer_live.recently")}</strong>
          </div>
          <div>
            <span>{i18n.t("customer_live.review.rating")}</span>
            <strong>{selectedRating}/5</strong>
          </div>
        </div>
        {composerOpen ? (
          <div className="customer-review-card__composer">
            <div>
              <span className="eyebrow">{i18n.t("customer_live.review.rating")}</span>
              <div className="chip-row" role="group" aria-label={i18n.t("customer_live.review.choose_rating_aria")}>
                {([5, 4, 3, 2, 1] as ReviewScore[]).map((rating) => {
                  const active = rating === selectedRating;
                  return (
                    <button
                      aria-pressed={active}
                      className={
                        active
                          ? "button customer-review-card__rating"
                          : "button-secondary customer-review-card__rating"
                      }
                      key={`${opportunity.bookingId}-${rating}`}
                      onClick={() =>
                        setReviewRatings((current) => ({
                          ...current,
                          [opportunity.bookingId]: rating
                        }))
                      }
                      type="button"
                    >
                      {rating}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              onChange={(event) =>
                setReviewDrafts((current) => ({
                  ...current,
                  [opportunity.bookingId]: event.target.value
                }))
              }
              placeholder={i18n.t("customer_live.review.placeholder")}
              rows={3}
              value={reviewDrafts[opportunity.bookingId] ?? ""}
            />
          </div>
        ) : null}
        <div className="cta-row">
          {composerOpen ? (
            <>
              <button
                className="button"
                disabled={loadingState === "loading"}
                onClick={() => void handleSubmitReview(opportunity)}
                type="button"
              >
                {i18n.t("customer_live.review.send")}
              </button>
              <button
                className="button-secondary"
                onClick={() => setReviewComposerBookingId(undefined)}
                type="button"
              >
                {i18n.t("customer_live.review.not_now")}
              </button>
            </>
          ) : (
            <button
              className="button"
              onClick={() => setReviewComposerBookingId(opportunity.bookingId)}
              type="button"
            >
              {i18n.t("customer_live.review.leave")}
            </button>
          )}
        </div>
      </article>
    );
  }

  function renderRecurringPlanCard(summary: RecurringServicePlanSummary) {
    return (
      <article className="list-panel">
        <div className="search-result-title">
          <div>
            <h3>{summary.providerName}</h3>
            <p>{i18n.t("customer_live.plan.category_plan", { category: i18n.t(serviceCategoryToI18nKey(summary.plan.category)) })}</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">{i18n.t("customer_live.plan.active")}</span>
            <span className="result-badge">{formatRecurringFrequency(i18n, summary.plan.frequency)}</span>
          </div>
        </div>
        {summary.upcomingBooking ? (
          <p>
            {i18n.t("customer_live.plan.next_visit", {
              window: formatBookingWindowSummary(summary.upcomingBooking.scheduledStartIso),
              date: formatDateTime(i18n, summary.upcomingBooking.scheduledStartIso)
            })}
          </p>
        ) : (
          <p>{i18n.t("customer_live.plan.no_queued_visit")}</p>
        )}
        <p>{i18n.t("customer_live.plan.visit_counts", {
          completed: summary.completedOccurrenceCount,
          active: summary.activeOccurrenceCount
        })}</p>
        {summary.plan.lastSchedulingError ? <p>{summary.plan.lastSchedulingError}</p> : null}
        {summary.plan.status === "active" ? (
          <div className="cta-row">
            {!summary.upcomingBooking ? (
              <button
                className="button"
                disabled={loadingState === "loading"}
                onClick={() => void handleQueueNextRecurringPlan(summary)}
                type="button"
              >
                {i18n.t("customer_live.plan.queue_next")}
              </button>
            ) : null}
            <button
              className="button-secondary"
              disabled={loadingState === "loading"}
              onClick={() => void handleCancelRecurringPlan(summary.plan.id)}
              type="button"
            >
              {i18n.t("customer_live.plan.cancel")}
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  function renderRetentionOpportunityCard(opportunity: CustomerRetentionOpportunity) {
    return (
      <article className="list-panel">
        <div className="search-result-title">
          <div>
            <h3>{opportunity.title}</h3>
            <p>
              {opportunity.providerName} • {i18n.t(serviceCategoryToI18nKey(opportunity.category))}
            </p>
          </div>
          <span className="result-badge">
            {opportunity.recommendedCadence === "one-time"
              ? i18n.t("customer_live.retention.one_time_rebook")
              : formatRecurringFrequency(i18n, opportunity.recommendedCadence)}
          </span>
          <span className="result-badge">{formatRetentionTrigger(i18n, opportunity.trigger)}</span>
          <span className="result-badge">{formatRetentionLoyaltyLabel(i18n, opportunity.loyaltySegment)}</span>
        </div>
        <p>{opportunity.message}</p>
        <p>
          {i18n.t("customer_live.retention.last_completed", {
            date: formatDateTime(i18n, opportunity.completedAt),
            count: opportunity.daysSinceCompleted
          })}
        </p>
        <p>{i18n.t("customer_live.retention.property_history", {
          count: opportunity.completedCategoryCount,
          category: i18n.t(serviceCategoryToI18nKey(opportunity.category)),
          sameProviderCount: opportunity.sameProviderCompletedCount,
          provider: opportunity.providerName,
          gapDays: opportunity.lastServiceGapDays ?? 0
        })}</p>
        <div className="cta-row">
          <button
            className="button-secondary"
            disabled={loadingState === "loading"}
            onClick={() => void handleApplyRetentionOpportunity(opportunity)}
            type="button"
          >
            {opportunity.actionLabel}
          </button>
        </div>
      </article>
    );
  }

  function renderPastRecurringPlanCard(summary: RecurringServicePlanSummary) {
    return (
      <article className="list-panel">
        <div className="search-result-title">
          <div>
            <h3>{summary.providerName}</h3>
            <p>{i18n.t("customer_live.plan.category_plan", { category: i18n.t(serviceCategoryToI18nKey(summary.plan.category)) })}</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">{i18n.t("customer_live.plan.cancelled")}</span>
            <span className="result-badge">{formatRecurringFrequency(i18n, summary.plan.frequency)}</span>
          </div>
        </div>
        <p>{i18n.t("customer_live.plan.no_longer_running")}</p>
        <p>{i18n.t("customer_live.plan.completed_count", { count: summary.completedOccurrenceCount })}</p>
      </article>
    );
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
      if (payment.refundedAmountCents) return `${i18n.t("complaint.partially_refunded")} · ${i18n.formatCurrency(payment.refundedAmountCents, payment.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return i18n.t("customer_history.payment.paid");
    }

    if (payment.status === "processing") return i18n.t("payments.processing.title");

    if (payment.status === "pending") {
      return i18n.t("customer_live.payment.awaiting_checkout");
    }

    if (payment.status === "failed") {
      return i18n.t("customer_live.payment.needs_attention");
    }

    if (payment.status === "refunded") {
      return i18n.t("customer_history.payment.refunded");
    }

    return i18n.t("customer_live.payment.on_file");
  }

  function getBookingPaymentLabel(booking: Booking, payment?: PaymentRecord) {
    if (booking.status === "requested" && payment?.status !== "captured") {
      return i18n.t("customer_live.payment.after_provider_confirms");
    }

    if (booking.status === "confirmed" && !payment) {
      return i18n.t("customer_live.payment.ready_for_checkout");
    }

    return getPaymentLabel(payment);
  }

  function canRequestRefundReview(booking: Booking, payment?: PaymentRecord) {
    return booking.status === "completed" && payment?.status === "captured" && payment.refundable;
  }

  const accountViews = [
    { href: "/customer/dashboard", labelKey: "nav.user.account", view: "account" },
    { href: "/customer/dashboard?view=history", labelKey: "nav.user.past_visits", view: "history" }
  ] satisfies Array<{ href: string; labelKey: TranslationKey; view: "account" | "history" }>;

  if (historyOnlyView) {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <h1>{i18n.t("nav.user.past_visits")}</h1>
          <p>{i18n.t("customer_live.past_visits.body")}</p>
        </section>

        <nav aria-label={i18n.t("customer_live.account_sections_aria")} className="dashboard-switcher">
          {accountViews.map((item) => (
            <a
              className={`dashboard-switcher__link${dashboardView === item.view ? " dashboard-switcher__link--active" : ""}`}
              href={addLocalePrefix(item.href, i18n.locale)}
              key={item.view}
            >
              {i18n.t(item.labelKey)}
            </a>
          ))}
        </nav>

        <CustomerHistoryBoard />
      </main>
    );
  }

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        {requestFlowActive ? (
          <div className="search-result-title">
            <div>
              <h1>{i18n.t("customer_history.request_service")}</h1>
              <p>{i18n.t("customer_live.request_service.body")}</p>
            </div>
            <a className="button-secondary" href={addLocalePrefix("/customer/dashboard", i18n.locale)}>
              {i18n.t("customer_live.back_to_account")}
            </a>
          </div>
        ) : (
          <>
            <h1>{i18n.t("customer_live.welcome_back", { name: customer?.fullName?.split(" ")[0] ?? i18n.t("customer_live.there") })}</h1>
            <p>{i18n.t("customer_live.account.body")}</p>
          </>
        )}
      </section>

      {!requestFlowActive ? (
        <nav aria-label={i18n.t("customer_live.account_sections_aria")} className="dashboard-switcher">
          {accountViews.map((item) => (
            <a
              className={`dashboard-switcher__link${dashboardView === item.view ? " dashboard-switcher__link--active" : ""}`}
              href={addLocalePrefix(item.href, i18n.locale)}
              key={item.view}
            >
              {i18n.t(item.labelKey)}
            </a>
          ))}
        </nav>
      ) : null}

      {bookingMessage ? (
        <section className="card">
          <div className="search-result-title">
            <div>
              <h2>{i18n.t(bookingMessage === i18n.t("payments.pending.body") ? "customer_live.payment.awaiting_checkout" : "customer_live.done")}</h2>
              <p>{bookingMessage}</p>
            </div>
            <button className="button-secondary" onClick={() => setBookingMessage(undefined)} type="button">
              {i18n.t("customer_live.dismiss")}
            </button>
          </div>
        </section>
      ) : null}

      {dashboardLoadError ? (
        <section className="card">
          <h2>{i18n.t("customer_live.account_load_error")}</h2>
          <p>{dashboardLoadError}</p>
          <div className="cta-row">
            <button className="button" disabled={isLoadingDashboard} onClick={() => void loadDashboard()} type="button">
              {isLoadingDashboard ? i18n.t("common.actions.trying_again") : i18n.t("common.actions.try_again")}
            </button>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <div className="search-result-title">
            <div>
              <h2>{i18n.t("customer_live.action_error")}</h2>
              <p>{errorMessage}</p>
            </div>
            <button className="button-secondary" onClick={() => setErrorMessage(undefined)} type="button">
              {i18n.t("customer_live.dismiss")}
            </button>
          </div>
        </section>
      ) : null}

      {requestFlowActive ? (
        <>
          {renderRequestProgress()}

          <section className="stack-lg">
            <article className="card">
              <div className="search-result-title">
                <div>
                  <h2>{i18n.t("customer_live.service_details")}</h2>
                  {quote ? (
                    <p>
                      {selectedServiceLabel} • {timingLabel} • {selectedCadenceLabel}
                    </p>
                  ) : null}
                </div>
                {quote && activeProperty ? (
                  <span className="result-badge result-badge--neutral">{activeProperty.label}</span>
                ) : null}
              </div>
              {quote ? (
                <>
                  {activeProperty ? (
                    <p>
                      {activeProperty.address.line1}, {activeProperty.address.city}, {activeProperty.address.state}
                    </p>
                  ) : null}
                  <details className="service-card-disclosure">
                    <summary className="service-card-disclosure__summary">{i18n.t("customer_live.action.change_details")}</summary>
                    <div className="service-card-disclosure__body">{renderRequestDetailsEditor(i18n.t("customer_live.refresh_price"))}</div>
                  </details>
                </>
              ) : (
                renderRequestDetailsEditor(i18n.t("customer_live.get_price"))
              )}
            </article>

            {quote ? (
              <article className="card">
                <div className="search-result-title">
                  <div>
                    <h2>{i18n.t("customer_live.progress.price")}</h2>
                    <p>{quote.estimateSummary}</p>
                  </div>
                  <strong>{i18n.formatCurrency(quote.estimatedPriceCents)}</strong>
                </div>
                <div className="customer-request-summary-grid" aria-label={i18n.t("customer_live.price_summary_aria")}>
                  <div>
                    <span>{i18n.t("customer_live.price.visit")}</span>
                    <strong>{i18n.formatCurrency(quote.estimatedPriceCents)}</strong>
                  </div>
                  <div>
                    <span>{i18n.t("customer_live.price.time")}</span>
                    <strong>{quote.estimatedDurationMinutes} min</strong>
                  </div>
                  <div>
                    <span>{i18n.t("customer_live.price.confidence")}</span>
                    <strong>{quote.confidenceTier}</strong>
                  </div>
                  <div>
                    <span>{i18n.t("customer_live.price.yard_size")}</span>
                    <strong>{i18n.t("customer_live.price.sq_ft", { count: quote.measurements.turfSqFt })}</strong>
                  </div>
                </div>
                <details className="service-card-disclosure">
                  <summary className="service-card-disclosure__summary">{i18n.t("customer_live.price.estimate_details")}</summary>
                  <div className="service-card-disclosure__body">
                    <article className="list-panel">
                      <h3>{i18n.t("customer_live.price.confidence_notes")}</h3>
                      <p>{quote.normalizedAddress.displayLabel}</p>
                      {quote.normalizedAddress.wasNormalized ? (
                        <p>{i18n.t("customer_live.price.cleaned_address")}</p>
                      ) : null}
                      {quote.normalizedAddress.validationMessage ? (
                        <p>{quote.normalizedAddress.validationMessage}</p>
                      ) : null}
                      <div className="stack-sm" style={{ paddingBottom: 0 }}>
                        {quote.confidenceReasons.map((reason) => (
                          <p key={`${reason.impact}-${reason.label}`}>
                            <strong>{reason.label}</strong> {reason.detail}
                          </p>
                        ))}
                      </div>
                      <p>
                        {i18n.t("customer_live.price.measurement_sources", {
                          turf: quote.measurementSources.turfSqFt,
                          shrubs: quote.measurementSources.shrubBedSqFt
                        })}
                      </p>
                    </article>
                  </div>
                </details>
                {!providerStepActive ? (
                  <div className="cta-row" style={{ marginTop: "1rem" }}>
                    <button
                      className="button"
                      disabled={loadingState === "loading"}
                      onClick={handleSearchProviders}
                      type="button"
                    >
                      {i18n.t("customer_live.action.see_provider")}
                    </button>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>

          {requestedProviderId && providerSearchState === "loaded" && !selectedProviderWasRequested ? <p role="status">{i18n.t("journey.match_changed")}</p> : null}
          {providerStepActive ? (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>
                    {selectedProviderWasRequested
                      ? i18n.t("customer_live.provider.selected_match")
                      : recommendedProviderCard
                        ? i18n.t("customer_live.provider.best_match")
                        : i18n.t("customer_live.provider.best_fit")}
                  </h2>
                  <p>{i18n.t("customer_live.provider.review_body")}</p>
                </div>
                {providerResults ? (
                  <span className="result-badge result-badge--neutral">
                    {i18n.t("customer_live.provider.option_count", { count: providerCards.length })}
                  </span>
                ) : null}
              </div>
              {providerSearchState === "loading" ? (
                <article className="list-panel">
                  <h3>{i18n.t("customer_live.provider.checking_title")}</h3>
                  <p>{i18n.t("customer_live.provider.checking_body")}</p>
                </article>
              ) : providerResults ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  {providerResults.providers.length === 0 ? (
                    <article className="list-panel">
                      <h3>{i18n.t("customer_live.provider.no_verified.title")}</h3>
                      <p>{i18n.t("customer_live.provider.no_verified.body")}</p>
                      <div className="cta-row">
                        <button className="button" data-analytics-action="edit-request" onClick={handleEditRequestDetails} type="button">
                          {i18n.t("customer_live.action.change_details")}
                        </button>
                        <a
                          className="button-secondary"
                          href={addLocalePrefix(
                            `/help?issueType=general&subject=${encodeURIComponent(i18n.t("customer_live.subject.need_service_area"))}`,
                            i18n.locale
                          )}
                        >
                          {i18n.t("customer_live.action.request_service_area")}
                        </a>
                      </div>
                    </article>
                  ) : null}
                  {providerResults.providers.length > 0 && providersWithWindows.length === 0 ? (
                    <article className="list-panel">
                      <h3>{i18n.t("customer_live.provider.no_openings.title", { timing: timingLabel.toLowerCase() })}</h3>
                      <p>{i18n.t("customer_live.provider.no_openings.body")}</p>
                      <div className="cta-row">
                        {alternativeTimingSuggestions.map((option, index) => (
                          <button
                            key={option.value}
                            className={index === 0 ? "button" : "button-secondary"}
                            disabled={loadingState === "loading"}
                            onClick={() => void handleTryAnotherTiming(option.value)}
                            type="button"
                          >
                            {getCustomerTimingLabel(option.value, selectedCustomDate, selectedCustomWindow, i18n)}
                          </button>
                        ))}
                      </div>
                      <p>{i18n.t("customer_live.provider.change_request_hint")}</p>
                    </article>
                  ) : null}
                  {recommendedProviderCard ? (
                    <article className="list-panel customer-booking-review customer-booking-review--recommended">
                      <div className="search-result-title">
                        <div>
                          <span className="eyebrow">
                            {selectedProviderWasRequested
                              ? i18n.t("customer_live.provider.selected_match")
                              : i18n.t("customer_live.provider.recommended_match")}
                          </span>
                          <h3>{recommendedProviderCard.provider.companyName}</h3>
                        </div>
                        <div className="chip-row">
                          {recommendedChoicePresentation ? (
                            <span className="result-badge">{recommendedChoicePresentation.badge}</span>
                          ) : null}
                          <span className="result-badge result-badge--neutral">
                            {recommendedProviderCard.slot
                              ? i18n.t("customer_live.provider.open_route_window")
                              : i18n.t("customer_live.provider.route_full")}
                          </span>
                        </div>
                      </div>

                      <div className="customer-booking-review__grid" aria-label={i18n.t("customer_live.booking_summary_aria")}>
                        <div>
                          <span>{i18n.t("customer_live.progress.price")}</span>
                          <strong>{quote ? i18n.formatCurrency(quote.estimatedPriceCents) : i18n.t("customer_live.quote_pending")}</strong>
                        </div>
                        <div>
                          <span>{i18n.t("customer_live.provider.opening")}</span>
                          <strong>{formatOpenWindow(i18n, recommendedProviderCard.slot)}</strong>
                        </div>
                        <div>
                          <span>{i18n.t("customer_live.provider.plan")}</span>
                          <strong>{selectedCadenceLabel}</strong>
                        </div>
                        <div>
                          <span>{i18n.t("customer_live.label.property")}</span>
                          <strong>{activeProperty?.label ?? i18n.t("customer_live.selected_property")}</strong>
                        </div>
                        <div>
                          <span>{i18n.t("customer_live.provider.trust")}</span>
                          <strong>{formatProviderTrust(i18n, recommendedProviderCard.provider)}</strong>
                        </div>
                        <div>
                          <span>{i18n.t("customer_live.provider.distance")}</span>
                          <strong>
                            {recommendedProviderCard.ranking
                              ? `${recommendedProviderCard.ranking.distanceMiles.toFixed(1)} mi`
                              : i18n.t("customer_live.provider.mile_radius", { count: recommendedProviderCard.provider.serviceRadiusMiles })}
                          </strong>
                        </div>
                      </div>

                      {recommendedChoicePresentation ? <p>{recommendedChoicePresentation.detail}</p> : null}
                      {selectedCadence === "one-time" ? (
                        <p>{i18n.t("customer_live.no_charge_provider_reviews")}</p>
                      ) : null}
                      {recommendedProviderCard.ranking || recommendedChoicePresentation ? (
                        <details className="service-card-disclosure">
                          <summary className="service-card-disclosure__summary">{i18n.t("customer_live.provider.why_pick")}</summary>
                          <div className="service-card-disclosure__body">
                            {recommendedChoicePresentation ? (
                              <article className="list-panel">
                                <h3>{recommendedChoicePresentation.heading}</h3>
                                <p>{recommendedChoicePresentation.detail}</p>
                              </article>
                            ) : null}
                            {recommendedProviderCard.ranking ? (
                              <article className="list-panel">
                                <p>
                                  <strong>{recommendedProviderCard.ranking.selectionSummaryLabel}.</strong>{" "}
                                  {recommendedProviderCard.ranking.selectionSummaryDetail}
                                </p>
                                <p>
                                  <strong>{recommendedProviderCard.ranking.reliabilityLabel}.</strong>{" "}
                                  {recommendedProviderCard.ranking.reliabilityDetail}
                                </p>
                                <p>
                                  {i18n.t("customer_live.provider.distance_reasons", {
                                    distance: recommendedProviderCard.ranking.distanceMiles,
                                    reasons: recommendedProviderCard.ranking.reasons.join(" • ")
                                  })}
                                </p>
                                <p>
                                  <strong>{recommendedProviderCard.ranking.neighborhoodFamiliarityLabel}.</strong>{" "}
                                  {recommendedProviderCard.ranking.neighborhoodFamiliarityDetail}
                                </p>
                                <p>
                                  <strong>{recommendedProviderCard.ranking.availabilityConfidenceLabel}.</strong>{" "}
                                  {formatCompletedJobTrustLine(i18n, recommendedProviderCard.ranking.completedJobCount)}
                                </p>
                              </article>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                      <div className="cta-row">
                        <button
                          className="button"
                          disabled={!recommendedProviderCard.slot || loadingState === "loading"}
                          data-analytics-action="request-booking" onClick={() =>
                            void handleCreateBooking(
                              recommendedProviderCard,
                              getProviderSelectionRank(recommendedProviderCard.provider.id, 1)
                            )
                          }
                          type="button"
                        >
                          {selectedCadence === "one-time"
                            ? i18n.t("customer_live.action.request_this_time")
                            : quote
                              ? i18n.t("customer_live.start_for_price", {
                                  price: i18n.formatCurrency(quote.estimatedPriceCents)
                                })
                              : i18n.t("customer_live.action.start_repeat_plan")}
                        </button>
                        {alternativeProviderCards.length > 0 && !showAlternativeProviders ? (
                          <button
                            className="button-secondary"
                            onClick={() => {
                              setShowAlternativeProviders(true);
                              void trackWebEvent(
                                MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
                                {
                                  recommendationSessionId: providerResults.recommendationSessionId,
                                  recommendedProviderId: providerResults.recommendedProviderId ?? "none",
                                  providerCount: providerCards.length,
                                  requestSource: "customer-web-dashboard"
                                }
                              );
                            }}
                            type="button"
                          >
                            {i18n.t("customer_live.provider.compare_options")}
                          </button>
                        ) : null}
                      </div>
                      {!recommendedProviderCard.slot ? (
                        <p style={{ marginTop: "0.75rem" }}>
                          {i18n.t("customer_live.provider.serves_no_window")}
                        </p>
                      ) : null}
                    </article>
                  ) : null}
                  {(showAlternativeProviders ? alternativeProviderCards : []).map(({ provider, ranking, slot }, index) => {
                    const choicePresentation = providerChoicePresentationById.get(provider.id);
                    return (
                      <article className="list-panel customer-provider-option" key={provider.id}>
                        <div className="search-result-title">
                          <div>
                            <span className="eyebrow">{i18n.t("customer_live.provider.backup_option")}</span>
                            <h3>{provider.companyName}</h3>
                          </div>
                          <div className="chip-row">
                            {choicePresentation ? (
                              <span className="result-badge">{choicePresentation.badge}</span>
                            ) : null}
                          </div>
                        </div>
                        {choicePresentation ? <p>{choicePresentation.detail}</p> : null}
                        <div className="live-provider-card__request-row" aria-label={i18n.t("customer_live.provider.option_summary_aria")}>
                          <div className="live-provider-card__slot">
                            <span>{i18n.t("customer_live.provider.opening")}</span>
                            <strong>{formatOpenWindow(i18n, slot)}</strong>
                          </div>
                          <dl className="live-provider-card__facts">
                            <div>
                              <dt>{i18n.t("customer_live.provider.trust")}</dt>
                              <dd>
                                {provider.rating.toFixed(1)} • {provider.reviewCount} reviews
                              </dd>
                            </div>
                            <div>
                              <dt>{i18n.t("customer_live.provider.distance")}</dt>
                              <dd>
                                {ranking
                                  ? `${ranking.distanceMiles.toFixed(1)} mi`
                                  : i18n.t("customer_live.provider.mile_radius", { count: provider.serviceRadiusMiles })}
                              </dd>
                            </div>
                          </dl>
                          <button
                            className="button live-provider-card__action"
                            disabled={!slot || loadingState === "loading"}
                            onClick={() =>
                              void handleCreateBooking(
                                { provider, ranking, slot },
                                getProviderSelectionRank(provider.id, index + 2)
                              )
                            }
                            type="button"
                          >
                            {selectedCadence === "one-time"
                              ? i18n.t("customer_live.action.request_this_time")
                              : quote
                                ? i18n.t("customer_live.start_for_price", {
                                    price: i18n.formatCurrency(quote.estimatedPriceCents)
                                  })
                                : i18n.t("customer_live.action.start_repeat_plan")}
                          </button>
                        </div>
                        {ranking || choicePresentation ? (
                          <details className="service-card-disclosure">
                            <summary className="service-card-disclosure__summary">{i18n.t("customer_live.provider.why_option")}</summary>
                            <div className="service-card-disclosure__body">
                              {choicePresentation ? (
                                <article className="list-panel">
                                  <h3>{choicePresentation.heading}</h3>
                                  <p>{choicePresentation.detail}</p>
                                </article>
                              ) : null}
                              {ranking ? (
                                <article className="list-panel">
                                  <p>
                                    <strong>{ranking.selectionSummaryLabel}.</strong> {ranking.selectionSummaryDetail}
                                  </p>
                                  <p>
                                    <strong>{ranking.reliabilityLabel}.</strong> {ranking.reliabilityDetail}
                                  </p>
                                  <p>
                                    {i18n.t("customer_live.provider.distance_reasons", {
                                      distance: ranking.distanceMiles,
                                      reasons: ranking.reasons.join(" • ")
                                    })}
                                  </p>
                                  <p>
                                    <strong>{ranking.neighborhoodFamiliarityLabel}.</strong>{" "}
                                    {ranking.neighborhoodFamiliarityDetail}
                                  </p>
                                  <p>
                                    <strong>{ranking.availabilityConfidenceLabel}.</strong>{" "}
                                    {formatCompletedJobTrustLine(i18n, ranking.completedJobCount)}
                                  </p>
                                </article>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                        {!slot ? (
                          <p style={{ marginTop: "0.75rem" }}>
                            {i18n.t("customer_live.provider.serves_no_window")}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <>
          {nextBooking && nextBookingProviderName ? (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>{getPriorityBookingCardTitle(i18n, nextBooking, nextBookingPayment)}</h2>
                  <p>{getBookingStateMessage(i18n, nextBooking, nextBookingProviderName, nextBookingPayment)}</p>
                </div>
                <strong>{i18n.formatCurrency(nextBooking.totalCents)}</strong>
              </div>

              <div className="customer-booking-review__grid" aria-label={i18n.t("customer_live.next_visit_summary_aria")}>
                <div>
                  <span>{i18n.t("customer_live.provider.status")}</span>
                  <strong>{getPriorityBookingCardTitle(i18n, nextBooking, nextBookingPayment)}</strong>
                </div>
                <div>
                  <span>{i18n.t("customer_live.label.when")}</span>
                  <strong>{formatBookingWindowSummary(nextBooking.scheduledStartIso)}</strong>
                </div>
                <div>
                  <span>{i18n.t("customer_live.provider.provider")}</span>
                  <strong>{nextBookingProviderName}</strong>
                </div>
                <div>
                  <span>{i18n.t("customer_live.label.payment")}</span>
                  <strong>{getBookingPaymentLabel(nextBooking, nextBookingPayment)}</strong>
                </div>
                <div>
                  <span>{i18n.t("customer_live.label.property")}</span>
                  <strong>{nextBooking.serviceAddress.line1}</strong>
                </div>
                <div>
                  <span>{i18n.t("customer_live.progress.price")}</span>
                  <strong>{i18n.formatCurrency(nextBooking.totalCents)}</strong>
                </div>
              </div>

              <BookingSchedulePanel booking={nextBooking} bookingId={nextBooking.id} onUpdated={loadDashboard} />

              {nextBookingNeedsCheckout ? <PaymentMethodGuide returningCustomer={bookings.some(visit => visit.status === "completed")} /> : null}

              {nextBookingHasPrimaryAction ? (
                <div className="cta-row">
                  {nextBookingNeedsCheckout ? (
                    <button
                      className="button"
                      disabled={loadingState === "loading"}
                      data-analytics-action="start-checkout" onClick={() => void handleStartCheckout(nextBooking)}
                      type="button"
                    >
                      {nextBookingPayment?.status === "pending"
                        ? i18n.t("customer_live.action.continue_checkout")
                        : i18n.t("customer_live.action.pay_now")}
                    </button>
                  ) : null}
                  {nextBookingHasTracking ? (
                    <button
                      className="button"
                      disabled={loadingState === "loading"}
                      onClick={() => void openArrivalTracking(nextBooking.id)}
                      type="button"
                    >
                      {i18n.t("customer_live.action.track_crew")}
                    </button>
                  ) : null}
                  {nextBookingNeedsPrimarySupport ? (
                    <a
                      className="button"
                      href={addLocalePrefix(
                        `/help?bookingId=${encodeURIComponent(nextBooking.id)}&issueType=${encodeURIComponent(
                          nextBooking.onRouteConfirmedAt || nextBooking.activeExceptionType ? "service-quality" : "general"
                        )}&subject=${encodeURIComponent(
                          nextBooking.onRouteConfirmedAt
                            ? i18n.t("customer_live.subject.on_route")
                            : nextBooking.activeExceptionType
                              ? getBookingExceptionLabel(nextBooking.activeExceptionType)
                              : i18n.t("customer_live.subject.booking")
                        )}`,
                        i18n.locale
                      )}
                    >
                      {i18n.t("crew_live.action.get_help")}
                    </a>
                  ) : null}
                </div>
              ) : null}

              {nextBookingHasPrimaryAction || !nextBookingNeedsPrimarySupport ? (
                <details className="service-card-disclosure">
                  <summary className="service-card-disclosure__summary">{i18n.t("customer_live.more_options")}</summary>
                  <div className="service-card-disclosure__body">
                    <div className="cta-row">
                      {nextBookingHasTracking ? (
                        <button
                          className="button-secondary"
                          disabled={loadingState === "loading"}
                          onClick={() => void openCustomerChat(nextBooking.id)}
                          type="button"
                        >
                          {i18n.t("customer_live.action.message_business")}
                        </button>
                      ) : null}
                      {!nextBookingNeedsPrimarySupport ? (
                        <a
                          className="button-secondary"
                          href={addLocalePrefix(
                            `/help?bookingId=${encodeURIComponent(nextBooking.id)}&issueType=${encodeURIComponent(
                              nextBooking.onRouteConfirmedAt || nextBooking.activeExceptionType ? "service-quality" : "general"
                            )}&subject=${encodeURIComponent(
                              nextBooking.onRouteConfirmedAt
                                ? i18n.t("customer_live.subject.on_route")
                                : nextBooking.activeExceptionType
                                  ? getBookingExceptionLabel(nextBooking.activeExceptionType)
                                  : i18n.t("customer_live.subject.booking")
                            )}`,
                            i18n.locale
                          )}
                        >
                          {i18n.t("crew_live.action.get_help")}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </details>
              ) : null}
            </section>
          ) : primaryReviewOpportunity ? (
            renderReviewOpportunityCard(primaryReviewOpportunity, "card")
          ) : primaryRetentionOpportunity ? (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>{i18n.t("customer_live.book_again")}</h2>
                  <p>{primaryRetentionOpportunity.message}</p>
                </div>
                <span className="result-badge">
                  {primaryRetentionOpportunity.recommendedCadence === "one-time"
                    ? i18n.t("customer_live.retention.one_time_rebook")
                    : formatRecurringFrequency(i18n, primaryRetentionOpportunity.recommendedCadence)}
                </span>
              </div>
              <div className="cta-row">
                <button
                  className="button"
                  disabled={loadingState === "loading"}
                  onClick={() => void handleApplyRetentionOpportunity(primaryRetentionOpportunity)}
                  type="button"
                >
                  {primaryRetentionOpportunity.actionLabel}
                </button>
              </div>
            </section>
          ) : primaryRecurringPlan ? (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>{i18n.t("customer_live.repeat_service_set")}</h2>
                  <p>
                    {primaryRecurringPlan.upcomingBooking
                      ? i18n.t("customer_live.repeat.next_visit_with_provider", {
                          window: formatBookingWindowSummary(primaryRecurringPlan.upcomingBooking.scheduledStartIso),
                          provider: primaryRecurringPlan.providerName
                        })
                      : i18n.t("customer_live.repeat.provider_still_set", {
                          provider: primaryRecurringPlan.providerName
                        })}
                  </p>
                </div>
                <span className="result-badge">{formatRecurringFrequency(i18n, primaryRecurringPlan.plan.frequency)}</span>
              </div>
              <div className="cta-row">
                <a className="button" href={addLocalePrefix("/customer/dashboard?flow=request", i18n.locale)}>
                  {i18n.t("customer_live.start_request")}
                </a>
              </div>
            </section>
          ) : (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>{hasAccountHistory ? i18n.t("customer_live.ready_another_visit") : i18n.t("customer_live.need_service")}</h2>
                  <p>
                    {hasAccountHistory
                      ? i18n.t("customer_live.ready_another_visit_body")
                      : i18n.t("customer_live.need_service_body")}
                  </p>
                </div>
                <a className="button" href={addLocalePrefix("/customer/dashboard?flow=request", i18n.locale)}>
                  {i18n.t("customer_history.request_service")}
                </a>
              </div>
            </section>
          )}
        </>
      )}

      {!requestFlowActive ? (
        <>
          {sectionSpotlightBookAgainOption || pastRecurringPlans.length ? (
            <section className="card">
              <h2>
                {hasCurrentBookAgainOptions
                  ? priorityCardKind === "retention" || priorityCardKind === "plan"
                    ? i18n.t("customer_live.other_repeat_options")
                    : i18n.t("customer_live.book_again")
                  : i18n.t("customer_live.past_repeat_plans")}
              </h2>
              <div className="stack-lg" style={{ paddingBottom: 0 }}>
                {sectionSpotlightBookAgainOption?.kind === "plan"
                  ? renderRecurringPlanCard(sectionSpotlightBookAgainOption.summary)
                  : sectionSpotlightBookAgainOption?.kind === "retention"
                    ? renderRetentionOpportunityCard(sectionSpotlightBookAgainOption.opportunity)
                    : null}
                {sectionAdditionalBookAgainOptionCount ? (
                  <details className="service-card-disclosure">
                    <summary className="service-card-disclosure__summary">
                      {i18n.t("customer_live.other_repeat_option_count", {
                        count: sectionAdditionalBookAgainOptionCount
                      })}
                    </summary>
                    <div className="service-card-disclosure__body">
                      <div className="stack-lg" style={{ paddingBottom: 0 }}>
                        {sectionAdditionalRecurringPlans.map((summary) => (
                          <div key={summary.plan.id}>{renderRecurringPlanCard(summary)}</div>
                        ))}
                        {sectionAdditionalRetentionOpportunities.map((opportunity) => (
                          <div key={opportunity.id}>{renderRetentionOpportunityCard(opportunity)}</div>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}
                {pastRecurringPlans.length && hasCurrentBookAgainOptions ? (
                  <details className="service-card-disclosure">
                    <summary className="service-card-disclosure__summary">{i18n.t("customer_live.past_repeat_plans")}</summary>
                    <div className="service-card-disclosure__body">
                      {pastRecurringPlans.map((summary) => (
                        <div key={summary.plan.id}>{renderPastRecurringPlanCard(summary)}</div>
                      ))}
                    </div>
                  </details>
                ) : null}
                {pastRecurringPlans.length && !hasCurrentBookAgainOptions
                  ? pastRecurringPlans.map((summary) => (
                      <div key={summary.plan.id}>{renderPastRecurringPlanCard(summary)}</div>
                    ))
                  : null}
              </div>
            </section>
          ) : null}

          {sectionSpotlightBooking || sectionSpotlightReviewOpportunity ? (
            <section className={sectionSpotlightBooking && sectionSpotlightReviewOpportunity ? "grid-two" : "stack-lg"}>
              {sectionSpotlightBooking ? (
                <article className="card">
                  <h2>{priorityCardKind === "booking" ? i18n.t("customer_live.other_visits") : i18n.t("customer_live.happening_now")}</h2>
                  <div className="stack-lg" style={{ paddingBottom: 0 }}>
                    {renderActiveBookingCard(sectionSpotlightBooking)}
                    {sectionAdditionalActiveBookings.length ? (
                      <details className="service-card-disclosure">
                        <summary className="service-card-disclosure__summary">
                          {i18n.t("customer_live.other_visit_count", {
                            count: sectionAdditionalActiveBookings.length
                          })}
                        </summary>
                        <div className="service-card-disclosure__body">
                          <div className="stack-lg" style={{ paddingBottom: 0 }}>
                            {sectionAdditionalActiveBookings.map((booking) => (
                              <div key={booking.id}>{renderActiveBookingCard(booking)}</div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </article>
              ) : null}

              {sectionSpotlightReviewOpportunity ? (
                <article className="card">
                  <h2>{priorityCardKind === "review" ? i18n.t("customer_live.other_reviews") : i18n.t("customer_live.review.ready")}</h2>
                  <div className="stack-lg" style={{ paddingBottom: 0 }}>
                    {renderReviewOpportunityCard(sectionSpotlightReviewOpportunity)}
                    {sectionAdditionalReviewOpportunities.length ? (
                      <details className="service-card-disclosure">
                        <summary className="service-card-disclosure__summary">
                          {i18n.t("customer_live.other_review_count", {
                            count: sectionAdditionalReviewOpportunities.length
                          })}
                        </summary>
                        <div className="service-card-disclosure__body">
                          <div className="stack-lg" style={{ paddingBottom: 0 }}>
                            {sectionAdditionalReviewOpportunities.map((opportunity) => (
                              <div key={opportunity.bookingId}>{renderReviewOpportunityCard(opportunity)}</div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
      {activeChatBookingId && chatThread ? (
        <FloatingChatWindow
          busy={loadingState === "loading"}
          draft={chatDraft}
          inputPlaceholder={i18n.t("customer_live.chat.placeholder")}
          isOpen={Boolean(activeChatBookingId)}
          launcherLabel={i18n.t("customer_live.chat.open")}
          messages={chatThread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            senderLabel:
              message.senderRole === "customer"
                ? i18n.t("customer_live.chat.you")
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
          title={i18n.t("customer_live.chat.title")}
        />
      ) : null}
    </main>
  );
}
