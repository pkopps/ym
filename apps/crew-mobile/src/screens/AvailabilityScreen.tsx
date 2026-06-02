import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewAvailabilityDay, CrewMemberProfile, ServiceCategory } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

const dayOptions: CrewAvailabilityDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const skillOptions: ServiceCategory[] = [
  "lawn-mowing",
  "hedge-trimming",
  "seasonal-cleanup",
  "mulch-installation",
  "snow-shoveling"
];

export function AvailabilityScreen() {
  const { envelope } = useCrewSession();
  const [crewMember, setCrewMember] = useState<CrewMemberProfile | undefined>();
  const [errorMessage, setErrorMessage] = useState("");

  async function loadCrewMember() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const me = await api.getCurrentUser();
      setCrewMember(me.user as CrewMemberProfile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load availability.");
    }
  }

  useEffect(() => {
    void loadCrewMember();
  }, [envelope?.session.token]);

  async function savePreferences(updates: Partial<CrewMemberProfile>) {
    if (!envelope?.session.token || !crewMember) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setCrewMember(
        await api.updateCrewPreferences({
          categories: updates.categories ?? crewMember.categories,
          availableWeekdays: updates.availableWeekdays ?? crewMember.availableWeekdays,
          willingToTravelMiles: updates.willingToTravelMiles ?? crewMember.willingToTravelMiles,
          preferredSchedule: updates.preferredSchedule ?? crewMember.preferredSchedule,
          hasOwnEquipment: updates.hasOwnEquipment ?? crewMember.hasOwnEquipment,
          winterWorkEnabled: updates.winterWorkEnabled ?? crewMember.winterWorkEnabled
        })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update availability.");
    }
  }

  const toggleValue = <T extends string>(value: T, current: T[], setter: (next: T[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <ScreenShell eyebrow="Availability" title="Set your work preferences">
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Days you can work" description="Keep this current">
        <View style={styles.chipWrap}>
          {dayOptions.map((day) => {
            const currentDays = crewMember?.availableWeekdays ?? [];
            const isActive = currentDays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() =>
                  toggleValue(day, currentDays, (next) =>
                    void savePreferences({ availableWeekdays: next })
                  )
                }
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
          <Pressable
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.max(5, (crewMember?.willingToTravelMiles ?? 20) - 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>-5</Text>
          </Pressable>
          <Text style={styles.radiusValue}>{crewMember?.willingToTravelMiles ?? 0} miles</Text>
          <Pressable
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.min(60, (crewMember?.willingToTravelMiles ?? 20) + 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>+5</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Skills" description="Pick the work you can help with">
        <View style={styles.chipWrap}>
          {skillOptions.map((skill) => {
            const currentSkills = crewMember?.categories ?? [];
            const isActive = currentSkills.includes(skill);
            return (
              <Pressable
                key={skill}
                onPress={() =>
                  toggleValue(skill, currentSkills, (next) =>
                    void savePreferences({ categories: next })
                  )
                }
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {skill.replaceAll("-", " ")}
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
            value={crewMember?.winterWorkEnabled ?? false}
            onValueChange={(value) => void savePreferences({ winterWorkEnabled: value })}
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
