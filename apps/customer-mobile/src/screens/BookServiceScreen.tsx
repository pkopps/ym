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

const customerTimingOptions: Array<{ value: CustomerTimingPreference; label: string }> = [
  { value: "tomorrow-morning", label: "Tomorrow morning" },
  { value: "tomorrow-afternoon", label: "Tomorrow afternoon" },
  { value: "tomorrow-evening", label: "Tomorrow evening" },
  { value: "day-after-morning", label: "Day after morning" },
  { value: "day-after-afternoon", label: "Day after afternoon" }
];

function formatServiceLabel(service: ServiceCategory) {
  return serviceCategoryLabels[service];
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

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? properties[0],
    [properties, selectedPropertyId]
  );

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
      const nextQuote = await api.createInstantQuote({
        address: activeProperty.address,
        category: selectedService,
        propertyId: activeProperty.id
      });
      setQuote(nextQuote);
      setProviders([]);
      setSlots([]);
      setRecommendationContext(undefined);
      setSearchState("loading");
      const providerSearch = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedService],
        dateIso: buildDateIsoForCustomerTiming(selectedTiming),
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
      setProviders([]);
      setSlots([]);
      setShowAlternativeProviders(false);
      setSearchState("idle");
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

  return (
    <ScreenShell
      eyebrow="Book"
      title="Plan the visit"
      description="Pick the service, pick when, and review the best match."
    >
      {message ? <InfoCard title="Booking confirmed" description={message} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="1. Service" description="What needs care?">
        <View style={styles.chipWrap}>
          {serviceOptions.map((option) => {
            const isActive = option === selectedService;
            return (
              <Pressable
                key={option}
                onPress={() => setSelectedService(option)}
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

      <InfoCard title="2. When" description="Choose the visit window first.">
        <View style={styles.propertyStack}>
          {customerTimingOptions.map((option) => {
            const isActive = option.value === selectedTiming;
            return (
              <Pressable
                key={option.value}
                onPress={() => setSelectedTiming(option.value)}
                style={[styles.propertyRow, isActive && styles.propertyRowActive]}
              >
                <View style={styles.propertyCopy}>
                  <Text style={styles.propertyLabel}>{option.label}</Text>
                  <Text style={styles.propertyAddress}>We will search openings around this timing first.</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="3. Property" description="Where should we send the crew?">
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
                    onPress={() => setSelectedPropertyId(property.id)}
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
              <Text style={styles.secondaryButtonInlineLabel}>Add another property</Text>
            </Pressable>
            <Pressable disabled={isWorking} onPress={() => void handleBuildQuote()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>
                {isWorking ? "Working..." : "See price and match"}
              </Text>
            </Pressable>
          </>
        )}
      </InfoCard>

      {quote ? (
        <>
          <InfoCard
            title={`4. Price • ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              quote.estimatedPriceCents / 100
            )}`}
            description={`${quote.estimatedDurationMinutes} min • ${quote.estimatedCrewSize} crew`}
          >
            <Text style={styles.quoteSummary}>{quote.estimateSummary}</Text>
            <Text style={styles.providerMeta}>
              {quote.normalizedAddress.displayLabel}
            </Text>
            {quote.normalizedAddress.validationMessage ? (
              <Text style={styles.providerMeta}>{quote.normalizedAddress.validationMessage}</Text>
            ) : null}
            {quote.confidenceReasons.slice(0, 2).map((reason) => (
              <Text key={`${reason.impact}-${reason.label}`} style={styles.providerMeta}>
                {reason.label}: {reason.detail}
              </Text>
            ))}
          </InfoCard>

          <InfoCard
            title="5. Recommended provider"
            description={`Best next opening for ${customerTimingOptions.find((option) => option.value === selectedTiming)?.label.toLowerCase() ?? "tomorrow morning"}`}
          >
            {searchState === "loading" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Checking nearby coverage and route openings...</Text>
              </View>
            ) : searchState === "error" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>We could not finish the match check.</Text>
                <Text style={styles.providerMeta}>Try again. Your price is still here.</Text>
              </View>
            ) : providers.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>No verified providers are live in this area yet.</Text>
                <Text style={styles.providerMeta}>Try another nearby area or check back later.</Text>
              </View>
            ) : providersWithWindows.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Providers serve this area, but their near-term windows are full.</Text>
                <Text style={styles.providerMeta}>You can still review the shortlist below.</Text>
                {shortlist.map(({ provider, ranking }) => (
                  <View key={provider.id} style={styles.providerRow}>
                    <View style={styles.providerCopy}>
                      <Text style={styles.providerName}>{provider.companyName}</Text>
                      <Text style={styles.providerMeta}>
                        {provider.rating} stars • {provider.serviceRadiusMiles} mi radius
                      </Text>
                      <Text style={styles.providerMeta}>
                        {ranking.distanceMiles.toFixed(1)} mi away • {ranking.reasons.join(" • ")}
                      </Text>
                      <Text style={styles.providerMeta}>No open route window right now</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.providerStack}>
                {recommendedProviderCard ? (
                  <View style={styles.providerRow}>
                    <View style={styles.providerCopy}>
                      <Text style={styles.providerBadge}>
                        {providerChoicePresentations[0]?.badge ?? "Recommended for this property"}
                      </Text>
                      <Text style={styles.providerName}>{recommendedProviderCard.provider.companyName}</Text>
                      {providerChoicePresentations[0] ? (
                        <Text style={styles.providerChoiceDetail}>
                          <Text style={styles.providerChoiceHeading}>
                            {providerChoicePresentations[0].heading}.{" "}
                          </Text>
                          {providerChoicePresentations[0].detail}
                        </Text>
                      ) : null}
                      <Text style={styles.providerChoiceDetail}>
                        <Text style={styles.providerChoiceHeading}>
                          {recommendedProviderCard.ranking.selectionSummaryLabel}.{" "}
                        </Text>
                        {recommendedProviderCard.ranking.selectionSummaryDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {recommendedProviderCard.provider.rating} stars •{" "}
                        {recommendedProviderCard.provider.serviceRadiusMiles} mi radius
                      </Text>
                      <Text style={styles.providerMeta}>
                        <Text style={styles.providerChoiceHeading}>
                          {recommendedProviderCard.ranking.reliabilityLabel}.{" "}
                        </Text>
                        {recommendedProviderCard.ranking.reliabilityDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {recommendedProviderCard.ranking.distanceMiles.toFixed(1)} mi away •{" "}
                        {recommendedProviderCard.ranking.reasons.join(" • ")}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {recommendedProviderCard.ranking.neighborhoodFamiliarityLabel}.{" "}
                        {recommendedProviderCard.ranking.neighborhoodFamiliarityDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {recommendedProviderCard.slot
                          ? `Next opening: ${formatBookingWindowSummary(recommendedProviderCard.slot.startIso)}`
                          : "No open slot right now"}
                      </Text>
                    </View>
                    <Pressable
                      disabled={isWorking || !recommendedProviderCard.slot}
                      onPress={() => void handleCreateBooking(recommendedProviderCard.ranking, 1)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>Book recommended</Text>
                    </Pressable>
                  </View>
                ) : null}
                {alternativeProviderCards.length > 0 && !showAlternativeProviders ? (
                  <View style={styles.providerStack}>
                    <Text style={styles.providerMeta}>
                      Want a backup first? Open a short curated list.
                    </Text>
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
                      <Text style={styles.secondaryButtonInlineLabel}>Show backup options</Text>
                    </Pressable>
                  </View>
                ) : null}
                {(showAlternativeProviders ? alternativeProviderCards : []).map(({ provider, ranking, slot }, index) => (
                  <View key={provider.id} style={styles.providerRow}>
                    <View style={styles.providerCopy}>
                      {providerChoicePresentations[index + 1] ? (
                        <Text style={styles.providerBadge}>{providerChoicePresentations[index + 1].badge}</Text>
                      ) : null}
                      <Text style={styles.providerName}>{provider.companyName}</Text>
                      {providerChoicePresentations[index + 1] ? (
                        <Text style={styles.providerChoiceDetail}>
                          <Text style={styles.providerChoiceHeading}>
                            {providerChoicePresentations[index + 1].heading}.{" "}
                          </Text>
                          {providerChoicePresentations[index + 1].detail}
                        </Text>
                      ) : null}
                      <Text style={styles.providerChoiceDetail}>
                        <Text style={styles.providerChoiceHeading}>{ranking.selectionSummaryLabel}. </Text>
                        {ranking.selectionSummaryDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {provider.rating} stars • {provider.serviceRadiusMiles} mi radius
                      </Text>
                      <Text style={styles.providerMeta}>
                        <Text style={styles.providerChoiceHeading}>{ranking.reliabilityLabel}. </Text>
                        {ranking.reliabilityDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {ranking.distanceMiles.toFixed(1)} mi away • {ranking.reasons.join(" • ")}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {ranking.neighborhoodFamiliarityLabel}. {ranking.neighborhoodFamiliarityDetail}
                      </Text>
                      <Text style={styles.providerMeta}>
                        {slot ? formatBookingWindowSummary(slot.startIso) : "No open slot"}
                      </Text>
                    </View>
                    <Pressable
                      disabled={isWorking || !slot}
                      onPress={() => void handleCreateBooking(ranking, index + 2)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>Book this option</Text>
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
  providerStack: {
    gap: BrandTokens.spacing.md
  },
  providerRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    alignItems: "center",
    justifyContent: "space-between"
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
