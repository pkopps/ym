import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { InfoCard } from "./InfoCard";

const radiusPresets = [10, 15, 20, 30, 45];

function getRadiusGuidance(serviceRadiusMiles: number): string {
  if (serviceRadiusMiles <= 12) {
    return "Tight route density with lower drive time between properties.";
  }

  if (serviceRadiusMiles <= 25) {
    return "Balanced growth radius for most suburban crews and repeat clients.";
  }

  return "Wider market reach, but expect more crew transit time and fewer back-to-back jobs.";
}

export function ServiceRadiusSettingsCard() {
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(18);

  const adjustRadius = (delta: number) => {
    setServiceRadiusMiles((currentRadius) => Math.max(5, Math.min(60, currentRadius + delta)));
  };

  return (
    <InfoCard
      title="Service radius settings"
      description="Set the maximum distance your business is willing to travel from each customer property address."
    >
      <Text style={styles.copy}>
        Customers only enter your lead pool when the property they want serviced falls inside this
        radius.
      </Text>

      <View style={styles.presetRow}>
        {radiusPresets.map((preset) => {
          const isActive = preset === serviceRadiusMiles;
          return (
            <Pressable
              key={preset}
              onPress={() => setServiceRadiusMiles(preset)}
              style={[styles.presetButton, isActive && styles.presetButtonActive]}
            >
              <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>{preset} mi</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stepper}>
        <Pressable onPress={() => adjustRadius(-5)} style={styles.stepperButton}>
          <Text style={styles.stepperLabel}>-5</Text>
        </Pressable>
        <View style={styles.valueBadge}>
          <Text style={styles.valueNumber}>{serviceRadiusMiles}</Text>
          <Text style={styles.valueSuffix}>miles</Text>
        </View>
        <Pressable onPress={() => adjustRadius(5)} style={styles.stepperButton}>
          <Text style={styles.stepperLabel}>+5</Text>
        </Pressable>
      </View>

      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            {
              width: `${((serviceRadiusMiles - 5) / 55) * 100}%`
            }
          ]}
        />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryTitle}>Match rule</Text>
          <Text style={styles.summaryText}>Use the selected booking property address, not the account default.</Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryTitle}>Operational effect</Text>
          <Text style={styles.summaryText}>{getRadiusGuidance(serviceRadiusMiles)}</Text>
        </View>
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  presetButton: {
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  presetButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  presetLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  presetLabelActive: {
    color: "#ffffff"
  },
  stepper: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    gap: BrandTokens.spacing.md
  },
  stepperButton: {
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    paddingVertical: BrandTokens.spacing.md
  },
  stepperLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  valueBadge: {
    alignItems: "center",
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surface,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.xl,
    paddingVertical: BrandTokens.spacing.md
  },
  valueNumber: {
    color: BrandTokens.colors.ink,
    fontSize: 28,
    fontWeight: "700"
  },
  valueSuffix: {
    color: BrandTokens.colors.inkSoft,
    fontWeight: "600"
  },
  meterTrack: {
    height: 12,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary
  },
  summaryRow: {
    gap: BrandTokens.spacing.md
  },
  summaryBlock: {
    gap: BrandTokens.spacing.xs
  },
  summaryTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  summaryText: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  }
});
