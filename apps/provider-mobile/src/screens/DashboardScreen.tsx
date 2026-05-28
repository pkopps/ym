import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  providerCrewPayouts,
  providerCrewMemberSnapshots,
  providerManagedJobs
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getProviderMobileTracker } from "../lib/tracking";

export function DashboardScreen() {
  const tracker = getProviderMobileTracker();
  const totalCrewNeeded = providerManagedJobs.reduce((sum, job) => sum + job.requiredCrewMembers, 0);
  const totalAssignedCrew = providerManagedJobs.reduce((sum, job) => sum + job.assignedCrewMembers.length, 0);
  const crewGap = totalCrewNeeded - totalAssignedCrew;
  const payoutReadyAmount = providerCrewPayouts
    .filter((payout) => payout.status === "ready")
    .reduce((sum, payout) => sum + Number(payout.amountLabel.replace(/[^0-9.]/g, "")), 0);
  const shortStaffedJobs = providerManagedJobs.filter(
    (job) => job.requiredCrewMembers > job.assignedCrewMembers.length
  );

  return (
    <ScreenShell eyebrow="Home" title="Today at a glance">
      {crewGap > 0 ? (
        <InfoCard title="Crew gap detected" description={`${crewGap} open crew slots across upcoming jobs`}>
          <Text style={styles.alertText}>
            Demand is outpacing your current crew coverage. Fill these spots before route quality slips.
          </Text>
          <Pressable
            onPress={() =>
              void tracker.track(MarketplaceTelemetryEventCatalog.providerSearchPerformed, {
                app: "provider",
                action: "find-crew-members",
                crewGap
              })
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>Find crew members</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard label="Jobs" value={`${providerManagedJobs.length}`} />
        <StatCard label="Crew" value={`${providerCrewMemberSnapshots.length}`} />
        <StatCard label="Crew gap" value={`${Math.max(crewGap, 0)}`} />
        <StatCard label="Ready payout" value={`$${payoutReadyAmount.toFixed(0)}`} />
      </View>

      <InfoCard title="Next jobs" description={`${shortStaffedJobs.length} need attention`}>
        <View style={styles.list}>
          {providerManagedJobs.slice(0, 3).map((job) => {
            const openSlots = job.requiredCrewMembers - job.assignedCrewMembers.length;
            return (
              <View key={job.id} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.jobTitle}>{job.clientName}</Text>
                  <Text style={styles.jobMeta}>
                    {job.dateLabel} • {job.timeLabel}
                  </Text>
                  <Text style={styles.jobMeta}>{job.serviceLabel}</Text>
                </View>
                <Text style={openSlots > 0 ? styles.warningBadge : styles.successBadge}>
                  {openSlots > 0 ? `${openSlots} open` : "Covered"}
                </Text>
              </View>
            );
          })}
        </View>
      </InfoCard>
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
  alertText: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 21
  },
  primaryButton: {
    marginTop: BrandTokens.spacing.sm,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.md
  },
  statCard: {
    width: "47%",
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
  },
  list: {
    gap: BrandTokens.spacing.md
  },
  jobRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  jobCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  jobTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  jobMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  warningBadge: {
    color: BrandTokens.colors.accent,
    fontWeight: "700"
  },
  successBadge: {
    color: BrandTokens.colors.success,
    fontWeight: "700"
  }
});
