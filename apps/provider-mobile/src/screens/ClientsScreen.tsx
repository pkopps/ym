import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { ProviderStaffingOverview } from "@yardmatch/contracts";
import { I18nInstance } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

function formatHourlyPay(i18n: I18nInstance, cents: number) {
  return i18n.t("provider_mobile.clients.hourly_rate", {
    rate: i18n.formatCurrency(cents)
  });
}

function formatRecommendationLabel(i18n: I18nInstance, label?: "best-fit" | "good-fit" | "backup") {
  if (label === "best-fit") {
    return i18n.t("common.state.best_fit");
  }

  if (label === "good-fit") {
    return i18n.t("provider_mobile.clients.good_fit");
  }

  if (label === "backup") {
    return i18n.t("provider_mobile.clients.backup");
  }

  return i18n.t("provider_mobile.clients.crew_match");
}

export function ClientsScreen() {
  const i18n = useI18n();
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.clients.error.load_matches"));
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
      setStatusMessage(
        action === "accept"
          ? i18n.t("provider_mobile.clients.message.accepted")
          : i18n.t("provider_mobile.clients.message.declined")
      );
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.clients.error.update_match"));
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
    const isPending = match.status === "pending-provider-review";
    const facts = [
      {
        label: i18n.t("provider_mobile.clients.fact.rate"),
        value: formatHourlyPay(i18n, match.hourlyRateCents)
      },
      {
        label: i18n.t("provider_mobile.clients.fact.distance"),
        value: i18n.t("common.format.miles", { count: match.distanceMiles })
      },
      {
        label: i18n.t("provider_mobile.clients.fact.travel"),
        value: i18n.t("common.format.miles", { count: match.willingToTravelMiles })
      },
      {
        label: i18n.t("provider_mobile.clients.fact.equipment"),
        value: match.hasOwnEquipment ? i18n.t("provider_mobile.clients.equipment.owns") : i18n.t("provider_mobile.clients.equipment.needs")
      }
    ];

    return (
      <View key={match.id} style={styles.matchRow}>
        <View style={styles.matchHeader}>
          <View style={styles.copy}>
            <Text style={styles.matchBadge}>{formatRecommendationLabel(i18n, match.recommendationLabel)}</Text>
            <Text style={styles.title}>{match.crewMemberName}</Text>
            <Text style={styles.meta}>
              {match.categories.map((category) => i18n.t(serviceCategoryToI18nKey(category))).join(" • ")}
            </Text>
          </View>
          <Text style={isPending ? styles.warningBadge : styles.successBadge}>
            {isPending ? i18n.t("provider_mobile.clients.review") : match.status.replaceAll("-", " ")}
          </Text>
        </View>
        <View style={styles.matchFactGrid}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.matchFactItem}>
              <Text style={styles.matchFactLabel}>{fact.label}</Text>
              <Text style={styles.matchFactValue}>{fact.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.meta}>
          {match.preferredSchedule.replaceAll("-", " ")} • {match.availableWeekdays.join(", ")}
        </Text>
        {match.recommendationReasons && match.recommendationReasons.length > 0 ? (
          <Text style={styles.meta}>{match.recommendationReasons.slice(0, 2).join(" • ")}</Text>
        ) : null}
        <View style={styles.buttonRow}>
          {isPending ? (
            <>
              <Pressable
                disabled={isWorking}
                onPress={() => void reviewMatch(match.id, "accept")}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>{i18n.t("provider_mobile.clients.add_crew")}</Text>
              </Pressable>
              <Pressable
                disabled={isWorking}
                onPress={() => void reviewMatch(match.id, "deny")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.clients.pass")}</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={() => void Linking.openURL(`tel:${match.crewMemberPhone}`)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.clients.call")}</Text>
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
            {i18n.t(serviceCategoryToI18nKey(job.category))} • {i18n.t("provider_mobile.clients.open_spots", { count: job.crewGap })}
          </Text>
          <Text style={styles.meta}>
            {i18n.t("provider_mobile.clients.match_summary", {
              pending: pendingMatches.length,
              total: job.matches.length
            })}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable onPress={() => toggleJobMatches(job.bookingId)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>
              {hasExpandedMatches ? i18n.t("common.actions.close") : i18n.t("provider_mobile.clients.review_matches")}
            </Text>
          </Pressable>
        </View>
        {hasExpandedMatches ? (
          <View style={styles.list}>
            {primaryMatch ? (
              <View style={styles.matchFocusCard}>
                <Text style={styles.matchSectionLabel}>
                  {primaryMatch.status === "pending-provider-review"
                    ? i18n.t("provider_mobile.clients.next_match")
                    : i18n.t("provider_mobile.clients.latest_match")}
                </Text>
                {renderMatchRow(primaryMatch)}
              </View>
            ) : (
              <Text style={styles.meta}>{i18n.t("provider_mobile.clients.no_matches_ready")}</Text>
            )}
            {otherMatches.length > 0 ? (
              <>
                <Pressable onPress={() => toggleOtherMatches(job.bookingId)} style={styles.secondaryButtonInline}>
                  <Text style={styles.secondaryButtonInlineLabel}>
                    {showOtherMatches
                      ? i18n.t("common.actions.close")
                      : i18n.t("provider_mobile.clients.other_matches", { count: otherMatches.length })}
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

  if (!overview && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("provider_mobile.clients.eyebrow")}
        title={i18n.t("provider_mobile.clients.title")}
        description={i18n.t("provider_mobile.clients.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction showAvatar />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction showAvatar />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("provider_mobile.clients.eyebrow")}
      title={i18n.t("provider_mobile.clients.title")}
      description={i18n.t("provider_mobile.clients.description")}
    >
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {primaryJobNeedingAttention ? (
        <InfoCard
          title={i18n.t("provider_mobile.clients.needs_coverage")}
          description={i18n.t("provider_mobile.clients.jobs_need_help", { count: jobsNeedingAttention.length })}
        >
          {renderJobCard(primaryJobNeedingAttention)}
          {otherJobsNeedingAttention.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowOtherJobs((current) => !current)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {showOtherJobs
                    ? i18n.t("common.actions.close")
                    : i18n.t("provider_mobile.clients.other_staffing_needs", { count: otherJobsNeedingAttention.length })}
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
        <InfoCard title={i18n.t("provider_mobile.clients.coverage_set")} description={i18n.t("provider_mobile.clients.no_jobs_need_crew")} />
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
    gap: BrandTokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandTokens.colors.border,
    paddingTop: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
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
  matchBadge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  matchFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  matchFactItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  matchFactLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  matchFactValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
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
