import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  CrewAvailabilityDay,
  CrewMemberProfile,
  CrewMemberSchedulePreference,
  ServiceCategory
} from "@yardmatch/contracts";
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
const scheduleOptions: Array<{ value: CrewMemberSchedulePreference; label: string }> = [
  { value: "flex", label: "Flexible" },
  { value: "part-time", label: "Part time" },
  { value: "full-time", label: "Full time" },
  { value: "seasonal", label: "Seasonal" }
];

function formatDaySummary(days: CrewAvailabilityDay[]) {
  if (days.length === 0) {
    return "Add days";
  }

  if (days.length === 7) {
    return "Every day";
  }

  return days.length <= 3 ? days.join(", ") : `${days.length} days`;
}

function formatSkillLabel(skill: ServiceCategory) {
  return skill.replaceAll("-", " ");
}

function formatSkillSummary(skills: ServiceCategory[]) {
  if (skills.length === 0) {
    return "Add skills";
  }

  if (skills.length === 1) {
    return formatSkillLabel(skills[0]);
  }

  return `${skills.length} services`;
}

export function AvailabilityScreen() {
  const { envelope } = useCrewSession();
  const [crewMember, setCrewMember] = useState<CrewMemberProfile | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

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
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextCrewMember = await api.updateCrewPreferences({
        categories: updates.categories ?? crewMember.categories,
        availableWeekdays: updates.availableWeekdays ?? crewMember.availableWeekdays,
        willingToTravelMiles: updates.willingToTravelMiles ?? crewMember.willingToTravelMiles,
        preferredSchedule: updates.preferredSchedule ?? crewMember.preferredSchedule,
        hasOwnEquipment: updates.hasOwnEquipment ?? crewMember.hasOwnEquipment,
        winterWorkEnabled: updates.winterWorkEnabled ?? crewMember.winterWorkEnabled
      });
      setCrewMember(nextCrewMember);
      setStatusMessage("Work profile saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update availability.");
    } finally {
      setIsWorking(false);
    }
  }

  const toggleValue = <T extends string>(value: T, current: T[], setter: (next: T[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const currentDays = crewMember?.availableWeekdays ?? [];
  const currentSkills = crewMember?.categories ?? [];
  const profileReady = currentDays.length > 0 && currentSkills.length > 0;
  const profileSummary = !crewMember
    ? "Loading work profile."
    : profileReady
      ? `${formatSkillSummary(currentSkills)} within ${crewMember.willingToTravelMiles} miles.`
      : "Add days and skills to improve matches.";

  return (
    <ScreenShell eyebrow="Availability" title="Availability" description="Control the jobs you see.">
      {statusMessage ? <InfoCard title="Saved" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title={profileReady ? "Ready for matching" : "Finish work profile"} description={profileSummary}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Days</Text>
            <Text style={styles.summaryValue}>{formatDaySummary(currentDays)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Radius</Text>
            <Text style={styles.summaryValue}>{crewMember?.willingToTravelMiles ?? 0} mi</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Services</Text>
            <Text style={styles.summaryValue}>{formatSkillSummary(currentSkills)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gear</Text>
            <Text style={styles.summaryValue}>{crewMember?.hasOwnEquipment ? "Own" : "Shared"}</Text>
          </View>
        </View>
      </InfoCard>

      <InfoCard title="Work days" description="Pick the days you want offers.">
        <View style={styles.chipWrap}>
          {dayOptions.map((day) => {
            const isActive = currentDays.includes(day);
            return (
              <Pressable
                disabled={isWorking || !crewMember}
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

      <InfoCard title="Travel radius" description="Keep routes realistic.">
        <View style={styles.radiusRow}>
          <Pressable
            disabled={isWorking || !crewMember}
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.max(5, (crewMember?.willingToTravelMiles ?? 20) - 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>-5</Text>
          </Pressable>
          <Text style={styles.radiusValue}>{crewMember?.willingToTravelMiles ?? 0} miles</Text>
          <Pressable
            disabled={isWorking || !crewMember}
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.min(60, (crewMember?.willingToTravelMiles ?? 20) + 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>+5</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Services" description="Only select work you can confidently complete.">
        <View style={styles.chipWrap}>
          {skillOptions.map((skill) => {
            const isActive = currentSkills.includes(skill);
            return (
              <Pressable
                disabled={isWorking || !crewMember}
                key={skill}
                onPress={() =>
                  toggleValue(skill, currentSkills, (next) =>
                    void savePreferences({ categories: next })
                  )
                }
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {formatSkillLabel(skill)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Work style" description="Help providers choose the right crew.">
        <View style={styles.chipWrap}>
          {scheduleOptions.map((schedule) => {
            const isActive = crewMember?.preferredSchedule === schedule.value;
            return (
              <Pressable
                disabled={isWorking || !crewMember}
                key={schedule.value}
                onPress={() => void savePreferences({ preferredSchedule: schedule.value })}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{schedule.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.switchStack}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Own equipment</Text>
              <Text style={styles.switchMeta}>Show providers when you can bring gear.</Text>
            </View>
            <Switch
              disabled={isWorking || !crewMember}
              trackColor={{ false: BrandTokens.colors.border, true: BrandTokens.colors.primary }}
              thumbColor="#ffffff"
              value={crewMember?.hasOwnEquipment ?? false}
              onValueChange={(value) => void savePreferences({ hasOwnEquipment: value })}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Winter work</Text>
              <Text style={styles.switchMeta}>Stay visible for snow jobs.</Text>
            </View>
            <Switch
              disabled={isWorking || !crewMember}
              trackColor={{ false: BrandTokens.colors.border, true: BrandTokens.colors.primary }}
              thumbColor="#ffffff"
              value={crewMember?.winterWorkEnabled ?? false}
              onValueChange={(value) => void savePreferences({ winterWorkEnabled: value })}
            />
          </View>
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  summaryItem: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: BrandTokens.colors.surface,
    padding: BrandTokens.spacing.md
  },
  summaryLabel: {
    color: BrandTokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: BrandTokens.spacing.xs
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
  switchStack: {
    gap: BrandTokens.spacing.md
  },
  switchCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  switchLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  switchMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  }
});
