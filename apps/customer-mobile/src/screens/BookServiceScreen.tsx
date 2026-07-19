import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  I18nInstance,
  TranslationKey
} from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import {
  AvailabilitySlot,
  buildCustomerProviderChoicePresentations,
  CreateCustomerPropertyRequest,
  CustomerProperty,
  getBookingServiceWindow,
  InstantQuoteResponse,
  SearchProvidersResponse,
  SearchProviderResult,
  ServiceCategory
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { CustomerPropertyForm } from "../components/CustomerPropertyForm";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { getCustomerMobileTracker } from "../lib/tracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

const serviceOptions: ServiceCategory[] = [
  "lawn-mowing",
  "hedge-trimming",
  "mulch-installation",
  "seasonal-cleanup",
  "weed-control"
];

type CustomerTimingPreference =
  | "tomorrow-morning"
  | "tomorrow-afternoon"
  | "tomorrow-evening"
  | "day-after-morning"
  | "day-after-afternoon";

type RequestStepStatus = "complete" | "current" | "pending";

const customerTimingOptions: Array<{ value: CustomerTimingPreference; labelKey: TranslationKey }> = [
  { value: "tomorrow-morning", labelKey: "customer.timing.tomorrow_morning" },
  { value: "tomorrow-afternoon", labelKey: "customer.timing.tomorrow_afternoon" },
  { value: "tomorrow-evening", labelKey: "customer.timing.tomorrow_evening" },
  { value: "day-after-morning", labelKey: "customer.timing.day_after_morning" },
  { value: "day-after-afternoon", labelKey: "customer.timing.day_after_afternoon" }
];

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

function getAlternativeTimingSuggestions(selectedTiming: CustomerTimingPreference) {
  const selectedIndex = customerTimingOptions.findIndex((option) => option.value === selectedTiming);

  if (selectedIndex === -1) {
    return customerTimingOptions.slice(0, 2);
  }

  return [...customerTimingOptions.slice(selectedIndex + 1), ...customerTimingOptions.slice(0, selectedIndex)].slice(0, 2);
}

function formatServiceLabel(i18n: I18nInstance, service: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(service));
}

function formatPrice(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents, "USD", { maximumFractionDigits: 0 });
}

function formatOpenWindow(i18n: I18nInstance, slot?: AvailabilitySlot) {
  if (!slot) {
    return i18n.t("customer_live.no_open_slot");
  }

  const window = getBookingServiceWindow(slot.startIso);
  return i18n.t("booking.window.summary", {
    label: i18n.t(bookingWindowLabelKeys[window.key]),
    range: i18n.t(bookingWindowRangeKeys[window.key])
  });
}

function formatProviderTrust(i18n: I18nInstance, provider: SearchProviderResult["provider"]) {
  return i18n.t("common.format.rating_reviews", {
    rating: provider.rating,
    count: provider.reviewCount
  });
}

function formatProviderDistance(i18n: I18nInstance, distanceMiles: number) {
  return distanceMiles < 1
    ? i18n.t("mobile.book.nearby")
    : i18n.t("common.format.miles", { count: Number(distanceMiles.toFixed(1)) });
}

function formatProviderServiceRadius(i18n: I18nInstance, radiusMiles: number) {
  return i18n.t("customer_live.provider.mile_radius", { count: radiusMiles });
}

function getProviderOpenSlots(providerId: string, slots: AvailabilitySlot[], preferredSlot?: AvailabilitySlot) {
  return [
    preferredSlot,
    ...slots.filter((slot) => slot.providerId === providerId && !slot.isBooked)
  ]
    .filter((slot): slot is AvailabilitySlot => Boolean(slot))
    .filter((slot, index, allSlots) => allSlots.findIndex((item) => item.id === slot.id) === index)
    .slice(0, 3);
}

function getRequestStepStatus(stepIndex: number, activeStepIndex: number): RequestStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function getCompanyInitials(companyName: string) {
  return companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function RequestNextSteps({ i18n }: { i18n: I18nInstance }) {
  const steps = [
    { label: i18n.t("customer_live.progress.request"), value: i18n.t("common.state.no_charge_yet") },
    { label: i18n.t("provider_live.action.confirm"), value: i18n.t("mobile.book.provider_reviews") },
    { label: i18n.t("mobile.book.pay"), value: i18n.t("customer_live.payment.after_provider_confirms") }
  ];

  return (
    <View style={styles.requestNextSteps}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.requestNextStep}>
          <View style={styles.requestNextStepIndex}>
            <Text style={styles.requestNextStepIndexLabel}>{index + 1}</Text>
          </View>
          <View style={styles.requestNextStepCopy}>
            <Text style={styles.requestNextStepLabel}>{step.label}</Text>
            <Text style={styles.requestNextStepValue}>{step.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function buildDateIsoForCustomerTiming(timing: CustomerTimingPreference) {
  const date = new Date();
  const isDayAfter = timing.startsWith("day-after");
  const windowPart = timing.endsWith("morning")
    ? "morning"
    : timing.endsWith("afternoon")
      ? "afternoon"
      : "evening";

  date.setDate(date.getDate() + (isDayAfter ? 2 : 1));

  if (windowPart === "morning") {
    date.setHours(9, 0, 0, 0);
  } else if (windowPart === "afternoon") {
    date.setHours(14, 0, 0, 0);
  } else {
    date.setHours(18, 0, 0, 0);
  }

  return date.toISOString();
}

export function BookServiceScreen({
  onOpenBookings
}: {
  onOpenBookings?: () => void;
}) {
  const i18n = useI18n();
  const tracker = getCustomerMobileTracker();
  const { envelope } = useCustomerSession();
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>("tomorrow-morning");
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [quote, setQuote] = useState<InstantQuoteResponse | undefined>();
  const [providers, setProviders] = useState<SearchProviderResult[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [recommendationContext, setRecommendationContext] = useState<
    Pick<SearchProvidersResponse, "recommendationSessionId" | "recommendedProviderId"> | undefined
  >();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [isPropertyModalVisible, setIsPropertyModalVisible] = useState(false);
  const [showAlternativeProviders, setShowAlternativeProviders] = useState(false);
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const [showRecommendedWhy, setShowRecommendedWhy] = useState(false);
  const [showAlternativeWhy, setShowAlternativeWhy] = useState<Record<string, boolean>>({});
  const [selectedSlotIdByProvider, setSelectedSlotIdByProvider] = useState<Record<string, string>>({});

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? properties[0],
    [properties, selectedPropertyId]
  );
  const selectedTimingLabel =
    customerTimingOptions.find((option) => option.value === selectedTiming)?.labelKey
      ? i18n.t(customerTimingOptions.find((option) => option.value === selectedTiming)?.labelKey ?? "customer.timing.tomorrow_morning")
      : i18n.t("customer.timing.tomorrow_morning");
  const alternativeTimingSuggestions = getAlternativeTimingSuggestions(selectedTiming);
  const selectedServiceLabel = formatServiceLabel(i18n, selectedService);

  function resetMatchState() {
    setQuote(undefined);
    setProviders([]);
    setSlots([]);
    setRecommendationContext(undefined);
    setSearchState("idle");
    setShowAlternativeProviders(false);
    setShowQuoteDetails(false);
    setShowRecommendedWhy(false);
    setShowAlternativeWhy({});
    setSelectedSlotIdByProvider({});
  }

  function handleChangeDetails() {
    resetMatchState();
    setMessage("");
    setErrorMessage("");
  }

  async function runProviderSearch(nextQuote: InstantQuoteResponse, timingPreference: CustomerTimingPreference) {
    if (!activeProperty || !envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setMessage("");
      setSearchState("loading");
      if (timingPreference !== selectedTiming) {
        setSelectedTiming(timingPreference);
      }
      if (recommendationContext?.recommendationSessionId) {
        await tracker.track(MarketplaceTelemetryEventCatalog.recommendationDismissed, {
          recommendationSessionId: recommendationContext.recommendationSessionId,
          recommendedProviderId: recommendationContext.recommendedProviderId ?? "none",
          requestSource: "customer-mobile-book",
          service: selectedService
        });
      }
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const providerSearch = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedService],
        dateIso: buildDateIsoForCustomerTiming(timingPreference),
        estimatedDurationMinutes: nextQuote.estimatedDurationMinutes,
        requestSource: "customer-mobile-book"
      });
      setProviders(providerSearch.rankedProviders);
      setSlots(providerSearch.suggestedSlots);
      setSelectedSlotIdByProvider({});
      setRecommendationContext({
        recommendationSessionId: providerSearch.recommendationSessionId,
        recommendedProviderId: providerSearch.recommendedProviderId
      });
      setShowAlternativeProviders(false);
      setSearchState("loaded");
    } catch (error) {
      setSearchState("error");
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.search_providers"));
    } finally {
      setIsWorking(false);
    }
  }

  async function loadProperties() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextProperties = await api.getCustomerProperties();
      setProperties(nextProperties);
      setSelectedPropertyId(nextProperties.find((property) => property.isDefault)?.id ?? nextProperties[0]?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.book.error.load_properties"));
    }
  }

  useEffect(() => {
    void loadProperties();
  }, [envelope?.session.token]);

  const handleBuildQuote = async () => {
    if (!activeProperty || !envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextQuote = await api.createInstantQuote({
        address: activeProperty.address,
        category: selectedService,
        propertyId: activeProperty.id
      });
      setQuote(nextQuote);
      setProviders([]);
      setSlots([]);
      setRecommendationContext(undefined);
      setShowQuoteDetails(false);
      setShowRecommendedWhy(false);
      setShowAlternativeWhy({});
      await runProviderSearch(nextQuote, selectedTiming);
    } catch (error) {
      setSearchState("error");
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.build_quote"));
    } finally {
      setIsWorking(false);
    }
  };

  async function handleCreateProperty(payload: CreateCustomerPropertyRequest) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const property = await api.createCustomerProperty(payload);
      await loadProperties();
      setSelectedPropertyId(property.id);
      setIsPropertyModalVisible(false);
      resetMatchState();
      setMessage(i18n.t("mobile.book.message.property_ready", { property: property.label }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.book.error.save_property"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateBooking(provider: SearchProviderResult, rank: number, selectedSlot?: AvailabilitySlot) {
    if (!quote || !activeProperty || !envelope?.session.token) {
      return;
    }

    const slot =
      selectedSlot ??
      provider.suggestedSlot ??
      slots.find((item) => item.providerId === provider.provider.id && !item.isBooked);
    if (!slot) {
      setErrorMessage(i18n.t("mobile.book.error.no_open_slot_provider"));
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createBooking({
        providerId: provider.provider.id,
        serviceAddress: activeProperty.address,
        servicePropertyId: activeProperty.id,
        category: selectedService,
        scheduledStartIso: slot.startIso,
        scheduledEndIso: slot.endIso,
        notes: i18n.t("mobile.book.booking_note"),
        totalCents: quote.estimatedPriceCents,
        recommendationSessionId: recommendationContext?.recommendationSessionId,
        recommendedProviderId: recommendationContext?.recommendedProviderId,
        selectedProviderRank: rank,
        viewedAlternativeProviders: showAlternativeProviders,
        recommendationSource: "customer-mobile-book"
      });
      setMessage(
        i18n.t("customer_live.message.booking_requested", {
          provider: provider.provider.companyName,
          window: formatOpenWindow(i18n, slot)
        })
      );
      setRecommendationContext(undefined);
      resetMatchState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("customer_live.error.create_booking"));
    } finally {
      setIsWorking(false);
    }
  }

  const providerCards = providers.map((ranking) => ({
    provider: ranking.provider,
    ranking,
    slot: ranking.suggestedSlot ?? slots.find((item) => item.providerId === ranking.provider.id && !item.isBooked)
  }));
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(providers);
  const shortlist = providerCards.slice(0, 3);
  const recommendedProviderCard = shortlist[0];
  const alternativeProviderCards = shortlist.slice(1);
  const recommendedProviderOpenSlots = recommendedProviderCard
    ? getProviderOpenSlots(recommendedProviderCard.provider.id, slots, recommendedProviderCard.slot)
    : [];
  const selectedRecommendedSlot =
    recommendedProviderOpenSlots.find(
      (slot) => recommendedProviderCard && slot.id === selectedSlotIdByProvider[recommendedProviderCard.provider.id]
    ) ??
    recommendedProviderCard?.slot ??
    recommendedProviderOpenSlots[0];
  const providersWithWindows = providerCards.filter((item) => item.slot);
  const activeStepIndex = recommendedProviderCard ? 3 : quote ? 2 : 0;
  const requestSteps = [
    { label: i18n.t("customer_live.progress.details"), value: activeProperty?.label ?? i18n.t("customer_live.label.property") },
    { label: i18n.t("customer_live.progress.price"), value: quote ? formatPrice(i18n, quote.estimatedPriceCents) : i18n.t("customer_live.next") },
    {
      label: i18n.t("customer_live.progress.match"),
      value: recommendedProviderCard
        ? recommendedProviderCard.provider.companyName
        : searchState === "loading"
          ? i18n.t("common.loading.checking")
          : i18n.t("customer_live.after_price")
    },
    {
      label: i18n.t("customer_live.progress.request"),
      value: recommendedProviderCard?.slot ? formatOpenWindow(i18n, recommendedProviderCard.slot) : i18n.t("provider_live.action.review")
    }
  ].map((step, index) => ({
    ...step,
    status: getRequestStepStatus(index, activeStepIndex)
  }));

  return (
    <ScreenShell
      eyebrow={i18n.t("mobile.book.eyebrow")}
      title={i18n.t("mobile.book.title")}
      description={i18n.t("mobile.book.description")}
    >
      {message ? (
        <InfoCard title={i18n.t("provider_live.updated")} description={message}>
          <Pressable onPress={onOpenBookings} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{i18n.t("mobile.book.go_to_visits")}</Text>
          </Pressable>
        </InfoCard>
      ) : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <View style={styles.progressCard}>
        <View style={styles.progressGrid}>
          {requestSteps.map((step, index) => (
            <View key={step.label} style={[styles.progressStep, styles[`progressStep_${step.status}`]]}>
              <View style={[styles.progressIndex, styles[`progressIndex_${step.status}`]]}>
                <Text style={[styles.progressIndexLabel, styles[`progressIndexLabel_${step.status}`]]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.progressCopy}>
                <Text style={styles.progressLabel}>{step.label}</Text>
                <Text numberOfLines={2} style={styles.progressValue}>
                  {step.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <InfoCard
        title={i18n.t("customer_live.progress.details")}
        description={quote ? i18n.t("provider_live.step.ready") : activeProperty ? `${selectedServiceLabel} • ${selectedTimingLabel}` : i18n.t("mobile.book.add_property_to_start")}
      >
        {quote ? (
          <View style={styles.detailSummaryStack}>
            <View style={styles.bookingFactGrid}>
              <View style={styles.bookingFactItem}>
                <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.label.service")}</Text>
                <Text style={styles.bookingFactValue}>{selectedServiceLabel}</Text>
              </View>
              <View style={styles.bookingFactItem}>
                <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.label.when")}</Text>
                <Text style={styles.bookingFactValue}>{selectedTimingLabel}</Text>
              </View>
              <View style={styles.bookingFactItem}>
                <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.label.property")}</Text>
                <Text style={styles.bookingFactValue}>{activeProperty?.label ?? i18n.t("customer_live.selected_property")}</Text>
              </View>
              <View style={styles.bookingFactItem}>
                <Text style={styles.bookingFactLabel}>{i18n.t("common.label.address")}</Text>
                <Text numberOfLines={2} style={styles.bookingFactValue}>
                  {quote.normalizedAddress.displayLabel}
                </Text>
              </View>
            </View>
            <Pressable onPress={handleChangeDetails} style={styles.secondaryButtonInline}>
              <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("customer_live.action.change_details")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.detailSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>{i18n.t("customer_live.label.service")}</Text>
                <Text style={styles.detailValue}>{selectedServiceLabel}</Text>
              </View>
              <View style={styles.chipWrap}>
                {serviceOptions.map((option) => {
                  const isActive = option === selectedService;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSelectedService(option);
                        resetMatchState();
                      }}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                        {formatServiceLabel(i18n, option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>{i18n.t("customer_live.label.when")}</Text>
                <Text style={styles.detailValue}>{selectedTimingLabel}</Text>
              </View>
              <View style={styles.chipWrap}>
                {customerTimingOptions.map((option) => {
                  const isActive = option.value === selectedTiming;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setSelectedTiming(option.value);
                        resetMatchState();
                      }}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{i18n.t(option.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>{i18n.t("customer_live.label.property")}</Text>
                <Text numberOfLines={1} style={styles.detailValue}>
                  {activeProperty ? activeProperty.label : i18n.t("provider_live.step.needed")}
                </Text>
              </View>

              {properties.length === 0 ? (
                <View style={styles.propertyStack}>
                  <Text style={styles.emptyState}>{i18n.t("mobile.book.add_property_before_price")}</Text>
                  <Pressable
                    disabled={isWorking}
                    onPress={() => setIsPropertyModalVisible(true)}
                    style={styles.secondaryButtonInline}
                  >
                    <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("mobile.book.add_property")}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.propertyStack}>
                    {properties.map((property) => {
                      const isActive = property.id === selectedPropertyId;
                      return (
                        <Pressable
                          key={property.id}
                          onPress={() => {
                            setSelectedPropertyId(property.id);
                            resetMatchState();
                          }}
                          style={[styles.propertyRow, isActive && styles.propertyRowActive]}
                        >
                          <View style={styles.propertyCopy}>
                            <Text style={styles.propertyLabel}>{property.label}</Text>
                            <Text style={styles.propertyAddress}>{property.address.line1}</Text>
                          </View>
                          {property.isDefault ? <Text style={styles.defaultBadge}>{i18n.t("mobile.book.default_property")}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable onPress={() => setIsPropertyModalVisible(true)} style={styles.secondaryButtonInline}>
                    <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("mobile.book.add_property")}</Text>
                  </Pressable>
                  <Pressable disabled={isWorking} onPress={() => void handleBuildQuote()} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonLabel}>
                      {isWorking ? i18n.t("common.loading.checking") : i18n.t("mobile.book.see_price_and_crews")}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </InfoCard>

      {quote ? (
        <>
          <InfoCard
            title={i18n.t("mobile.book.quote")}
            description={i18n.t("mobile.book.quote_description")}
          >
            <View style={styles.priceSummary}>
              <Text style={styles.priceAmount}>{formatPrice(i18n, quote.estimatedPriceCents)}</Text>
              <Text style={styles.priceCaption}>{i18n.t("mobile.book.price_caption")}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factPill}>{i18n.t("provider_live.duration.minutes", { count: quote.estimatedDurationMinutes })}</Text>
              <Text style={styles.factPill}>{i18n.t("mobile.book.crew_count", { count: quote.estimatedCrewSize })}</Text>
              <Text style={styles.factPill}>{selectedServiceLabel}</Text>
            </View>
            <Text style={styles.quoteSummary}>{quote.estimateSummary}</Text>
            <Text style={styles.providerMeta}>{quote.normalizedAddress.displayLabel}</Text>
            <Pressable onPress={() => setShowQuoteDetails((current) => !current)} style={styles.secondaryButtonInline}>
              <Text style={styles.secondaryButtonInlineLabel}>
                {showQuoteDetails ? i18n.t("common.actions.close") : i18n.t("mobile.book.how_price_works")}
              </Text>
            </Pressable>
            {showQuoteDetails ? (
              <View style={styles.providerStack}>
                {quote.normalizedAddress.validationMessage ? (
                  <Text style={styles.providerMeta}>{quote.normalizedAddress.validationMessage}</Text>
                ) : null}
                {quote.confidenceReasons.slice(0, 2).map((reason) => (
                  <Text key={`${reason.impact}-${reason.label}`} style={styles.providerMeta}>
                    {reason.label}: {reason.detail}
                  </Text>
                ))}
              </View>
            ) : null}
          </InfoCard>

          <InfoCard
            title={i18n.t("customer_live.provider.best_match")}
            description={
              recommendedProviderCard && selectedRecommendedSlot
                ? i18n.t("mobile.book.opening_description", {
                    window: formatOpenWindow(i18n, selectedRecommendedSlot)
                  })
                : i18n.t("mobile.book.first_checked", { timing: selectedTimingLabel })
            }
          >
            {searchState === "loading" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>{i18n.t("mobile.book.checking_nearby_openings")}</Text>
              </View>
            ) : searchState === "error" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>{i18n.t("mobile.book.match_check_failed")}</Text>
                <Text style={styles.providerMeta}>{i18n.t("mobile.book.price_still_ready")}</Text>
                <Pressable
                  disabled={isWorking}
                  onPress={() => {
                    if (quote) {
                      void runProviderSearch(quote, selectedTiming);
                    }
                  }}
                  style={styles.secondaryButtonInline}
                >
                  <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("common.actions.try_again")}</Text>
                </Pressable>
              </View>
            ) : providers.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>{i18n.t("customer_live.provider.no_verified.title")}</Text>
                <Text style={styles.providerMeta}>{i18n.t("customer_live.provider.no_verified.body")}</Text>
                <Pressable onPress={handleChangeDetails} style={styles.secondaryButtonInline}>
                  <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("customer_live.action.change_details")}</Text>
                </Pressable>
              </View>
            ) : providersWithWindows.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>
                  {i18n.t("customer_live.provider.no_openings.title", { timing: selectedTimingLabel })}
                </Text>
                <Text style={styles.providerMeta}>{i18n.t("customer_live.provider.no_openings.body")}</Text>
                <View style={styles.providerStack}>
                  {alternativeTimingSuggestions.map((option) => (
                    <Pressable
                      key={option.value}
                      disabled={isWorking || !quote}
                      onPress={() => {
                        if (quote) {
                          void runProviderSearch(quote, option.value);
                        }
                      }}
                      style={styles.secondaryButtonInline}
                    >
                      <Text style={styles.secondaryButtonInlineLabel}>{i18n.t(option.labelKey)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.providerMeta}>{i18n.t("customer_live.provider.change_request_hint")}</Text>
              </View>
            ) : (
              <View style={styles.providerStack}>
                {recommendedProviderCard ? (
                  <View style={styles.recommendedCard}>
                    <View style={styles.providerTopRow}>
                      <View style={styles.providerAvatar}>
                        <Text style={styles.providerAvatarLabel}>
                          {getCompanyInitials(recommendedProviderCard.provider.companyName)}
                        </Text>
                      </View>
                      <View style={styles.providerCopy}>
                        <Text style={styles.providerBadge}>
                          {providerChoicePresentations[0]?.badge ?? i18n.t("customer_live.provider.recommended_match")}
                        </Text>
                        <Text style={styles.providerName}>{recommendedProviderCard.provider.companyName}</Text>
                        <Text style={styles.providerMeta}>
                          {i18n.t("mobile.book.opening_description", {
                            window: formatOpenWindow(i18n, recommendedProviderCard.slot)
                          })}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.marketSignalRow}>
                      <Text style={styles.marketSignalPill}>
                        {i18n.t("mobile.book.stars", { rating: recommendedProviderCard.provider.rating })}
                      </Text>
                      <Text style={styles.marketSignalPill}>
                        {i18n.t("mobile.book.review_count", { count: recommendedProviderCard.provider.reviewCount })}
                      </Text>
                      <Text style={styles.marketSignalPill}>
                        {formatProviderDistance(i18n, recommendedProviderCard.ranking.distanceMiles)}
                      </Text>
                    </View>

                    <View style={styles.bookingFactGrid}>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.progress.price")}</Text>
                        <Text style={styles.bookingFactValue}>{formatPrice(i18n, quote.estimatedPriceCents)}</Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.provider.opening")}</Text>
                        <Text style={styles.bookingFactValue}>{formatOpenWindow(i18n, selectedRecommendedSlot)}</Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>{i18n.t("provider_live.step.crew")}</Text>
                        <Text style={styles.bookingFactValue}>
                          {i18n.t("mobile.book.crew_duration", {
                            crewCount: quote.estimatedCrewSize,
                            minutes: quote.estimatedDurationMinutes
                          })}
                        </Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>{i18n.t("customer_live.label.property")}</Text>
                        <Text style={styles.bookingFactValue}>
                          {activeProperty?.label ?? i18n.t("customer_live.selected_property")}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.providerDecisionLine}>
                      {providerChoicePresentations[0]?.heading ?? recommendedProviderCard.ranking.selectionSummaryLabel}
                    </Text>
                    <ProviderOpeningChoices
                      onSelect={(slotId) =>
                        setSelectedSlotIdByProvider((current) => ({
                          ...current,
                          [recommendedProviderCard.provider.id]: slotId
                        }))
                      }
                      selectedSlotId={selectedRecommendedSlot?.id}
                      slots={recommendedProviderOpenSlots}
                      i18n={i18n}
                    />
                    <RequestNextSteps i18n={i18n} />
                    <Pressable
                      disabled={isWorking || !selectedRecommendedSlot}
                      onPress={() => void handleCreateBooking(recommendedProviderCard.ranking, 1, selectedRecommendedSlot)}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonLabel}>{i18n.t("customer_live.action.request_this_time")}</Text>
                    </Pressable>
                    <View style={styles.providerStack}>
                      <Pressable
                        onPress={() => setShowRecommendedWhy((current) => !current)}
                        style={styles.secondaryButtonInline}
                      >
                        <Text style={styles.secondaryButtonInlineLabel}>
                          {showRecommendedWhy ? i18n.t("common.actions.close") : i18n.t("customer_live.provider.why_pick")}
                        </Text>
                      </Pressable>
                      {showRecommendedWhy ? (
                        <View style={styles.providerStack}>
                          {providerChoicePresentations[0] ? (
                            <Text style={styles.providerMeta}>
                              <Text style={styles.providerChoiceHeading}>
                                {providerChoicePresentations[0].heading}.{" "}
                              </Text>
                              {providerChoicePresentations[0].detail}
                            </Text>
                          ) : null}
                          <Text style={styles.providerMeta}>
                            <Text style={styles.providerChoiceHeading}>
                              {recommendedProviderCard.ranking.selectionSummaryLabel}.{" "}
                            </Text>
                            {recommendedProviderCard.ranking.selectionSummaryDetail}
                          </Text>
                          <Text style={styles.providerMeta}>
                            <Text style={styles.providerChoiceHeading}>
                              {recommendedProviderCard.ranking.reliabilityLabel}.{" "}
                            </Text>
                            {recommendedProviderCard.ranking.reliabilityDetail}
                          </Text>
                          <Text style={styles.providerMeta}>
                            {recommendedProviderCard.ranking.neighborhoodFamiliarityLabel}.{" "}
                            {recommendedProviderCard.ranking.neighborhoodFamiliarityDetail}
                          </Text>
                          <Text style={styles.providerMeta}>
                            {recommendedProviderCard.ranking.reasons.join(" • ")}
                          </Text>
                          <ProviderTrustProfile ranking={recommendedProviderCard.ranking} i18n={i18n} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {alternativeProviderCards.length > 0 && !showAlternativeProviders ? (
                  <View style={styles.providerStack}>
                    <Pressable
                      onPress={() => {
                        setShowAlternativeProviders(true);
                        void tracker.track(
                          MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
                          {
                            recommendationSessionId: recommendationContext?.recommendationSessionId ?? "unknown",
                            recommendedProviderId: recommendationContext?.recommendedProviderId ?? "none",
                            providerCount: shortlist.length,
                            requestSource: "customer-mobile-book",
                            service: selectedService
                          }
                        );
                      }}
                      style={styles.secondaryButtonInline}
                    >
                      <Text style={styles.secondaryButtonInlineLabel}>{i18n.t("customer_live.provider.compare_options")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {(showAlternativeProviders ? alternativeProviderCards : []).map(({ provider, ranking, slot }, index) => {
                  const openSlots = getProviderOpenSlots(provider.id, slots, slot);
                  const selectedAlternativeSlot =
                    openSlots.find((item) => item.id === selectedSlotIdByProvider[provider.id]) ?? slot ?? openSlots[0];
                  const presentation = providerChoicePresentations[index + 1];

                  return (
                    <View key={provider.id} style={styles.alternativeCard}>
                      <View style={styles.providerTopRow}>
                        <View style={styles.providerAvatarSmall}>
                          <Text style={styles.providerAvatarLabel}>{getCompanyInitials(provider.companyName)}</Text>
                        </View>
                        <View style={styles.providerCopy}>
                          {presentation ? <Text style={styles.providerBadge}>{presentation.badge}</Text> : null}
                          <Text style={styles.providerName}>{provider.companyName}</Text>
                          <Text style={styles.providerChoiceDetail}>{ranking.selectionSummaryLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.marketSignalRow}>
                        <Text style={styles.marketSignalPill}>{formatProviderTrust(i18n, provider)}</Text>
                        <Text style={styles.marketSignalPill}>{formatProviderDistance(i18n, ranking.distanceMiles)}</Text>
                        <Text style={styles.marketSignalPill}>{formatPrice(i18n, quote.estimatedPriceCents)}</Text>
                      </View>
                      <ProviderOpeningChoices
                        onSelect={(slotId) =>
                          setSelectedSlotIdByProvider((current) => ({
                            ...current,
                            [provider.id]: slotId
                          }))
                        }
                        selectedSlotId={selectedAlternativeSlot?.id}
                        slots={openSlots}
                        i18n={i18n}
                      />
                      <Pressable
                        onPress={() =>
                          setShowAlternativeWhy((current) => ({
                            ...current,
                            [provider.id]: !current[provider.id]
                          }))
                        }
                        style={styles.secondaryButtonInline}
                      >
                        <Text style={styles.secondaryButtonInlineLabel}>
                          {showAlternativeWhy[provider.id]
                            ? i18n.t("common.actions.close")
                            : i18n.t("customer_live.provider.why_option")}
                        </Text>
                      </Pressable>
                      {showAlternativeWhy[provider.id] ? (
                        <View style={styles.providerStack}>
                          {presentation ? (
                            <Text style={styles.providerMeta}>
                              <Text style={styles.providerChoiceHeading}>{presentation.heading}. </Text>
                              {presentation.detail}
                            </Text>
                          ) : null}
                          <Text style={styles.providerMeta}>
                            <Text style={styles.providerChoiceHeading}>{ranking.selectionSummaryLabel}. </Text>
                            {ranking.selectionSummaryDetail}
                          </Text>
                          <Text style={styles.providerMeta}>
                            <Text style={styles.providerChoiceHeading}>{ranking.reliabilityLabel}. </Text>
                            {ranking.reliabilityDetail}
                          </Text>
                          <Text style={styles.providerMeta}>
                            {ranking.neighborhoodFamiliarityLabel}. {ranking.neighborhoodFamiliarityDetail}
                          </Text>
                          <Text style={styles.providerMeta}>{ranking.reasons.join(" • ")}</Text>
                          <ProviderTrustProfile ranking={ranking} i18n={i18n} />
                        </View>
                      ) : null}
                      <Pressable
                        disabled={isWorking || !selectedAlternativeSlot}
                        onPress={() => void handleCreateBooking(ranking, index + 2, selectedAlternativeSlot)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonLabel}>{i18n.t("customer_live.action.request_this_time")}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </InfoCard>
        </>
      ) : null}

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
        visible={isPropertyModalVisible}
      >
        <View style={styles.modalShell}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>{i18n.t("customer_live.label.property")}</Text>
              <Text style={styles.modalTitle}>
                {properties.length === 0
                  ? i18n.t("mobile.book.add_first_property")
                  : i18n.t("mobile.book.add_another_property")}
              </Text>
              <Text style={styles.modalDescription}>{i18n.t("mobile.book.property_modal_description")}</Text>
            </View>
            <Pressable onPress={() => setIsPropertyModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonLabel}>{i18n.t("common.actions.close")}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <CustomerPropertyForm
              isWorking={isWorking}
              onSubmit={handleCreateProperty}
              submitLabel={
                properties.length === 0 ? i18n.t("mobile.book.save_property") : i18n.t("mobile.book.add_property")
              }
            />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function ProviderTrustProfile({ ranking, i18n }: { ranking: SearchProviderResult; i18n: I18nInstance }) {
  const { provider } = ranking;
  const facts = [
    {
      label: i18n.t("mobile.book.experience"),
      value: i18n.t("mobile.book.experience_years", { count: provider.yearsExperience })
    },
    {
      label: i18n.t("mobile.book.jobs"),
      value: i18n.t("mobile.book.completed_jobs", { count: ranking.completedJobCount })
    },
    {
      label: i18n.t("mobile.book.nearby"),
      value: i18n.t("mobile.book.local_jobs", { count: ranking.nearbyCompletedJobCount })
    },
    {
      label: i18n.t("mobile.book.coverage"),
      value: formatProviderServiceRadius(i18n, provider.serviceRadiusMiles)
    }
  ];

  return (
    <View style={styles.trustProfile}>
      {provider.bio ? <Text style={styles.providerMeta}>{provider.bio}</Text> : null}
      <View style={styles.trustFactGrid}>
        {facts.map((fact) => (
          <View key={fact.label} style={styles.trustFactItem}>
            <Text style={styles.trustFactLabel}>{fact.label}</Text>
            <Text style={styles.trustFactValue}>{fact.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.marketSignalRow}>
        <Text style={styles.marketSignalPill}>
          {i18n.t("mobile.book.punctuality_rating", { rating: provider.timelinessRating })}
        </Text>
        <Text style={styles.marketSignalPill}>
          {i18n.t("mobile.book.detail_rating", { rating: provider.attentionToDetailRating })}
        </Text>
        <Text style={styles.marketSignalPill}>{ranking.availabilityConfidenceLabel}</Text>
      </View>
    </View>
  );
}

function ProviderOpeningChoices({
  i18n,
  onSelect,
  selectedSlotId,
  slots
}: {
  i18n: I18nInstance;
  onSelect: (slotId: string) => void;
  selectedSlotId?: string;
  slots: AvailabilitySlot[];
}) {
  if (slots.length === 0) {
    return null;
  }

  return (
    <View style={styles.openingStack}>
      <Text style={styles.openingLabel}>
        {slots.length > 1 ? i18n.t("mobile.book.choose_time") : i18n.t("customer_live.provider.opening")}
      </Text>
      <View style={styles.openingChoiceRow}>
        {slots.map((slot) => {
          const isSelected = slot.id === selectedSlotId;

          return (
            <Pressable
              key={slot.id}
              onPress={() => onSelect(slot.id)}
              style={[styles.openingChoice, isSelected && styles.openingChoiceActive]}
            >
              <Text style={[styles.openingChoiceLabel, isSelected && styles.openingChoiceLabelActive]}>
                {formatOpenWindow(i18n, slot)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.md
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  progressStep: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 76,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.sm
  },
  progressStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  progressStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  progressStep_pending: {
    opacity: 0.86
  },
  progressIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  progressIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  progressIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  progressIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  progressIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  progressIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  progressIndexLabel_current: {
    color: "#ffffff"
  },
  progressIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  progressCopy: {
    flex: 1,
    gap: 2
  },
  progressLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  progressValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(20, 40, 29, 0.08)",
    gap: BrandTokens.spacing.sm,
    paddingTop: BrandTokens.spacing.md
  },
  detailHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    justifyContent: "space-between"
  },
  detailLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  detailValue: {
    color: BrandTokens.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right"
  },
  detailSummaryStack: {
    gap: BrandTokens.spacing.md
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  chipActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  chipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chipLabelActive: {
    color: "#ffffff"
  },
  propertyStack: {
    gap: BrandTokens.spacing.sm
  },
  emptyState: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  propertyRow: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  propertyRowActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  propertyCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  propertyLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  propertyAddress: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  defaultBadge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  secondaryButtonInline: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonInlineLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  primaryButton: {
    marginTop: BrandTokens.spacing.md,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  quoteSummary: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 21
  },
  priceSummary: {
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.xs
  },
  priceAmount: {
    color: BrandTokens.colors.ink,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38
  },
  priceCaption: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  factRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  factPill: {
    borderRadius: 999,
    backgroundColor: "rgba(20, 40, 29, 0.06)",
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  marketSignalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  marketSignalPill: {
    borderRadius: 999,
    backgroundColor: "rgba(47, 125, 76, 0.1)",
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  bookingFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  bookingFactItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  bookingFactLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  bookingFactValue: {
    color: BrandTokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  requestNextSteps: {
    borderTopWidth: 1,
    borderTopColor: "rgba(20, 40, 29, 0.08)",
    gap: BrandTokens.spacing.sm,
    paddingTop: BrandTokens.spacing.md
  },
  requestNextStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  requestNextStepIndex: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(47, 125, 76, 0.12)",
    height: 24,
    width: 24
  },
  requestNextStepIndexLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800"
  },
  requestNextStepCopy: {
    flex: 1,
    flexDirection: "row",
    gap: BrandTokens.spacing.sm,
    justifyContent: "space-between"
  },
  requestNextStepLabel: {
    color: BrandTokens.colors.ink,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "800"
  },
  requestNextStepValue: {
    color: BrandTokens.colors.inkSoft,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "right"
  },
  openingStack: {
    gap: BrandTokens.spacing.sm
  },
  openingLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  openingChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  openingChoice: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  openingChoiceActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.primary
  },
  openingChoiceLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  openingChoiceLabelActive: {
    color: "#ffffff"
  },
  providerStack: {
    gap: BrandTokens.spacing.md
  },
  alternativeCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  recommendedCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.md
  },
  providerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandTokens.spacing.md
  },
  providerAvatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BrandTokens.colors.primary
  },
  providerAvatarLabel: {
    color: "#ffffff",
    fontWeight: "800"
  },
  providerAvatarSmall: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BrandTokens.colors.primaryStrong
  },
  providerCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  providerName: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  providerBadge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  providerMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  providerDecisionLine: {
    color: BrandTokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21
  },
  providerChoiceDetail: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  providerChoiceHeading: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  trustProfile: {
    borderTopWidth: 1,
    borderTopColor: "rgba(20, 40, 29, 0.08)",
    gap: BrandTokens.spacing.md,
    paddingTop: BrandTokens.spacing.md
  },
  trustFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  trustFactItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: "rgba(20, 40, 29, 0.05)",
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  trustFactLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  trustFactValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modalShell: {
    flex: 1,
    backgroundColor: BrandTokens.colors.surface
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingTop: BrandTokens.spacing.hero,
    paddingBottom: BrandTokens.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.colors.border
  },
  modalHeaderCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  modalEyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  modalDescription: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  modalCloseButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  modalCloseButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modalBody: {
    padding: BrandTokens.spacing.lg
  }
});
