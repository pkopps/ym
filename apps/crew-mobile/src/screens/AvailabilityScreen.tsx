import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  CrewAvailabilityDay,
  CrewMemberProfile,
  CrewMemberSchedulePreference,
  ServiceCategory
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
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
const scheduleOptions: Array<{ value: CrewMemberSchedulePreference; labelKey: TranslationKey }> = [
  { value: "flex", labelKey: "crew_signup.schedule.flex" },
  { value: "part-time", labelKey: "crew_signup.schedule.part_time" },
  { value: "full-time", labelKey: "crew_signup.schedule.full_time" },
  { value: "seasonal", labelKey: "crew_signup.schedule.seasonal" }
];

function formatDayLabel(i18n: I18nInstance, day: CrewAvailabilityDay) {
  return i18n.t(`provider_mobile.support.weekday.${day.toLowerCase()}` as TranslationKey);
}

function formatDaySummary(i18n: I18nInstance, days: CrewAvailabilityDay[]) {
  if (days.length === 0) {
    return i18n.t("crew_mobile.availability.add_days");
  }

  if (days.length === 7) {
    return i18n.t("crew_mobile.availability.every_day");
  }

  return days.length <= 3
    ? days.map((day) => formatDayLabel(i18n, day)).join(", ")
    : i18n.t("crew_mobile.availability.day_count", { count: days.length });
}

function formatSkillLabel(i18n: I18nInstance, skill: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(skill));
}

function formatSkillSummary(i18n: I18nInstance, skills: ServiceCategory[]) {
  if (skills.length === 0) {
    return i18n.t("crew_mobile.availability.add_skills");
  }

  if (skills.length === 1) {
    return formatSkillLabel(i18n, skills[0]);
  }

  return i18n.t("crew_mobile.availability.service_count", { count: skills.length });
}

export function AvailabilityScreen() {
  const i18n = useI18n();
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.availability.error.load"));
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
      setStatusMessage(i18n.t("crew_mobile.availability.message.saved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.availability.error.update"));
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
    ? i18n.t("crew_mobile.availability.loading_profile")
    : profileReady
      ? i18n.t("crew_mobile.availability.ready_summary", {
          skills: formatSkillSummary(i18n, currentSkills),
          count: crewMember.willingToTravelMiles
        })
      : i18n.t("crew_mobile.availability.incomplete_summary");

  return (
    <ScreenShell
      eyebrow={i18n.t("crew_mobile.availability.eyebrow")}
      title={i18n.t("crew_mobile.availability.title")}
      description={i18n.t("crew_mobile.availability.description")}
    >
      {statusMessage ? <InfoCard title={i18n.t("crew_mobile.availability.saved")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <InfoCard
        title={profileReady ? i18n.t("crew_mobile.availability.ready_title") : i18n.t("crew_mobile.availability.finish_title")}
        description={profileSummary}
      >
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{i18n.t("crew_mobile.availability.days")}</Text>
            <Text style={styles.summaryValue}>{formatDaySummary(i18n, currentDays)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{i18n.t("crew_mobile.availability.radius")}</Text>
            <Text style={styles.summaryValue}>{i18n.t("common.format.miles", { count: crewMember?.willingToTravelMiles ?? 0 })}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{i18n.t("crew_mobile.availability.services")}</Text>
            <Text style={styles.summaryValue}>{formatSkillSummary(i18n, currentSkills)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{i18n.t("crew_mobile.availability.gear")}</Text>
            <Text style={styles.summaryValue}>
              {crewMember?.hasOwnEquipment ? i18n.t("crew_mobile.availability.gear_own") : i18n.t("crew_mobile.availability.gear_shared")}
            </Text>
          </View>
        </View>
      </InfoCard>

      <InfoCard title={i18n.t("crew_mobile.availability.work_days")} description={i18n.t("crew_mobile.availability.work_days_description")}>
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
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{formatDayLabel(i18n, day)}</Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title={i18n.t("crew_mobile.availability.travel_radius")} description={i18n.t("crew_mobile.availability.travel_radius_description")}>
        <View style={styles.radiusRow}>
          <Pressable
            disabled={isWorking || !crewMember}
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.max(5, (crewMember?.willingToTravelMiles ?? 20) - 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>{i18n.t("provider_live.settings.minus_5_miles")}</Text>
          </Pressable>
          <Text style={styles.radiusValue}>{i18n.t("provider_radius.value_miles", { count: crewMember?.willingToTravelMiles ?? 0 })}</Text>
          <Pressable
            disabled={isWorking || !crewMember}
            onPress={() =>
              void savePreferences({ willingToTravelMiles: Math.min(60, (crewMember?.willingToTravelMiles ?? 20) + 5) })
            }
            style={styles.radiusButton}
          >
            <Text style={styles.radiusButtonLabel}>{i18n.t("provider_live.settings.plus_5_miles")}</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title={i18n.t("crew_mobile.availability.services")} description={i18n.t("crew_mobile.availability.services_description")}>
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
                  {formatSkillLabel(i18n, skill)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title={i18n.t("crew_mobile.availability.work_style")} description={i18n.t("crew_mobile.availability.work_style_description")}>
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
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{i18n.t(schedule.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.switchStack}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>{i18n.t("crew_mobile.availability.own_equipment")}</Text>
              <Text style={styles.switchMeta}>{i18n.t("crew_mobile.availability.own_equipment_description")}</Text>
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
              <Text style={styles.switchLabel}>{i18n.t("crew_mobile.availability.winter_work")}</Text>
              <Text style={styles.switchMeta}>{i18n.t("crew_mobile.availability.winter_work_description")}</Text>
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
