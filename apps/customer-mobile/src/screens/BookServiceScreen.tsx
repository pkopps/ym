import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AvailabilitySlot,
  CreateCustomerPropertyRequest,
  CustomerProperty,
  formatBookingWindowSummary,
  InstantQuoteResponse,
  ProviderProfile,
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

export function BookServiceScreen() {
  const tracker = getCustomerMobileTracker();
  const { envelope } = useCustomerSession();
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [quote, setQuote] = useState<InstantQuoteResponse | undefined>();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [showPropertyForm, setShowPropertyForm] = useState(false);

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
      setSearchState("loading");
      const providerSearch = await api.searchProviders({
        address: activeProperty.address,
        categories: [selectedService],
        dateIso: new Date().toISOString(),
        estimatedDurationMinutes: nextQuote.estimatedDurationMinutes
      });
      setProviders(providerSearch.providers);
      setSlots(providerSearch.suggestedSlots);
      setSearchState("loaded");
      void tracker.track(MarketplaceTelemetryEventCatalog.bookingRequested, {
        app: "customer",
        screen: "book",
        service: selectedService,
        property: activeProperty.label
      });
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
      setShowPropertyForm(false);
      setMessage(`${property.label} is ready for booking.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that property.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateBooking(provider: ProviderProfile) {
    if (!quote || !activeProperty || !envelope?.session.token) {
      return;
    }

    const slot = slots.find((item) => item.providerId === provider.id && !item.isBooked);
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
        providerId: provider.id,
        serviceAddress: activeProperty.address,
        servicePropertyId: activeProperty.id,
        category: selectedService,
        scheduledStartIso: slot.startIso,
        scheduledEndIso: slot.endIso,
        notes: "Booked from the mobile customer app.",
        totalCents: quote.estimatedPriceCents
      });
      setMessage(`Booked ${provider.companyName} for the ${formatBookingWindowSummary(slot.startIso)} window.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your booking right now.");
    } finally {
      setIsWorking(false);
    }
  }

  const providerCards = providers.map((provider) => ({
    provider,
    slot: slots.find((item) => item.providerId === provider.id && !item.isBooked)
  }));
  const shortlist = providerCards.slice(0, 3);
  const providersWithWindows = providerCards.filter((item) => item.slot);

  return (
    <ScreenShell eyebrow="Book" title="Start a new booking" description="Pick a service and property.">
      {message ? <InfoCard title="Booking confirmed" description={message} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Service" description="What do you need today?">
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
                  {option.replaceAll("-", " ")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Property" description="Choose where the crew is going.">
        {properties.length === 0 ? (
          <View style={styles.propertyStack}>
            <Text style={styles.emptyState}>Add your first property to get a quote.</Text>
            <CustomerPropertyForm
              isWorking={isWorking}
              onSubmit={handleCreateProperty}
              submitLabel="Save first property"
            />
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
            {showPropertyForm ? (
              <CustomerPropertyForm isWorking={isWorking} onSubmit={handleCreateProperty} submitLabel="Add property" />
            ) : (
              <Pressable onPress={() => setShowPropertyForm(true)} style={styles.secondaryButtonInline}>
                <Text style={styles.secondaryButtonInlineLabel}>Add another property</Text>
              </Pressable>
            )}
            <Pressable disabled={isWorking} onPress={() => void handleBuildQuote()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Get quote"}</Text>
            </Pressable>
          </>
        )}
      </InfoCard>

      {quote ? (
        <>
          <InfoCard
            title={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              quote.estimatedPriceCents / 100
            )}
            description={`${quote.estimatedDurationMinutes} minutes • ${quote.estimatedCrewSize} crew`}
          >
            <Text style={styles.quoteSummary}>{quote.estimateSummary}</Text>
          </InfoCard>

          <InfoCard title="Nearby matches" description="Best next openings">
            {searchState === "loading" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Checking nearby coverage, route openings, and live availability...</Text>
                <Text style={styles.providerMeta}>If many businesses serve this area, sorting can take a moment.</Text>
              </View>
            ) : searchState === "error" ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>We could not finish checking nearby providers.</Text>
                <Text style={styles.providerMeta}>Please try again. Your quote is still here.</Text>
              </View>
            ) : providers.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>No landscaping businesses are live in this area yet.</Text>
                <Text style={styles.providerMeta}>Try another nearby city or check back later as YardMatch expands coverage.</Text>
              </View>
            ) : providersWithWindows.length === 0 ? (
              <View style={styles.providerStack}>
                <Text style={styles.emptyState}>Businesses serve this area, but nothing is open in this window.</Text>
                <Text style={styles.providerMeta}>Try again later or switch to another service window.</Text>
                {shortlist.map(({ provider }) => (
                  <View key={provider.id} style={styles.providerRow}>
                    <View style={styles.providerCopy}>
                      <Text style={styles.providerName}>{provider.companyName}</Text>
                      <Text style={styles.providerMeta}>
                        {provider.rating} stars • {provider.serviceRadiusMiles} mi radius
                      </Text>
                      <Text style={styles.providerMeta}>No open route window right now</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.providerStack}>
                {shortlist.map(({ provider, slot }) => (
                  <View key={provider.id} style={styles.providerRow}>
                    <View style={styles.providerCopy}>
                      <Text style={styles.providerName}>{provider.companyName}</Text>
                      <Text style={styles.providerMeta}>
                        {provider.rating} stars • {provider.serviceRadiusMiles} mi radius
                      </Text>
                      <Text style={styles.providerMeta}>
                        {slot ? formatBookingWindowSummary(slot.startIso) : "No open slot"}
                      </Text>
                    </View>
                    <Pressable
                      disabled={isWorking || !slot}
                      onPress={() => void handleCreateBooking(provider)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>Book</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </InfoCard>
        </>
      ) : null}
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
  providerMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
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
  }
});
