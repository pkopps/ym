import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { BookingStatus, CrewMatchesResponse, CrewPayoutLedgerResponse, ServiceCategory } from "@yardmatch/contracts";
import { I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

type CrewAssignment = CrewMatchesResponse["matches"][number];
type CrewPayoutEntry = CrewPayoutLedgerResponse["entries"][number];
type CrewPrimaryAction = "start-route" | "start-work" | "proof";
type CrewPayoutActionTone = "success" | "warning" | "neutral";
type ShiftStepStatus = "complete" | "current" | "pending";

interface CrewNextStep {
  detail: string;
  label: string;
}

interface CrewPayoutActionItem {
  detail: string;
  label: string;
  tone: CrewPayoutActionTone;
  value: string;
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

function formatShiftWindow(i18n: I18nInstance, iso: string) {
  return i18n.t("crew_mobile.dashboard.shift_window", {
    day: i18n.formatDate(iso, { weekday: "short", month: "short", day: "numeric" }),
    time: i18n.formatDate(iso, { hour: "numeric", minute: "2-digit" })
  });
}

function formatHourlyPay(i18n: I18nInstance, cents: number) {
  return i18n.t("provider_mobile.clients.hourly_rate", {
    rate: i18n.formatCurrency(cents)
  });
}

function formatCurrency(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents);
}

function formatPayoutDate(i18n: I18nInstance, iso?: string) {
  if (!iso) {
    return i18n.t("provider_mobile.dashboard.pending");
  }

  return i18n.formatDate(iso, { month: "short", day: "numeric" });
}

function formatPayoutStatus(i18n: I18nInstance, status: CrewPayoutEntry["status"]) {
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

function getCrewPayoutFocus(
  i18n: I18nInstance,
  payoutLedger: CrewPayoutLedgerResponse,
  blockedPayoutCents: number
) {
  if (payoutLedger.totalReadyCents > 0) {
    return {
      amount: formatCurrency(i18n, payoutLedger.totalReadyCents),
      detail: i18n.t("provider_mobile.dashboard.payout.pays_date", {
        date: formatPayoutDate(i18n, payoutLedger.nextWeeklyPayoutDateIso)
      }),
      label: i18n.t("provider_mobile.dashboard.payout.ready")
    };
  }

  if (payoutLedger.totalScheduledCents > 0) {
    return {
      amount: formatCurrency(i18n, payoutLedger.totalScheduledCents),
      detail: i18n.t("provider_mobile.dashboard.payout.next_payout", {
        date: formatPayoutDate(i18n, payoutLedger.nextWeeklyPayoutDateIso)
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
    detail: i18n.t("crew_mobile.dashboard.payout.completed_shifts_here"),
    label: i18n.t("provider_mobile.dashboard.payout.no_payout")
  };
}

function getCrewPayoutActionItems(
  i18n: I18nInstance,
  payoutLedger: CrewPayoutLedgerResponse,
  heldPayoutEntries: CrewPayoutEntry[]
): CrewPayoutActionItem[] {
  const items: CrewPayoutActionItem[] = [];

  if (payoutLedger.totalReadyCents > 0) {
    items.push({
      detail: i18n.t("provider_mobile.dashboard.payout.pays_date", {
        date: formatPayoutDate(i18n, payoutLedger.nextWeeklyPayoutDateIso)
      }),
      label: i18n.t("provider_mobile.dashboard.payout.ready"),
      tone: "success",
      value: formatCurrency(i18n, payoutLedger.totalReadyCents)
    });
  }

  if (payoutLedger.totalScheduledCents > 0) {
    items.push({
      detail: formatHoldPeriod(i18n, payoutLedger.holdPeriodHours),
      label: i18n.t("provider_mobile.dashboard.payout.clearing"),
      tone: "neutral",
      value: formatCurrency(i18n, payoutLedger.totalScheduledCents)
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
      value: formatCurrency(i18n, heldPayoutEntries.reduce((sum, entry) => sum + entry.amountCents, 0))
    });
  }

  if (items.length === 0) {
    items.push({
      detail: i18n.t("crew_mobile.dashboard.payout.complete_shift"),
      label: i18n.t("provider_mobile.schedule.summary.next"),
      tone: "neutral",
      value: formatCurrency(i18n, 0)
    });
  }

  return items.slice(0, 4);
}

function getCrewRoleLabel(i18n: I18nInstance, assignment: CrewAssignment) {
  if (assignment.isAssignedRouteLeader) {
    return i18n.t("crew_mobile.dashboard.role.route_lead");
  }

  if (assignment.requiresRouteLeaderAssignment) {
    return i18n.t("crew_mobile.dashboard.role.lead_pending");
  }

  return i18n.t("provider_mobile.dashboard.crew");
}

function getCrewPrimaryAction(assignment: CrewAssignment): CrewPrimaryAction | undefined {
  if (
    assignment.bookingStatus === "confirmed" &&
    !assignment.onRouteConfirmedAt &&
    assignment.isAssignedRouteLeader
  ) {
    return "start-route";
  }

  if (assignment.bookingStatus === "confirmed" && assignment.onRouteConfirmedAt) {
    return "start-work";
  }

  if (assignment.bookingStatus === "in-progress") {
    return "proof";
  }

  return undefined;
}

function getShiftStepStatus(stepIndex: number, activeStepIndex: number): ShiftStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function formatCrewBookingStatus(i18n: I18nInstance, status: BookingStatus) {
  return i18n.t(bookingStatusLabelKeys[status]);
}

function formatServiceCategory(i18n: I18nInstance, category: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(category));
}

function getCrewNextStep(
  i18n: I18nInstance,
  assignment: CrewAssignment,
  payoutEntry?: CrewPayoutEntry
): CrewNextStep {
  if (payoutEntry) {
    return {
      detail: i18n.t("crew_mobile.dashboard.next_step.payout_status", {
        status: formatPayoutStatus(i18n, payoutEntry.status).toLowerCase()
      }),
      label: i18n.t("crew_mobile.dashboard.pay")
    };
  }

  if (assignment.bookingStatus === "completed") {
    return {
      detail: i18n.t("crew_mobile.dashboard.next_step.payout_processing_detail"),
      label: i18n.t("crew_mobile.dashboard.next_step.payout_processing")
    };
  }

  if (assignment.bookingStatus === "in-progress") {
    if (assignment.afterEvidenceCount > 0) {
      return {
        detail: i18n.t("crew_mobile.dashboard.next_step.proof_saved_detail"),
        label: i18n.t("crew_mobile.dashboard.next_step.proof_saved")
      };
    }

    return {
      detail: i18n.t("crew_mobile.dashboard.next_step.add_proof_detail"),
      label: i18n.t("provider_mobile.schedule.action.add_proof")
    };
  }

  if (assignment.bookingStatus === "confirmed" && assignment.onRouteConfirmedAt) {
    return {
      detail: i18n.t("crew_mobile.dashboard.next_step.start_work_detail"),
      label: i18n.t("provider_mobile.schedule.action.start_work")
    };
  }

  if (assignment.bookingStatus === "confirmed" && !assignment.onRouteConfirmedAt) {
    return assignment.isAssignedRouteLeader
      ? {
          detail: i18n.t("crew_mobile.dashboard.next_step.start_route_detail"),
          label: i18n.t("provider_mobile.dashboard.action.start_route")
        }
      : {
          detail: i18n.t("crew_mobile.dashboard.next_step.wait_route_detail"),
          label: i18n.t("crew_mobile.dashboard.next_step.wait_route")
        };
  }

  return {
    detail: i18n.t("crew_mobile.dashboard.next_step.wait_confirmation_detail"),
    label: i18n.t("crew_mobile.dashboard.next_step.wait_confirmation")
  };
}

export function DashboardScreen({
  onOpenAvailability,
  onOpenSchedule
}: {
  onOpenAvailability?: () => void;
  onOpenSchedule?: () => void;
}) {
  const i18n = useI18n();
  const { envelope } = useCrewSession();
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [payoutLedger, setPayoutLedger] = useState<CrewPayoutLedgerResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [showEvidenceTools, setShowEvidenceTools] = useState(false);
  const [showShiftOptions, setShowShiftOptions] = useState(false);
  const [beforeNoteDraft, setBeforeNoteDraft] = useState("");
  const [afterNoteDraft, setAfterNoteDraft] = useState("");
  const acceptedMatch = useMemo(
    () => matchesResponse?.matches.find((match) => match.status === "accepted"),
    [matchesResponse]
  );
  const acceptedPayoutEntry = useMemo(
    () =>
      acceptedMatch
        ? payoutLedger?.entries.find((entry) => entry.bookingId === acceptedMatch.bookingId)
        : undefined,
    [acceptedMatch, payoutLedger]
  );
  const acceptedPrimaryAction = acceptedMatch ? getCrewPrimaryAction(acceptedMatch) : undefined;
  const acceptedNextStep = acceptedMatch ? getCrewNextStep(i18n, acceptedMatch, acceptedPayoutEntry) : undefined;
  const shouldShowArrivalProof =
    acceptedMatch?.bookingStatus === "confirmed" && Boolean(acceptedMatch.onRouteConfirmedAt);
  const shouldShowCompletionProof = acceptedMatch?.bookingStatus === "in-progress";
  const canManageProof = shouldShowArrivalProof || shouldShowCompletionProof;
  const pendingCount = matchesResponse?.matches.filter((match) => match.status === "pending-provider-review").length ?? 0;
  const acceptedCount = matchesResponse?.matches.filter((match) => match.status === "accepted").length ?? 0;
  const heldPayoutEntries = (payoutLedger?.entries ?? []).filter((entry) => entry.status === "on-hold");
  const blockedPayoutCents =
    (payoutLedger?.pendingCustomerPaymentCents ?? 0) +
    heldPayoutEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const shouldShowPayouts =
    Boolean(payoutLedger) &&
    ((payoutLedger?.entries.length ?? 0) > 0 ||
      (payoutLedger?.totalReadyCents ?? 0) > 0 ||
      (payoutLedger?.totalScheduledCents ?? 0) > 0 ||
      (payoutLedger?.totalPaidCents ?? 0) > 0 ||
      (payoutLedger?.pendingCustomerPaymentCents ?? 0) > 0);
  const payoutFocus = payoutLedger ? getCrewPayoutFocus(i18n, payoutLedger, blockedPayoutCents) : undefined;
  const payoutActionItems = payoutLedger ? getCrewPayoutActionItems(i18n, payoutLedger, heldPayoutEntries) : [];
  const payoutRecentEntries = (payoutLedger?.entries ?? [])
    .slice()
    .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso))
    .slice(0, 2);
  const activeShiftStepIndex =
    acceptedPayoutEntry?.status === "paid"
      ? 5
      : acceptedMatch?.bookingStatus === "completed"
        ? 4
        : acceptedMatch?.bookingStatus === "in-progress"
          ? 3
          : acceptedMatch?.bookingStatus === "confirmed" && acceptedMatch.onRouteConfirmedAt
            ? 2
            : acceptedMatch?.bookingStatus === "confirmed"
              ? 1
              : 0;
  const shiftSteps = [
    {
      label: i18n.t("crew_mobile.dashboard.step.accepted"),
      value: acceptedMatch ? formatShiftWindow(i18n, acceptedMatch.scheduledStartIso) : i18n.t("provider_mobile.dashboard.payout.waiting")
    },
    {
      label: i18n.t("provider_mobile.schedule.summary.route"),
      value: acceptedMatch?.onRouteConfirmedAt ? i18n.t("provider_mobile.schedule.state.live") : i18n.t("provider_mobile.schedule.summary.next")
    },
    {
      label: i18n.t("crew_mobile.dashboard.step.work"),
      value:
        acceptedMatch?.bookingStatus === "in-progress"
          ? i18n.t("crew_mobile.dashboard.step.started")
          : i18n.t("crew_mobile.dashboard.step.start_onsite")
    },
    {
      label: i18n.t("provider_mobile.schedule.proof.title"),
      value: acceptedMatch
        ? i18n.t("mobile.support.property.measurements_saved", {
            count: acceptedMatch.beforeEvidenceCount + acceptedMatch.afterEvidenceCount
          })
        : i18n.t("crew_mobile.dashboard.step.photos")
    },
    {
      label: i18n.t("crew_mobile.dashboard.pay"),
      value: acceptedPayoutEntry
        ? formatPayoutStatus(i18n, acceptedPayoutEntry.status)
        : acceptedMatch?.bookingStatus === "completed"
          ? i18n.t("crew_mobile.dashboard.step.processing")
          : i18n.t("crew_mobile.dashboard.step.after_proof")
    }
  ].map((step, index) => ({
    ...step,
    status: getShiftStepStatus(index, activeShiftStepIndex)
  }));

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextMatches, nextPayoutLedger] = await Promise.all([
        api.getCrewMatches(),
        api.getCrewPayoutLedger()
      ]);
      setMatchesResponse(nextMatches);
      setPayoutLedger(nextPayoutLedger);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.dashboard.error.load_work"));
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  async function startWork() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      await api.startBooking({ bookingId: acceptedMatch.bookingId });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.work_started"));
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.start_work"));
    } finally {
      setIsWorking(false);
    }
  }

  async function startRoute() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.markBookingOnRoute({ bookingId: acceptedMatch.bookingId });
      setStatusMessage(i18n.t("crew_mobile.dashboard.message.route_started"));
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.start_route"));
    } finally {
      setIsWorking(false);
    }
  }

  async function captureEvidencePhoto(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(i18n.t("provider_mobile.schedule.error.camera_required"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        imageDataUrl: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
      });
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.before_photo_saved")
          : i18n.t("provider_mobile.schedule.message.after_photo_saved")
      );
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.capture_photo"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceNote(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    const draft = (phase === "before" ? beforeNoteDraft : afterNoteDraft).trim();
    if (!draft) {
      setErrorMessage(i18n.t("provider_mobile.schedule.error.note_required"));
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        evidenceType: "note",
        note: draft
      });
      if (phase === "before") {
        setBeforeNoteDraft("");
      } else {
        setAfterNoteDraft("");
      }
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.before_note_saved")
          : i18n.t("provider_mobile.schedule.message.after_note_saved")
      );
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.save_note"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceChecklist(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    const checklistItems =
      phase === "before"
        ? [
            { label: i18n.t("provider_mobile.schedule.checklist.access_path"), completed: true },
            { label: i18n.t("crew_mobile.dashboard.checklist.equipment_unloaded"), completed: true },
            { label: i18n.t("crew_mobile.dashboard.checklist.service_area_reviewed"), completed: true }
          ]
        : [
            { label: i18n.t("provider_mobile.schedule.checklist.service_completed"), completed: true },
            { label: i18n.t("provider_mobile.schedule.checklist.debris_cleared"), completed: true },
            { label: i18n.t("crew_mobile.dashboard.checklist.gate_secured"), completed: true }
          ];

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        evidenceType: "checklist",
        checklistItems
      });
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.arrival_checklist_saved")
          : i18n.t("provider_mobile.schedule.message.completion_checklist_saved")
      );
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.save_checklist"));
    } finally {
      setIsWorking(false);
    }
  }

  async function cancelAcceptedAssignment() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.cancelCrewMatch({
        crewMatchId: acceptedMatch.id,
        reason: i18n.t("crew_mobile.dashboard.cancel.reason")
      });
      setStatusMessage(i18n.t("crew_mobile.dashboard.cancel.message"));
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_mobile.dashboard.cancel.error"));
    } finally {
      setIsWorking(false);
    }
  }

  function confirmCancelAcceptedAssignment() {
    if (!acceptedMatch) {
      return;
    }

    Alert.alert(
      i18n.t("crew_mobile.dashboard.cancel.confirm_title"),
      i18n.t("crew_mobile.dashboard.cancel.confirm_body"),
      [
        { text: i18n.t("crew_mobile.dashboard.cancel.keep_assignment"), style: "cancel" },
        {
          text: i18n.t("crew_mobile.dashboard.cancel.cancel_assignment"),
          style: "destructive",
          onPress: () => void cancelAcceptedAssignment()
        }
      ]
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("crew_mobile.dashboard.eyebrow")}
      title={i18n.t("crew_mobile.dashboard.title")}
      description={i18n.t("crew_mobile.dashboard.description")}
    >
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {acceptedMatch ? (
        <InfoCard
          title={acceptedMatch.providerCompanyName}
          description={i18n.t("crew_mobile.dashboard.accepted_shift")}
        >
          <View style={styles.shiftPath}>
            {shiftSteps.map((step, index) => (
              <View key={step.label} style={[styles.shiftPathStep, styles[`shiftPathStep_${step.status}`]]}>
                <View style={[styles.shiftPathIndex, styles[`shiftPathIndex_${step.status}`]]}>
                  <Text style={[styles.shiftPathIndexLabel, styles[`shiftPathIndexLabel_${step.status}`]]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.shiftPathCopy}>
                  <Text style={styles.shiftPathLabel}>{step.label}</Text>
                  <Text numberOfLines={2} style={styles.shiftPathValue}>{step.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.title}>{formatServiceCategory(i18n, acceptedMatch.category)}</Text>
          <Text style={styles.meta}>{acceptedMatch.serviceAddress.line1}</Text>
          <Text style={styles.meta}>
            {acceptedMatch.serviceAddress.city}, {acceptedMatch.serviceAddress.state}
          </Text>
          <View style={styles.shiftSummaryGrid}>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.schedule.summary.window")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatShiftWindow(i18n, acceptedMatch.scheduledStartIso)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("crew_mobile.dashboard.pay")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatHourlyPay(i18n, acceptedMatch.hourlyRateCents)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("crew_mobile.dashboard.role.label")}</Text>
              <Text style={styles.shiftSummaryValue}>{getCrewRoleLabel(i18n, acceptedMatch)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.schedule.proof.title")}</Text>
              <Text style={styles.shiftSummaryValue}>
                {i18n.t("crew_mobile.dashboard.proof_counts", {
                  before: acceptedMatch.beforeEvidenceCount,
                  after: acceptedMatch.afterEvidenceCount
                })}
              </Text>
            </View>
          </View>
          <Text style={styles.statusLine}>{formatCrewBookingStatus(i18n, acceptedMatch.bookingStatus)}</Text>
          {acceptedMatch.isAssignedRouteLeader ? (
            <Text style={styles.meta}>{i18n.t("crew_mobile.dashboard.route_leader.assigned")}</Text>
          ) : acceptedMatch.requiresRouteLeaderAssignment ? (
            <Text style={styles.meta}>{i18n.t("crew_mobile.dashboard.route_leader.pending")}</Text>
          ) : null}
          {acceptedNextStep ? (
            <View style={styles.nextActionCard}>
              <Text style={styles.nextActionEyebrow}>{i18n.t("provider_mobile.schedule.summary.next")}</Text>
              <Text style={styles.nextActionTitle}>{acceptedNextStep.label}</Text>
              <Text style={styles.nextActionDetail}>{acceptedNextStep.detail}</Text>
              {acceptedPrimaryAction === "start-route" ? (
                <Pressable
                  disabled={isWorking}
                  onPress={() => void startRoute()}
                  style={styles.nextPrimaryButton}
                >
                  <Text style={styles.nextPrimaryButtonLabel}>
                    {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.start_route")}
                  </Text>
                </Pressable>
              ) : null}
              {acceptedPrimaryAction === "start-work" ? (
                <Pressable
                  disabled={isWorking}
                  onPress={() => void startWork()}
                  style={styles.nextPrimaryButton}
                >
                  <Text style={styles.nextPrimaryButtonLabel}>
                    {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.schedule.action.start_work")}
                  </Text>
                </Pressable>
              ) : null}
              {acceptedPrimaryAction === "proof" ? (
                <Pressable
                  disabled={isWorking}
                  onPress={() => setShowEvidenceTools((current) => !current)}
                  style={styles.nextPrimaryButton}
                >
                  <Text style={styles.nextPrimaryButtonLabel}>
                    {showEvidenceTools ? i18n.t("common.actions.close") : i18n.t("provider_mobile.schedule.action.add_proof")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.buttonRow}>
            {canManageProof && acceptedPrimaryAction !== "proof" ? (
              <Pressable onPress={() => setShowEvidenceTools((current) => !current)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>
                  {showEvidenceTools ? i18n.t("common.actions.close") : i18n.t("crew_mobile.dashboard.proof_of_work")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setShowShiftOptions((current) => !current)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {showShiftOptions ? i18n.t("common.actions.close") : i18n.t("crew_mobile.dashboard.shift_options")}
              </Text>
            </Pressable>
          </View>
          {showEvidenceTools && canManageProof ? (
            <View style={styles.toolStack}>
              {shouldShowArrivalProof ? (
                <>
                  <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.proof.arrival_title")}</Text>
                  <TextInput
                    value={beforeNoteDraft}
                    onChangeText={setBeforeNoteDraft}
                    placeholder={i18n.t("provider_mobile.schedule.proof.arrival_note")}
                    placeholderTextColor={BrandTokens.colors.inkSoft}
                    style={styles.input}
                  />
                  <View style={styles.buttonRow}>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void captureEvidencePhoto("before")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>
                        {acceptedMatch.beforeEvidenceCount > 0
                          ? i18n.t("provider_mobile.schedule.proof.add_photo")
                          : i18n.t("provider_mobile.schedule.proof.take_photo")}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void saveEvidenceNote("before")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.proof.save_note")}</Text>
                    </Pressable>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void saveEvidenceChecklist("before")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.proof.checklist")}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
              {shouldShowCompletionProof ? (
                <>
                  <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.proof.completion_title")}</Text>
                  <TextInput
                    value={afterNoteDraft}
                    onChangeText={setAfterNoteDraft}
                    placeholder={i18n.t("provider_mobile.schedule.proof.completion_note")}
                    placeholderTextColor={BrandTokens.colors.inkSoft}
                    style={styles.input}
                  />
                  <View style={styles.buttonRow}>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void captureEvidencePhoto("after")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>
                        {acceptedMatch.afterEvidenceCount > 0
                          ? i18n.t("provider_mobile.schedule.proof.add_photo")
                          : i18n.t("provider_mobile.schedule.proof.take_photo")}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void saveEvidenceNote("after")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.proof.save_note")}</Text>
                    </Pressable>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void saveEvidenceChecklist("after")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.proof.checklist")}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
          {showShiftOptions ? (
            <View style={styles.toolStack}>
              <Text style={styles.meta}>
                {i18n.t("crew_mobile.dashboard.cancel.calloffs", {
                  count: matchesResponse?.crewMember.cancellationCount ?? 0
                })}
              </Text>
              {(acceptedMatch.bookingStatus === "requested" ||
                (acceptedMatch.bookingStatus === "confirmed" && !acceptedMatch.onRouteConfirmedAt)) ? (
                <Pressable
                  disabled={isWorking}
                  onPress={confirmCancelAcceptedAssignment}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonLabel}>{i18n.t("crew_mobile.dashboard.cancel.cancel_assignment")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void Linking.openURL(`tel:${acceptedMatch.providerPhone}`)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("crew_mobile.dashboard.call_business")}</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
          </Pressable>
        </InfoCard>
      ) : (
        <InfoCard title={i18n.t("crew_mobile.dashboard.empty.title")} description={i18n.t("crew_mobile.dashboard.empty.description")}>
          <Text style={styles.meta}>{i18n.t("crew_mobile.dashboard.empty.body")}</Text>
          <Pressable onPress={onOpenAvailability} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>{i18n.t("crew_mobile.dashboard.update_availability")}</Text>
          </Pressable>
        </InfoCard>
      )}

      {shouldShowPayouts && payoutLedger ? (
        <InfoCard
          title={i18n.t("crew_mobile.dashboard.pay")}
          description={
            blockedPayoutCents > 0
              ? i18n.t("provider_mobile.dashboard.payout.waiting_amount", {
                  amount: formatCurrency(i18n, blockedPayoutCents)
                })
              : i18n.t("provider_mobile.dashboard.payout.ready_amount", {
                  amount: formatCurrency(i18n, payoutLedger.totalReadyCents)
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
          <View style={styles.shiftSummaryGrid}>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.ready")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatCurrency(i18n, payoutLedger.totalReadyCents)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.next")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatPayoutDate(i18n, payoutLedger.nextWeeklyPayoutDateIso)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.scheduled")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatCurrency(i18n, payoutLedger.totalScheduledCents)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.paid")}</Text>
              <Text style={styles.shiftSummaryValue}>{formatCurrency(i18n, payoutLedger.totalPaidCents)}</Text>
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
                    <Text style={styles.title}>{entry.providerCompanyName}</Text>
                    <Text style={styles.meta}>
                      {i18n.t("crew_mobile.dashboard.payout.entry_summary", {
                        service: entry.serviceLabel,
                        date: formatPayoutDate(i18n, entry.serviceDateIso)
                      })}
                    </Text>
                  </View>
                  <View style={styles.payoutEntryAmountBlock}>
                    <Text style={styles.shiftSummaryValue}>{formatCurrency(i18n, entry.amountCents)}</Text>
                    <Text style={styles.shiftSummaryLabel}>{formatPayoutStatus(i18n, entry.status)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>{i18n.t("crew_mobile.dashboard.payout.empty")}</Text>
          )}
        </InfoCard>
      ) : null}

      <InfoCard
        title={i18n.t("crew_mobile.dashboard.assignments")}
        description={i18n.t("crew_mobile.dashboard.assignments_summary", {
          accepted: acceptedCount,
          pending: pendingCount
        })}
      >
        <Text style={styles.meta}>
          {pendingCount > 0
            ? i18n.t("crew_mobile.dashboard.assignments_pending")
            : i18n.t("crew_mobile.dashboard.assignments_clear")}
        </Text>
        <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>{i18n.t("provider_mobile.dashboard.action.open_schedule")}</Text>
        </Pressable>
      </InfoCard>

    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shiftPath: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  shiftPathStep: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 74,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.sm
  },
  shiftPathStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  shiftPathStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  shiftPathStep_pending: {
    opacity: 0.82
  },
  shiftPathIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  shiftPathIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  shiftPathIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  shiftPathIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  shiftPathIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  shiftPathIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  shiftPathIndexLabel_current: {
    color: "#ffffff"
  },
  shiftPathIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  shiftPathCopy: {
    flex: 1,
    gap: 2
  },
  shiftPathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  shiftPathValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
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
  statusLine: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  shiftSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  shiftSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  shiftSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  shiftSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  nextActionCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(47, 125, 76, 0.18)",
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: BrandTokens.spacing.sm,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  nextActionEyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  nextActionTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22
  },
  nextActionDetail: {
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
  input: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    color: BrandTokens.colors.ink,
    backgroundColor: "rgba(255,255,255,0.95)"
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.md,
    marginTop: BrandTokens.spacing.sm
  },
  toolStack: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  proofTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
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
  dangerButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b25555",
    backgroundColor: "#fff3f1",
    paddingVertical: BrandTokens.spacing.md
  },
  dangerButtonLabel: {
    color: "#a03838",
    fontWeight: "700"
  },
  linkButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  list: {
    gap: BrandTokens.spacing.md
  }
});
