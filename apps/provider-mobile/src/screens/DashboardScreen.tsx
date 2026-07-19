import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  ProviderPayoutLedgerResponse,
  ProviderStaffingOverview,
  ProviderStaffingJobSummary
} from "@yardmatch/contracts";
import { I18nInstance } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
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

function formatCurrency(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents);
}

function formatJobWindow(i18n: I18nInstance, iso: string) {
  const date = new Date(iso);
  const day = i18n.formatDate(date, { weekday: "short", month: "short", day: "numeric" });
  const time = i18n.formatDate(date, { hour: "numeric", minute: "2-digit" });
  return i18n.t("provider_mobile.dashboard.job_window", { day, time });
}

function formatJobStatus(status: string) {
  return status.replaceAll("-", " ");
}

function formatPayoutDate(i18n: I18nInstance, iso?: string) {
  if (!iso) {
    return i18n.t("provider_mobile.dashboard.pending");
  }

  return i18n.formatDate(iso, { month: "short", day: "numeric" });
}

function formatPayoutStatus(i18n: I18nInstance, status: ProviderPayoutLedgerResponse["entries"][number]["status"]) {
  switch (status) {
    case "awaiting-customer-payment":
      return i18n.t("provider_mobile.dashboard.payout.awaiting_payment");
    case "on-hold":
      return i18n.t("provider_mobile.dashboard.payout.on_hold");
    case "scheduled":
      return i18n.t("provider_mobile.dashboard.payout.scheduled");
    case "ready":
      return i18n.t("provider_mobile.dashboard.payout.ready");
    case "paid":
      return i18n.t("provider_mobile.dashboard.payout.paid");
    case "reversed":
      return i18n.t("provider_mobile.dashboard.payout.reversed");
  }
}

function formatHoldPeriod(i18n: I18nInstance, hours: number) {
  if (hours < 24) {
    return i18n.t("provider_mobile.dashboard.hold_hours", { count: hours });
  }

  const days = Math.round(hours / 24);
  return i18n.t("provider_mobile.dashboard.hold_days", { count: days });
}

function getReadyPayoutDetail(i18n: I18nInstance, payoutLedger: ProviderPayoutLedgerResponse) {
  if (
    payoutLedger.payoutSchedule.instantPayoutsEnabled &&
    payoutLedger.payoutSchedule.instantPayoutEligibleCents > 0
  ) {
    return i18n.t("provider_mobile.dashboard.payout.instant_eligible", {
      amount: formatCurrency(i18n, payoutLedger.payoutSchedule.instantPayoutEligibleCents)
    });
  }

  return i18n.t("provider_mobile.dashboard.payout.pays_date", {
    date: formatPayoutDate(i18n, payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)
  });
}

function getProviderPayoutFocus(i18n: I18nInstance, payoutLedger: ProviderPayoutLedgerResponse, blockedPayoutCents: number) {
  if (payoutLedger.totalNetReadyCents > 0) {
    return {
      amount: formatCurrency(i18n, payoutLedger.totalNetReadyCents),
      detail: getReadyPayoutDetail(i18n, payoutLedger),
      label: i18n.t("provider_mobile.dashboard.payout.ready")
    };
  }

  if (payoutLedger.totalNetScheduledCents > 0) {
    return {
      amount: formatCurrency(i18n, payoutLedger.totalNetScheduledCents),
      detail: i18n.t("provider_mobile.dashboard.payout.next_payout", {
        date: formatPayoutDate(i18n, payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)
      }),
      label: i18n.t("provider_mobile.dashboard.payout.scheduled")
    };
  }

  if (blockedPayoutCents > 0) {
    return {
      amount: formatCurrency(i18n, blockedPayoutCents),
      detail: i18n.t("provider_mobile.dashboard.payout.blocked_detail"),
      label: i18n.t("provider_mobile.dashboard.payout.waiting")
    };
  }

  return {
    amount: formatCurrency(i18n, 0),
    detail: i18n.t("provider_mobile.dashboard.payout.completed_paid_jobs_here"),
    label: i18n.t("provider_mobile.dashboard.payout.no_payout")
  };
}

function getPayoutActionItems(
  i18n: I18nInstance,
  payoutLedger: ProviderPayoutLedgerResponse,
  heldPayoutEntries: ProviderPayoutLedgerResponse["entries"]
): PayoutActionItem[] {
  const items: PayoutActionItem[] = [];

  if (payoutLedger.totalNetReadyCents > 0) {
    items.push({
      detail: getReadyPayoutDetail(i18n, payoutLedger),
      label: i18n.t("provider_mobile.dashboard.payout.ready"),
      tone: "success",
      value: formatCurrency(i18n, payoutLedger.totalNetReadyCents)
    });
  }

  if (payoutLedger.totalNetScheduledCents > 0) {
    items.push({
      detail: formatHoldPeriod(i18n, payoutLedger.payoutSchedule.holdPeriodHours),
      label: i18n.t("provider_mobile.dashboard.payout.clearing"),
      tone: "neutral",
      value: formatCurrency(i18n, payoutLedger.totalNetScheduledCents)
    });
  }

  if (payoutLedger.pendingCustomerPaymentCents > 0) {
    items.push({
      detail: i18n.t("provider_mobile.dashboard.payout.customer_checkout"),
      label: i18n.t("provider_mobile.dashboard.payout.waiting"),
      tone: "warning",
      value: formatCurrency(i18n, payoutLedger.pendingCustomerPaymentCents)
    });
  }

  if (heldPayoutEntries.length > 0) {
    items.push({
      detail: i18n.t("provider_mobile.dashboard.payout.hold_count", { count: heldPayoutEntries.length }),
      label: i18n.t("provider_mobile.dashboard.payout.on_hold"),
      tone: "warning",
      value: formatCurrency(i18n, heldPayoutEntries.reduce((sum, entry) => sum + entry.providerNetAmountCents, 0))
    });
  }

  if (items.length === 0) {
    items.push({
      detail: i18n.t("provider_mobile.dashboard.payout.complete_paid_jobs"),
      label: i18n.t("provider_mobile.dashboard.payout.next"),
      tone: "neutral",
      value: formatCurrency(i18n, 0)
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

function getTodayJobActionLabel(i18n: I18nInstance, action: ProviderTodayJobAction) {
  switch (action) {
    case "confirm":
      return i18n.t("provider_mobile.dashboard.action.confirm_booking");
    case "complete":
      return i18n.t("provider_mobile.dashboard.action.complete_job");
    case "schedule":
      return i18n.t("provider_mobile.dashboard.action.open_schedule");
  }
}

export function DashboardScreen({
  onOpenCrew,
  onOpenSchedule
}: {
  onOpenCrew?: () => void;
  onOpenSchedule?: () => void;
}) {
  const i18n = useI18n();
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
  const payoutFocus = payoutLedger ? getProviderPayoutFocus(i18n, payoutLedger, blockedPayoutCents) : undefined;
  const payoutActionItems = payoutLedger ? getPayoutActionItems(i18n, payoutLedger, heldPayoutEntries) : [];
  const payoutRecentEntries = (payoutLedger?.entries ?? [])
    .slice()
    .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso))
    .slice(0, 2);
  const nextActionLabel =
    primaryCardKind === "staffing"
      ? i18n.t("provider_mobile.dashboard.action.review_staffing")
      : primaryCardKind === "departure"
        ? i18n.t("provider_mobile.dashboard.action.start_route")
        : primaryCardKind === "job"
          ? getTodayJobActionLabel(i18n, nextJobAction)
          : i18n.t("provider_mobile.dashboard.action.open_schedule");

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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.load_operations"));
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
      setStatusMessage(i18n.t("provider_mobile.dashboard.message.route_started"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.start_route"));
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
      setStatusMessage(i18n.t("provider_mobile.dashboard.message.booking_confirmed"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.confirm_booking"));
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
      setStatusMessage(i18n.t("provider_mobile.dashboard.message.job_complete"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.complete_job"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("provider_mobile.dashboard.eyebrow")}
      title={i18n.t("provider_mobile.dashboard.title")}
      description={i18n.t("provider_mobile.dashboard.description")}
    >
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <View style={styles.opsSummaryCard}>
        <View style={styles.opsSummaryHeader}>
          <View>
            <Text style={styles.opsSummaryEyebrow}>{i18n.t("provider_mobile.dashboard.route_health")}</Text>
            <Text style={styles.opsSummaryTitle}>
              {totalCrewGap > 0
                ? i18n.t("provider_mobile.dashboard.staffing_first")
                : i18n.t("provider_mobile.dashboard.route_ready")}
            </Text>
          </View>
          <Text style={totalCrewGap > 0 ? styles.warningBadge : styles.successBadge}>
            {nextActionLabel}
          </Text>
        </View>
        <View style={styles.opsSummaryGrid}>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>{i18n.t("provider_mobile.dashboard.jobs")}</Text>
            <Text style={styles.opsSummaryValue}>{totalJobs}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.ready")}</Text>
            <Text style={styles.opsSummaryValue}>{readyJobs}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew_gap")}</Text>
            <Text style={styles.opsSummaryValue}>{totalCrewGap}</Text>
          </View>
          <View style={styles.opsSummaryItem}>
            <Text style={styles.opsSummaryLabel}>{i18n.t("provider_mobile.dashboard.assigned")}</Text>
            <Text style={styles.opsSummaryValue}>{totalAssignedCrew}</Text>
          </View>
        </View>
        {nextJob ? (
          <Text style={styles.opsSummaryMeta}>
            {i18n.t("provider_mobile.dashboard.next_job_line", {
              customer: nextJob.customerName,
              window: formatJobWindow(i18n, nextJob.scheduledStartIso)
            })}
          </Text>
        ) : (
          <Text style={styles.opsSummaryMeta}>{i18n.t("provider_mobile.dashboard.no_route_work")}</Text>
        )}
      </View>

      {shouldShowPayouts && payoutLedger ? (
        <InfoCard
          title={i18n.t("provider_mobile.dashboard.payouts")}
          description={
            blockedPayoutCents > 0
              ? i18n.t("provider_mobile.dashboard.payout.waiting_amount", {
                  amount: formatCurrency(i18n, blockedPayoutCents)
                })
              : i18n.t("provider_mobile.dashboard.payout.ready_amount", {
                  amount: formatCurrency(i18n, payoutLedger.totalNetReadyCents)
                })
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
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.ready")}</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, payoutLedger.totalNetReadyCents)}</Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.next")}</Text>
              <Text style={styles.jobSummaryValue}>
                {formatPayoutDate(i18n, payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso)}
              </Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.scheduled")}</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, payoutLedger.totalNetScheduledCents)}</Text>
            </View>
            <View style={styles.jobSummaryItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew")}</Text>
              <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, payoutLedger.totalCrewOwedCents)}</Text>
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
                      {entry.serviceLabel} • {formatPayoutDate(i18n, entry.serviceDateIso)}
                    </Text>
                  </View>
                  <View style={styles.payoutEntryAmountBlock}>
                    <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, entry.providerNetAmountCents)}</Text>
                    <Text style={styles.jobSummaryLabel}>{formatPayoutStatus(i18n, entry.status)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.alertText}>{i18n.t("provider_mobile.dashboard.payout.completed_paid_jobs_here")}</Text>
          )}
        </InfoCard>
      ) : null}

      {primaryCardKind === "staffing" ? (
        <InfoCard title={i18n.t("provider_mobile.dashboard.crew_gap")} description={i18n.t("provider_mobile.dashboard.open_crew_slots", { count: totalCrewGap })}>
          <Text style={styles.alertText}>
            {i18n.t("provider_mobile.dashboard.review_crew_before_window")}
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
            <Text style={styles.primaryButtonLabel}>{i18n.t("provider_mobile.dashboard.action.review_staffing")}</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {primaryCardKind === "departure" && departureReminderJob ? (
        <InfoCard
          title={i18n.t("provider_mobile.dashboard.leave_soon")}
          description={buildDepartureSummary(i18n, departureReminderJob)}
        >
          <Text style={styles.alertText}>
            {i18n.t("provider_mobile.dashboard.start_route_ready")}
          </Text>
          <ProviderJobSnapshot i18n={i18n} job={departureReminderJob} />
          <Pressable
            disabled={isWorking}
            onPress={() => void startRoute(departureReminderJob.bookingId)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>
              {isWorking ? i18n.t("provider_mobile.dashboard.loading.starting") : i18n.t("provider_mobile.dashboard.action.start_route")}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {primaryCardKind === "job" && nextJob ? (
        <InfoCard title={i18n.t("provider_mobile.dashboard.next_job")} description={buildDepartureSummary(i18n, nextJob)}>
          <Text style={styles.alertText}>
            {nextJobAction === "confirm"
              ? i18n.t("provider_mobile.dashboard.confirm_request_guidance")
              : nextJobAction === "complete"
                ? i18n.t("provider_mobile.dashboard.complete_job_guidance")
                : i18n.t("provider_mobile.dashboard.crew_staffing_line", {
                    assigned: nextJob.assignedCrewMembers,
                    required: nextJob.requiredCrewMembers,
                    detail:
                      nextJob.crewGap > 0
                        ? i18n.t("provider_mobile.dashboard.still_open", { count: nextJob.crewGap })
                        : i18n.t("provider_mobile.dashboard.fully_staffed")
                  })}
          </Text>
          <ProviderJobSnapshot i18n={i18n} job={nextJob} />
          {nextJobAction === "confirm" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void confirmJob(nextJob.bookingId)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>
                {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.confirm_booking")}
              </Text>
            </Pressable>
          ) : null}
          {nextJobAction === "complete" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void completeJob(nextJob.bookingId)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>
                {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.complete_job")}
              </Text>
            </Pressable>
          ) : null}
          {nextJobAction === "schedule" ? (
            <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
            </Pressable>
          ) : null}
        </InfoCard>
      ) : null}

      {primaryCardKind === "empty" ? (
        <InfoCard title={i18n.t("provider_mobile.dashboard.caught_up")} description={i18n.t("provider_mobile.dashboard.no_upcoming_jobs_need_review")}>
          <Pressable onPress={onOpenSchedule} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      {departureReminderJob && primaryCardKind === "staffing" ? (
        <InfoCard title={i18n.t("provider_mobile.dashboard.leave_soon")} description={buildDepartureSummary(i18n, departureReminderJob)}>
          <Text style={styles.alertText}>{i18n.t("provider_mobile.dashboard.cover_staffing_before_route")}</Text>
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
          </Pressable>
        </InfoCard>
      ) : null}

      <InfoCard
        title={remainingJobs.length > 0 ? i18n.t("provider_mobile.dashboard.later_jobs") : i18n.t("provider_mobile.dashboard.schedule_health")}
        description={
          remainingJobs.length > 0
            ? i18n.t("provider_mobile.dashboard.more_upcoming", { count: remainingJobs.length })
            : i18n.t("provider_mobile.dashboard.schedule_health_summary", {
                jobs: overview?.jobs.length ?? 0,
                crew: totalAssignedCrew
              })
        }
      >
        {remainingJobs.length > 0 ? (
        <View style={styles.list}>
          {remainingJobs.slice(0, 3).map((job) => (
            <View key={job.bookingId} style={styles.jobRow}>
              <View style={styles.jobCopy}>
                <Text style={styles.jobTitle}>{job.customerName}</Text>
                <Text style={styles.jobMeta}>{i18n.t(serviceCategoryToI18nKey(job.category))}</Text>
                <ProviderJobSnapshot i18n={i18n} job={job} compact />
              </View>
              <Text style={job.crewGap > 0 ? styles.warningBadge : styles.successBadge}>
                {job.crewGap > 0 ? i18n.t("provider_mobile.dashboard.needs_review") : i18n.t("provider_mobile.dashboard.covered")}
              </Text>
            </View>
          ))}
        </View>
        ) : (
          <Text style={styles.alertText}>
            {i18n.t("provider_mobile.dashboard.staffing_mode_no_other_jobs", {
              mode:
                overview?.provider.staffingMode === "auto-accept"
                  ? i18n.t("provider_mobile.dashboard.staffing_mode.auto_accept")
                  : i18n.t("provider_mobile.dashboard.staffing_mode.review_first")
            })}
          </Text>
        )}
      </InfoCard>
    </ScreenShell>
  );
}

function buildDepartureSummary(i18n: I18nInstance, job: ProviderStaffingJobSummary) {
  return i18n.t("provider_mobile.dashboard.departure_summary", {
    customer: job.customerName,
    date: i18n.formatDate(job.scheduledStartIso),
    time: i18n.formatDate(job.scheduledStartIso, { timeStyle: "short" })
  });
}

function ProviderJobSnapshot({
  compact = false,
  i18n,
  job
}: {
  compact?: boolean;
  i18n: I18nInstance;
  job: ProviderStaffingJobSummary;
}) {
  return (
    <View style={[styles.jobSummaryGrid, compact && styles.jobSummaryGridCompact]}>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.window")}</Text>
        <Text style={styles.jobSummaryValue}>{formatJobWindow(i18n, job.scheduledStartIso)}</Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew")}</Text>
        <Text style={styles.jobSummaryValue}>
          {i18n.t("provider_mobile.dashboard.crew_ratio", {
            assigned: job.assignedCrewMembers,
            required: job.requiredCrewMembers,
            gap: job.crewGap ? i18n.t("provider_mobile.dashboard.gap_count", { count: job.crewGap }) : ""
          })}
        </Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.total")}</Text>
        <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, job.totalCents)}</Text>
      </View>
      <View style={styles.jobSummaryItem}>
        <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.status")}</Text>
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
