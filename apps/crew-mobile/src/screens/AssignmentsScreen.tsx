import { ReactNode, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { BookingStatus, CrewMatchStatus, CrewMatchesResponse, ServiceCategory } from "@yardmatch/contracts";
import { I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

type ViewMode = "upcoming" | "history";
type CrewAssignment = CrewMatchesResponse["matches"][number];
type AssignmentNextAction = "start-route" | "today";

interface AssignmentNextStep {
  action?: AssignmentNextAction;
  detail: string;
  label: string;
}

const bookingStatusLabelKeys: Record<BookingStatus, TranslationKey> = {
  cancelled: "provider_mobile.schedule.status.cancelled",
  completed: "provider_mobile.schedule.status.completed",
  confirmed: "provider_mobile.schedule.status.confirmed",
  disputed: "provider_mobile.schedule.status.disputed",
  "in-progress": "provider_mobile.schedule.status.in_progress",
  refunded: "provider_mobile.schedule.status.refunded",
  requested: "provider_mobile.schedule.status.requested"
};

const crewMatchStatusLabelKeys: Record<CrewMatchStatus, TranslationKey> = {
  accepted: "provider_mobile.schedule.crew.status.accepted",
  "cancelled-by-crew": "provider_mobile.schedule.crew.status.cancelled_by_crew",
  denied: "provider_mobile.schedule.crew.status.denied",
  "pending-provider-review": "provider_mobile.schedule.crew.status.pending_provider_review"
};

function formatAssignmentStatus(i18n: I18nInstance, status: BookingStatus | CrewMatchStatus) {
  if (status in bookingStatusLabelKeys) {
    return i18n.t(bookingStatusLabelKeys[status as BookingStatus]);
  }

  return i18n.t(crewMatchStatusLabelKeys[status as CrewMatchStatus]);
}

function formatAssignmentDay(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, { weekday: "short", month: "short", day: "numeric" });
}

function formatAssignmentTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, { hour: "numeric", minute: "2-digit" });
}

function formatHourlyPay(i18n: I18nInstance, cents: number) {
  return i18n.t("provider_mobile.clients.hourly_rate", {
    rate: i18n.formatCurrency(cents)
  });
}

function formatServiceCategory(i18n: I18nInstance, category: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(category));
}

function getAssignmentRoleLabel(i18n: I18nInstance, assignment: CrewAssignment) {
  if (assignment.isAssignedRouteLeader) {
    return i18n.t("crew_mobile.dashboard.role.route_lead");
  }

  if (assignment.requiresRouteLeaderAssignment) {
    return i18n.t("crew_mobile.dashboard.role.lead_pending");
  }

  return i18n.t("provider_mobile.dashboard.crew");
}

function getAssignmentSummary(i18n: I18nInstance, assignment: CrewAssignment) {
  if (assignment.onRouteConfirmedAt) {
    return assignment.isAssignedRouteLeader
      ? i18n.t("crew_mobile.assignments.summary.route_live_lead")
      : i18n.t("crew_mobile.assignments.summary.route_live");
  }

  if (assignment.lateEtaIso) {
    return i18n.t("provider_mobile.schedule.message.delay_notice_sent", {
      time: formatAssignmentTime(i18n, assignment.lateEtaIso)
    });
  }

  if (assignment.bookingStatus === "requested") {
    return i18n.t("crew_mobile.assignments.summary.wait_business");
  }

  if (assignment.bookingStatus === "confirmed") {
    return assignment.isAssignedRouteLeader
      ? i18n.t("crew_mobile.assignments.summary.leading_route")
      : i18n.t("crew_mobile.assignments.summary.confirmed_ready");
  }

  return formatAssignmentStatus(i18n, assignment.bookingStatus);
}

function getAssignmentNextStep(i18n: I18nInstance, assignment: CrewAssignment): AssignmentNextStep {
  if (assignment.status === "pending-provider-review") {
    return {
      detail: i18n.t("crew_mobile.assignments.next.wait_review_detail"),
      label: i18n.t("crew_mobile.assignments.next.wait_review")
    };
  }

  if (assignment.bookingStatus === "requested") {
    return {
      detail: i18n.t("crew_mobile.assignments.next.wait_confirmation_detail"),
      label: i18n.t("crew_mobile.dashboard.next_step.wait_confirmation")
    };
  }

  if (assignment.bookingStatus === "confirmed" && !assignment.onRouteConfirmedAt) {
    return assignment.isAssignedRouteLeader
      ? {
          action: "start-route",
          detail: i18n.t("crew_mobile.assignments.next.start_route_detail"),
          label: i18n.t("provider_mobile.dashboard.action.start_route")
        }
      : {
          detail: i18n.t("crew_mobile.assignments.next.wait_route_detail"),
          label: i18n.t("crew_mobile.dashboard.next_step.wait_route")
        };
  }

  if (assignment.bookingStatus === "confirmed" && assignment.onRouteConfirmedAt) {
    return {
      action: "today",
      detail: i18n.t("crew_mobile.assignments.next.start_work_detail"),
      label: i18n.t("provider_mobile.schedule.action.start_work")
    };
  }

  if (assignment.bookingStatus === "in-progress") {
    if (assignment.afterEvidenceCount > 0) {
      return {
        action: "today",
        detail: i18n.t("crew_mobile.assignments.next.proof_saved_detail"),
        label: i18n.t("crew_mobile.dashboard.next_step.proof_saved")
      };
    }

    return {
      action: "today",
      detail: i18n.t("crew_mobile.dashboard.next_step.add_proof_detail"),
      label: i18n.t("provider_mobile.schedule.action.add_proof")
    };
  }

  if (assignment.bookingStatus === "completed") {
    return {
      detail: i18n.t("crew_mobile.assignments.next.payout_processing_detail"),
      label: i18n.t("crew_mobile.dashboard.next_step.payout_processing")
    };
  }

  return {
    detail: formatAssignmentStatus(i18n, assignment.bookingStatus),
    label: i18n.t("crew_mobile.assignments.next.review_status")
  };
}

function AssignmentSummaryGrid({ assignment, i18n }: { assignment: CrewAssignment; i18n: I18nInstance }) {
  return (
    <View style={styles.assignmentSummaryGrid}>
      <View style={styles.assignmentSummaryItem}>
        <Text style={styles.assignmentSummaryLabel}>{i18n.t("crew_mobile.assignments.day")}</Text>
        <Text style={styles.assignmentSummaryValue}>{formatAssignmentDay(i18n, assignment.scheduledStartIso)}</Text>
      </View>
      <View style={styles.assignmentSummaryItem}>
        <Text style={styles.assignmentSummaryLabel}>{i18n.t("crew_mobile.assignments.time")}</Text>
        <Text style={styles.assignmentSummaryValue}>{formatAssignmentTime(i18n, assignment.scheduledStartIso)}</Text>
      </View>
      <View style={styles.assignmentSummaryItem}>
        <Text style={styles.assignmentSummaryLabel}>{i18n.t("crew_mobile.dashboard.pay")}</Text>
        <Text style={styles.assignmentSummaryValue}>{formatHourlyPay(i18n, assignment.hourlyRateCents)}</Text>
      </View>
      <View style={styles.assignmentSummaryItem}>
        <Text style={styles.assignmentSummaryLabel}>{i18n.t("crew_mobile.dashboard.role.label")}</Text>
        <Text style={styles.assignmentSummaryValue}>{getAssignmentRoleLabel(i18n, assignment)}</Text>
      </View>
    </View>
  );
}

function AssignmentNextPanel({ children, i18n, step }: { children?: ReactNode; i18n: I18nInstance; step: AssignmentNextStep }) {
  return (
    <View style={styles.nextPanel}>
      <Text style={styles.nextEyebrow}>{i18n.t("provider_mobile.schedule.summary.next")}</Text>
      <Text style={styles.nextTitle}>{step.label}</Text>
      <Text style={styles.nextDetail}>{step.detail}</Text>
      {children}
    </View>
  );
}

export function AssignmentsScreen({ onOpenToday }: { onOpenToday?: () => void }) {
  const i18n = useI18n();
  const { envelope } = useCrewSession();
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setMatchesResponse(await api.getCrewMatches());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.assignments.error.load"));
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  async function cancelAssignment(crewMatchId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.cancelCrewMatch({
        crewMatchId,
        reason: i18n.t("crew_mobile.assignments.cancel.reason")
      });
      setStatusMessage(i18n.t("crew_mobile.dashboard.cancel.message"));
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.dashboard.cancel.error"));
    } finally {
      setIsWorking(false);
    }
  }

  async function startRoute(assignment: CrewAssignment) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.markBookingOnRoute({ bookingId: assignment.bookingId });
      setStatusMessage(i18n.t("crew_mobile.dashboard.message.route_started"));
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.start_route"));
    } finally {
      setIsWorking(false);
    }
  }

  function confirmCancelAssignment(crewMatchId: string) {
    Alert.alert(
      i18n.t("crew_mobile.dashboard.cancel.confirm_title"),
      i18n.t("crew_mobile.dashboard.cancel.confirm_body"),
      [
        { text: i18n.t("crew_mobile.dashboard.cancel.keep_assignment"), style: "cancel" },
        {
          text: i18n.t("crew_mobile.dashboard.cancel.cancel_assignment"),
          style: "destructive",
          onPress: () => void cancelAssignment(crewMatchId)
        }
      ]
    );
  }

  const acceptedAssignments = useMemo(
    () => (matchesResponse?.matches ?? []).filter((match) => match.status === "accepted"),
    [matchesResponse]
  );
  const pendingAssignments = useMemo(
    () => (matchesResponse?.matches ?? []).filter((match) => match.status === "pending-provider-review"),
    [matchesResponse]
  );
  const pastAssignments = useMemo(
    () =>
      (matchesResponse?.matches ?? []).filter(
        (match) => match.status === "denied" || match.status === "cancelled-by-crew"
      ),
    [matchesResponse]
  );

  return (
    <ScreenShell
      eyebrow={i18n.t("provider_mobile.schedule.eyebrow")}
      title={i18n.t("crew_mobile.assignments.title")}
      description={i18n.t("crew_mobile.assignments.description")}
    >
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label={i18n.t("crew_mobile.assignments.view.upcoming")} onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "history"} label={i18n.t("crew_mobile.assignments.view.history")} onPress={() => setViewMode("history")} />
      </View>

      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {viewMode === "upcoming" ? (
        <>
          {acceptedAssignments.length > 0 ? (
            <InfoCard title={i18n.t("crew_mobile.assignments.accepted_shifts")} description={i18n.t("crew_mobile.assignments.upcoming_count", { count: acceptedAssignments.length })}>
              <View style={styles.list}>
                {acceptedAssignments.map((assignment) => {
                  const nextStep = getAssignmentNextStep(i18n, assignment);

                  return (
                    <View key={assignment.id} style={styles.assignmentCard}>
                      <View style={styles.assignmentHeader}>
                        <View style={styles.copy}>
                          <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                          <Text style={styles.meta}>{formatServiceCategory(i18n, assignment.category)}</Text>
                        </View>
                        <Text style={styles.statusPill}>{formatAssignmentStatus(i18n, assignment.bookingStatus)}</Text>
                      </View>
                      <AssignmentSummaryGrid assignment={assignment} i18n={i18n} />
                      <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                      <AssignmentNextPanel step={nextStep} i18n={i18n}>
                        {nextStep.action === "today" && onOpenToday ? (
                          <Pressable disabled={isWorking} onPress={onOpenToday} style={styles.nextPrimaryButton}>
                            <Text style={styles.nextPrimaryButtonLabel}>{i18n.t("crew_mobile.assignments.open_today")}</Text>
                          </Pressable>
                        ) : null}
                        {nextStep.action === "start-route" ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void startRoute(assignment)}
                            style={styles.nextPrimaryButton}
                          >
                            <Text style={styles.nextPrimaryButtonLabel}>
                              {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.start_route")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </AssignmentNextPanel>
                      <Text style={styles.summary}>{getAssignmentSummary(i18n, assignment)}</Text>
                      <View style={styles.actionStack}>
                        {(assignment.bookingStatus === "requested" ||
                          (assignment.bookingStatus === "confirmed" && !assignment.onRouteConfirmedAt)) ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() => confirmCancelAssignment(assignment.id)}
                            style={styles.cancelButton}
                          >
                            <Text style={styles.cancelButtonLabel}>{i18n.t("crew_mobile.dashboard.cancel.cancel_assignment")}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </InfoCard>
          ) : null}

          {pendingAssignments.length > 0 ? (
            <InfoCard title={i18n.t("crew_mobile.assignments.awaiting_review")} description={i18n.t("crew_mobile.assignments.pending_count", { count: pendingAssignments.length })}>
              <View style={styles.list}>
                {pendingAssignments.map((assignment) => (
                  <View key={assignment.id} style={styles.assignmentCard}>
                    <View style={styles.assignmentHeader}>
                      <View style={styles.copy}>
                        <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                        <Text style={styles.meta}>{formatServiceCategory(i18n, assignment.category)}</Text>
                      </View>
                      <Text style={styles.statusPill}>{formatAssignmentStatus(i18n, assignment.status)}</Text>
                    </View>
                    <AssignmentSummaryGrid assignment={assignment} i18n={i18n} />
                    <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                    <AssignmentNextPanel step={getAssignmentNextStep(i18n, assignment)} i18n={i18n} />
                  </View>
                ))}
              </View>
            </InfoCard>
          ) : null}

          {acceptedAssignments.length === 0 && pendingAssignments.length === 0 ? (
            <InfoCard title={i18n.t("crew_mobile.assignments.empty.title")} description={i18n.t("crew_mobile.assignments.empty.description")}>
              <Text style={styles.meta}>{i18n.t("crew_mobile.assignments.empty.body")}</Text>
            </InfoCard>
          ) : null}
        </>
      ) : (
        <InfoCard title={i18n.t("crew_mobile.assignments.past_decisions")} description={i18n.t("crew_mobile.assignments.item_count", { count: pastAssignments.length })}>
          <View style={styles.list}>
            {pastAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                    <Text style={styles.meta}>{formatServiceCategory(i18n, assignment.category)}</Text>
                  </View>
                  <Text style={styles.statusPill}>{formatAssignmentStatus(i18n, assignment.status)}</Text>
                </View>
                <AssignmentSummaryGrid assignment={assignment} i18n={i18n} />
                <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                {assignment.status === "cancelled-by-crew" && assignment.cancellationReason ? (
                  <Text style={styles.warning}>
                    {i18n.t("crew_mobile.assignments.cancelled_note", {
                      reason: assignment.cancellationReason
                    })}
                  </Text>
                ) : null}
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
  assignmentCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.94)",
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  assignmentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  assignmentSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  assignmentSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  assignmentSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  assignmentSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  nextPanel: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(47, 125, 76, 0.16)",
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.md
  },
  nextEyebrow: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  nextTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  nextDetail: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  nextPrimaryButton: {
    alignSelf: "flex-start",
    marginTop: BrandTokens.spacing.xs,
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  nextPrimaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
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
  summary: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 20,
    fontWeight: "700"
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs,
    overflow: "hidden",
    fontWeight: "700"
  },
  actionStack: {
    gap: BrandTokens.spacing.sm
  },
  cancelButton: {
    alignSelf: "flex-start",
    marginTop: BrandTokens.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b25555",
    backgroundColor: "#fff3f1",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  cancelButtonLabel: {
    color: "#a03838",
    fontWeight: "700"
  },
  warning: {
    color: "#a03838",
    lineHeight: 20
  }
});
