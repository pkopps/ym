import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { ProviderStaffingOverview } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

export function ClientsScreen() {
  const { envelope } = useProviderSession();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [expandedJobBookingId, setExpandedJobBookingId] = useState<string | undefined>();
  const [showOtherJobs, setShowOtherJobs] = useState(false);
  const [showOtherMatchesByJob, setShowOtherMatchesByJob] = useState<Record<string, boolean>>({});

  async function loadData() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setOverview(await api.getProviderStaffingOverview());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load crew matches.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [envelope?.session.token]);

  async function reviewMatch(crewMatchId: string, action: "accept" | "deny") {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.reviewCrewMatch({ crewMatchId, action });
      setStatusMessage(action === "accept" ? "Crew member accepted." : "Crew member declined.");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that match.");
    } finally {
      setIsWorking(false);
    }
  }

  const jobsNeedingAttention = (overview?.jobs ?? []).filter((job) => job.crewGap > 0);
  const primaryJobNeedingAttention = jobsNeedingAttention[0];
  const otherJobsNeedingAttention = jobsNeedingAttention.slice(1);

  function toggleJobMatches(bookingId: string) {
    setExpandedJobBookingId((current) => (current === bookingId ? undefined : bookingId));
    setShowOtherMatchesByJob((current) => ({
      ...current,
      [bookingId]: false
    }));
  }

  function toggleOtherMatches(bookingId: string) {
    setShowOtherMatchesByJob((current) => ({
      ...current,
      [bookingId]: !current[bookingId]
    }));
  }

  function renderMatchRow(match: ProviderStaffingOverview["jobs"][number]["matches"][number]) {
    return (
      <View key={match.id} style={styles.matchRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>{match.crewMemberName}</Text>
          <Text style={styles.meta}>
            {match.categories.map((category) => category.replaceAll("-", " ")).join(" • ")}
          </Text>
          <Text style={styles.meta}>
            {match.distanceMiles} mi • {match.availableWeekdays.join(", ")}
          </Text>
          <Text style={styles.meta}>
            {match.status === "pending-provider-review" ? "Ready for your review" : match.status.replaceAll("-", " ")}
          </Text>
        </View>
        <View style={styles.buttonStack}>
          {match.status === "pending-provider-review" ? (
            <>
              <Pressable
                disabled={isWorking}
                onPress={() => void reviewMatch(match.id, "accept")}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>Accept</Text>
              </Pressable>
              <Pressable
                disabled={isWorking}
                onPress={() => void reviewMatch(match.id, "deny")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Deny</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={() => void Linking.openURL(`tel:${match.crewMemberPhone}`)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Call</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderJobCard(job: ProviderStaffingOverview["jobs"][number]) {
    const pendingMatches = job.matches.filter((match) => match.status === "pending-provider-review");
    const hasExpandedMatches = expandedJobBookingId === job.bookingId;
    const primaryMatch = pendingMatches[0] ?? job.matches[0];
    const otherMatches = primaryMatch ? job.matches.filter((match) => match.id !== primaryMatch.id) : [];
    const showOtherMatches = showOtherMatchesByJob[job.bookingId] ?? false;

    return (
      <View key={job.bookingId} style={styles.jobCard}>
        <View style={styles.copy}>
          <Text style={styles.title}>{job.customerName}</Text>
          <Text style={styles.meta}>
            {job.category.replaceAll("-", " ")} • {job.crewGap} open spot{job.crewGap === 1 ? "" : "s"}
          </Text>
          <Text style={styles.meta}>
            {pendingMatches.length} waiting for review • {job.matches.length} total match
            {job.matches.length === 1 ? "" : "es"}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable onPress={() => toggleJobMatches(job.bookingId)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>
              {hasExpandedMatches ? "Hide matches" : "Review matches"}
            </Text>
          </Pressable>
        </View>
        {hasExpandedMatches ? (
          <View style={styles.list}>
            {primaryMatch ? (
              <View style={styles.matchFocusCard}>
                <Text style={styles.matchSectionLabel}>
                  {primaryMatch.status === "pending-provider-review" ? "Next match" : "Latest match"}
                </Text>
                {renderMatchRow(primaryMatch)}
              </View>
            ) : (
              <Text style={styles.meta}>No crew matches are ready yet.</Text>
            )}
            {otherMatches.length > 0 ? (
              <>
                <Pressable onPress={() => toggleOtherMatches(job.bookingId)} style={styles.secondaryButtonInline}>
                  <Text style={styles.secondaryButtonInlineLabel}>
                    {showOtherMatches ? "Hide other matches" : `Other matches (${otherMatches.length})`}
                  </Text>
                </Pressable>
                {showOtherMatches ? <View style={styles.list}>{otherMatches.map((match) => renderMatchRow(match))}</View> : null}
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScreenShell eyebrow="Crew" title="Crew coverage" description="Fill the next open spot.">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {primaryJobNeedingAttention ? (
        <InfoCard
          title="Needs coverage"
          description={`${jobsNeedingAttention.length} job${jobsNeedingAttention.length === 1 ? "" : "s"} need more help`}
        >
          {renderJobCard(primaryJobNeedingAttention)}
          {otherJobsNeedingAttention.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowOtherJobs((current) => !current)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {showOtherJobs ? "Hide other jobs" : `Other staffing needs (${otherJobsNeedingAttention.length})`}
                </Text>
              </Pressable>
              {showOtherJobs ? (
                <View style={styles.list}>
                  {otherJobsNeedingAttention.map((job) => renderJobCard(job))}
                </View>
              ) : null}
            </>
          ) : null}
        </InfoCard>
      ) : (
        <InfoCard title="Coverage is set" description="No jobs need more crew right now." />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  jobCard: {
    gap: BrandTokens.spacing.sm
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandTokens.colors.border,
    paddingTop: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
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
  buttonStack: {
    gap: BrandTokens.spacing.sm
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  matchFocusCard: {
    gap: BrandTokens.spacing.sm
  },
  matchSectionLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  secondaryButtonInline: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonInlineLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
