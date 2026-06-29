"use client";

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
  PaymentRecord,
  ProviderProfile,
  RecurringServiceFrequency,
  RecurringServicePlanSummary,
  ReviewScore,
  SearchProvidersResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { getLaunchAttributionContext, getStoredLaunchLeadId } from "../lib/launchAttribution";
import { useStoredWebSession } from "../lib/session";
import { trackWebEvent } from "../lib/tracking";
import { ArrivalTrackingPanel } from "./ArrivalTrackingPanel";
import { CustomerHistoryBoard } from "./CustomerHistoryBoard";
import { FloatingChatWindow } from "./FloatingChatWindow";
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

const serviceOptions: Array<{ label: string; value: ServiceCategory }> = [
  { label: "Lawn mowing", value: "lawn-mowing" },
  { label: "Hedge trimming", value: "hedge-trimming" },
  { label: "Mulch installation", value: "mulch-installation" },
  { label: "Seasonal cleanup", value: "seasonal-cleanup" },
  { label: "Weed control", value: "weed-control" },
  { label: "Leaf blowing", value: "leaf-blowing" }
];
const dashboardTimingOptions: Array<{ label: string; value: CustomerTimingPreference }> = [
  ...customerTimingOptions,
  { label: "Choose date", value: "custom-date" }
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatOpenWindow(slot?: SearchProvidersResponse["suggestedSlots"][number]) {
  return slot ? formatBookingWindowSummary(slot.startIso) : "No open slot";
}

function formatProviderTrust(provider: ProviderProfile) {
  return `${provider.rating.toFixed(1)} overall • ${provider.reviewCount} reviews`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatEta(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
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

function formatRecurringFrequency(frequency: RecurringServiceFrequency) {
  return frequency === "biweekly" ? "Every 2 weeks" : "Every week";
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

function formatRetentionTrigger(trigger: CustomerRetentionOpportunity["trigger"]) {
  return trigger === "recent-completion"
    ? "Recent completion"
    : trigger === "30-day-follow-up"
      ? "30-day follow-up"
      : trigger === "60-day-follow-up"
        ? "60-day reminder"
        : trigger === "spring-season-window"
          ? "Spring reminder"
          : trigger === "fall-season-window"
            ? "Fall reminder"
            : "90-day follow-up";
}

function formatRetentionLoyaltyLabel(segment: CustomerRetentionOpportunity["loyaltySegment"]) {
  return segment === "provider-loyal"
    ? "Same provider repeat"
    : segment === "repeat-customer"
      ? "Repeat customer"
      : "First repeat";
}

function formatCompletedJobTrustLine(completedJobCount: number) {
  return completedJobCount > 0
    ? `${completedJobCount} completed YardMatch jobs.`
    : "New on GreenRain, but already ranked well for service fit, timing, and trust signals.";
}

function formatBookingStatusTitle(booking: Booking) {
  if (booking.onRouteConfirmedAt) {
    return "Crew on the way";
  }

  if (booking.activeExceptionType) {
    return getBookingExceptionLabel(booking.activeExceptionType);
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return "Running behind";
  }

  switch (booking.status) {
    case "requested":
      return "Waiting on confirmation";
    case "confirmed":
      return "Visit confirmed";
    case "in-progress":
      return "Visit in progress";
    case "completed":
      return "Visit completed";
    default:
      return booking.status.replaceAll("-", " ");
  }
}

function formatSentenceTail(value: string) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function getBookingStateMessage(booking: Booking, providerName: string, payment?: PaymentRecord) {
  if (booking.onRouteConfirmedAt) {
    return `${providerName} is on the way. You can message the business or track the crew live.`;
  }

  if (booking.activeExceptionType) {
    return `${providerName} flagged an issue with this visit. Review the update, then decide if you need support.`;
  }

  if (booking.lateEtaIso && !booking.onRouteConfirmedAt) {
    return `${providerName} is running behind. Check the updated arrival time before changing the visit.`;
  }

  switch (booking.status) {
    case "requested":
      return `GreenRain is holding this request with ${formatSentenceTail(providerName)} Confirm the details or ask for help if plans changed.`;
    case "confirmed":
      return payment?.status === "pending"
        ? `Your visit is set with ${formatSentenceTail(providerName)} Finish checkout when you are ready.`
        : `Your visit is set with ${formatSentenceTail(providerName)} Everything is lined up for the scheduled window.`;
    case "in-progress":
      return `${providerName} is working this visit now. Keep support close if anything changes in the field.`;
    default:
      return `${providerName} is attached to this visit.`;
  }
}

function getPriorityBookingCardTitle(booking: Booking, payment?: PaymentRecord) {
  if ((booking.status === "requested" || booking.status === "confirmed") && payment?.status !== "captured") {
    return "Finish booking";
  }

  if (booking.status === "confirmed" && !booking.onRouteConfirmedAt && !booking.activeExceptionType && !booking.lateEtaIso) {
    return "You're set";
  }

  return formatBookingStatusTitle(booking);
}

export function CustomerLiveDashboard() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const requestedFlow = searchParams.get("flow");
  const requestedService = parseDashboardServiceParam(searchParams.get("service"));
  const requestedTiming = parseDashboardTimingParam(searchParams.get("when"));
  const requestedCustomDate = parseDashboardDateParam(searchParams.get("date"));
  const requestedCustomWindow = parseDashboardCustomWindowParam(searchParams.get("window"));
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
  const trackedRetentionPromptIds = useRef(new Set<string>());

  const activeProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const timingLabel = getCustomerTimingLabel(selectedTiming, selectedCustomDate, selectedCustomWindow);
  const selectedServiceLabel =
    serviceOptions.find((option) => option.value === selectedCategory)?.label ?? "Selected service";
  const selectedCadenceLabel =
    selectedCadence === "one-time" ? "One-time visit" : formatRecurringFrequency(selectedCadence);
  const providerCards =
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
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(
    providerResults?.rankedProviders ?? []
  );
  const recommendedProviderCard = providerCards[0];
  const alternativeProviderCards = providerCards.slice(1, 4);
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
  const nextBooking = [...activeBookings].sort((left, right) =>
    left.scheduledStartIso.localeCompare(right.scheduledStartIso)
  )[0];
  const nextBookingProviderName = nextBooking
    ? providerNamesById[nextBooking.providerId] ?? "your landscaper"
    : undefined;
  const nextBookingPayment = nextBooking ? paymentsByBookingId[nextBooking.id] : undefined;
  const nextBookingNeedsCheckout =
    Boolean(nextBooking) &&
    (nextBooking.status === "requested" || nextBooking.status === "confirmed") &&
    nextBookingPayment?.status !== "captured";
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
    if (!activeRetentionOpportunity) {
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
        payments,
        recurringPlanResponse
      ] = await Promise.all([
        api.getCurrentUser(),
        api.getCustomerProperties(),
        api.getBookings(),
        api.getCustomerReviewOpportunities(),
        api.getCustomerRetentionOpportunities(),
        api.getPayments(),
        api.getRecurringServicePlans()
      ]);

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
          if (!current || current.updatedAt < payment.updatedAt) {
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
      setBookingMessage("Stripe checkout cancelled.");
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
        await api.finalizeCheckoutSession({
          checkoutSessionId
        });
        await loadDashboard();
        setBookingMessage("Stripe payment received.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to confirm your Stripe payment right now."
        );
      } finally {
        setLoadingState("idle");
        clearPaymentParams();
      }
    })();
  }, [paymentActionHandled, searchParams, sessionReady]);

  async function handleQuote() {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
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
      setProviderResults(undefined);
      setProviderSearchState("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to build a quote right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function runProviderSearch(timingPreference: CustomerTimingPreference) {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
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
        estimatedDurationMinutes: quote?.estimatedDurationMinutes,
        requestSource: activeRetentionOpportunity ? "customer-retention-nudge" : "customer-web-dashboard",
        retentionPreference: getActiveRetentionPreference(),
        attribution: getLaunchAttributionContext()
      });
      setProviderResults(results);
      setShowAlternativeProviders(false);
      setProviderSearchState("loaded");
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unable to search providers right now.");
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
      setErrorMessage("That saved property is no longer available.");
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
        retentionPreference: {
          priorProviderId: opportunity.providerId,
          sourceBookingId: opportunity.sourceBookingId,
          strategyKey: opportunity.strategyKey,
          trigger: opportunity.trigger,
          loyaltySegment: opportunity.loyaltySegment,
          completedCategoryCount: opportunity.completedCategoryCount,
          sameProviderCompletedCount: opportunity.sameProviderCompletedCount
        },
        attribution: getLaunchAttributionContext()
      });

      setProviderResults(results);
      setProviderSearchState("loaded");
      setBookingMessage(
        opportunity.kind === "start-recurring-plan"
          ? "Recurring mowing setup is ready. Review the recommendation and route window to start the plan."
          : "Your next service request is ready. Review the recommendation and route window to book again."
      );
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to prepare that follow-up service right now."
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
      setErrorMessage("That saved property is no longer available.");
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
      setBookingMessage("Your next repeat visit is ready. Review the recommendation and route window to queue it.");
    } catch (error) {
      setProviderSearchState("idle");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to prepare the next repeat visit right now."
      );
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleCreateBooking(providerCard: (typeof providerCards)[number], rank: number) {
    if (!activeProperty) {
      setErrorMessage("Choose a property first.");
      return;
    }

    const provider = providerCard.provider;
    const slot = providerCard.slot ?? providerResults?.suggestedSlots.find((candidate) => candidate.providerId === provider.id);
    if (!slot || !quote) {
      setErrorMessage("Pick a provider with an available slot first.");
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
          notes: "Booked from the live YardMatch customer dashboard.",
          totalCents: quote.estimatedPriceCents,
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
          `Booked ${provider.companyName} for the ${formatBookingWindowSummary(slot.startIso)} window.`
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
          `Started an ${formatRecurringFrequency(selectedCadence).toLowerCase()} plan with ${provider.companyName}. First visit requested for ${formatBookingWindowSummary(
            recurringPlan.initialBooking.scheduledStartIso
          )}.`
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your booking right now.");
    } finally {
      setLoadingState("idle");
    }
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
        error instanceof Error ? error.message : "Unable to open Stripe checkout right now."
      );
      setLoadingState("idle");
    }
  }

  async function handleSubmitReview(opportunity: CustomerReviewOpportunity) {
    const reviewText = (reviewDrafts[opportunity.bookingId] ?? "").trim();
    const rating = getReviewRating(opportunity.bookingId);

    if (!reviewText) {
      setErrorMessage("Add a short review note before sending.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit your review right now.");
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
      setBookingMessage("Booking cancelled.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel this booking right now.");
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
        reason: "Customer cancelled the recurring service plan from the dashboard."
      });
      setBookingMessage("Recurring plan cancelled.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to cancel this recurring plan right now."
      );
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRescheduleBooking(bookingId: string) {
    const draft = rescheduleDrafts[bookingId];
    if (!draft) {
      setErrorMessage("Pick a new date and time first.");
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
      setBookingMessage("Booking rescheduled.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reschedule this booking right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleOpenDispute(bookingId: string) {
    const reason = (disputeDrafts[bookingId] ?? "").trim();
    if (!reason) {
      setErrorMessage("Tell us why you need to dispute this booking.");
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
      setBookingMessage("Dispute opened. YardMatch support now has the booking context.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open this dispute right now.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleRequestRefundReview(bookingId: string) {
    const payment = getPaymentRecord(bookingId);
    const reason = (refundDrafts[bookingId] ?? "").trim();

    if (!payment) {
      setErrorMessage("There is no payment on file for this booking yet.");
      return;
    }

    if (!reason) {
      setErrorMessage("Tell us why you need a refund review.");
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
      setBookingMessage("Refund review requested. YardMatch support now has the payment and booking context.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to request a refund review right now.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to open business chat right now.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load arrival tracking right now.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to send your message right now.");
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
        <section className="card">
          <h2>Loading your account...</h2>
        </section>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <main className="container stack-lg">
        <section className="card">
          <h2>Log in to manage your account</h2>
          <p>Search for service, or log in to see bookings, repeat visits, and reviews.</p>
          <div className="cta-row">
            <a className="button-secondary" href="/customer">
              Request service
            </a>
            <a className="button" href="/login/customer">
              Log in
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
        <p>Pick the service, timing, and repeat schedule.</p>
        <div className="form-grid">
          <label className="form-field">
            <span>Property</span>
            <select onChange={(event) => setSelectedPropertyId(event.target.value)} value={selectedPropertyId}>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Service</span>
            <select
              onChange={(event) => setSelectedCategory(event.target.value as ServiceCategory)}
              value={selectedCategory}
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>When</span>
            <select
              onChange={(event) => setSelectedTiming(event.target.value as CustomerTimingPreference)}
              value={selectedTiming}
            >
              {dashboardTimingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {selectedTiming === "custom-date" ? (
            <>
              <label className="form-field">
                <span>Date</span>
                <input
                  min={getMinimumCustomerCustomDateString()}
                  onChange={(event) => setSelectedCustomDate(event.target.value)}
                  type="date"
                  value={selectedCustomDate}
                />
              </label>
              <label className="form-field">
                <span>Window</span>
                <select
                  onChange={(event) => setSelectedCustomWindow(event.target.value as CustomerCustomTimingWindow)}
                  value={selectedCustomWindow}
                >
                  {customerCustomTimingWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="form-field">
            <span>Cadence</span>
            <select
              onChange={(event) => setSelectedCadence(event.target.value as "one-time" | RecurringServiceFrequency)}
              value={selectedCadence}
            >
              <option value="one-time">One-time visit</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <button className="button" disabled={loadingState === "loading"} onClick={handleQuote} type="button">
            {loadingState === "loading" ? "Working..." : buttonLabel}
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

  function renderActiveBookingCard(booking: Booking) {
    const providerName = providerNamesById[booking.providerId] ?? "Landscaping business";
    const paymentRecord = getPaymentRecord(booking.id);
    const canEditVisit = booking.status === "requested" || booking.status === "confirmed";
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
            <h2>{formatBookingStatusTitle(booking)}</h2>
            <p>{providerName}</p>
          </div>
          <strong>{formatCurrency(booking.totalCents)}</strong>
        </div>
        <p className="history-card__summary">{getBookingStateMessage(booking, providerName, paymentRecord)}</p>
        <div className="chip-row">
          <span className="result-badge result-badge--neutral">
            {formatBookingWindowSummary(booking.scheduledStartIso)}
          </span>
          <span className="result-badge result-badge--neutral">{getPaymentLabel(paymentRecord)}</span>
        </div>
        <div className="cta-row">
          {canEditVisit && paymentRecord?.status !== "captured" ? (
            <button
              className="button"
              disabled={loadingState === "loading"}
              onClick={() => void handleStartCheckout(booking)}
              type="button"
            >
              {paymentRecord?.status === "pending" ? "Continue checkout" : "Pay now"}
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
                Message business
              </button>
              <button
                className="button-secondary"
                disabled={loadingState === "loading"}
                onClick={() => void openArrivalTracking(booking.id)}
                type="button"
              >
                Track crew
              </button>
            </>
          ) : null}
          <a
            className="button-secondary"
            href={`/help?bookingId=${encodeURIComponent(booking.id)}&issueType=${encodeURIComponent(
              booking.onRouteConfirmedAt || booking.activeExceptionType ? "service-quality" : "general"
            )}&subject=${encodeURIComponent(
              booking.onRouteConfirmedAt
                ? "On-route support"
                : booking.activeExceptionType
                  ? getBookingExceptionLabel(booking.activeExceptionType)
                  : "Booking support"
            )}`}
          >
            Get help
          </a>
        </div>
        {booking.lateEtaIso && !booking.onRouteConfirmedAt ? (
          <div className="list-panel" style={{ marginTop: "1rem" }}>
            <h3>Delay update</h3>
            <p>{providerName} is running behind.</p>
            <p>
              New target: {formatEta(booking.lateEtaIso)}.
              {booking.lateReason ? ` ${booking.lateReason}` : ""}
            </p>
          </div>
        ) : null}
        {booking.activeExceptionType ? (
          <div className="list-panel" style={{ marginTop: "1rem" }}>
            <h3>{getBookingExceptionLabel(booking.activeExceptionType)}</h3>
            <p>{providerName} flagged an issue with this visit.</p>
            <p>
              {booking.activeExceptionNotes ??
                "Check in with the business or support to work out the next step."}
            </p>
          </div>
        ) : null}
        {activeTrackingBookingId === booking.id && activeTracking ? (
          <ArrivalTrackingPanel subtitle={providerName} title="Crew on the way" tracking={activeTracking} />
        ) : null}
        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">Visit details</summary>
          <div className="service-card-disclosure__body">
            <div className="history-card__grid">
              <div>
                <h3>Address</h3>
                <p>{booking.serviceAddress.line1}</p>
                <p>
                  {booking.serviceAddress.city}, {booking.serviceAddress.state}{" "}
                  {booking.serviceAddress.postalCode}
                </p>
              </div>
              <div>
                <h3>Schedule</h3>
                <p>{formatBookingWindowSummary(booking.scheduledStartIso)}</p>
                <p>{formatDateTime(booking.scheduledStartIso)}</p>
              </div>
              <div>
                <h3>Notes</h3>
                <p>{booking.notes || "No extra notes."}</p>
              </div>
              <div>
                <h3>Payment</h3>
                <p>{getPaymentLabel(paymentRecord)}</p>
                {paymentRecord?.paidAt ? <p>{formatDateTime(paymentRecord.paidAt)}</p> : null}
              </div>
            </div>
            {canEditVisit ? (
              <>
                <p className="history-card__detail-copy">
                  Need a different time or want to cancel this visit? Make the change here.
                </p>
                <div className="form-grid">
                  <label className="form-field">
                    <span>New start</span>
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
                    <span>New end</span>
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
                    Reschedule
                  </button>
                  <button
                    className="button-secondary"
                    disabled={loadingState === "loading"}
                    onClick={() => void handleCancelBooking(booking.id)}
                    type="button"
                  >
                    Cancel booking
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </details>
        {canOpenDispute || canReviewRefund ? (
          <details className="service-card-disclosure">
            <summary className="service-card-disclosure__summary">Billing and support</summary>
            <div className="service-card-disclosure__body">
              {canOpenDispute ? (
                <div className="list-panel">
                  <h3>Need to dispute this service?</h3>
                  <p>
                    Open a formal dispute so YardMatch support can step in with the booking context attached.
                  </p>
                  <div className="form-grid" style={{ marginTop: "1rem" }}>
                    <label className="form-field form-field--full">
                      <span>Dispute reason</span>
                      <textarea
                        rows={3}
                        value={disputeDrafts[booking.id] ?? ""}
                        onChange={(event) =>
                          setDisputeDrafts((current) => ({
                            ...current,
                            [booking.id]: event.target.value
                          }))
                        }
                        placeholder="What went wrong with this service?"
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
                      Open dispute
                    </button>
                  </div>
                </div>
              ) : null}
              {canReviewRefund ? (
                <div className="list-panel">
                  <h3>Refund review</h3>
                  <p>
                    {paymentRecord?.refundReviewStatus === "requested"
                      ? "YardMatch support is reviewing this refund request. Payouts stay on hold until the review is resolved."
                      : paymentRecord?.refundReviewStatus === "denied"
                        ? `The last refund review was denied.${paymentRecord?.refundDecisionNotes ? ` ${paymentRecord.refundDecisionNotes}` : ""}`
                        : "If this completed service needs a billing review, send a refund request with the reason below."}
                  </p>
                  {paymentRecord?.refundReviewStatus !== "requested" ? (
                    <>
                      <div className="form-grid" style={{ marginTop: "1rem" }}>
                        <label className="form-field form-field--full">
                          <span>Refund reason</span>
                          <textarea
                            rows={3}
                            value={refundDrafts[booking.id] ?? ""}
                            onChange={(event) =>
                              setRefundDrafts((current) => ({
                                ...current,
                                [booking.id]: event.target.value
                              }))
                            }
                            placeholder="Why should YardMatch review this payment?"
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
                          Request refund review
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
            <span className="eyebrow">Ready to review</span>
            <h2>{opportunity.providerName}</h2>
            <p>{opportunity.reason}</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">
              {opportunity.category.replaceAll("-", " ")}
            </span>
            {opportunity.completedAt ? (
              <span className="result-badge result-badge--neutral">
                {formatDateTime(opportunity.completedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="customer-review-card__grid" aria-label="Review summary">
          <div>
            <span>Service</span>
            <strong>{opportunity.category.replaceAll("-", " ")}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{opportunity.completedAt ? formatDateTime(opportunity.completedAt) : "Recently"}</strong>
          </div>
          <div>
            <span>Rating</span>
            <strong>{selectedRating}/5</strong>
          </div>
        </div>
        {composerOpen ? (
          <div className="customer-review-card__composer">
            <div>
              <span className="eyebrow">Rating</span>
              <div className="chip-row" role="group" aria-label="Choose rating">
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
              placeholder="What should the provider know?"
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
                Send review
              </button>
              <button
                className="button-secondary"
                onClick={() => setReviewComposerBookingId(undefined)}
                type="button"
              >
                Not now
              </button>
            </>
          ) : (
            <button
              className="button"
              onClick={() => setReviewComposerBookingId(opportunity.bookingId)}
              type="button"
            >
              Leave review
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
            <p>{summary.plan.category.replaceAll("-", " ")} plan</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">Active plan</span>
            <span className="result-badge">{formatRecurringFrequency(summary.plan.frequency)}</span>
          </div>
        </div>
        {summary.upcomingBooking ? (
          <p>
            Next visit: {formatBookingWindowSummary(summary.upcomingBooking.scheduledStartIso)} •{" "}
            {formatDateTime(summary.upcomingBooking.scheduledStartIso)}
          </p>
        ) : (
          <p>No visit is queued yet. Queue the next one when you are ready.</p>
        )}
        <p>
          {summary.completedOccurrenceCount} completed visit
          {summary.completedOccurrenceCount === 1 ? "" : "s"}
          {summary.activeOccurrenceCount > 0 ? ` • ${summary.activeOccurrenceCount} active` : ""}
        </p>
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
                Queue next visit
              </button>
            ) : null}
            <button
              className="button-secondary"
              disabled={loadingState === "loading"}
              onClick={() => void handleCancelRecurringPlan(summary.plan.id)}
              type="button"
            >
              Cancel plan
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
              {opportunity.providerName} • {opportunity.category.replaceAll("-", " ")}
            </p>
          </div>
          <span className="result-badge">
            {opportunity.recommendedCadence === "one-time"
              ? "One-time rebook"
              : formatRecurringFrequency(opportunity.recommendedCadence)}
          </span>
          <span className="result-badge">{formatRetentionTrigger(opportunity.trigger)}</span>
          <span className="result-badge">{formatRetentionLoyaltyLabel(opportunity.loyaltySegment)}</span>
        </div>
        <p>{opportunity.message}</p>
        <p>
          Last completed: {formatDateTime(opportunity.completedAt)} • {opportunity.daysSinceCompleted} day
          {opportunity.daysSinceCompleted === 1 ? "" : "s"} ago
        </p>
        <p>
          {opportunity.completedCategoryCount} completed {opportunity.category.replaceAll("-", " ")} visit
          {opportunity.completedCategoryCount === 1 ? "" : "s"} at this property
          {opportunity.sameProviderCompletedCount > 1
            ? ` • ${opportunity.sameProviderCompletedCount} with ${opportunity.providerName}`
            : ""}
          {opportunity.lastServiceGapDays
            ? ` • last gap ${opportunity.lastServiceGapDays} day${
                opportunity.lastServiceGapDays === 1 ? "" : "s"
              }`
            : ""}
        </p>
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
            <p>{summary.plan.category.replaceAll("-", " ")} plan</p>
          </div>
          <div className="chip-row">
            <span className="result-badge result-badge--neutral">Cancelled</span>
            <span className="result-badge">{formatRecurringFrequency(summary.plan.frequency)}</span>
          </div>
        </div>
        <p>This plan is no longer running.</p>
        <p>
          {summary.completedOccurrenceCount} completed visit
          {summary.completedOccurrenceCount === 1 ? "" : "s"}
        </p>
      </article>
    );
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
      return "Awaiting Stripe checkout";
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

  const accountViews = [
    { href: "/customer/dashboard", label: "Account", view: "account" },
    { href: "/customer/dashboard?view=history", label: "Past visits", view: "history" }
  ] as const;

  if (historyOnlyView) {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <h1>Past visits</h1>
          <p>Completed, cancelled, refunded, and disputed visits.</p>
        </section>

        <nav aria-label="Customer account sections" className="dashboard-switcher">
          {accountViews.map((item) => (
            <a
              className={`dashboard-switcher__link${dashboardView === item.view ? " dashboard-switcher__link--active" : ""}`}
              href={item.href}
              key={item.view}
            >
              {item.label}
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
              <h1>Request service</h1>
              <p>Choose the job, check the price, then book.</p>
            </div>
            <a className="button-secondary" href="/customer/dashboard">
              Back to account
            </a>
          </div>
        ) : (
          <>
            <h1>Welcome back, {customer?.fullName?.split(" ")[0] ?? "there"}.</h1>
            <p>Manage visits, repeat service, and reviews in one place.</p>
          </>
        )}
      </section>

      {!requestFlowActive ? (
        <nav aria-label="Customer account sections" className="dashboard-switcher">
          {accountViews.map((item) => (
            <a
              className={`dashboard-switcher__link${dashboardView === item.view ? " dashboard-switcher__link--active" : ""}`}
              href={item.href}
              key={item.view}
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}

      {bookingMessage ? (
        <section className="card">
          <div className="search-result-title">
            <div>
              <h2>Done</h2>
              <p>{bookingMessage}</p>
            </div>
            <button className="button-secondary" onClick={() => setBookingMessage(undefined)} type="button">
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {dashboardLoadError ? (
        <section className="card">
          <h2>We couldn't load your account</h2>
          <p>{dashboardLoadError}</p>
          <div className="cta-row">
            <button className="button" disabled={isLoadingDashboard} onClick={() => void loadDashboard()} type="button">
              {isLoadingDashboard ? "Trying again..." : "Try again"}
            </button>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <div className="search-result-title">
            <div>
              <h2>We couldn't finish that</h2>
              <p>{errorMessage}</p>
            </div>
            <button className="button-secondary" onClick={() => setErrorMessage(undefined)} type="button">
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {requestFlowActive ? (
        <>
          <section className="stack-lg">
            <article className="card">
              <div className="search-result-title">
                <div>
                  <h2>Choose the job</h2>
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
                    <summary className="service-card-disclosure__summary">Change details</summary>
                    <div className="service-card-disclosure__body">{renderRequestDetailsEditor("Refresh price")}</div>
                  </details>
                </>
              ) : (
                renderRequestDetailsEditor("Get price")
              )}
            </article>

            {quote ? (
              <article className="card">
                <h2>Price</h2>
                {providerStepActive ? (
                  <>
                    <p>
                      {formatCurrency(quote.estimatedPriceCents)} • {quote.estimatedDurationMinutes} minutes •{" "}
                      {quote.confidenceTier} confidence
                    </p>
                    <p>
                      Turf {quote.measurements.turfSqFt} sq ft • Shrubs {quote.measurements.shrubBedSqFt} sq ft
                    </p>
                  </>
                ) : (
                  <div className="stack-lg" style={{ paddingBottom: 0 }}>
                    <article className="list-panel">
                      <h3>{formatCurrency(quote.estimatedPriceCents)}</h3>
                      <p>
                        {quote.estimatedDurationMinutes} minutes • {quote.confidenceTier} confidence
                      </p>
                    </article>
                    <article className="list-panel">
                      <h3>Property estimate</h3>
                      <p>
                        Turf {quote.measurements.turfSqFt} sq ft • Shrubs {quote.measurements.shrubBedSqFt} sq ft
                      </p>
                    </article>
                  </div>
                )}
                <details className="service-card-disclosure">
                  <summary className="service-card-disclosure__summary">Estimate details</summary>
                  <div className="service-card-disclosure__body">
                    <article className="list-panel">
                      <h3>Summary</h3>
                      <p>{quote.estimateSummary}</p>
                    </article>
                    <article className="list-panel">
                      <h3>Confidence notes</h3>
                      <p>{quote.normalizedAddress.displayLabel}</p>
                      {quote.normalizedAddress.wasNormalized ? (
                        <p>We cleaned up the address before matching and quoting.</p>
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
                        Turf source {quote.measurementSources.turfSqFt} • Shrubs source{" "}
                        {quote.measurementSources.shrubBedSqFt}
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
                      See provider
                    </button>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>

          {providerStepActive ? (
            <section className="card">
              <h2>{recommendedProviderCard ? "Ready to book" : "Best fit"}</h2>
              {providerSearchState === "loading" ? (
                <article className="list-panel">
                  <h3>Checking the best fit</h3>
                  <p>Looking at live route openings, coverage, and trust signals for this property.</p>
                </article>
              ) : providerResults ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  {providerResults.providers.length === 0 ? (
                    <article className="list-panel">
                      <h3>Nothing is live here yet.</h3>
                      <p>We do not have a verified business covering this request yet.</p>
                      <div className="cta-row">
                        <button className="button" onClick={handleEditRequestDetails} type="button">
                          Change details
                        </button>
                        <a className="button-secondary" href="/help?issueType=general&subject=Need service in my area">
                          Request service in this area
                        </a>
                      </div>
                    </article>
                  ) : null}
                  {providerResults.providers.length > 0 && providersWithWindows.length === 0 ? (
                    <article className="list-panel">
                      <h3>Nothing is open {timingLabel.toLowerCase()}.</h3>
                      <p>This area is covered, but the current route windows are full.</p>
                      <div className="cta-row">
                        {alternativeTimingSuggestions.map((option, index) => (
                          <button
                            key={option.value}
                            className={index === 0 ? "button" : "button-secondary"}
                            disabled={loadingState === "loading"}
                            onClick={() => void handleTryAnotherTiming(option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p>Need a different property or service? Change the request above.</p>
                    </article>
                  ) : null}
                  {recommendedProviderCard ? (
                    <article className="list-panel customer-booking-review">
                      <div className="search-result-title">
                        <h3>{recommendedProviderCard.provider.companyName}</h3>
                        <span className="result-badge">
                          {providerChoicePresentations[0]?.badge ?? "Recommended for this property"}
                        </span>
                      </div>

                      <div className="customer-booking-review__grid" aria-label="Booking summary">
                        <div>
                          <span>Price</span>
                          <strong>{quote ? formatCurrency(quote.estimatedPriceCents) : "Quote pending"}</strong>
                        </div>
                        <div>
                          <span>Opening</span>
                          <strong>{formatOpenWindow(recommendedProviderCard.slot)}</strong>
                        </div>
                        <div>
                          <span>Plan</span>
                          <strong>{selectedCadenceLabel}</strong>
                        </div>
                        <div>
                          <span>Property</span>
                          <strong>{activeProperty?.label ?? "Selected property"}</strong>
                        </div>
                        <div>
                          <span>Trust</span>
                          <strong>{formatProviderTrust(recommendedProviderCard.provider)}</strong>
                        </div>
                        <div>
                          <span>Distance</span>
                          <strong>
                            {recommendedProviderCard.ranking
                              ? `${recommendedProviderCard.ranking.distanceMiles.toFixed(1)} mi`
                              : `${recommendedProviderCard.provider.serviceRadiusMiles} mi radius`}
                          </strong>
                        </div>
                      </div>

                      {providerChoicePresentations[0] ? <p>{providerChoicePresentations[0].detail}</p> : null}
                      {recommendedProviderCard.ranking || providerChoicePresentations[0] ? (
                        <details className="service-card-disclosure">
                          <summary className="service-card-disclosure__summary">Why this pick</summary>
                          <div className="service-card-disclosure__body">
                            {providerChoicePresentations[0] ? (
                              <article className="list-panel">
                                <h3>{providerChoicePresentations[0].heading}</h3>
                                <p>{providerChoicePresentations[0].detail}</p>
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
                                  {recommendedProviderCard.ranking.distanceMiles.toFixed(1)} miles away •{" "}
                                  {recommendedProviderCard.ranking.reasons.join(" • ")}
                                </p>
                                <p>
                                  <strong>{recommendedProviderCard.ranking.neighborhoodFamiliarityLabel}.</strong>{" "}
                                  {recommendedProviderCard.ranking.neighborhoodFamiliarityDetail}
                                </p>
                                <p>
                                  <strong>{recommendedProviderCard.ranking.availabilityConfidenceLabel}.</strong>{" "}
                                  {formatCompletedJobTrustLine(recommendedProviderCard.ranking.completedJobCount)}
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
                          onClick={() => void handleCreateBooking(recommendedProviderCard, 1)}
                          type="button"
                        >
                          {quote
                            ? `${selectedCadence === "one-time" ? "Book for" : "Start for"} ${formatCurrency(
                                quote.estimatedPriceCents
                              )}`
                            : selectedCadence === "one-time"
                              ? "Book this visit"
                              : "Start repeat plan"}
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
                            Compare options
                          </button>
                        ) : null}
                      </div>
                      {!recommendedProviderCard.slot ? (
                        <p style={{ marginTop: "0.75rem" }}>
                          This business serves the area, but it does not have an open route window right now.
                        </p>
                      ) : null}
                    </article>
                  ) : null}
                  {(showAlternativeProviders ? alternativeProviderCards : []).map(({ provider, ranking, slot }, index) => {
                    return (
                      <article className="list-panel" key={provider.id}>
                        <div className="search-result-title">
                          <h3>{provider.companyName}</h3>
                          {providerChoicePresentations[index + 1] ? (
                            <span className="result-badge">{providerChoicePresentations[index + 1].badge}</span>
                          ) : null}
                          {provider.sponsoredListingEnabled ? <span className="result-badge">Sponsored</span> : null}
                        </div>
                        <p>
                          {provider.rating.toFixed(1)} overall • {provider.timelinessRating.toFixed(1)} punctuality
                        </p>
                        {providerChoicePresentations[index + 1] ? <p>{providerChoicePresentations[index + 1].detail}</p> : null}
                        <p>
                          Radius {provider.serviceRadiusMiles} miles •{" "}
                          {formatOpenWindow(slot)}
                        </p>
                        {ranking || providerChoicePresentations[index + 1] ? (
                          <details className="service-card-disclosure">
                            <summary className="service-card-disclosure__summary">Why this option</summary>
                            <div className="service-card-disclosure__body">
                              {providerChoicePresentations[index + 1] ? (
                                <article className="list-panel">
                                  <h3>{providerChoicePresentations[index + 1].heading}</h3>
                                  <p>{providerChoicePresentations[index + 1].detail}</p>
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
                                    {ranking.distanceMiles.toFixed(1)} miles away • {ranking.reasons.join(" • ")}
                                  </p>
                                  <p>
                                    <strong>{ranking.neighborhoodFamiliarityLabel}.</strong>{" "}
                                    {ranking.neighborhoodFamiliarityDetail}
                                  </p>
                                  <p>
                                    <strong>{ranking.availabilityConfidenceLabel}.</strong>{" "}
                                    {formatCompletedJobTrustLine(ranking.completedJobCount)}
                                  </p>
                                </article>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                        <div className="cta-row">
                          <button
                            className="button"
                            disabled={!slot || loadingState === "loading"}
                            onClick={() =>
                              void handleCreateBooking(
                                { provider, ranking, slot },
                                index + 2
                              )
                            }
                            type="button"
                          >
                            {quote
                              ? `${selectedCadence === "one-time" ? "Book for" : "Start for"} ${formatCurrency(
                                  quote.estimatedPriceCents
                                )}`
                              : selectedCadence === "one-time"
                                ? "Book this visit"
                                : "Start repeat plan"}
                          </button>
                        </div>
                        {!slot ? (
                          <p style={{ marginTop: "0.75rem" }}>
                            This business serves the area, but it does not have an open route window right now.
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
                  <h2>{getPriorityBookingCardTitle(nextBooking, nextBookingPayment)}</h2>
                  <p>{getBookingStateMessage(nextBooking, nextBookingProviderName, nextBookingPayment)}</p>
                </div>
                <strong>{formatCurrency(nextBooking.totalCents)}</strong>
              </div>

              <div className="customer-booking-review__grid" aria-label="Next visit summary">
                <div>
                  <span>Status</span>
                  <strong>{getPriorityBookingCardTitle(nextBooking, nextBookingPayment)}</strong>
                </div>
                <div>
                  <span>When</span>
                  <strong>{formatBookingWindowSummary(nextBooking.scheduledStartIso)}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{nextBookingProviderName}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{getPaymentLabel(nextBookingPayment)}</strong>
                </div>
                <div>
                  <span>Property</span>
                  <strong>{nextBooking.serviceAddress.line1}</strong>
                </div>
                <div>
                  <span>Price</span>
                  <strong>{formatCurrency(nextBooking.totalCents)}</strong>
                </div>
              </div>

              {nextBookingHasPrimaryAction ? (
                <div className="cta-row">
                  {nextBookingNeedsCheckout ? (
                    <button
                      className="button"
                      disabled={loadingState === "loading"}
                      onClick={() => void handleStartCheckout(nextBooking)}
                      type="button"
                    >
                      {nextBookingPayment?.status === "pending" ? "Continue checkout" : "Pay now"}
                    </button>
                  ) : null}
                  {nextBookingHasTracking ? (
                    <button
                      className="button"
                      disabled={loadingState === "loading"}
                      onClick={() => void openArrivalTracking(nextBooking.id)}
                      type="button"
                    >
                      Track crew
                    </button>
                  ) : null}
                  {nextBookingNeedsPrimarySupport ? (
                    <a
                      className="button"
                      href={`/help?bookingId=${encodeURIComponent(nextBooking.id)}&issueType=${encodeURIComponent(
                        nextBooking.onRouteConfirmedAt || nextBooking.activeExceptionType ? "service-quality" : "general"
                      )}&subject=${encodeURIComponent(
                        nextBooking.onRouteConfirmedAt
                          ? "On-route support"
                          : nextBooking.activeExceptionType
                            ? getBookingExceptionLabel(nextBooking.activeExceptionType)
                            : "Booking support"
                      )}`}
                    >
                      Get help
                    </a>
                  ) : null}
                </div>
              ) : null}

              {nextBookingHasPrimaryAction || !nextBookingNeedsPrimarySupport ? (
                <details className="service-card-disclosure">
                  <summary className="service-card-disclosure__summary">More options</summary>
                  <div className="service-card-disclosure__body">
                    <div className="cta-row">
                      {nextBookingHasTracking ? (
                        <button
                          className="button-secondary"
                          disabled={loadingState === "loading"}
                          onClick={() => void openCustomerChat(nextBooking.id)}
                          type="button"
                        >
                          Message business
                        </button>
                      ) : null}
                      {!nextBookingNeedsPrimarySupport ? (
                        <a
                          className="button-secondary"
                          href={`/help?bookingId=${encodeURIComponent(nextBooking.id)}&issueType=${encodeURIComponent(
                            nextBooking.onRouteConfirmedAt || nextBooking.activeExceptionType ? "service-quality" : "general"
                          )}&subject=${encodeURIComponent(
                            nextBooking.onRouteConfirmedAt
                              ? "On-route support"
                              : nextBooking.activeExceptionType
                                ? getBookingExceptionLabel(nextBooking.activeExceptionType)
                                : "Booking support"
                          )}`}
                        >
                          Get help
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
                  <h2>Book again</h2>
                  <p>{primaryRetentionOpportunity.message}</p>
                </div>
                <span className="result-badge">
                  {primaryRetentionOpportunity.recommendedCadence === "one-time"
                    ? "One-time rebook"
                    : formatRecurringFrequency(primaryRetentionOpportunity.recommendedCadence)}
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
                  <h2>Repeat service is set</h2>
                  <p>
                    {primaryRecurringPlan.upcomingBooking
                      ? `Next visit ${formatBookingWindowSummary(primaryRecurringPlan.upcomingBooking.scheduledStartIso)} with ${primaryRecurringPlan.providerName}.`
                      : `${primaryRecurringPlan.providerName} is still set for repeat service.`}
                  </p>
                </div>
                <span className="result-badge">{formatRecurringFrequency(primaryRecurringPlan.plan.frequency)}</span>
              </div>
              <div className="cta-row">
                <a className="button" href="/customer/dashboard?flow=request">
                  Start request
                </a>
              </div>
            </section>
          ) : (
            <section className="card">
              <div className="search-result-title">
                <div>
                  <h2>{hasAccountHistory ? "Ready for another visit?" : "Need service?"}</h2>
                  <p>
                    {hasAccountHistory
                      ? "Start one request. We will price it first, then show the best fit."
                      : "Start one request. Visits, reviews, and repeat service will show up here after that."}
                  </p>
                </div>
                <a className="button" href="/customer/dashboard?flow=request">
                  Request service
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
                    ? "Other repeat options"
                    : "Book again"
                  : "Past repeat plans"}
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
                      {sectionAdditionalBookAgainOptionCount === 1
                        ? "1 other repeat option"
                        : `${sectionAdditionalBookAgainOptionCount} other repeat options`}
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
                    <summary className="service-card-disclosure__summary">Past repeat plans</summary>
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
                  <h2>{priorityCardKind === "booking" ? "Other visits" : "Happening now"}</h2>
                  <div className="stack-lg" style={{ paddingBottom: 0 }}>
                    {renderActiveBookingCard(sectionSpotlightBooking)}
                    {sectionAdditionalActiveBookings.length ? (
                      <details className="service-card-disclosure">
                        <summary className="service-card-disclosure__summary">
                          {sectionAdditionalActiveBookings.length === 1
                            ? "1 other visit"
                            : `${sectionAdditionalActiveBookings.length} other visits`}
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
                  <h2>{priorityCardKind === "review" ? "Other reviews" : "Ready to review"}</h2>
                  <div className="stack-lg" style={{ paddingBottom: 0 }}>
                    {renderReviewOpportunityCard(sectionSpotlightReviewOpportunity)}
                    {sectionAdditionalReviewOpportunities.length ? (
                      <details className="service-card-disclosure">
                        <summary className="service-card-disclosure__summary">
                          {sectionAdditionalReviewOpportunities.length === 1
                            ? "1 other review"
                            : `${sectionAdditionalReviewOpportunities.length} other reviews`}
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
          inputPlaceholder="Message the business about arrival or access."
          isOpen={Boolean(activeChatBookingId)}
          launcherLabel="Open chat"
          messages={chatThread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            senderLabel:
              message.senderRole === "customer"
                ? "You"
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
          title="Business chat"
        />
      ) : null}
    </main>
  );
}
