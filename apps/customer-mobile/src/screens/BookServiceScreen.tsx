import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AvailabilitySlot,
  buildCustomerProviderChoicePresentations,
  CreateCustomerPropertyRequest,
  CustomerProperty,
  formatBookingWindowSummary,
  InstantQuoteResponse,
  SearchProvidersResponse,
  SearchProviderResult,
  ServiceCategory
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { serviceCategoryLabels } from "@yardmatch/ui";
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

const customerTimingOptions: Array<{ value: CustomerTimingPreference; label: string }> = [
  { value: "tomorrow-morning", label: "Tomorrow morning" },
  { value: "tomorrow-afternoon", label: "Tomorrow afternoon" },
  { value: "tomorrow-evening", label: "Tomorrow evening" },
  { value: "day-after-morning", label: "Day after morning" },
  { value: "day-after-afternoon", label: "Day after afternoon" }
];

function getAlternativeTimingSuggestions(selectedTiming: CustomerTimingPreference) {
  const selectedIndex = customerTimingOptions.findIndex((option) => option.value === selectedTiming);

  if (selectedIndex === -1) {
    return customerTimingOptions.slice(0, 2);
  }

  return [...customerTimingOptions.slice(selectedIndex + 1), ...customerTimingOptions.slice(0, selectedIndex)].slice(0, 2);
}

function formatServiceLabel(service: ServiceCategory) {
  return serviceCategoryLabels[service];
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function formatOpenWindow(slot?: AvailabilitySlot) {
  return slot ? formatBookingWindowSummary(slot.startIso) : "No open slot";
}

function formatProviderTrust(provider: SearchProviderResult["provider"]) {
  return `${provider.rating.toFixed(1)} stars • ${provider.reviewCount} reviews`;
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

export function BookServiceScreen() {
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

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? properties[0],
    [properties, selectedPropertyId]
  );
  const selectedTimingLabel =
    customerTimingOptions.find((option) => option.value === selectedTiming)?.label ?? "Tomorrow morning";
  const alternativeTimingSuggestions = getAlternativeTimingSuggestions(selectedTiming);
  const selectedServiceLabel = formatServiceLabel(selectedService);

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
      setRecommendationContext({
        recommendationSessionId: providerSearch.recommendationSessionId,
        recommendedProviderId: providerSearch.recommendedProviderId
      });
      setShowAlternativeProviders(false);
      setSearchState("loaded");
    } catch (error) {
      setSearchState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to check providers right now.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load properties.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to build quote right now.");
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
      setMessage(`${property.label} is ready for booking.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that property.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateBooking(provider: SearchProviderResult, rank: number) {
    if (!quote || !activeProperty || !envelope?.session.token) {
      return;
    }

    const slot =
      provider.suggestedSlot ??
      slots.find((item) => item.providerId === provider.provider.id && !item.isBooked);
    if (!slot) {
      setErrorMessage("No open slot is available for that provider.");
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
        notes: "Booked from the mobile customer app.",
        totalCents: quote.estimatedPriceCents,
        recommendationSessionId: recommendationContext?.recommendationSessionId,
        recommendedProviderId: recommendationContext?.recommendedProviderId,
        selectedProviderRank: rank,
        viewedAlternativeProviders: showAlternativeProviders,
        recommendationSource: "customer-mobile-book"
      });
      setMessage(
        `Booked ${provider.provider.companyName} for the ${formatBookingWindowSummary(slot.startIso)} window.`
      );
      setRecommendationContext(undefined);
      resetMatchState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your booking right now.");
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
  const providersWithWindows = providerCards.filter((item) => item.slot);
  const activeStepIndex = recommendedProviderCard ? 3 : quote ? 2 : 0;
  const requestSteps = [
    { label: "Details", value: activeProperty?.label ?? "Property" },
    { label: "Price", value: quote ? formatPrice(quote.estimatedPriceCents) : "Next" },
    {
      label: "Match",
      value: recommendedProviderCard
        ? recommendedProviderCard.provider.companyName
        : searchState === "loading"
          ? "Checking"
          : "After price"
    },
    {
      label: "Book",
      value: recommendedProviderCard?.slot ? formatOpenWindow(recommendedProviderCard.slot) : "Review"
    }
  ].map((step, index) => ({
    ...step,
    status: getRequestStepStatus(index, activeStepIndex)
  }));

  return (
    <ScreenShell
      eyebrow="Book"
      title="Request service"
      description="Details, price, match, book."
    >
      {message ? <InfoCard title="Booking confirmed" description={message} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

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
        <View style={styles.intentSummary}>
          <View style={styles.intentSummaryItem}>
            <Text style={styles.intentSummaryLabel}>Service</Text>
            <Text style={styles.intentSummaryValue}>{selectedServiceLabel}</Text>
          </View>
          <View style={styles.intentSummaryItem}>
            <Text style={styles.intentSummaryLabel}>When</Text>
            <Text style={styles.intentSummaryValue}>{selectedTimingLabel}</Text>
          </View>
        </View>
      </View>

      <InfoCard title="Service" description={selectedServiceLabel}>
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
                  {formatServiceLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="When" description="Best opening first.">
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
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard
        title="Property"
        description={activeProperty ? activeProperty.address.line1 : "Where should we send the crew?"}
      >
        {properties.length === 0 ? (
          <View style={styles.propertyStack}>
            <Text style={styles.emptyState}>Add a property before we price the job.</Text>
            <Pressable
              disabled={isWorking}
              onPress={() => setIsPropertyModalVisible(true)}
              style={styles.secondaryButtonInline}
            >
              <Text style={styles.secondaryButtonInlineLabel}>Add property</Text>
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
                    {property.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setIsPropertyModalVisible(true)} style={styles.secondaryButtonInline}>
              <Text style={styles.secondaryButtonInlineLabel}>Add property</Text>
            </Pressable>
            <Pressable disabled={isWorking} onPress={() => void handleBuildQuote()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>
                {isWorking ? "Checking..." : "See price and crews"}
              </Text>
            </Pressable>
          </>
        )}
      </InfoCard>

      {quote ? (
        <>
          <InfoCard
            title="Quote"
            description="Review only if needed."
          >
            <View style={styles.priceSummary}>
              <Text style={styles.priceAmount}>{formatPrice(quote.estimatedPriceCents)}</Text>
              <Text style={styles.priceCaption}>Includes route, crew, and service estimate.</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factPill}>{quote.estimatedDurationMinutes} min</Text>
              <Text style={styles.factPill}>{quote.estimatedCrewSize} crew</Text>
              <Text style={styles.factPill}>{selectedServiceLabel}</Text>
            </View>
            <Text style={styles.quoteSummary}>{quote.estimateSummary}</Text>
            <Text style={styles.providerMeta}>{quote.normalizedAddress.displayLabel}</Text>
            <Pressable onPress={() => setShowQuoteDetails((current) => !current)} style={styles.secondaryButtonInline}>
              <Text style={styles.secondaryButtonInlineLabel}>
                {showQuoteDetails ? "Hide details" : "How price works"}
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
            title={recommendedProviderCard ? "Ready to book" : "Best fit"}
            description={recommendedProviderCard ? "One clear recommendation." : `First checked: ${selectedTimingLabel.toLowerCase()}`}
          >
            {searchState === "loading" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Checking nearby openings…</Text>
              </View>
            ) : searchState === "error" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>We could not finish the match check.</Text>
                <Text style={styles.providerMeta}>Try again. Your price is still ready.</Text>
                <Pressable
                  disabled={isWorking}
                  onPress={() => {
                    if (quote) {
                      void runProviderSearch(quote, selectedTiming);
                    }
                  }}
                  style={styles.secondaryButtonInline}
                >
                  <Text style={styles.secondaryButtonInlineLabel}>Try again</Text>
                </Pressable>
              </View>
            ) : providers.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Nothing is live here yet.</Text>
                <Text style={styles.providerMeta}>We do not have a verified business covering this request yet.</Text>
                <Pressable onPress={handleChangeDetails} style={styles.secondaryButtonInline}>
                  <Text style={styles.secondaryButtonInlineLabel}>Change details</Text>
                </Pressable>
              </View>
            ) : providersWithWindows.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Nothing is open {selectedTimingLabel.toLowerCase()}.</Text>
                <Text style={styles.providerMeta}>This area is covered, but the current route windows are full.</Text>
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
                      <Text style={styles.secondaryButtonInlineLabel}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.providerMeta}>Need a different property or service? Change the details above.</Text>
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
                          {providerChoicePresentations[0]?.badge ?? "Recommended"}
                        </Text>
                        <Text style={styles.providerName}>{recommendedProviderCard.provider.companyName}</Text>
                        <Text style={styles.providerMeta}>
                          {formatProviderTrust(recommendedProviderCard.provider)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bookingFactGrid}>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>Price</Text>
                        <Text style={styles.bookingFactValue}>{formatPrice(quote.estimatedPriceCents)}</Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>Opening</Text>
                        <Text style={styles.bookingFactValue}>{formatOpenWindow(recommendedProviderCard.slot)}</Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>Crew</Text>
                        <Text style={styles.bookingFactValue}>
                          {quote.estimatedCrewSize} crew • {quote.estimatedDurationMinutes} min
                        </Text>
                      </View>
                      <View style={styles.bookingFactItem}>
                        <Text style={styles.bookingFactLabel}>Property</Text>
                        <Text style={styles.bookingFactValue}>{activeProperty?.label ?? "Selected property"}</Text>
                      </View>
                    </View>
                    <Text style={styles.providerChoiceDetail}>
                      {recommendedProviderCard.ranking.selectionSummaryDetail}
                    </Text>
                    <Pressable
                      disabled={isWorking || !recommendedProviderCard.slot}
                      onPress={() => void handleCreateBooking(recommendedProviderCard.ranking, 1)}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonLabel}>Book for {formatPrice(quote.estimatedPriceCents)}</Text>
                    </Pressable>
                    <View style={styles.providerStack}>
                      <Pressable
                        onPress={() => setShowRecommendedWhy((current) => !current)}
                        style={styles.secondaryButtonInline}
                      >
                        <Text style={styles.secondaryButtonInlineLabel}>
                          {showRecommendedWhy ? "Hide why" : "Why this pick"}
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
                      <Text style={styles.secondaryButtonInlineLabel}>Compare options</Text>
                    </Pressable>
                  </View>
                ) : null}
                {(showAlternativeProviders ? alternativeProviderCards : []).map(({ provider, ranking, slot }, index) => (
                  <View key={provider.id} style={styles.providerRowCompact}>
                    <View style={styles.providerCopy}>
                      {providerChoicePresentations[index + 1] ? (
                        <Text style={styles.providerBadge}>{providerChoicePresentations[index + 1].badge}</Text>
                      ) : null}
                      <Text style={styles.providerName}>{provider.companyName}</Text>
                      <Text style={styles.providerChoiceDetail}>{ranking.selectionSummaryDetail}</Text>
                      <Text style={styles.providerMeta}>
                        {formatOpenWindow(slot)}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {formatProviderTrust(provider)} • {ranking.distanceMiles.toFixed(1)} mi away
                      </Text>
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
                          {showAlternativeWhy[provider.id] ? "Hide why" : "Why this option"}
                        </Text>
                      </Pressable>
                      {showAlternativeWhy[provider.id] ? (
                        <View style={styles.providerStack}>
                          {providerChoicePresentations[index + 1] ? (
                            <Text style={styles.providerMeta}>
                              <Text style={styles.providerChoiceHeading}>
                                {providerChoicePresentations[index + 1].heading}.{" "}
                              </Text>
                              {providerChoicePresentations[index + 1].detail}
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
                        </View>
                      ) : null}
                    </View>
                    <Pressable
                      disabled={isWorking || !slot}
                      onPress={() => void handleCreateBooking(ranking, index + 2)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>Book for {formatPrice(quote.estimatedPriceCents)}</Text>
                    </Pressable>
                  </View>
                ))}
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
              <Text style={styles.modalEyebrow}>Property</Text>
              <Text style={styles.modalTitle}>
                {properties.length === 0 ? "Add your first property" : "Add another property"}
              </Text>
              <Text style={styles.modalDescription}>Keep the address short and clean. You can book it right after.</Text>
            </View>
            <Pressable onPress={() => setIsPropertyModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonLabel}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <CustomerPropertyForm
              isWorking={isWorking}
              onSubmit={handleCreateProperty}
              submitLabel={properties.length === 0 ? "Save property" : "Add property"}
            />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
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
  intentSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  intentSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    gap: 2
  },
  intentSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  intentSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
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
  providerStack: {
    gap: BrandTokens.spacing.md
  },
  providerRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    alignItems: "center",
    justifyContent: "space-between"
  },
  providerRowCompact: {
    gap: BrandTokens.spacing.md
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
  providerChoiceDetail: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  providerChoiceHeading: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
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
