import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  customerProviderMatches,
  customerSavedProperties,
  serviceCategoryLabels
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getCustomerMobileTracker } from "../lib/tracking";

const serviceOptions = [
  "lawn-mowing",
  "hedge-trimming",
  "mulch-installation",
  "seasonal-cleanup",
  "weed-control"
] as const;

export function BookServiceScreen() {
  const tracker = getCustomerMobileTracker();
  const [selectedService, setSelectedService] = useState<(typeof serviceOptions)[number]>("lawn-mowing");
  const [selectedPropertyId, setSelectedPropertyId] = useState(customerSavedProperties[0]?.id ?? "");
  const [quoteUnlocked, setQuoteUnlocked] = useState(false);

  const activeProperty = useMemo(
    () => customerSavedProperties.find((property) => property.id === selectedPropertyId) ?? customerSavedProperties[0],
    [selectedPropertyId]
  );

  const shortlist = customerProviderMatches.slice(0, 3);

  const handleBuildQuote = () => {
    setQuoteUnlocked(true);
    void tracker.track(MarketplaceTelemetryEventCatalog.bookingRequested, {
      app: "customer",
      screen: "book",
      service: selectedService,
      property: activeProperty.label
    });
  };

  return (
    <ScreenShell eyebrow="Book" title="Start a new booking" description="Pick a service and property.">
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
                  {serviceCategoryLabels[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Property" description="Choose where the crew is going.">
        <View style={styles.propertyStack}>
          {customerSavedProperties.map((property) => {
            const isActive = property.id === selectedPropertyId;
            return (
              <Pressable
                key={property.id}
                onPress={() => setSelectedPropertyId(property.id)}
                style={[styles.propertyRow, isActive && styles.propertyRowActive]}
              >
                <View style={styles.propertyCopy}>
                  <Text style={styles.propertyLabel}>{property.label}</Text>
                  <Text style={styles.propertyAddress}>{property.addressLine}</Text>
                </View>
                {property.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={handleBuildQuote} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>Get quote</Text>
        </Pressable>
      </InfoCard>

      {quoteUnlocked ? (
        <>
          <InfoCard title="$68 estimate" description="52 minutes • 1 crew member">
            <Text style={styles.quoteSummary}>
              Quote built from {activeProperty.label.toLowerCase()} and your selected service.
            </Text>
          </InfoCard>

          <InfoCard title="Nearby matches" description="Best next openings">
            <View style={styles.providerStack}>
              {shortlist.map((provider) => (
                <View key={provider.id} style={styles.providerRow}>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerName}>{provider.businessName}</Text>
                    <Text style={styles.providerMeta}>
                      {provider.rating} stars • {provider.distanceMiles} mi • {provider.nextSlotLabel}
                    </Text>
                    <Text style={styles.providerMeta}>{provider.estimateLabel}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      void tracker.track(MarketplaceTelemetryEventCatalog.providerSearchPerformed, {
                        app: "customer",
                        provider: provider.businessName,
                        service: selectedService
                      })
                    }
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonLabel}>Book</Text>
                  </Pressable>
                </View>
              ))}
            </View>
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
