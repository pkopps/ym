import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { providerManagedJobs } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

type ViewMode = "calendar" | "list";

export function ScheduleScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  return (
    <ScreenShell eyebrow="Schedule" title="Upcoming jobs">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "calendar"} label="Calendar" onPress={() => setViewMode("calendar")} />
        <ModeButton active={viewMode === "list"} label="List" onPress={() => setViewMode("list")} />
      </View>

      {viewMode === "calendar" ? (
        <InfoCard title="This week" description="Crew-aware schedule blocks">
          <View style={styles.list}>
            {providerManagedJobs.map((job) => (
              <View key={job.id} style={styles.dayCard}>
                <Text style={styles.dayLabel}>{job.dayLabel}</Text>
                <Text style={styles.timeLabel}>{job.timeLabel}</Text>
                <Text style={styles.clientLabel}>{job.clientName}</Text>
                <Text style={styles.metaLine}>{job.serviceLabel}</Text>
                <Text style={styles.metaLine}>
                  {job.requiredCrewMembers} crew • {job.distanceMiles} mi • {job.estimatedLaborHours} hr
                </Text>
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="Job list" description={`${providerManagedJobs.length} scheduled`}>
          <View style={styles.list}>
            {providerManagedJobs.map((job) => (
              <View key={job.id} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.clientLabel}>{job.clientName}</Text>
                  <Text style={styles.metaLine}>
                    {job.dateLabel} • {job.timeLabel}
                  </Text>
                  <Text style={styles.metaLine}>{job.addressLine}</Text>
                  <Text style={styles.metaLine}>
                    {job.serviceLabel} • {job.distanceMiles} mi • {job.requiredCrewMembers} crew needed
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </InfoCard>
      )}
    </ScreenShell>
  );
}

function ModeButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  modeButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  modeLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modeLabelActive: {
    color: "#ffffff"
  },
  list: {
    gap: BrandTokens.spacing.md
  },
  dayCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  dayLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  timeLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  clientLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  metaLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  jobRow: {
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.colors.border,
    paddingBottom: BrandTokens.spacing.md
  },
  jobCopy: {
    gap: BrandTokens.spacing.xs
  }
});
