import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  ProviderPayoutLedgerResponse,
  ProviderStaffingOverview,
  ProviderStaffingJobSummary
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { getProviderMobileTracker } from "../lib/tracking";
import { useProviderSession } from "../session/ProviderSessionContext";

type ProviderTodayJobAction = "complete" | "confirm" | "schedule";
type PayoutActionTone = "success" | "warning" | "neutral";

interface PayoutActionItem {
  detail: string;
  label: string;
  tone: PayoutActionTone;
  value: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatJobWindow(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} • ${time}`;
}

function formatJobStatus(status: string) {
  return status.replaceAll("-", " ");
}

function formatPayoutDate(iso?: string) {
  if (!iso) {
    return "Pending";
  }

  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPayoutStatus(status: ProviderPayoutLedgerResponse["entries"][number]["status"]) {
  switch (status) {
    case "awaiting-customer-payment":
      return "Awaiting payment";
    case "on-hold":
      return "On hold";
    case "scheduled":
      return "Scheduled";
    case "ready":
      return "Ready";
    case "paid":
      return "Paid";
    case "reversed":
      return "Reversed";
  }
}

function formatHoldPeriod(hours: number) {
  if (hours < 24) {
    return `${hours}h hold`;
  }

  const days = Math.round(hours / 24);
  return `${days}d hold`;
}

function getReadyPayoutDetail(payoutLedger: ProviderPayoutLedgerResponse) {
  if (
    payoutLedger.payoutSchedule.instantPayoutsEnabled &&
    payoutLedger.payoutSchedule.instantPayoutEligibleCents > 0
  ) {
    return `Instant eligible ${formatCurrency(payoutLedger.payoutSchedule.instantPayoutEligibleCents)}`;
  }

  return `Pays ${formatPayoutDate(payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)}`;
}

function getProviderPayoutFocus(payoutLedger: ProviderPayoutLedgerResponse, blockedPayoutCents: number) {
  if (payoutLedger.totalNetReadyCents > 0) {
    return {
      amount: formatCurrency(payoutLedger.totalNetReadyCents),
      detail: getReadyPayoutDetail(payoutLedger),
      label: "Ready"
    };
  }

  if (payoutLedger.totalNetScheduledCents > 0) {
    return {
      amount: formatCurrency(payoutLedger.totalNetScheduledCents),
      detail: `Next payout ${formatPayoutDate(payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)}`,
      label: "Scheduled"
    };
  }

  if (blockedPayoutCents > 0) {
    return {
      amount: formatCurrency(blockedPayoutCents),
      detail: "Customer payment or hold needs to clear.",
      label: "Waiting"
    };
  }

  return {
    amount: "$0",
    detail: "Completed paid jobs appear here.",
    label: "No payout yet"
  };
}

function getPayoutActionItems(
  payoutLedger: ProviderPayoutLedgerResponse,
  heldPayoutEntries: ProviderPayoutLedgerResponse["entries"]
): PayoutActionItem[] {
  const items: PayoutActionItem[] = [];

  if (payoutLedger.totalNetReadyCents > 0) {
    items.push({
      detail: getReadyPayoutDetail(payoutLedger),
      label: "Ready",
      tone: "success",
      value: formatCurrency(payoutLedger.totalNetReadyCents)
    });
  }

  if (payoutLedger.totalNetScheduledCents > 0) {
    items.push({
      detail: formatHoldPeriod(payoutLedger.payoutSchedule.holdPeriodHours),
      label: "Clearing",
      tone: "neutral",
      value: formatCurrency(payoutLedger.totalNetScheduledCents)
    });
  }

  if (payoutLedger.pendingCustomerPaymentCents > 0) {
    items.push({
      detail: "Customer checkout",
      label: "Waiting",
      tone: "warning",
      value: formatCurrency(payoutLedger.pendingCustomerPaymentCents)
    });
  }

  if (heldPayoutEntries.length > 0) {
    items.push({
      detail: `${heldPayoutEntries.length} hold${heldPayoutEntries.length === 1 ? "" : "s"}`,
      label: "On hold",
      tone: "warning",
      value: formatCurrency(heldPayoutEntries.reduce((sum, entry) => sum + entry.providerNetAmountCents, 0))
    });
  }

  if (items.length === 0) {
    items.push({
      detail: "Complete paid jobs",
      label: "Next",
      tone: "neutral",
      value: "$0"
    });
  }

  return items.slice(0, 4);
}

function getTodayJobAction(job?: ProviderStaffingJobSummary): ProviderTodayJobAction {
  if (!job) {
    return "schedule";
  }

  if (job.status === "requested") {
    return "confirm";
  }

  if (job.status === "in-progress" && job.afterEvidenceCount > 0) {
    return "complete";
  }

  return "schedule";
}

function getTodayJobActionLabel(action: ProviderTodayJobAction) {
  switch (action) {
    case "confirm":
      return "Confirm booking";
    case "complete":
      return "Complete job";
    case "schedule":
      return "Open schedule";
  }
}

export function DashboardScreen({
  onOpenCrew,
  onOpenSchedule
}: {
  onOpenCrew?: () => void;
  onOpenSchedule?: () => void;
}) {
  const tracker = getProviderMobileTracker();
  const { envelope } = useProviderSession();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [payoutLedger, setPayoutLedger] = useState<ProviderPayoutLedgerResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const totalJobs = overview?.jobs.length ?? 0;
  const totalAssignedCrew = useMemo(
    () => overview?.jobs.reduce((sum, job) => sum + job.assignedCrewMembers, 0) ?? 0,
    [overview]
  );
  const totalCrewGap = useMemo(
    () => overview?.jobs.reduce((sum, job) => sum + job.crewGap, 0) ?? 0,
    [overview]
  );
  const nextJob = useMemo(
    () =>
      (overview?.jobs ?? [])
        .slice()
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [overview]
  );
  const departureReminderJob = useMemo(
    () =>
      (overview?.jobs ?? [])
        .filter((job) => job.status === "confirmed" && !job.onRouteConfirmedAt)
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [overview]
  );
  const primaryCardKind =
    totalCrewGap > 0
      ? "staffing"
      : departureReminderJob
        ? "departure"
        : nextJob
          ? "job"
          : "empty";
  const remainingJobs = (overview?.jobs ?? []).filter((job) => {
    if (primaryCardKind === "departure" && departureReminderJob) {
      return job.bookingId !== departureReminderJob.bookingId;
    }

    if (primaryCardKind === "job" && nextJob) {
      return job.bookingId !== nextJob.bookingId;
    }

    return true;
  });
  const readyJobs = (overview?.jobs ?? []).filter((job) => job.crewGap === 0).length;
  const nextJobAction = getTodayJobAction(nextJob);
  const heldPayoutEntries = (payoutLedger?.entries ?? []).filter((entry) => entry.status === "on-hold");
  const blockedPayoutCents =
    (payoutLedger?.pendingCustomerPaymentCents ?? 0) +
    heldPayoutEntries.reduce((sum, entry) => sum + entry.providerNetAmountCents, 0);
  const shouldShowPayouts =
    Boolean(payoutLedger) && ((payoutLedger?.entries.length ?? 0) > 0 || totalJobs > 0);
  const payoutFocus = payoutLedger ? getProviderPayoutFocus(payoutLedger, blockedPayoutCents) : undefined;
  const payoutActionItems = payoutLedger ? getPayoutActionItems(payoutLedger, heldPayoutEntries) : [];
  const payoutRecentEntries = (payoutLedger?.entries ?? [])
    .slice()
    .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso))
    .slice(0, 2);
  const nextActionLabel =
    primaryCardKind === "staffing"
      ? "Review staffing"
      : primaryCardKind === "departure"
        ? "Start route"
        : primaryCardKind === "job"
          ? getTodayJobActionLabel(nextJobAction)
          : "Open schedule";

  async function loadOverview() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextOverview, nextPayoutLedger] = await Promise.all([
        api.getProviderStaffingOverview(),
        api.getProviderPayoutLedger()
      ]);
      setOverview(nextOverview);
      setPayoutLedger(nextPayoutLedger);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load operations.");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [envelope?.session.token]);

  async function startRoute(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setStatusMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingOnRoute({ bookingId });
      setStatusMessage("Route started. Open Schedule for live tracking and job tools.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the route.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setStatusMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.confirmBooking({ bookingId });
      setStatusMessage("Booking confirmed.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to confirm that booking.");
    } finally {
      setIsWorking(false);
    }
  }

  async function completeJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      setStatusMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.completeBooking({ bookingId });
      setStatusMessage("Job complete. The customer can review the service.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete that job.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Provider" title="Today" description="One priority, then the route.">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <View style={styles.opsSummaryCard}>
        <View style={styles.opsSummaryHeader}>
          <View>
            <Text style={styles.opsSummaryEyebrow}>Route health</Text>
            <Text style={styles.opsSummaryTitle}>{totalCrewGap > 0 ? "Staffing first" : "Route ready"}</Text>
          </View>
          <Text style={totalCrewGap > 0 ? styles.warningBadge : styles.successBadge}>
            {nextActionLabel}
          </Text>
        </View>
        <View style={styles.opsSummaryGrid}>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>Jobs</Text>
            <Text style={styles.opsSummaryValue}>{totalJobs}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>Ready</Text>
            <Text style={styles.opsSummaryValue}>{readyJobs}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>Crew gap</Text>
            <Text style={styles.opsSummaryValue}>{totalCrewGap}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>Assigned</Text>
            <Text style={styles.opsSummaryValue}>{totalAssignedCrew}</Text>
          </View>
        </View>
        {nextJob ? (
          <Text style={styles.opsSummaryMeta}>
            Next: {nextJob.customerName} • {formatJobWindow(nextJob.scheduledStartIso)}
          </Text>
        ) : (
          <Text style={styles.opsSummaryMeta}>No route work is waiting right now.</Text>
        )}
      </View>

      {shouldShowPayouts && payoutLedger ? (
        <InfoCard
          title="Payouts"
          description={
            blockedPayoutCents > 0
              ? `${formatCurrency(blockedPayoutCents)} waiting`
              : `${formatCurrency(payoutLedger.totalNetReadyCents)} ready`
          }
        >
          {payoutFocus ? (
            <View style={styles.payoutFocusCard}>
              <View style={styles.payoutFocusCopy}>
                <Text style={styles.payoutFocusLabel}>{payoutFocus.label}</Text>
                <Text style={styles.payoutFocusDetail}>{payoutFocus.detail}</Text>
              </View>
              <Text style={styles.payoutFocusAmount}>{payoutFocus.amount}</Text>
            </View>
          ) : null}
          <View style={styles.jobSummaryGrid}>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>Ready</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(payoutLedger.totalNetReadyCents)}</Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>Next</Text>
              <Text style={styles.jobSummaryValue}>
                {formatPayoutDate(payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)}
              </Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>Scheduled</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(payoutLedger.totalNetScheduledCents)}</Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>Crew</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(payoutLedger.totalCrewOwedCents)}</Text>
            </View>
          </View>
          <View style={styles.payoutActionGrid}>
            {payoutActionItems.map((item) => (
              <View
                key={`${item.label}-${item.value}`}
                style={[
                  styles.payoutActionItem,
                  item.tone === "success"
                    ? styles.payoutActionItemSuccess
                    : item.tone === "warning"
                      ? styles.payoutActionItemWarning
                      : styles.payoutActionItemNeutral
                ]}
              >
                <Text style={styles.payoutActionLabel}>{item.label}</Text>
                <Text style={styles.payoutActionValue}>{item.value}</Text>
                <Text style={styles.payoutActionDetail}>{item.detail}</Text>
              </View>
            ))}
          </View>
          {payoutRecentEntries.length > 0 ? (
            <View style={styles.payoutEntryList}>
              {payoutRecentEntries.map((entry) => (
                <View key={entry.id} style={styles.payoutEntryRow}>
                  <View style={styles.payoutEntryCopy}>
                    <Text style={styles.jobTitle}>{entry.customerName}</Text>
                    <Text style={styles.jobMeta}>
                      {entry.serviceLabel} • {formatPayoutDate(entry.serviceDateIso)}
                    </Text>
                  </View>
                  <View style={styles.payoutEntryAmountBlock}>
                    <Text style={styles.jobSummaryValue}>{formatCurrency(entry.providerNetAmountCents)}</Text>
                    <Text style={styles.jobSummaryLabel}>{formatPayoutStatus(entry.status)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.alertText}>Completed paid jobs will appear here.</Text>
          )}
        </InfoCard>
      ) : null}

      {primaryCardKind === "staffing" ? (
        <InfoCard title="Crew gap" description={`${totalCrewGap} open crew slots across upcoming jobs`}>
          <Text style={styles.alertText}>
            Matching is live. Review candidates before the route falls behind.
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
            <Text style={styles.primaryButtonLabel}>Review staffing</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {primaryCardKind === "departure" && departureReminderJob ? (
        <InfoCard
          title="Leave soon"
          description={buildDepartureSummary(departureReminderJob)}
        >
          <Text style={styles.alertText}>
            Start the route when you are ready to head to the property.
          </Text>
          <ProviderJobSnapshot job={departureReminderJob} />
          <Pressable
            disabled={isWorking}
            onPress={() => void startRoute(departureReminderJob.bookingId)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>{isWorking ? "Starting..." : "Start route"}</Text>
          </Pressable>
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Open schedule</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {primaryCardKind === "job" && nextJob ? (
        <InfoCard title="Next job" description={buildDepartureSummary(nextJob)}>
          <Text style={styles.alertText}>
            {nextJobAction === "confirm"
              ? "Confirm the request so the customer can pay and track the visit."
              : nextJobAction === "complete"
                ? "After-work proof is saved. Complete the job when service is reviewed."
                : `${nextJob.assignedCrewMembers}/${nextJob.requiredCrewMembers} crew${
                    nextJob.crewGap > 0 ? ` • ${nextJob.crewGap} still open` : " • fully staffed"
                  }`}
          </Text>
          <ProviderJobSnapshot job={nextJob} />
          {nextJobAction === "confirm" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void confirmJob(nextJob.bookingId)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Confirm booking"}</Text>
            </Pressable>
          ) : null}
          {nextJobAction === "complete" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void completeJob(nextJob.bookingId)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Complete job"}</Text>
            </Pressable>
          ) : null}
          {nextJobAction === "schedule" ? (
            <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Open schedule</Text>
            </Pressable>
          ) : null}
        </InfoCard>
      ) : null}

      {primaryCardKind === "empty" ? (
        <InfoCard title="You’re caught up" description="No upcoming jobs need review right now.">
          <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Open schedule</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {departureReminderJob && primaryCardKind === "staffing" ? (
        <InfoCard title="Leave soon" description={buildDepartureSummary(departureReminderJob)}>
          <Text style={styles.alertText}>Route is ready once staffing is covered.</Text>
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Open schedule</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      <InfoCard
        title={remainingJobs.length > 0 ? "Later jobs" : "Schedule health"}
        description={
          remainingJobs.length > 0
            ? `${remainingJobs.length} more upcoming`
            : `${overview?.jobs.length ?? 0} total jobs • ${totalAssignedCrew} crew assigned`
        }
      >
        {remainingJobs.length > 0 ? (
        <View style={styles.list}>
          {remainingJobs.slice(0, 3).map((job) => (
            <View key={job.bookingId} style={styles.jobRow}>
              <View style={styles.jobCopy}>
                <Text style={styles.jobTitle}>{job.customerName}</Text>
                <Text style={styles.jobMeta}>{job.category.replaceAll("-", " ")}</Text>
                <ProviderJobSnapshot job={job} compact />
              </View>
              <Text style={job.crewGap > 0 ? styles.warningBadge : styles.successBadge}>
                {job.crewGap > 0 ? "Needs review" : "Covered"}
              </Text>
            </View>
          ))}
        </View>
        ) : (
          <Text style={styles.alertText}>
            Staffing is set to {overview?.provider.staffingMode === "auto-accept" ? "auto-accept" : "review first"} and there
            are no other upcoming jobs behind the current priority.
          </Text>
        )}
      </InfoCard>
    </ScreenShell>
  );
}

function buildDepartureSummary(job: ProviderStaffingJobSummary) {
  return `${job.customerName} • ${new Date(job.scheduledStartIso).toLocaleDateString()} • ${new Date(job.scheduledStartIso).toLocaleTimeString([], { timeStyle: "short" })}`;
}

function ProviderJobSnapshot({
  compact = false,
  job
}: {
  compact?: boolean;
  job: ProviderStaffingJobSummary;
}) {
  return (
    <View style={[styles.jobSummaryGrid, compact && styles.jobSummaryGridCompact]}>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>Window</Text>
        <Text style={styles.jobSummaryValue}>{formatJobWindow(job.scheduledStartIso)}</Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>Crew</Text>
        <Text style={styles.jobSummaryValue}>
          {job.assignedCrewMembers}/{job.requiredCrewMembers}
          {job.crewGap ? ` • gap ${job.crewGap}` : ""}
        </Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>Total</Text>
        <Text style={styles.jobSummaryValue}>{formatCurrency(job.totalCents)}</Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>Status</Text>
        <Text style={styles.jobSummaryValue}>{formatJobStatus(job.status)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  opsSummaryCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.md
  },
  opsSummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  opsSummaryEyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  opsSummaryTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24
  },
  opsSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  opsSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  opsSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  opsSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24
  },
  opsSummaryMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  alertText: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 21
  },
  payoutFocusCard: {
    alignItems: "center",
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  payoutFocusCopy: {
    flex: 1,
    gap: 2
  },
  payoutFocusLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  payoutFocusDetail: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  payoutFocusAmount: {
    color: BrandTokens.colors.ink,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "right"
  },
  payoutActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  payoutActionItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  payoutActionItemSuccess: {
    borderColor: "rgba(47, 125, 76, 0.2)",
    backgroundColor: "rgba(47, 125, 76, 0.08)"
  },
  payoutActionItemWarning: {
    borderColor: "rgba(230, 167, 86, 0.26)",
    backgroundColor: "rgba(230, 167, 86, 0.1)"
  },
  payoutActionItemNeutral: {
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  payoutActionLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  payoutActionValue: {
    color: BrandTokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20
  },
  payoutActionDetail: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  payoutEntryList: {
    gap: BrandTokens.spacing.sm
  },
  payoutEntryRow: {
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: "rgba(20, 40, 29, 0.08)",
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    justifyContent: "space-between",
    paddingTop: BrandTokens.spacing.sm
  },
  payoutEntryCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  payoutEntryAmountBlock: {
    alignItems: "flex-end",
    gap: 2
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
  linkButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderColor: BrandTokens.colors.primary,
    borderWidth: 1,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
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
  jobSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  jobSummaryGridCompact: {
    marginTop: BrandTokens.spacing.xs
  },
  jobSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  jobSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  jobSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
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
