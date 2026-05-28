import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { crewAssignmentHistory, crewAssignments } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

type ViewMode = "upcoming" | "history";

export function AssignmentsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const items = viewMode === "upcoming" ? crewAssignments : crewAssignmentHistory;

  return (
    <ScreenShell eyebrow="Schedule" title="Your work">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "history"} label="History" onPress={() => setViewMode("history")} />
      </View>

      <InfoCard
        title={viewMode === "upcoming" ? "Upcoming assignments" : "Past work"}
        description={`${items.length} items`}
      >
        <View style={styles.list}>
          {items.map((assignment) => (
            <View key={assignment.id} style={styles.assignmentRow}>
              <Text style={styles.dayPill}>{assignment.dayLabel}</Text>
              <View style={styles.copy}>
                <Text style={styles.title}>{assignment.businessName}</Text>
                <Text style={styles.meta}>{assignment.serviceLabel}</Text>
                <Text style={styles.meta}>
                  {assignment.dateLabel} • {assignment.timeLabel}
                </Text>
                <Text style={styles.meta}>{assignment.addressLine}</Text>
              </View>
              <Text style={styles.earnings}>{assignment.expectedEarnings}</Text>
            </View>
          ))}
        </View>
      </InfoCard>
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
  assignmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandTokens.spacing.md
  },
  dayPill: {
    minWidth: 52,
    textAlign: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    color: BrandTokens.colors.primaryStrong,
    paddingVertical: BrandTokens.spacing.sm,
    fontWeight: "700",
    overflow: "hidden"
  },
  copy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  earnings: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
