import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { crewAssignments } from "@yardmatch/ui";
import {
  MarketplaceTelemetryEventCatalog
} from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getCrewMobileTracker } from "../lib/tracking";

export function DashboardScreen() {
  const tracker = getCrewMobileTracker();
  const [checkedIn, setCheckedIn] = useState(false);
  const [completed, setCompleted] = useState(false);
  const nextShift = crewAssignments[0];

  const handleCheckIn = () => {
    setCheckedIn(true);
    void tracker.track(MarketplaceTelemetryEventCatalog.crewCheckInCompleted, {
      app: "crew",
      assignmentId: nextShift.id
    });
  };

  const handleComplete = () => {
    setCompleted(true);
    void tracker.track(MarketplaceTelemetryEventCatalog.crewAssignmentCompleted, {
      app: "crew",
      assignmentId: nextShift.id
    });
  };

  return (
    <ScreenShell eyebrow="Today" title="Your next shift">
      <InfoCard title={nextShift.businessName} description={`${nextShift.dateLabel} • ${nextShift.timeLabel}`}>
        <Text style={styles.title}>{nextShift.serviceLabel}</Text>
        <Text style={styles.meta}>Meet with {nextShift.crewLead}</Text>
        <Text style={styles.meta}>{nextShift.addressLine}</Text>
        <Text style={styles.meta}>{nextShift.notes}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            disabled={checkedIn}
            onPress={handleCheckIn}
            style={[styles.primaryButton, checkedIn && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonLabel}>{checkedIn ? "Checked in" : "Check in"}</Text>
          </Pressable>
          <Pressable
            disabled={completed}
            onPress={handleComplete}
            style={[styles.secondaryButton, completed && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonLabel}>{completed ? "Completed" : "Complete"}</Text>
          </Pressable>
        </View>
      </InfoCard>

      <View style={styles.statRow}>
        <StatCard label="Planned hours" value={`${crewAssignments.reduce((sum, item) => sum + item.plannedHours, 0)}`} />
        <StatCard label="Expected pay" value="$528" />
      </View>
    </ScreenShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  buttonRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    marginTop: BrandTokens.spacing.sm
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  statRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md
  },
  statCard: {
    flex: 1,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.xs
  },
  statValue: {
    color: BrandTokens.colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  statLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 13,
    fontWeight: "600"
  }
});
