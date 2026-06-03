import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { ProviderStaffingOverview } from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { getProviderMobileTracker } from "../lib/tracking";
import { useProviderSession } from "../session/ProviderSessionContext";

export function DashboardScreen({ onOpenCrew }: { onOpenCrew?: () => void }) {
  const tracker = getProviderMobileTracker();
  const { envelope } = useProviderSession();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [errorMessage, setErrorMessage] = useState("");

  const totalAssignedCrew = useMemo(
    () => overview?.jobs.reduce((sum, job) => sum + job.assignedCrewMembers, 0) ?? 0,
    [overview]
  );
  const totalCrewGap = useMemo(
    () => overview?.jobs.reduce((sum, job) => sum + job.crewGap, 0) ?? 0,
    [overview]
  );

  async function loadOverview() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setOverview(await api.getProviderStaffingOverview());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load operations.");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [envelope?.session.token]);

  return (
    <ScreenShell eyebrow="Home" title="Today at a glance">
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {totalCrewGap > 0 ? (
        <InfoCard title="Crew gap detected" description={`${totalCrewGap} open crew slots across upcoming jobs`}>
          <Text style={styles.alertText}>
            Matching is live. Review candidates now or switch the business to auto-accept.
          </Text>
          <Pressable
            onPress={() => {
              void tracker.track(MarketplaceTelemetryEventCatalog.providerSearchPerformed, {
                app: "provider",
                action: "find-crew-members",
                crewGap: totalCrewGap
              });
              onOpenCrew?.();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>Review crew below</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard label="Jobs" value={`${overview?.jobs.length ?? 0}`} />
        <StatCard label="Crew assigned" value={`${totalAssignedCrew}`} />
        <StatCard label="Crew gap" value={`${totalCrewGap}`} />
        <StatCard label="Staffing mode" value={overview?.provider.staffingMode === "auto-accept" ? "Auto" : "Review"} />
      </View>

      <InfoCard title="Next jobs" description={`${overview?.jobs.length ?? 0} upcoming`}>
        <View style={styles.list}>
          {(overview?.jobs ?? []).slice(0, 3).map((job) => (
            <View key={job.bookingId} style={styles.jobRow}>
              <View style={styles.jobCopy}>
                <Text style={styles.jobTitle}>{job.customerName}</Text>
                <Text style={styles.jobMeta}>
                  {new Date(job.scheduledStartIso).toLocaleDateString()} • {job.category.replaceAll("-", " ")}
                </Text>
                <Text style={styles.jobMeta}>
                  {job.assignedCrewMembers}/{job.requiredCrewMembers} crew • {job.crewGap} open
                </Text>
              </View>
              <Text style={job.crewGap > 0 ? styles.warningBadge : styles.successBadge}>
                {job.crewGap > 0 ? "Needs review" : "Covered"}
              </Text>
            </View>
          ))}
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
