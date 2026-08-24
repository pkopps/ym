import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  BookingExceptionType,
  BookingArrivalTracking,
  BookingServiceWindowKey,
  BookingStatus,
  CustomerProviderConversationThread,
  CrewMatchStatus,
  ExternalCalendarBlockType,
  getBookingServiceWindow,
  ProviderAssistantActionType,
  ProviderAssistantCommandResponse,
  ProviderCalendarOverviewResponse,
  ProviderStaffingOverview,
  ServiceCategory
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

type ViewMode = "calendar" | "list";
type RouteStepStatus = "complete" | "current" | "pending";

const bookingWindowLabelKeys: Record<BookingServiceWindowKey, TranslationKey> = {
  morning: "booking.window.morning.label",
  afternoon: "booking.window.afternoon.label",
  "late-afternoon-night": "booking.window.late_afternoon_night.label"
};

const bookingWindowRangeKeys: Record<BookingServiceWindowKey, TranslationKey> = {
  morning: "booking.window.morning.range",
  afternoon: "booking.window.afternoon.range",
  "late-afternoon-night": "booking.window.late_afternoon_night.range"
};

const bookingExceptionLabelKeys: Record<BookingExceptionType, TranslationKey> = {
  "customer-no-show": "booking.exception.customer_no_show",
  "customer-not-ready": "booking.exception.customer_not_ready",
  "service-could-not-be-completed": "booking.exception.service_could_not_be_completed",
  "unable-to-access-property": "booking.exception.unable_to_access_property"
};

const externalCalendarBlockLabelKeys: Record<ExternalCalendarBlockType, TranslationKey> = {
  "equipment-maintenance": "provider_mobile.support.calendar.block_type.equipment_maintenance",
  "off-platform-client": "provider_mobile.support.calendar.block_type.off_platform_client",
  "personal-time": "provider_mobile.support.calendar.block_type.personal_time",
  "travel-buffer": "provider_mobile.support.calendar.block_type.travel_buffer"
};

const providerJobStatusLabelKeys: Record<BookingStatus, TranslationKey> = {
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

const routeToolPresets: Array<{
  command: string;
  detailKey: TranslationKey;
  labelKey: TranslationKey;
}> = [
  {
    command: "What needs attention tomorrow?",
    detailKey: "provider_mobile.schedule.assistant.preset.tomorrow.detail",
    labelKey: "provider_mobile.schedule.assistant.preset.tomorrow.label"
  },
  {
    command: "Do I need more crew tomorrow?",
    detailKey: "provider_mobile.schedule.assistant.preset.crew_gaps.detail",
    labelKey: "provider_mobile.schedule.assistant.preset.crew_gaps.label"
  },
  {
    command: "Tell my afternoon customer I am 30 minutes late.",
    detailKey: "provider_mobile.schedule.assistant.preset.send_delay.detail",
    labelKey: "provider_mobile.schedule.assistant.preset.send_delay.label"
  },
  {
    command: "Move my afternoon job to evening and notify the customer.",
    detailKey: "provider_mobile.schedule.assistant.preset.move_later.detail",
    labelKey: "provider_mobile.schedule.assistant.preset.move_later.label"
  }
];

function formatCurrency(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents);
}

async function withPromiseTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function formatMinutesAsHours(i18n: I18nInstance, minutes: number) {
  if (minutes < 60) {
    return i18n.t("provider_mobile.support.minutes", { count: minutes });
  }

  const hours = minutes / 60;
  return i18n.t("provider_mobile.schedule.hours_short", {
    count: Number.isInteger(hours) ? hours : Number(hours.toFixed(1))
  });
}

function formatRouteStatusLabel(i18n: I18nInstance, status: "comfortable" | "watch" | "overloaded") {
  switch (status) {
    case "comfortable":
      return i18n.t("provider_mobile.schedule.route_status.balanced");
    case "watch":
      return i18n.t("provider_mobile.schedule.route_status.watch");
    case "overloaded":
      return i18n.t("provider_mobile.schedule.route_status.overloaded");
  }
}

function formatCrewRecommendationLabel(i18n: I18nInstance, label?: "best-fit" | "good-fit" | "backup") {
  switch (label) {
    case "best-fit":
      return i18n.t("common.state.best_fit");
    case "good-fit":
      return i18n.t("provider_mobile.clients.good_fit");
    case "backup":
      return i18n.t("provider_mobile.clients.backup");
    default:
      return "";
  }
}

type ProviderJobSummary = ProviderStaffingOverview["jobs"][number];
type ProviderJobPrimaryAction = "confirm" | "start-route" | "start-work" | "complete";

function formatServiceCategoryLabel(i18n: I18nInstance, category: ServiceCategory) {
  return i18n.t(serviceCategoryToI18nKey(category));
}

function formatAssistantActionType(i18n: I18nInstance, actionType: ProviderAssistantActionType) {
  const keys: Record<ProviderAssistantActionType, TranslationKey> = {
    "accept-best-crew-match": "provider_mobile.schedule.assistant.action.accept_best_crew_match",
    "accept-crew-match": "provider_mobile.schedule.assistant.action.accept_crew_match",
    "assign-route-leader": "provider_mobile.schedule.assistant.action.assign_route_leader",
    "clear-route-leader": "provider_mobile.schedule.assistant.action.clear_route_leader",
    "clear-route-stop": "provider_mobile.schedule.assistant.action.clear_route_stop",
    "complete-booking": "provider_mobile.schedule.assistant.action.complete_booking",
    "confirm-booking": "provider_mobile.schedule.assistant.action.confirm_booking",
    "deny-crew-match": "provider_mobile.schedule.assistant.action.deny_crew_match",
    "mark-booking-late": "provider_mobile.schedule.assistant.action.mark_booking_late",
    "message-crew": "provider_mobile.schedule.assistant.action.message_crew",
    "recommend-dispatch-adjustment": "provider_mobile.schedule.assistant.action.recommend_dispatch_adjustment",
    "recommend-staffing-adjustment": "provider_mobile.schedule.assistant.action.recommend_staffing_adjustment",
    "report-booking-exception": "provider_mobile.schedule.assistant.action.report_booking_exception",
    "reschedule-booking": "provider_mobile.schedule.assistant.action.reschedule_booking",
    "set-route-stop": "provider_mobile.schedule.assistant.action.set_route_stop",
    "start-route": "provider_mobile.schedule.assistant.action.start_route",
    "start-work": "provider_mobile.schedule.assistant.action.start_work",
    "summarize-dispatch": "provider_mobile.schedule.assistant.action.summarize_dispatch"
  };
  return i18n.t(keys[actionType]);
}

function getRouteStepStatus(stepIndex: number, activeStepIndex: number): RouteStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function formatBookingWindowSummaryI18n(i18n: I18nInstance, startIso: string) {
  const window = getBookingServiceWindow(startIso);
  return i18n.t("booking.window.summary", {
    label: i18n.t(bookingWindowLabelKeys[window.key]),
    range: i18n.t(bookingWindowRangeKeys[window.key])
  });
}

function formatBookingExceptionLabel(i18n: I18nInstance, exceptionType: BookingExceptionType) {
  return i18n.t(bookingExceptionLabelKeys[exceptionType]);
}

function formatExternalCalendarBlockLabel(i18n: I18nInstance, blockType: ExternalCalendarBlockType) {
  return i18n.t(externalCalendarBlockLabelKeys[blockType]);
}

function getProviderJobStatusLabel(i18n: I18nInstance, job: ProviderJobSummary) {
  if (job.status === "requested") {
    return i18n.t("provider_mobile.schedule.status.requested");
  }

  if (job.status === "confirmed" && job.onRouteConfirmedAt) {
    return i18n.t("provider_mobile.schedule.status.on_route");
  }

  return i18n.t(providerJobStatusLabelKeys[job.status]);
}

function getProviderJobPrimaryAction(job: ProviderJobSummary): ProviderJobPrimaryAction | undefined {
  if (job.status === "requested") {
    return "confirm";
  }

  if (job.status === "confirmed" && !job.onRouteConfirmedAt) {
    return "start-route";
  }

  if (job.status === "confirmed" && job.onRouteConfirmedAt) {
    return "start-work";
  }

  if (job.status === "in-progress") {
    return "complete";
  }

  return undefined;
}

function hasCrewDecisionPending(job: ProviderJobSummary) {
  return (
    job.crewGap > 0 ||
    job.requiresRouteLeaderAssignment ||
    job.matches.some((match) => match.status === "pending-provider-review")
  );
}

function getProviderJobActionLabel(i18n: I18nInstance, job: ProviderJobSummary) {
  const primaryAction = getProviderJobPrimaryAction(job);

  if (primaryAction === "confirm") {
    return i18n.t("provider_mobile.schedule.action.confirm");
  }

  if (hasCrewDecisionPending(job)) {
    return i18n.t("provider_mobile.schedule.action.staff");
  }

  if (primaryAction === "start-route") {
    return i18n.t("provider_mobile.dashboard.action.start_route");
  }

  if (primaryAction === "start-work") {
    return i18n.t("provider_mobile.schedule.action.start_work");
  }

  if (primaryAction === "complete") {
    return job.afterEvidenceCount > 0
      ? i18n.t("provider_mobile.schedule.action.complete")
      : i18n.t("provider_mobile.schedule.action.add_proof");
  }

  return i18n.t("provider_mobile.clients.review");
}

function getProviderJobIssueLabel(i18n: I18nInstance, job: ProviderJobSummary) {
  if (job.status === "confirmed" && !job.onRouteConfirmedAt) {
    return i18n.t("provider_mobile.schedule.issue.delay");
  }

  return i18n.t("provider_mobile.schedule.issue.generic");
}

function getProviderJobProofSummary(i18n: I18nInstance, job: ProviderJobSummary) {
  if (job.status === "requested") {
    return {
      label: i18n.t("provider_mobile.schedule.summary.next"),
      value: i18n.t("provider_mobile.schedule.proof.confirm_first")
    };
  }

  if (job.status === "confirmed") {
    return {
      label: i18n.t("provider_mobile.schedule.proof.arrival"),
      value:
        job.beforeEvidenceCount > 0
          ? i18n.t("mobile.support.property.measurements_saved", { count: job.beforeEvidenceCount })
          : i18n.t("provider_mobile.schedule.proof.needed")
    };
  }

  if (job.status === "in-progress") {
    return {
      label: i18n.t("provider_mobile.schedule.proof.completion"),
      value:
        job.afterEvidenceCount > 0
          ? i18n.t("mobile.support.property.measurements_saved", { count: job.afterEvidenceCount })
          : i18n.t("provider_mobile.schedule.proof.needed")
    };
  }

  return {
    label: i18n.t("provider_mobile.schedule.proof.title"),
    value: i18n.t("mobile.support.property.measurements_saved", {
      count: job.beforeEvidenceCount + job.afterEvidenceCount
    })
  };
}

function getProviderJobActiveStepIndex(job: ProviderJobSummary) {
  if (job.status === "requested") {
    return 0;
  }

  if (hasCrewDecisionPending(job)) {
    return 1;
  }

  if (job.status === "confirmed" && !job.onRouteConfirmedAt) {
    return 2;
  }

  return 3;
}

export function ScheduleScreen() {
  const i18n = useI18n();
  const { envelope } = useProviderSession();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [calendarOverview, setCalendarOverview] = useState<ProviderCalendarOverviewResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [assistantCommand, setAssistantCommand] = useState("");
  const [assistantResult, setAssistantResult] = useState<ProviderAssistantCommandResponse | undefined>();
  const [selectedAssistantBookingId, setSelectedAssistantBookingId] = useState<string | undefined>();
  const [showAssistantTools, setShowAssistantTools] = useState(false);
  const [expandedManageSections, setExpandedManageSections] = useState<Record<string, boolean>>({});
  const [expandedStaffingSections, setExpandedStaffingSections] = useState<Record<string, boolean>>({});
  const [expandedProofSections, setExpandedProofSections] = useState<Record<string, boolean>>({});
  const [expandedIssueSections, setExpandedIssueSections] = useState<Record<string, boolean>>({});
  const [expandedCustomerSections, setExpandedCustomerSections] = useState<Record<string, boolean>>({});
  const [evidenceNoteDrafts, setEvidenceNoteDrafts] = useState<Record<string, string>>({});
  const [isWorking, setIsWorking] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const routeSharingBookingIdRef = useRef<string | undefined>(undefined);
  const activeTrackingBookingIdRef = useRef<string | undefined>(undefined);

  async function loadOverview() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextOverview, nextCalendarOverview] = await Promise.all([
        api.getProviderStaffingOverview(),
        api.getProviderCalendarOverview()
      ]);
      setOverview(nextOverview);
      setCalendarOverview(nextCalendarOverview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.load"));
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [envelope?.session.token]);

  const jobs = overview?.jobs ?? [];
  const calendarEvents = calendarOverview?.events ?? [];
  const activeRouteJob = useMemo(
    () =>
      [...jobs]
        .filter((job) => Boolean(job.onRouteConfirmedAt) && (job.status === "confirmed" || job.status === "in-progress"))
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [jobs]
  );
  const priorityJob = useMemo(() => {
    const sortedJobs = [...jobs].sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));
    return (
      sortedJobs.find(
        (job) => Boolean(getProviderJobPrimaryAction(job)) || hasCrewDecisionPending(job)
      ) ?? sortedJobs[0]
    );
  }, [jobs]);
  const priorityJobPrimaryAction = priorityJob ? getProviderJobPrimaryAction(priorityJob) : undefined;
  const priorityJobNeedsStaffing = priorityJob ? hasCrewDecisionPending(priorityJob) : false;
  const priorityJobActiveStepIndex = priorityJob ? getProviderJobActiveStepIndex(priorityJob) : 0;
  const priorityJobSteps = priorityJob
    ? [
        {
          label: i18n.t("provider_mobile.schedule.action.confirm"),
          value:
            priorityJob.status === "requested"
              ? i18n.t("provider_mobile.schedule.proof.needed")
              : i18n.t("provider_mobile.schedule.state.done")
        },
        {
          label: i18n.t("provider_mobile.dashboard.crew"),
          value:
            priorityJob.crewGap > 0
              ? i18n.t("provider_mobile.dashboard.gap_count", { count: priorityJob.crewGap }).trim()
              : priorityJob.requiresRouteLeaderAssignment
                ? i18n.t("provider_mobile.schedule.route_leader.short")
                : i18n.t("provider_mobile.schedule.state.ready")
        },
        {
          label: i18n.t("provider_mobile.schedule.summary.route"),
          value: priorityJob.onRouteConfirmedAt
            ? i18n.t("provider_mobile.schedule.state.live")
            : formatBookingWindowSummaryI18n(i18n, priorityJob.scheduledStartIso)
        },
        {
          label: i18n.t("provider_mobile.schedule.summary.finish"),
          value:
            priorityJob.status === "in-progress"
              ? priorityJob.afterEvidenceCount > 0
                ? i18n.t("provider_mobile.schedule.action.complete")
                : i18n.t("provider_mobile.schedule.proof.title")
              : i18n.t("provider_mobile.schedule.proof.count", { count: priorityJob.afterEvidenceCount })
        }
      ].map((step, index) => ({
        ...step,
        status: getRouteStepStatus(index, priorityJobActiveStepIndex)
      }))
    : [];
  const selectedAssistantJob = selectedAssistantBookingId
    ? jobs.find((job) => job.bookingId === selectedAssistantBookingId)
    : undefined;
  const selectedAssistantCandidate = selectedAssistantBookingId
    ? assistantResult?.bookingCandidates.find((candidate) => candidate.bookingId === selectedAssistantBookingId)
    : undefined;
  const selectedAssistantBookingLabel = selectedAssistantJob
    ? i18n.t("provider_mobile.schedule.assistant.booking_label", {
        customer: selectedAssistantJob.customerName,
        window: formatBookingWindowSummaryI18n(i18n, selectedAssistantJob.scheduledStartIso)
      })
    : selectedAssistantCandidate
      ? i18n.t("provider_mobile.schedule.assistant.booking_label", {
          customer: selectedAssistantCandidate.customerName,
          window: selectedAssistantCandidate.currentWindowLabel
        })
      : undefined;

  useEffect(() => {
    activeTrackingBookingIdRef.current = activeTrackingBookingId;
  }, [activeTrackingBookingId]);

  function buildLateEta(bookingIso: string, minutes: number) {
    return new Date(new Date(bookingIso).getTime() + minutes * 60_000).toISOString();
  }

  function stopRouteLocationSharing() {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    routeSharingBookingIdRef.current = undefined;
  }

  async function pushRouteLocation(bookingId: string, location: Location.LocationObject) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextTracking = await api.updateBookingRouteLocation({
        bookingId,
        point: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        },
        capturedAtIso: new Date(location.timestamp).toISOString(),
        speedMph:
          typeof location.coords.speed === "number" && location.coords.speed >= 0
            ? Number((location.coords.speed * 2.23694).toFixed(1))
            : undefined,
        accuracyMeters:
          typeof location.coords.accuracy === "number" ? Number(location.coords.accuracy.toFixed(1)) : undefined
      });

      if (activeTrackingBookingIdRef.current === bookingId) {
        setTracking(nextTracking);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.share_location"));
    }
  }

  async function beginRouteLocationSharing(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    if (routeSharingBookingIdRef.current === bookingId && locationSubscriptionRef.current) {
      return;
    }

    stopRouteLocationSharing();

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        routeSharingBookingIdRef.current = bookingId;
        setStatusMessage(
          i18n.t("provider_mobile.schedule.message.route_live_location_needed")
        );
        return;
      }

      routeSharingBookingIdRef.current = bookingId;
      setStatusMessage(i18n.t("provider_mobile.schedule.message.sharing_route"));

      const currentPosition = await withPromiseTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        }),
        12_000,
        i18n.t("provider_mobile.schedule.error.route_location_timed_out")
      );
      await pushRouteLocation(bookingId, currentPosition);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30_000,
          distanceInterval: 50,
          mayShowUserSettingsDialog: true
        },
        (nextPosition) => {
          if (routeSharingBookingIdRef.current !== bookingId) {
            return;
          }

          void pushRouteLocation(bookingId, nextPosition);
        }
      );
    } catch (error) {
      setStatusMessage(
        i18n.t("provider_mobile.schedule.message.route_live_estimated")
      );
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.start_route_sharing"));
    }
  }

  useEffect(() => {
    if (!activeRouteJob?.bookingId) {
      stopRouteLocationSharing();
      return;
    }

    void beginRouteLocationSharing(activeRouteJob.bookingId);

    return () => {
      stopRouteLocationSharing();
    };
  }, [activeRouteJob?.bookingId, envelope?.session.token]);

  useEffect(() => () => stopRouteLocationSharing(), []);

  async function completeJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.completeBooking({ bookingId });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.job_complete"));
      setActiveBookingId(undefined);
      setChatThread(undefined);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.complete_job"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReviewMatch(crewMatchId: string, action: "accept" | "deny") {
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
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.clients.error.update_match"));
    } finally {
      setIsWorking(false);
    }
  }

  async function assignRouteLeader(bookingId: string, crewMemberId?: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.assignBookingRouteLeader({ bookingId, crewMemberId });
      setStatusMessage(
        crewMemberId
          ? i18n.t("provider_mobile.schedule.message.route_leader_assigned")
          : i18n.t("provider_mobile.schedule.message.route_leader_cleared")
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.update_route_leader"));
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

  async function declineJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.declineBooking({ bookingId });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.booking_declined"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.decline_booking"));
    } finally {
      setIsWorking(false);
    }
  }

  async function openCustomerChat(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveBookingId(bookingId);
      setChatThread(await api.getCustomerProviderConversationThread(undefined, bookingId));
    } catch (error) {
      if (error instanceof Error && /Conversation not found/.test(error.message)) {
        setActiveBookingId(bookingId);
        setChatThread(undefined);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.open_chat"));
    }
  }

  async function sendCustomerChat(bookingId: string) {
    if (!envelope?.session.token || !chatDraft.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setChatThread(
        await api.sendCustomerProviderMessage({
          threadId: chatThread?.thread.id,
          bookingId,
          body: chatDraft.trim()
        })
      );
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.send_message"));
    } finally {
      setIsWorking(false);
    }
  }

  async function openArrivalTracking(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setTracking(await api.getBookingTracking(bookingId));
      setActiveTrackingBookingId(bookingId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.open_arrival_tracking"));
    }
  }

  async function startRoute(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingOnRoute({ bookingId });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.route_started_location"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.dashboard.error.start_route"));
    } finally {
      setIsWorking(false);
    }
  }

  async function startWork(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.startBooking({ bookingId });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.work_started"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.start_work"));
    } finally {
      setIsWorking(false);
    }
  }

  async function markLate(bookingId: string, lateEtaIso: string, reason: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingLate({
        bookingId,
        lateEtaIso,
        reason
      });
      setStatusMessage(i18n.t("provider_mobile.schedule.message.delay_sent"));
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.send_delay"));
    } finally {
      setIsWorking(false);
    }
  }

  async function runProviderAssistant(execute: boolean) {
    if (!envelope?.session.token || !assistantCommand.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const result = await api.runProviderAssistantCommand({
        command: assistantCommand,
        bookingId: selectedAssistantBookingId,
        execute
      });
      setAssistantResult(result);
      if (result.bookingCandidates.length === 1) {
        setSelectedAssistantBookingId(result.bookingCandidates[0].bookingId);
      }
      if (result.executed) {
        setStatusMessage(result.previewMessage);
        await loadOverview();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.run_assistant"));
    } finally {
      setIsWorking(false);
    }
  }

  async function reportIssue(
    bookingId: string,
    exceptionType:
      | "customer-no-show"
      | "customer-not-ready"
      | "unable-to-access-property"
      | "service-could-not-be-completed",
    notes: string
  ) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingException({
        bookingId,
        exceptionType,
        notes
      });
      setStatusMessage(
        i18n.t("provider_mobile.schedule.message.issue_shared", {
          issue: formatBookingExceptionLabel(i18n, exceptionType)
        })
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.log_issue"));
    } finally {
      setIsWorking(false);
    }
  }

  async function captureEvidencePhoto(bookingId: string, phase: "before" | "after") {
    if (!envelope?.session.token) {
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
        quality: 0.3
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId,
        phase,
        imageDataUrl: `data:${mimeType};base64,${asset.base64}`
      });
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.before_photo_saved")
          : i18n.t("provider_mobile.schedule.message.after_photo_saved")
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.capture_photo"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceNote(bookingId: string, phase: "before" | "after") {
    if (!envelope?.session.token) {
      return;
    }

    const draftKey = `${bookingId}:${phase}`;
    const draft = (evidenceNoteDrafts[draftKey] ?? "").trim();
    if (!draft) {
      setErrorMessage(i18n.t("provider_mobile.schedule.error.note_required"));
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId,
        phase,
        evidenceType: "note",
        note: draft
      });
      setEvidenceNoteDrafts((current) => ({ ...current, [draftKey]: "" }));
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.before_note_saved")
          : i18n.t("provider_mobile.schedule.message.after_note_saved")
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.save_note"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceChecklist(bookingId: string, phase: "before" | "after") {
    if (!envelope?.session.token) {
      return;
    }

    const checklistItems =
      phase === "before"
        ? [
            { label: i18n.t("provider_mobile.schedule.checklist.access_path"), completed: true },
            { label: i18n.t("provider_mobile.schedule.checklist.equipment_staged"), completed: true },
            { label: i18n.t("provider_mobile.schedule.checklist.scope_reviewed"), completed: true }
          ]
        : [
            { label: i18n.t("provider_mobile.schedule.checklist.service_completed"), completed: true },
            { label: i18n.t("provider_mobile.schedule.checklist.debris_cleared"), completed: true },
            { label: i18n.t("provider_mobile.schedule.checklist.property_secured"), completed: true }
          ];

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId,
        phase,
        evidenceType: "checklist",
        checklistItems
      });
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_mobile.schedule.message.arrival_checklist_saved")
          : i18n.t("provider_mobile.schedule.message.completion_checklist_saved")
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.schedule.error.save_checklist"));
    } finally {
      setIsWorking(false);
    }
  }

  function openProofTools(bookingId: string) {
    setViewMode("list");
    setExpandedManageSections((current) => ({
      ...current,
      [bookingId]: true
    }));
    setExpandedProofSections((current) => ({
      ...current,
      [bookingId]: true
    }));
  }

  if (!overview && !calendarOverview && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("provider_mobile.schedule.eyebrow")}
        title={i18n.t("provider_mobile.schedule.title")}
        description={i18n.t("provider_mobile.schedule.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAvatar />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={3} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("provider_mobile.schedule.eyebrow")}
      title={i18n.t("provider_mobile.schedule.title")}
      description={i18n.t("provider_mobile.schedule.description")}
    >
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "calendar"} label={i18n.t("provider_mobile.schedule.view.calendar")} onPress={() => setViewMode("calendar")} />
        <ModeButton active={viewMode === "list"} label={i18n.t("provider_mobile.schedule.view.list")} onPress={() => setViewMode("list")} />
      </View>

      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {priorityJob ? (
        <InfoCard title={i18n.t("provider_mobile.schedule.today_path")} description={getProviderJobActionLabel(i18n, priorityJob)}>
          <View style={styles.routeFocusHeader}>
            <View style={styles.routeFocusCopy}>
              <Text style={styles.clientLabel}>{priorityJob.customerName}</Text>
              <Text style={styles.metaLine}>{priorityJob.serviceAddress.line1}</Text>
            </View>
            <Text style={styles.routeFocusPill}>{getProviderJobStatusLabel(i18n, priorityJob)}</Text>
          </View>
          <View style={styles.routePath} accessibilityLabel={i18n.t("provider_mobile.schedule.route_progress")}>
            {priorityJobSteps.map((step, index) => (
              <View key={step.label} style={[styles.routePathStep, styles[`routePathStep_${step.status}`]]}>
                <View style={[styles.routePathIndex, styles[`routePathIndex_${step.status}`]]}>
                  <Text style={[styles.routePathIndexLabel, styles[`routePathIndexLabel_${step.status}`]]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.routePathCopy}>
                  <Text style={styles.routePathLabel}>{step.label}</Text>
                  <Text numberOfLines={2} style={styles.routePathValue}>
                    {step.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.routeFocusGrid}>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.schedule.summary.window")}</Text>
              <Text style={styles.jobSummaryValue}>{formatBookingWindowSummaryI18n(i18n, priorityJob.scheduledStartIso)}</Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew")}</Text>
              <Text style={styles.jobSummaryValue}>
                {priorityJob.assignedCrewMembers}/{priorityJob.requiredCrewMembers}
                {priorityJob.crewGap ? i18n.t("provider_mobile.schedule.crew.gap_suffix", { count: priorityJob.crewGap }) : ""}
              </Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.schedule.summary.service")}</Text>
              <Text style={styles.jobSummaryValue}>{formatServiceCategoryLabel(i18n, priorityJob.category)}</Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.schedule.summary.next")}</Text>
              <Text style={styles.jobSummaryValue}>{getProviderJobActionLabel(i18n, priorityJob)}</Text>
            </View>
          </View>
          <View style={styles.routeFocusActions}>
            {priorityJobPrimaryAction === "confirm" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void confirmJob(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>
                  {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.confirm_booking")}
                </Text>
              </Pressable>
            ) : null}
            {priorityJobNeedsStaffing && priorityJobPrimaryAction !== "confirm" ? (
              <Pressable
                onPress={() => {
                  setViewMode("list");
                  setExpandedManageSections((current) => ({
                    ...current,
                    [priorityJob.bookingId]: true
                  }));
                  setExpandedStaffingSections((current) => ({
                    ...current,
                    [priorityJob.bookingId]: true
                  }));
                }}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>{i18n.t("provider_mobile.schedule.action.manage_staffing")}</Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "start-route" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void startRoute(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>
                  {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.start_route")}
                </Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "start-work" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void startWork(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>
                  {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.schedule.action.start_work")}
                </Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "complete" ? (
              <Pressable
                disabled={isWorking}
                onPress={() =>
                  priorityJob.afterEvidenceCount > 0
                    ? void completeJob(priorityJob.bookingId)
                    : openProofTools(priorityJob.bookingId)
                }
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>
                  {isWorking
                    ? i18n.t("provider_mobile.dashboard.loading.working")
                    : priorityJob.afterEvidenceCount > 0
                      ? i18n.t("provider_mobile.dashboard.action.complete_job")
                      : i18n.t("provider_mobile.schedule.action.add_proof")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title={i18n.t("provider_mobile.schedule.today_path")} description={i18n.t("provider_mobile.schedule.empty.title")}>
          <Text style={styles.metaLine}>{i18n.t("provider_mobile.schedule.empty.description")}</Text>
        </InfoCard>
      )}

      <InfoCard
        title={i18n.t("provider_mobile.schedule.assistant.title")}
        description={
          showAssistantTools
            ? i18n.t("provider_mobile.schedule.assistant.review_description")
            : i18n.t("provider_mobile.schedule.assistant.description")
        }
      >
        <Pressable onPress={() => setShowAssistantTools((current) => !current)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>
            {showAssistantTools ? i18n.t("common.actions.close") : i18n.t("provider_mobile.schedule.action.open")}
          </Text>
        </Pressable>
        {showAssistantTools ? (
          <View style={styles.assistantStack}>
            <View style={styles.presetGrid}>
              {routeToolPresets.map((preset) => {
                const isActive = assistantCommand === preset.command;
                return (
                  <Pressable
                    key={preset.labelKey}
                    onPress={() => {
                      setAssistantCommand(preset.command);
                      setAssistantResult(undefined);
                    }}
                    style={[styles.presetButton, isActive && styles.presetButtonActive]}
                  >
                    <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>{i18n.t(preset.labelKey)}</Text>
                    <Text style={[styles.presetDetail, isActive && styles.presetDetailActive]}>{i18n.t(preset.detailKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sectionLabel}>{i18n.t("provider_mobile.schedule.assistant.custom_change")}</Text>
            <TextInput
              value={assistantCommand}
              onChangeText={(text) => {
                setAssistantCommand(text);
                setAssistantResult(undefined);
              }}
              placeholder={i18n.t("provider_mobile.schedule.assistant.placeholder")}
              placeholderTextColor={BrandTokens.colors.inkSoft}
              style={[styles.input, styles.multilineInput]}
              multiline
            />
            {selectedAssistantBookingLabel ? (
              <Text style={styles.metaLine}>
                {i18n.t("provider_mobile.schedule.assistant.selected", {
                  booking: selectedAssistantBookingLabel
                })}
              </Text>
            ) : null}
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || assistantCommand.trim().length === 0}
                onPress={() => void runProviderAssistant(false)}
                style={[styles.secondaryButton, assistantCommand.trim().length === 0 && styles.secondaryButtonDisabled]}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.assistant.review_plan")}</Text>
              </Pressable>
              <Pressable
                disabled={isWorking || !assistantResult?.requiresConfirmation}
                onPress={() => void runProviderAssistant(true)}
                style={[styles.secondaryButton, !assistantResult?.requiresConfirmation && styles.secondaryButtonDisabled]}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.assistant.apply")}</Text>
              </Pressable>
            </View>
            {assistantResult ? (
              <View style={styles.ticketStack}>
                <Text style={styles.valueText}>{assistantResult.previewLabel}</Text>
                <Text style={styles.meta}>{assistantResult.previewMessage}</Text>
                {assistantResult.actionTypes && assistantResult.actionTypes.length > 1 ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.steps", {
                      steps: assistantResult.actionTypes.map((actionType) => formatAssistantActionType(i18n, actionType)).join(" • ")
                    })}
                  </Text>
                ) : null}
                {assistantResult.targetWindowLabel ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.target_window", {
                      window: assistantResult.targetWindowLabel
                    })}
                  </Text>
                ) : null}
                {assistantResult.lateEtaIso ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.new_eta", {
                      time: i18n.formatDate(assistantResult.lateEtaIso, { timeStyle: "short" })
                    })}
                  </Text>
                ) : null}
                {assistantResult.dispatchDaySummary ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.day_summary", {
                      route: formatRouteStatusLabel(i18n, assistantResult.dispatchDaySummary.routeStatus),
                      jobs: assistantResult.dispatchDaySummary.yardmatchJobCount,
                      crewGap: assistantResult.dispatchDaySummary.crewGap,
                      miles: assistantResult.dispatchDaySummary.estimatedDriveMiles
                    })}
                  </Text>
                ) : null}
                {assistantResult.dispatchRangeSummary ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.range_summary", {
                      active: assistantResult.dispatchRangeSummary.activeDayCount,
                      watch: assistantResult.dispatchRangeSummary.watchDayCount,
                      overloaded: assistantResult.dispatchRangeSummary.overloadedDayCount,
                      crewGap: assistantResult.dispatchRangeSummary.totalCrewGap
                    })}
                  </Text>
                ) : null}
                {assistantResult.dispatchWindowSummary ? (
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.schedule.assistant.window_summary", {
                      window: assistantResult.dispatchWindowSummary.label,
                      jobs: assistantResult.dispatchWindowSummary.yardmatchJobCount,
                      crewGap: assistantResult.dispatchWindowSummary.crewGap,
                      minutes: assistantResult.dispatchWindowSummary.blockedMinutes
                    })}
                  </Text>
                ) : null}
                {assistantResult.customerNotificationPreview ? (
                  <Text style={styles.meta}>{assistantResult.customerNotificationPreview}</Text>
                ) : null}
                {assistantResult.bookingCandidates.length > 0 ? (
                  <Text style={styles.meta}>
                    {assistantResult.actionType === "summarize-dispatch"
                      ? i18n.t("provider_mobile.schedule.assistant.candidates.focus_area")
                      : assistantResult.actionType === "recommend-dispatch-adjustment"
                        ? i18n.t("provider_mobile.schedule.assistant.candidates.pressured_window")
                        : assistantResult.actionType === "recommend-staffing-adjustment"
                          ? i18n.t("provider_mobile.schedule.assistant.candidates.need_crew")
                          : i18n.t("provider_mobile.schedule.assistant.candidates.matching")}
                  </Text>
                ) : null}
                {assistantResult.bookingCandidates.map((candidate) => (
                  <View key={candidate.bookingId} style={styles.ticketRow}>
                    <View style={styles.ticketCopy}>
                      <Text style={styles.valueText}>{candidate.customerName}</Text>
                      <Text style={styles.meta}>
                        {i18n.t("provider_mobile.schedule.assistant.candidate_time", {
                          window: candidate.currentWindowLabel,
                          date: i18n.formatDate(candidate.scheduledStartIso, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        })}
                      </Text>
                      <Text style={styles.meta}>{candidate.addressLine}</Text>
                    </View>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => setSelectedAssistantBookingId(candidate.bookingId)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_mobile.schedule.action.select")}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </InfoCard>

      {viewMode === "calendar" ? (
        <InfoCard
          title={i18n.t("provider_mobile.schedule.week_view")}
          description={i18n.t("provider_mobile.schedule.week_summary", {
            jobs: calendarOverview?.yardmatchJobCount ?? jobs.length,
            blocks: calendarOverview?.externalBlockCount ?? 0
          })}
        >
          <View style={styles.list}>
            {calendarOverview?.dispatchDays?.map((day) => (
              <View key={day.dateIso} style={styles.dispatchCard}>
                <View style={styles.dispatchHeader}>
                  <Text style={styles.clientLabel}>{day.dayLabel}</Text>
                  <Text style={styles.dispatchStatus}>{formatRouteStatusLabel(i18n, day.routeStatus)}</Text>
                </View>
                <Text style={styles.metaLine}>
                  {i18n.t("provider_mobile.schedule.dispatch.day_summary", {
                    jobs: day.yardmatchJobCount,
                    assigned: day.totalCrewAssigned,
                    required: day.totalCrewRequired,
                    miles: day.estimatedDriveMiles
                  })}
                </Text>
                <Text style={styles.metaLine}>
                  {i18n.t("provider_mobile.schedule.dispatch.longest_leg", {
                    miles: day.longestDriveLegMiles
                  })}
                  {day.largestIdleGapMinutes
                    ? i18n.t("provider_mobile.schedule.dispatch.idle_gap_suffix", {
                        duration: formatMinutesAsHours(i18n, day.largestIdleGapMinutes)
                      })
                    : ""}
                  {day.outlierStopCount
                    ? i18n.t("provider_mobile.schedule.dispatch.outlier_suffix", {
                        count: day.outlierStopCount
                      })
                    : ""}
                </Text>
                <Text style={styles.metaLine}>
                  {i18n.t("provider_mobile.schedule.dispatch.booked_minutes", {
                    duration: formatMinutesAsHours(i18n, day.bookedMinutes)
                  })}
                  {day.externalBlockCount
                    ? i18n.t("provider_mobile.schedule.dispatch.outside_blocks_suffix", {
                        duration: formatMinutesAsHours(i18n, day.blockedMinutes)
                      })
                    : ""}
                </Text>
                {day.firstStopAddressLine ? (
                  <Text style={styles.metaLine}>
                    {i18n.t("provider_mobile.schedule.dispatch.first_stop", {
                      address: day.firstStopAddressLine
                    })}
                  </Text>
                ) : null}
                <View style={styles.windowList}>
                  {day.windowSummaries.map((window) => (
                    <View key={`${day.dateIso}-${window.windowKey}`} style={styles.windowCard}>
                      <Text style={styles.timeLabel}>{window.label}</Text>
                      <Text style={styles.metaLine}>
                        {i18n.t("provider_mobile.schedule.dispatch.window_summary", {
                          jobs: window.yardmatchJobCount,
                          assigned: window.totalCrewAssigned,
                          required: window.totalCrewRequired
                        })}
                        {window.crewGap ? i18n.t("provider_mobile.schedule.crew.gap_suffix", { count: window.crewGap }) : ""}
                      </Text>
                      <Text style={styles.metaLine}>
                        {window.externalBlockCount
                          ? i18n.t("provider_mobile.schedule.dispatch.window_blocks", {
                              blocks: window.externalBlockCount,
                              duration: formatMinutesAsHours(i18n, window.blockedMinutes)
                            })
                          : i18n.t("provider_mobile.schedule.dispatch.booked_minutes", {
                              duration: formatMinutesAsHours(i18n, window.bookedMinutes)
                            })}
                      </Text>
                    </View>
                  ))}
                </View>
                {day.recommendations.map((recommendation) => (
                  <Text key={recommendation} style={styles.metaLine}>
                    - {recommendation}
                  </Text>
                ))}
              </View>
            ))}
            {calendarEvents.map((event) => (
              <View key={event.id} style={styles.dayCard}>
                <Text style={styles.dayLabel}>
                  {i18n.formatDate(event.startIso, { weekday: "short" })}
                </Text>
                <Text style={styles.timeLabel}>
                  {formatBookingWindowSummaryI18n(i18n, event.startIso)}
                </Text>
                <Text style={styles.clientLabel}>{event.title}</Text>
                <Text style={styles.metaLine}>
                  {event.source === "yardmatch-booking"
                    ? i18n.t("provider_mobile.schedule.calendar.yardmatch_event", {
                        customer: event.customerName ?? i18n.t("provider_mobile.schedule.customer_fallback"),
                        status: event.status ? i18n.t(providerJobStatusLabelKeys[event.status]) : i18n.t("mobile.support.not_set")
                      })
                    : i18n.t("provider_mobile.schedule.calendar.outside_event", {
                        type: formatExternalCalendarBlockLabel(i18n, event.blockType ?? "off-platform-client")
                      })}
                </Text>
                {event.addressLine ? <Text style={styles.metaLine}>{event.addressLine}</Text> : null}
                {event.notes ? <Text style={styles.metaLine}>{event.notes}</Text> : null}
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title={i18n.t("provider_mobile.schedule.job_list")} description={i18n.t("provider_mobile.schedule.scheduled_count", { count: jobs.length })}>
          <View style={styles.list}>
            {jobs.map((job) => {
              const isManageOpen = expandedManageSections[job.bookingId];
              const primaryAction = getProviderJobPrimaryAction(job);
              const statusLabel = getProviderJobStatusLabel(i18n, job);
              const issueLabel = getProviderJobIssueLabel(i18n, job);
              const proofSummary = getProviderJobProofSummary(i18n, job);
              const shouldShowArrivalProof = job.status === "confirmed";
              const shouldShowCompletionProof = job.status === "in-progress";
              const canDeclineJob = job.status === "requested";
              const canManageCrew = job.status === "confirmed" || job.status === "in-progress";
              const hasPendingCrewReview = job.matches.some((match) => match.status === "pending-provider-review");
              const canAssignRouteLeader =
                overview?.provider.routeLeaderMode === "accepted-crew-fallback" &&
                !job.onRouteConfirmedAt &&
                job.matches.some((match) => match.status === "accepted");
              const canShowStaffingTools =
                canManageCrew &&
                (job.crewGap > 0 || job.requiresRouteLeaderAssignment || hasPendingCrewReview || canAssignRouteLeader);
              const canShowProofTools = shouldShowArrivalProof || shouldShowCompletionProof;
              const canShowIssueTools = job.status === "confirmed" || job.status === "in-progress";
              const canShowDelayActions = job.status === "confirmed" && !job.onRouteConfirmedAt;
              const canShowArrivalIssueActions = job.status === "confirmed" && Boolean(job.onRouteConfirmedAt);
              const canShowOnsiteIssueActions = canShowArrivalIssueActions || job.status === "in-progress";
              const canShowCustomerTools = Boolean(job.onRouteConfirmedAt);
              const canShowJobTools =
                canDeclineJob ||
                canShowStaffingTools ||
                canShowProofTools ||
                canShowIssueTools ||
                canShowCustomerTools;

              return (
                <View key={job.bookingId} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.clientLabel}>{job.customerName}</Text>
                  <Text style={styles.metaLine}>{job.serviceAddress.line1}</Text>
                  <Text style={styles.statusLine}>{statusLabel}</Text>
                  <View style={styles.jobSummaryGrid}>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.schedule.summary.window")}</Text>
                      <Text style={styles.jobSummaryValue}>{formatBookingWindowSummaryI18n(i18n, job.scheduledStartIso)}</Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew")}</Text>
                      <Text style={styles.jobSummaryValue}>
                        {job.assignedCrewMembers}/{job.requiredCrewMembers}
                        {job.crewGap ? i18n.t("provider_mobile.schedule.crew.gap_suffix", { count: job.crewGap }) : ""}
                      </Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>{proofSummary.label}</Text>
                      <Text style={styles.jobSummaryValue}>{proofSummary.value}</Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>{i18n.t("provider_mobile.dashboard.total")}</Text>
                      <Text style={styles.jobSummaryValue}>{formatCurrency(i18n, job.totalCents)}</Text>
                    </View>
                  </View>
                  <Text style={styles.metaLine}>{formatServiceCategoryLabel(i18n, job.category)}</Text>
                  {overview?.provider.routeLeaderMode === "accepted-crew-fallback" ? (
                    <Text style={styles.metaLine}>
                      {i18n.t("provider_mobile.schedule.route_leader.summary", {
                        leader: job.assignedRouteLeaderCrewMemberName ?? i18n.t("provider_mobile.schedule.route_leader.provider")
                      })}
                      {job.requiresRouteLeaderAssignment ? i18n.t("provider_mobile.schedule.route_leader.pick_suffix") : ""}
                    </Text>
                  ) : null}
                  {job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>{i18n.t("provider_mobile.schedule.message.route_chat_open")}</Text>
                  ) : null}
                  {job.lateEtaIso && !job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>
                      {i18n.t("provider_mobile.schedule.message.delay_notice_sent", {
                        time: i18n.formatDate(job.lateEtaIso, { timeStyle: "short" })
                      })}
                    </Text>
                  ) : null}
                  {job.activeExceptionType ? (
                    <Text style={styles.metaLine}>
                      {formatBookingExceptionLabel(i18n, job.activeExceptionType)}
                      {job.activeExceptionNotes ? i18n.t("provider_mobile.schedule.note_suffix", { note: job.activeExceptionNotes }) : ""}
                    </Text>
                  ) : null}
                  {job.status === "disputed" ? (
                    <Text style={styles.metaLine}>
                      {i18n.t("provider_mobile.schedule.status.disputed")}
                      {job.disputeReason ? i18n.t("provider_mobile.schedule.note_suffix", { note: job.disputeReason }) : ""}
                    </Text>
                  ) : null}
                  {job.evidencePhotos.some(
                    (evidence) => evidence.phase === "before" && evidence.capturedByRole === "customer"
                  ) ? (
                    <View style={styles.customerPhotoPanel}>
                      <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.customer_photos.title")}</Text>
                      <Text style={styles.metaLine}>{i18n.t("provider_mobile.schedule.customer_photos.body")}</Text>
                      <View style={styles.photoRow}>
                        {job.evidencePhotos
                          .filter(
                            (evidence) =>
                              evidence.phase === "before" &&
                              evidence.capturedByRole === "customer" &&
                              evidence.imageDataUrl
                          )
                          .map((evidence) => (
                            <View key={evidence.id} style={styles.photoTile}>
                              <Image source={{ uri: evidence.imageDataUrl }} style={styles.photoImage} />
                              <Text style={styles.photoLabel}>{evidence.photoArea?.replaceAll("-", " ") ?? i18n.t("photo.area.other")}</Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.actionRow}>
                    {primaryAction === "confirm" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void confirmJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>
                          {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.confirm_booking")}
                        </Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "start-route" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startRoute(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>
                          {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.dashboard.action.start_route")}
                        </Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "start-work" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startWork(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>
                          {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_mobile.schedule.action.start_work")}
                        </Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "complete" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          job.afterEvidenceCount > 0 ? void completeJob(job.bookingId) : openProofTools(job.bookingId)
                        }
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>
                          {isWorking
                            ? i18n.t("provider_mobile.dashboard.loading.working")
                            : job.afterEvidenceCount > 0
                              ? i18n.t("provider_mobile.dashboard.action.complete_job")
                              : i18n.t("provider_mobile.schedule.action.add_proof")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {canShowJobTools ? (
                    <Pressable
                      onPress={() =>
                        setExpandedManageSections((current) => ({
                          ...current,
                          [job.bookingId]: !current[job.bookingId]
                        }))
                      }
                      style={styles.chatButton}
                    >
                      <Text style={styles.chatButtonLabel}>
                        {isManageOpen ? i18n.t("common.actions.close") : i18n.t("provider_mobile.schedule.action.options")}
                      </Text>
                    </Pressable>
                  ) : null}
                  {isManageOpen && canShowJobTools ? (
                    <View style={styles.managePanel}>
                      <View style={styles.actionRow}>
                        {canDeclineJob ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void declineJob(job.bookingId)}
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>
                              {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("provider_live.action.decline_request")}
                            </Text>
                          </Pressable>
                        ) : null}
                        {canShowStaffingTools ? (
                          <Pressable
                            onPress={() =>
                              setExpandedStaffingSections((current) => ({
                                ...current,
                                [job.bookingId]: !current[job.bookingId]
                              }))
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>
                              {expandedStaffingSections[job.bookingId]
                                ? i18n.t("common.actions.close")
                                : i18n.t("provider_mobile.schedule.action.staffing")}
                            </Text>
                          </Pressable>
                        ) : null}
                        {canShowProofTools ? (
                          <Pressable
                            onPress={() =>
                              setExpandedProofSections((current) => ({
                                ...current,
                                [job.bookingId]: !current[job.bookingId]
                              }))
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>
                              {expandedProofSections[job.bookingId]
                                ? i18n.t("common.actions.close")
                                : i18n.t("provider_mobile.schedule.proof.title")}
                            </Text>
                          </Pressable>
                        ) : null}
                        {canShowIssueTools ? (
                          <Pressable
                            onPress={() =>
                              setExpandedIssueSections((current) => ({
                                ...current,
                                [job.bookingId]: !current[job.bookingId]
                              }))
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>
                              {expandedIssueSections[job.bookingId] ? i18n.t("common.actions.close") : issueLabel}
                            </Text>
                          </Pressable>
                        ) : null}
                        {canShowCustomerTools ? (
                          <Pressable
                            onPress={() =>
                              setExpandedCustomerSections((current) => ({
                                ...current,
                                [job.bookingId]: !current[job.bookingId]
                              }))
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>
                              {expandedCustomerSections[job.bookingId]
                                ? i18n.t("common.actions.close")
                                : i18n.t("provider_mobile.schedule.live_updates")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {isManageOpen && canShowStaffingTools && expandedStaffingSections[job.bookingId] ? (
                  <View style={styles.matchList}>
                    {job.requiresRouteLeaderAssignment ? (
                      <View style={styles.windowCard}>
                        <Text style={styles.clientLabel}>{i18n.t("provider_mobile.schedule.route_leader.needs_assignment")}</Text>
                        <Text style={styles.metaLine}>
                          {i18n.t("provider_mobile.schedule.route_leader.needs_assignment_description")}
                        </Text>
                      </View>
                    ) : null}
                    {job.matches.length === 0 ? (
                      <View style={styles.windowCard}>
                        <Text style={styles.clientLabel}>{i18n.t("provider_mobile.schedule.crew.no_matches_title")}</Text>
                        <Text style={styles.metaLine}>
                          {i18n.t("provider_mobile.schedule.crew.no_matches_description")}
                        </Text>
                      </View>
                    ) : (
                      job.matches.map((match) => (
                        <View key={match.id} style={styles.windowCard}>
                          <Text style={styles.clientLabel}>{match.crewMemberName}</Text>
                          <Text style={styles.metaLine}>
                            {i18n.t("provider_mobile.schedule.crew.match_summary", {
                              miles: match.distanceMiles,
                              schedule: i18n.t(`crew_signup.schedule.${match.preferredSchedule.replace("-", "_")}` as TranslationKey),
                              days: match.availableWeekdays
                                .map((weekday) => i18n.t(`provider_mobile.support.weekday.${weekday.toLowerCase()}` as TranslationKey))
                                .join(", ")
                            })}
                          </Text>
                          {match.recommendationLabel ? (
                            <Text style={styles.metaLine}>
                              {formatCrewRecommendationLabel(i18n, match.recommendationLabel)}
                              {typeof match.recommendationScore === "number"
                                ? i18n.t("provider_mobile.schedule.crew.score_suffix", { score: match.recommendationScore })
                                : ""}
                            </Text>
                          ) : null}
                          {match.recommendationReasons?.length ? (
                            <Text style={styles.metaLine}>{match.recommendationReasons.join(" • ")}</Text>
                          ) : null}
                          {match.status === "cancelled-by-crew" && match.cancellationReason ? (
                            <Text style={styles.warningLine}>
                              {i18n.t("provider_mobile.schedule.crew.note", { note: match.cancellationReason })}
                            </Text>
                          ) : null}
                          {match.status === "accepted" && job.assignedRouteLeaderCrewMemberId === match.crewMemberId ? (
                            <Text style={styles.metaLine}>{i18n.t("provider_mobile.schedule.route_leader.assigned_for_job")}</Text>
                          ) : null}
                          <Text style={styles.metaLine}>{i18n.t(crewMatchStatusLabelKeys[match.status])}</Text>
                          <Text style={styles.metaLine}>
                            {i18n.t("provider_mobile.clients.hourly_rate", {
                              rate: formatCurrency(i18n, match.hourlyRateCents)
                            })}
                          </Text>
                          {match.status === "pending-provider-review" ? (
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={isWorking}
                                onPress={() => void handleReviewMatch(match.id, "accept")}
                                style={styles.completeButton}
                              >
                                <Text style={styles.completeButtonLabel}>
                                  {isWorking ? i18n.t("provider_mobile.dashboard.loading.working") : i18n.t("common.actions.accept")}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={isWorking}
                                onPress={() => void handleReviewMatch(match.id, "deny")}
                                style={styles.chatButton}
                            >
                                <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.action.deny")}</Text>
                              </Pressable>
                            </View>
                          ) : null}
                          {overview?.provider.routeLeaderMode === "accepted-crew-fallback" &&
                          match.status === "accepted" &&
                          !job.onRouteConfirmedAt ? (
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void assignRouteLeader(job.bookingId, match.crewMemberId)}
                              style={
                                job.assignedRouteLeaderCrewMemberId === match.crewMemberId
                                  ? styles.completeButton
                                  : styles.chatButton
                              }
                            >
                              <Text
                                style={
                                  job.assignedRouteLeaderCrewMemberId === match.crewMemberId
                                    ? styles.completeButtonLabel
                                    : styles.chatButtonLabel
                                }
                              >
                                {job.assignedRouteLeaderCrewMemberId === match.crewMemberId
                                  ? i18n.t("provider_mobile.schedule.route_leader.assigned")
                                  : i18n.t("provider_mobile.schedule.route_leader.lead_this_route")}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                  ) : null}
                  {isManageOpen &&
                  canShowStaffingTools &&
                  expandedStaffingSections[job.bookingId] &&
                  overview?.provider.routeLeaderMode === "accepted-crew-fallback" &&
                  job.assignedRouteLeaderCrewMemberId &&
                  !job.onRouteConfirmedAt ? (
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void assignRouteLeader(job.bookingId)}
                      style={styles.chatButton}
                    >
                      <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.route_leader.clear")}</Text>
                    </Pressable>
                  ) : null}
                  {isManageOpen && canShowProofTools && expandedProofSections[job.bookingId] ? (
                    <View style={styles.ticketStack}>
                      {shouldShowArrivalProof ? (
                        <>
                          <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.proof.arrival_title")}</Text>
                          <TextInput
                            multiline
                            onChangeText={(value) =>
                              setEvidenceNoteDrafts((current) => ({
                                ...current,
                                [`${job.bookingId}:before`]: value
                              }))
                            }
                            placeholder={i18n.t("provider_mobile.schedule.proof.arrival_note")}
                            placeholderTextColor={BrandTokens.colors.muted}
                            style={styles.input}
                            value={evidenceNoteDrafts[`${job.bookingId}:before`] ?? ""}
                          />
                          <View style={styles.actionRow}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void captureEvidencePhoto(job.bookingId, "before")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>
                                {job.beforeEvidenceCount > 0
                                  ? i18n.t("provider_mobile.schedule.proof.add_photo")
                                  : i18n.t("provider_mobile.schedule.proof.take_photo")}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void saveEvidenceNote(job.bookingId, "before")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.proof.save_note")}</Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void saveEvidenceChecklist(job.bookingId, "before")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.proof.checklist")}</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : null}
                      {shouldShowCompletionProof ? (
                        <>
                          <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.proof.completion_title")}</Text>
                          <TextInput
                            multiline
                            onChangeText={(value) =>
                              setEvidenceNoteDrafts((current) => ({
                                ...current,
                                [`${job.bookingId}:after`]: value
                              }))
                            }
                            placeholder={i18n.t("provider_mobile.schedule.proof.completion_note")}
                            placeholderTextColor={BrandTokens.colors.muted}
                            style={styles.input}
                            value={evidenceNoteDrafts[`${job.bookingId}:after`] ?? ""}
                          />
                          <View style={styles.actionRow}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void captureEvidencePhoto(job.bookingId, "after")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>
                                {job.afterEvidenceCount > 0
                                  ? i18n.t("provider_mobile.schedule.proof.add_photo")
                                  : i18n.t("provider_mobile.schedule.proof.take_photo")}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void saveEvidenceNote(job.bookingId, "after")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.proof.save_note")}</Text>
                            </Pressable>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => void saveEvidenceChecklist(job.bookingId, "after")}
                              style={styles.chatButton}
                            >
                              <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.proof.checklist")}</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                  {isManageOpen && canShowIssueTools && expandedIssueSections[job.bookingId] ? (
                    <View style={styles.ticketStack}>
                      <Text style={styles.proofTitle}>{issueLabel}</Text>
                      <View style={styles.actionRow}>
                        {canShowDelayActions ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void markLate(
                                job.bookingId,
                                buildLateEta(job.scheduledStartIso, 15),
                                i18n.t("provider_mobile.schedule.issue.reason_15")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.issue.plus_15")}</Text>
                          </Pressable>
                        ) : null}
                        {canShowDelayActions ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void markLate(
                                job.bookingId,
                                buildLateEta(job.scheduledStartIso, 30),
                                i18n.t("provider_mobile.schedule.issue.reason_30")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.issue.plus_30")}</Text>
                          </Pressable>
                        ) : null}
                        {canShowArrivalIssueActions ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void reportIssue(
                                job.bookingId,
                                "customer-no-show",
                                i18n.t("provider_mobile.schedule.issue.reason_no_show")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("booking.exception.customer_no_show")}</Text>
                          </Pressable>
                        ) : null}
                        {canShowOnsiteIssueActions ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void reportIssue(
                                job.bookingId,
                                "customer-not-ready",
                                i18n.t("provider_mobile.schedule.issue.reason_not_ready")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("booking.exception.customer_not_ready")}</Text>
                          </Pressable>
                        ) : null}
                        {canShowOnsiteIssueActions ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void reportIssue(
                                job.bookingId,
                                "unable-to-access-property",
                                i18n.t("provider_mobile.schedule.issue.reason_no_access")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.issue.no_access")}</Text>
                          </Pressable>
                        ) : null}
                        {job.status === "in-progress" ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() =>
                              void reportIssue(
                                job.bookingId,
                                "service-could-not-be-completed",
                                i18n.t("provider_mobile.schedule.issue.reason_could_not_complete")
                              )
                            }
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.issue.could_not_complete")}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {isManageOpen && canShowCustomerTools && expandedCustomerSections[job.bookingId] ? (
                    <View style={styles.chatStack}>
                      <Text style={styles.proofTitle}>{i18n.t("provider_mobile.schedule.live_updates")}</Text>
                      <View style={styles.actionRow}>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openCustomerChat(job.bookingId)}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.action.message")}</Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openArrivalTracking(job.bookingId)}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>{i18n.t("provider_mobile.schedule.action.live_map")}</Text>
                        </Pressable>
                      </View>
                      {job.onRouteConfirmedAt &&
                      activeTrackingBookingId === job.bookingId &&
                      tracking ? (
                        <View style={styles.trackingCard}>
                          <Text style={styles.clientLabel}>
                            {tracking.etaMinutes
                              ? i18n.t("provider_mobile.schedule.tracking.eta", { count: tracking.etaMinutes })
                              : i18n.t("provider_mobile.schedule.tracking.at_property")}
                          </Text>
                          <Text style={styles.metaLine}>{tracking.message}</Text>
                          <Text style={styles.metaLine}>
                            {i18n.t("provider_mobile.schedule.tracking.progress", {
                              percent: tracking.progressPercent
                            })}
                            {tracking.remainingDistanceMiles !== undefined
                              ? i18n.t("provider_mobile.schedule.tracking.distance_left", {
                                  miles: tracking.remainingDistanceMiles
                                })
                              : i18n.t("provider_mobile.schedule.tracking.waiting_for_route")}
                          </Text>
                          <Text style={styles.metaLine}>
                            {tracking.source === "provider-device"
                              ? tracking.isLiveLocationStale
                                ? i18n.t("provider_mobile.schedule.tracking.location_paused")
                                : tracking.liveUpdatedAt
                                  ? i18n.t("provider_mobile.schedule.tracking.live_updated", {
                                      time: i18n.formatDate(tracking.liveUpdatedAt, { timeStyle: "short" })
                                    })
                                  : i18n.t("provider_mobile.schedule.tracking.live_location")
                              : i18n.t("provider_mobile.schedule.tracking.estimated")}
                          </Text>
                          {tracking.activeRouteStop ? (
                            <Text style={styles.metaLine}>
                              {i18n.t("provider_mobile.schedule.tracking.interim_stop", {
                                stop: tracking.activeRouteStop.label
                              })}
                              {tracking.etaToCurrentLegMinutes
                                ? i18n.t("provider_mobile.schedule.tracking.eta_to_stop_suffix", {
                                    count: tracking.etaToCurrentLegMinutes
                                  })
                                : ""}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                      {job.onRouteConfirmedAt && activeBookingId === job.bookingId ? (
                        <View style={styles.chatStack}>
                          {(chatThread?.messages ?? []).map((message) => (
                            <View key={message.id} style={styles.chatBubble}>
                              <Text style={styles.clientLabel}>
                                {message.senderRole === "provider" ? i18n.t("provider_mobile.schedule.chat.you") : job.customerName}
                              </Text>
                              <Text style={styles.metaLine}>{message.body}</Text>
                            </View>
                          ))}
                          <Text style={styles.metaLine}>{i18n.t("chat.safety_notice")}</Text>
                          <TextInput
                            multiline
                            onChangeText={setChatDraft}
                            placeholder={i18n.t("provider_mobile.schedule.chat.placeholder")}
                            placeholderTextColor={BrandTokens.colors.muted}
                            style={styles.input}
                            value={chatDraft}
                          />
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void sendCustomerChat(job.bookingId)}
                            style={styles.submitButton}
                          >
                            <Text style={styles.submitButtonLabel}>
                              {isWorking ? i18n.t("mobile.support.sending") : i18n.t("provider_mobile.schedule.chat.send_message")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                </View>
              );
            })}
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
  routeFocusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: BrandTokens.spacing.sm
  },
  routeFocusCopy: {
    flex: 1,
    gap: 2
  },
  routeFocusPill: {
    borderRadius: 999,
    backgroundColor: "rgba(47, 125, 76, 0.12)",
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: BrandTokens.spacing.sm,
    paddingVertical: 6,
    textTransform: "uppercase"
  },
  routePath: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  routePathStep: {
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
  routePathStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  routePathStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  routePathStep_pending: {
    opacity: 0.82
  },
  routePathIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  routePathIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  routePathIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  routePathIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  routePathIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  routePathIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  routePathIndexLabel_current: {
    color: "#ffffff"
  },
  routePathIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  routePathCopy: {
    flex: 1,
    gap: 2
  },
  routePathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  routePathValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  routeFocusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  routeFocusItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  routeFocusActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.md
  },
  routeFocusPrimaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  routeFocusPrimaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  dispatchCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs,
    backgroundColor: "rgba(245,252,247,0.98)"
  },
  dispatchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: BrandTokens.spacing.sm
  },
  dispatchStatus: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  windowList: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.xs
  },
  windowCard: {
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: BrandTokens.spacing.sm,
    gap: 2
  },
  dayCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  dayLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  timeLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  clientLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  metaLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  warningLine: {
    color: "#a03838",
    lineHeight: 20,
    fontWeight: "600"
  },
  statusLine: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  jobRow: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.94)",
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  jobCopy: {
    gap: BrandTokens.spacing.xs
  },
  jobSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
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
  matchList: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.xs
  },
  managePanel: {
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: BrandTokens.spacing.md,
    marginTop: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.md
  },
  completeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  completeButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  chatButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  chatButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chatStack: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  proofTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  customerPhotoPanel: {
    gap: BrandTokens.spacing.xs,
    marginTop: BrandTokens.spacing.sm,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.md
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  photoTile: {
    width: 112,
    gap: BrandTokens.spacing.xs
  },
  photoImage: {
    width: 112,
    height: 88,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.border
  },
  photoLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    textTransform: "capitalize"
  },
  trackingCard: {
    gap: BrandTokens.spacing.xs,
    marginTop: BrandTokens.spacing.sm,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.md
  },
  chatBubble: {
    gap: BrandTokens.spacing.xs
  },
  input: {
    minHeight: 92,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: BrandTokens.spacing.md,
    color: BrandTokens.colors.ink,
    textAlignVertical: "top"
  },
  multilineInput: {
    minHeight: 108
  },
  assistantStack: {
    gap: BrandTokens.spacing.md
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  presetButton: {
    flexGrow: 1,
    minWidth: "47%",
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    gap: BrandTokens.spacing.xs,
    padding: BrandTokens.spacing.md
  },
  presetButtonActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.surface
  },
  presetLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    lineHeight: 20
  },
  presetLabelActive: {
    color: BrandTokens.colors.primaryStrong
  },
  presetDetail: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18
  },
  presetDetailActive: {
    color: BrandTokens.colors.ink
  },
  sectionLabel: {
    color: BrandTokens.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.xs
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  secondaryButtonDisabled: {
    opacity: 0.56
  },
  ticketStack: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: BrandTokens.spacing.sm,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: BrandTokens.spacing.sm
  },
  ticketCopy: {
    flex: 1,
    gap: 2
  },
  valueText: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
