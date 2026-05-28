import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  providerCrewMemberSnapshots,
  providerManagedJobs
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getProviderMobileTracker } from "../lib/tracking";

export function ClientsScreen() {
  const tracker = getProviderMobileTracker();
  const shortStaffedJobs = providerManagedJobs.filter(
    (job) => job.requiredCrewMembers > job.assignedCrewMembers.length
  );

  return (
    <ScreenShell eyebrow="Crew" title="Staffing and coverage">
      <InfoCard title="Open crew needs" description={`${shortStaffedJobs.length} jobs need more help`}>
        <View style={styles.list}>
          {shortStaffedJobs.map((job) => {
            const gap = job.requiredCrewMembers - job.assignedCrewMembers.length;

            return (
              <View key={job.id} style={styles.jobRow}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{job.clientName}</Text>
                  <Text style={styles.meta}>
                    {job.serviceLabel} • {job.dateLabel}
                  </Text>
                  <Text style={styles.meta}>
                    {gap} open spot{gap === 1 ? "" : "s"} • {job.distanceMiles} mi away
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    void tracker.track(MarketplaceTelemetryEventCatalog.providerSearchPerformed, {
                      app: "provider",
                      action: "fill-job-gap",
                      bookingId: job.id,
                      openSlots: gap
                    })
                  }
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Find help</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Current crew" description={`${providerCrewMemberSnapshots.length} people available`}>
        <View style={styles.list}>
          {providerCrewMemberSnapshots.map((crewMember) => (
            <View key={crewMember.name} style={styles.jobRow}>
              <View style={styles.copy}>
                <Text style={styles.title}>{crewMember.name}</Text>
                <Text style={styles.meta}>{crewMember.roleLabel}</Text>
                <Text style={styles.meta}>{crewMember.availabilityLabel}</Text>
              </View>
            </View>
          ))}
        </View>
      </InfoCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  jobRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    alignItems: "center",
    justifyContent: "space-between"
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
