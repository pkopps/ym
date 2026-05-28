import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const skillOptions = [
  "lawn-mowing",
  "hedge-trimming",
  "seasonal-cleanup",
  "mulch-installation",
  "snow-shoveling"
] as const;

export function AvailabilityScreen() {
  const [availableDays, setAvailableDays] = useState<string[]>(["Mon", "Tue", "Thu", "Sat"]);
  const [travelMiles, setTravelMiles] = useState(20);
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [skills, setSkills] = useState<string[]>(["lawn-mowing", "seasonal-cleanup"]);

  const toggleValue = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <ScreenShell eyebrow="Availability" title="Set your work preferences">
      <InfoCard title="Days you can work" description="Keep this current">
        <View style={styles.chipWrap}>
          {dayOptions.map((day) => {
            const isActive = availableDays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleValue(day, availableDays, setAvailableDays)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Travel radius" description="How far can you realistically go?">
        <View style={styles.radiusRow}>
          <Pressable onPress={() => setTravelMiles((current) => Math.max(5, current - 5))} style={styles.radiusButton}>
            <Text style={styles.radiusButtonLabel}>-5</Text>
          </Pressable>
          <Text style={styles.radiusValue}>{travelMiles} miles</Text>
          <Pressable onPress={() => setTravelMiles((current) => Math.min(40, current + 5))} style={styles.radiusButton}>
            <Text style={styles.radiusButtonLabel}>+5</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Skills" description="Pick the work you can help with">
        <View style={styles.chipWrap}>
          {skillOptions.map((skill) => {
            const isActive = skills.includes(skill);
            return (
              <Pressable
                key={skill}
                onPress={() => toggleValue(skill, skills, setSkills)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {serviceCategoryLabels[skill]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Winter work" description="Stay visible for snow jobs">
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Snow shifts and salting</Text>
          <Switch
            trackColor={{ false: BrandTokens.colors.border, true: BrandTokens.colors.primary }}
            thumbColor="#ffffff"
            value={snowEnabled}
            onValueChange={setSnowEnabled}
          />
        </View>
      </InfoCard>
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
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  radiusButton: {
    minWidth: 64,
    alignItems: "center",
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  radiusButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  radiusValue: {
    color: BrandTokens.colors.ink,
    fontSize: 20,
    fontWeight: "700"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  switchLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    flex: 1
  }
});
