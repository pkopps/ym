import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  BookingArrivalTracking,
  CustomerProviderConversationThread,
  formatBookingWindowSummary,
  getExternalCalendarBlockLabel,
  getBookingExceptionLabel,
  ProviderAssistantCommandResponse,
  ProviderCalendarOverviewResponse,
  ProviderStaffingOverview
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

type ViewMode = "calendar" | "list";
type RouteStepStatus = "complete" | "current" | "pending";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatMinutesAsHours(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}

function formatRouteStatusLabel(status: "comfortable" | "watch" | "overloaded") {
  switch (status) {
    case "comfortable":
      return "Balanced";
    case "watch":
      return "Watch closely";
    case "overloaded":
      return "Overloaded";
  }
}

function formatCrewRecommendationLabel(label?: "best-fit" | "good-fit" | "backup") {
  switch (label) {
    case "best-fit":
      return "Best fit";
    case "good-fit":
      return "Good fit";
    case "backup":
      return "Backup";
    default:
      return "";
  }
}

type ProviderJobSummary = ProviderStaffingOverview["jobs"][number];
type ProviderJobPrimaryAction = "confirm" | "start-route" | "start-work" | "complete";

function formatServiceCategoryLabel(category: string) {
  return category.replaceAll("-", " ");
}

function getRouteStepStatus(stepIndex: number, activeStepIndex: number): RouteStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function getProviderJobStatusLabel(job: ProviderJobSummary) {
  if (job.status === "requested") {
    return "Requested";
  }

  if (job.status === "confirmed" && job.onRouteConfirmedAt) {
    return "On route";
  }

  if (job.status === "confirmed") {
    return "Confirmed";
  }

  if (job.status === "in-progress") {
    return "In progress";
  }

  if (job.status === "disputed") {
    return "Disputed";
  }

  return job.status.replaceAll("-", " ");
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

function getProviderJobActionLabel(job: ProviderJobSummary) {
  const primaryAction = getProviderJobPrimaryAction(job);

  if (primaryAction === "confirm") {
    return "Confirm";
  }

  if (hasCrewDecisionPending(job)) {
    return "Staff";
  }

  if (primaryAction === "start-route") {
    return "Start route";
  }

  if (primaryAction === "start-work") {
    return "Start work";
  }

  if (primaryAction === "complete") {
    return "Complete";
  }

  return "Review";
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
  const [showAssistantExamples, setShowAssistantExamples] = useState(false);
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load schedule.");
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
          label: "Confirm",
          value: priorityJob.status === "requested" ? "Needed" : "Done"
        },
        {
          label: "Crew",
          value:
            priorityJob.crewGap > 0
              ? `${priorityJob.crewGap} gap`
              : priorityJob.requiresRouteLeaderAssignment
                ? "Lead"
                : "Ready"
        },
        {
          label: "Route",
          value: priorityJob.onRouteConfirmedAt ? "Live" : formatBookingWindowSummary(priorityJob.scheduledStartIso)
        },
        {
          label: "Finish",
          value: priorityJob.status === "in-progress" ? "Now" : `${priorityJob.afterEvidenceCount} proof`
        }
      ].map((step, index) => ({
        ...step,
        status: getRouteStepStatus(index, priorityJobActiveStepIndex)
      }))
    : [];

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
      setErrorMessage(error instanceof Error ? error.message : "Unable to share live route location.");
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
          "Route is live. Turn on location access for live customer map updates, or YardMatch will keep using estimated tracking."
        );
        return;
      }

      routeSharingBookingIdRef.current = bookingId;
      setStatusMessage("Sharing your live route with the customer now.");

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
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
        "Route is live, but we could not start live location sharing. Customers will still see estimated tracking."
      );
      setErrorMessage(error instanceof Error ? error.message : "Unable to start live route sharing.");
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
      setStatusMessage("Job marked complete.");
      setActiveBookingId(undefined);
      setChatThread(undefined);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete that job.");
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
      setStatusMessage(action === "accept" ? "Crew member accepted." : "Crew member declined.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that crew match.");
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
        crewMemberId ? "Crew route leader assigned." : "Explicit crew route leader cleared."
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that route leader.");
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
      setStatusMessage("Booking confirmed.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to confirm that booking.");
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
      setStatusMessage("Booking declined. The customer can choose another provider.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to decline that booking.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to open customer chat.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to send customer message.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to open arrival tracking.");
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
      setStatusMessage("Route started. Asking for live location so the customer can track your arrival.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the route.");
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
      setStatusMessage("Work started.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start work.");
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
      setStatusMessage("Customer updated about the delay.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the delay update.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to run the provider assistant.");
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
      setStatusMessage(`${getBookingExceptionLabel(exceptionType)} shared with the customer.`);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log that issue.");
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
        setErrorMessage("Camera access is required to capture service photos.");
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
      const mimeType = asset.mimeType ?? "image/jpeg";
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId,
        phase,
        imageDataUrl: `data:${mimeType};base64,${asset.base64}`
      });
      setStatusMessage(
        phase === "before" ? "Before photo saved to the job record." : "After photo saved to the job record."
      );
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to capture that service photo.");
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
      setErrorMessage("Add a short onsite note before saving it.");
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
      setStatusMessage(phase === "before" ? "Before-work note saved." : "After-work note saved.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that onsite note.");
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
            { label: "Access path confirmed", completed: true },
            { label: "Equipment staged", completed: true },
            { label: "Service scope reviewed", completed: true }
          ]
        : [
            { label: "Primary service completed", completed: true },
            { label: "Debris cleared", completed: true },
            { label: "Property secured", completed: true }
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
      setStatusMessage(phase === "before" ? "Arrival checklist saved." : "Completion checklist saved.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that checklist.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Schedule" title="Schedule" description="Open the next job or make a route change.">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "calendar"} label="Calendar" onPress={() => setViewMode("calendar")} />
        <ModeButton active={viewMode === "list"} label="List" onPress={() => setViewMode("list")} />
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {priorityJob ? (
        <InfoCard title="Today path" description={getProviderJobActionLabel(priorityJob)}>
          <View style={styles.routeFocusHeader}>
            <View style={styles.routeFocusCopy}>
              <Text style={styles.clientLabel}>{priorityJob.customerName}</Text>
              <Text style={styles.metaLine}>{priorityJob.serviceAddress.line1}</Text>
            </View>
            <Text style={styles.routeFocusPill}>{getProviderJobStatusLabel(priorityJob)}</Text>
          </View>
          <View style={styles.routePath} accessibilityLabel="Route progress">
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
              <Text style={styles.jobSummaryLabel}>Window</Text>
              <Text style={styles.jobSummaryValue}>{formatBookingWindowSummary(priorityJob.scheduledStartIso)}</Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>Crew</Text>
              <Text style={styles.jobSummaryValue}>
                {priorityJob.assignedCrewMembers}/{priorityJob.requiredCrewMembers}
                {priorityJob.crewGap ? ` • gap ${priorityJob.crewGap}` : ""}
              </Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>Service</Text>
              <Text style={styles.jobSummaryValue}>{formatServiceCategoryLabel(priorityJob.category)}</Text>
            </View>
            <View style={styles.routeFocusItem}>
              <Text style={styles.jobSummaryLabel}>Next</Text>
              <Text style={styles.jobSummaryValue}>{getProviderJobActionLabel(priorityJob)}</Text>
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
                  {isWorking ? "Working..." : "Confirm booking"}
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
                <Text style={styles.routeFocusPrimaryButtonLabel}>Manage staffing</Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "start-route" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void startRoute(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>{isWorking ? "Working..." : "Start route"}</Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "start-work" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void startWork(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>{isWorking ? "Working..." : "Start work"}</Text>
              </Pressable>
            ) : null}
            {!priorityJobNeedsStaffing && priorityJobPrimaryAction === "complete" ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void completeJob(priorityJob.bookingId)}
                style={styles.routeFocusPrimaryButton}
              >
                <Text style={styles.routeFocusPrimaryButtonLabel}>{isWorking ? "Working..." : "Complete job"}</Text>
              </Pressable>
            ) : null}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="Today path" description="No scheduled jobs">
          <Text style={styles.metaLine}>Calendar and route tools are ready when work is booked.</Text>
        </InfoCard>
      )}

      <InfoCard title="Route tools" description={showAssistantTools ? "Make a route change" : "Use when plans change"}>
        <Pressable onPress={() => setShowAssistantTools((current) => !current)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>
            {showAssistantTools ? "Hide tools" : "Open tools"}
          </Text>
        </Pressable>
        {showAssistantTools ? (
          <View style={styles.assistantStack}>
            <Text style={styles.metaLine}>Move a job, check staffing, or notify a customer.</Text>
            <Pressable onPress={() => setShowAssistantExamples((current) => !current)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {showAssistantExamples ? "Hide examples" : "Examples"}
              </Text>
            </Pressable>
            {showAssistantExamples ? (
              <View style={styles.ticketStack}>
                <Text style={styles.meta}>What needs attention tomorrow?</Text>
                <Text style={styles.meta}>Do I need more crew tomorrow?</Text>
                <Text style={styles.meta}>Change my afternoon appointment to evening and notify the customer.</Text>
                <Text style={styles.meta}>Tell my afternoon customer I am 30 minutes late.</Text>
                <Text style={styles.meta}>Start route for my afternoon appointment.</Text>
                <Text style={styles.meta}>Complete my afternoon appointment.</Text>
              </View>
            ) : null}
            <TextInput
              value={assistantCommand}
              onChangeText={setAssistantCommand}
              placeholder="Type a route change"
              placeholderTextColor={BrandTokens.colors.inkSoft}
              style={[styles.input, styles.multilineInput]}
              multiline
            />
            {selectedAssistantBookingId ? (
              <Text style={styles.metaLine}>Selected booking: {selectedAssistantBookingId}</Text>
            ) : null}
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || assistantCommand.trim().length === 0}
                onPress={() => void runProviderAssistant(false)}
                style={[styles.secondaryButton, assistantCommand.trim().length === 0 && styles.secondaryButtonDisabled]}
              >
                <Text style={styles.secondaryButtonLabel}>Review plan</Text>
              </Pressable>
              <Pressable
                disabled={isWorking || !assistantResult?.requiresConfirmation}
                onPress={() => void runProviderAssistant(true)}
                style={[styles.secondaryButton, !assistantResult?.requiresConfirmation && styles.secondaryButtonDisabled]}
              >
                <Text style={styles.secondaryButtonLabel}>Apply change</Text>
              </Pressable>
            </View>
            {assistantResult ? (
              <View style={styles.ticketStack}>
                <Text style={styles.valueText}>{assistantResult.previewLabel}</Text>
                <Text style={styles.meta}>{assistantResult.previewMessage}</Text>
                {assistantResult.actionTypes && assistantResult.actionTypes.length > 1 ? (
                  <Text style={styles.meta}>Planned steps: {assistantResult.actionTypes.join(" -> ")}</Text>
                ) : null}
                {assistantResult.targetWindowLabel ? (
                  <Text style={styles.meta}>Target window: {assistantResult.targetWindowLabel}</Text>
                ) : null}
                {assistantResult.lateEtaIso ? (
                  <Text style={styles.meta}>
                    New ETA: {new Date(assistantResult.lateEtaIso).toLocaleTimeString([], { timeStyle: "short" })}
                  </Text>
                ) : null}
                {assistantResult.dispatchDaySummary ? (
                  <Text style={styles.meta}>
                    Route: {assistantResult.dispatchDaySummary.routeStatus} • Jobs:{" "}
                    {assistantResult.dispatchDaySummary.yardmatchJobCount} • Crew gap:{" "}
                    {assistantResult.dispatchDaySummary.crewGap} • Drive miles:{" "}
                    {assistantResult.dispatchDaySummary.estimatedDriveMiles.toFixed(1)}
                  </Text>
                ) : null}
                {assistantResult.dispatchRangeSummary ? (
                  <Text style={styles.meta}>
                    Active days: {assistantResult.dispatchRangeSummary.activeDayCount} • Watch:{" "}
                    {assistantResult.dispatchRangeSummary.watchDayCount} • Overloaded:{" "}
                    {assistantResult.dispatchRangeSummary.overloadedDayCount} • Total crew gap:{" "}
                    {assistantResult.dispatchRangeSummary.totalCrewGap}
                  </Text>
                ) : null}
                {assistantResult.dispatchWindowSummary ? (
                  <Text style={styles.meta}>
                    Focus window: {assistantResult.dispatchWindowSummary.label} • Jobs:{" "}
                    {assistantResult.dispatchWindowSummary.yardmatchJobCount} • Crew gap:{" "}
                    {assistantResult.dispatchWindowSummary.crewGap} • Blocked minutes:{" "}
                    {assistantResult.dispatchWindowSummary.blockedMinutes}
                  </Text>
                ) : null}
                {assistantResult.customerNotificationPreview ? (
                  <Text style={styles.meta}>{assistantResult.customerNotificationPreview}</Text>
                ) : null}
                {assistantResult.bookingCandidates.length > 0 ? (
                  <Text style={styles.meta}>
                    {assistantResult.actionType === "summarize-dispatch"
                      ? "Appointments in that focus area:"
                      : assistantResult.actionType === "recommend-dispatch-adjustment"
                        ? "Appointments in the pressured window:"
                        : assistantResult.actionType === "recommend-staffing-adjustment"
                          ? "Bookings that need more crew:"
                          : "Matching appointments:"}
                  </Text>
                ) : null}
                {assistantResult.bookingCandidates.map((candidate) => (
                  <View key={candidate.bookingId} style={styles.ticketRow}>
                    <View style={styles.ticketCopy}>
                      <Text style={styles.valueText}>{candidate.customerName}</Text>
                      <Text style={styles.meta}>
                        {candidate.currentWindowLabel} • {new Date(candidate.scheduledStartIso).toLocaleString()}
                      </Text>
                      <Text style={styles.meta}>{candidate.addressLine}</Text>
                    </View>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => setSelectedAssistantBookingId(candidate.bookingId)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>Use</Text>
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
          title="Week view"
          description={`${calendarOverview?.yardmatchJobCount ?? jobs.length} YardMatch jobs • ${calendarOverview?.externalBlockCount ?? 0} outside blocks`}
        >
          <View style={styles.list}>
            {calendarOverview?.dispatchDays?.map((day) => (
              <View key={day.dateIso} style={styles.dispatchCard}>
                <View style={styles.dispatchHeader}>
                  <Text style={styles.clientLabel}>{day.dayLabel}</Text>
                  <Text style={styles.dispatchStatus}>{formatRouteStatusLabel(day.routeStatus)}</Text>
                </View>
                <Text style={styles.metaLine}>
                  {day.yardmatchJobCount} jobs • {day.totalCrewAssigned}/{day.totalCrewRequired} crew •{" "}
                  {day.estimatedDriveMiles} mi
                </Text>
                <Text style={styles.metaLine}>
                  Longest leg {day.longestDriveLegMiles} mi
                  {day.largestIdleGapMinutes ? ` • Longest idle gap ${formatMinutesAsHours(day.largestIdleGapMinutes)}` : ""}
                  {day.outlierStopCount ? ` • ${day.outlierStopCount} outlier stop${day.outlierStopCount === 1 ? "" : "s"}` : ""}
                </Text>
                <Text style={styles.metaLine}>
                  {formatMinutesAsHours(day.bookedMinutes)} booked
                  {day.externalBlockCount ? ` • ${formatMinutesAsHours(day.blockedMinutes)} outside blocks` : ""}
                </Text>
                {day.firstStopAddressLine ? (
                  <Text style={styles.metaLine}>First stop: {day.firstStopAddressLine}</Text>
                ) : null}
                <View style={styles.windowList}>
                  {day.windowSummaries.map((window) => (
                    <View key={`${day.dateIso}-${window.windowKey}`} style={styles.windowCard}>
                      <Text style={styles.timeLabel}>{window.label}</Text>
                      <Text style={styles.metaLine}>
                        {window.yardmatchJobCount} jobs • {window.totalCrewAssigned}/{window.totalCrewRequired} crew
                        {window.crewGap ? ` • gap ${window.crewGap}` : ""}
                      </Text>
                      <Text style={styles.metaLine}>
                        {window.externalBlockCount
                          ? `${window.externalBlockCount} outside blocks • ${formatMinutesAsHours(window.blockedMinutes)}`
                          : `${formatMinutesAsHours(window.bookedMinutes)} booked`}
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
                  {new Date(event.startIso).toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={styles.timeLabel}>
                  {formatBookingWindowSummary(event.startIso)}
                </Text>
                <Text style={styles.clientLabel}>{event.title}</Text>
                <Text style={styles.metaLine}>
                  {event.source === "yardmatch-booking"
                    ? `${event.customerName ?? "Customer"} • ${event.status?.replaceAll("-", " ")}`
                    : `${getExternalCalendarBlockLabel(event.blockType ?? "off-platform-client")} • Outside block`}
                </Text>
                {event.addressLine ? <Text style={styles.metaLine}>{event.addressLine}</Text> : null}
                {event.notes ? <Text style={styles.metaLine}>{event.notes}</Text> : null}
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="Job list" description={`${jobs.length} scheduled`}>
          <View style={styles.list}>
            {jobs.map((job) => {
              const isManageOpen = expandedManageSections[job.bookingId];
              const primaryAction = getProviderJobPrimaryAction(job);
              const statusLabel = getProviderJobStatusLabel(job);

              return (
                <View key={job.bookingId} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.clientLabel}>{job.customerName}</Text>
                  <Text style={styles.metaLine}>{job.serviceAddress.line1}</Text>
                  <Text style={styles.statusLine}>{statusLabel}</Text>
                  <View style={styles.jobSummaryGrid}>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>Window</Text>
                      <Text style={styles.jobSummaryValue}>{formatBookingWindowSummary(job.scheduledStartIso)}</Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>Crew</Text>
                      <Text style={styles.jobSummaryValue}>
                        {job.assignedCrewMembers}/{job.requiredCrewMembers}
                        {job.crewGap ? ` • gap ${job.crewGap}` : ""}
                      </Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>Proof</Text>
                      <Text style={styles.jobSummaryValue}>
                        {job.beforeEvidenceCount} before • {job.afterEvidenceCount} after
                      </Text>
                    </View>
                    <View style={styles.jobSummaryItem}>
                      <Text style={styles.jobSummaryLabel}>Total</Text>
                      <Text style={styles.jobSummaryValue}>{formatCurrency(job.totalCents)}</Text>
                    </View>
                  </View>
                  <Text style={styles.metaLine}>{formatServiceCategoryLabel(job.category)}</Text>
                  {overview?.provider.routeLeaderMode === "accepted-crew-fallback" ? (
                    <Text style={styles.metaLine}>
                      Route leader: {job.assignedRouteLeaderCrewMemberName ?? "Provider"}
                      {job.requiresRouteLeaderAssignment ? " • pick one accepted crew member before delegating" : ""}
                    </Text>
                  ) : null}
                  {job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>Route is live. Customer chat is open.</Text>
                  ) : null}
                  {job.lateEtaIso && !job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>
                      Delay notice sent for{" "}
                      {new Date(job.lateEtaIso).toLocaleTimeString(undefined, { timeStyle: "short" })}.
                    </Text>
                  ) : null}
                  {job.activeExceptionType ? (
                    <Text style={styles.metaLine}>
                      {getBookingExceptionLabel(job.activeExceptionType)}
                      {job.activeExceptionNotes ? ` • ${job.activeExceptionNotes}` : ""}
                    </Text>
                  ) : null}
                  {job.status === "disputed" ? (
                    <Text style={styles.metaLine}>
                      Disputed{job.disputeReason ? ` • ${job.disputeReason}` : ""}
                    </Text>
                  ) : null}
                  <View style={styles.actionRow}>
                    {primaryAction === "confirm" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void confirmJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Confirm booking"}</Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "start-route" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startRoute(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Start route"}</Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "start-work" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startWork(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Start work"}</Text>
                      </Pressable>
                    ) : null}
                    {primaryAction === "complete" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void completeJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Complete job"}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      setExpandedManageSections((current) => ({
                        ...current,
                        [job.bookingId]: !current[job.bookingId]
                      }))
                    }
                    style={styles.chatButton}
                  >
                    <Text style={styles.chatButtonLabel}>{isManageOpen ? "Hide" : "Manage"}</Text>
                  </Pressable>
                  {isManageOpen ? (
                    <View style={styles.managePanel}>
                      <View style={styles.actionRow}>
                        {job.status === "requested" ? (
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void declineJob(job.bookingId)}
                            style={styles.chatButton}
                          >
                            <Text style={styles.chatButtonLabel}>{isWorking ? "Working..." : "Decline request"}</Text>
                          </Pressable>
                        ) : null}
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
                            {expandedStaffingSections[job.bookingId] ? "Hide staffing" : "Staffing"}
                          </Text>
                        </Pressable>
                        {job.status === "confirmed" || job.status === "in-progress" ? (
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
                              {expandedProofSections[job.bookingId] ? "Hide proof" : "Proof"}
                            </Text>
                          </Pressable>
                        ) : null}
                        {job.status === "confirmed" || job.status === "in-progress" ? (
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
                              {expandedIssueSections[job.bookingId] ? "Hide issues" : "Issue"}
                            </Text>
                          </Pressable>
                        ) : null}
                        {job.onRouteConfirmedAt ? (
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
                              {expandedCustomerSections[job.bookingId] ? "Hide customer" : "Customer"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {isManageOpen && expandedStaffingSections[job.bookingId] ? (
                  <View style={styles.matchList}>
                    {job.requiresRouteLeaderAssignment ? (
                      <View style={styles.windowCard}>
                        <Text style={styles.clientLabel}>Route leader still needs assignment</Text>
                        <Text style={styles.metaLine}>
                          More than one accepted crew member is on this job. Pick who should start and share the route, or keep the route under provider control.
                        </Text>
                      </View>
                    ) : null}
                    {job.matches.length === 0 ? (
                      <View style={styles.windowCard}>
                        <Text style={styles.clientLabel}>No matched crew yet</Text>
                        <Text style={styles.metaLine}>
                          As more crew availability comes in, matched candidates will appear here.
                        </Text>
                      </View>
                    ) : (
                      job.matches.map((match) => (
                        <View key={match.id} style={styles.windowCard}>
                          <Text style={styles.clientLabel}>{match.crewMemberName}</Text>
                          <Text style={styles.metaLine}>
                            {match.distanceMiles} miles away • {match.preferredSchedule} •{" "}
                            {match.availableWeekdays.join(", ")}
                          </Text>
                          {match.recommendationLabel ? (
                            <Text style={styles.metaLine}>
                              {formatCrewRecommendationLabel(match.recommendationLabel)}
                              {typeof match.recommendationScore === "number"
                                ? ` • score ${match.recommendationScore}`
                                : ""}
                            </Text>
                          ) : null}
                          {match.recommendationReasons?.length ? (
                            <Text style={styles.metaLine}>{match.recommendationReasons.join(" • ")}</Text>
                          ) : null}
                          {match.status === "cancelled-by-crew" && match.cancellationReason ? (
                            <Text style={styles.warningLine}>Crew note: {match.cancellationReason}</Text>
                          ) : null}
                          {match.status === "accepted" && job.assignedRouteLeaderCrewMemberId === match.crewMemberId ? (
                            <Text style={styles.metaLine}>Assigned route leader for this job.</Text>
                          ) : null}
                          <Text style={styles.metaLine}>{match.status.replaceAll("-", " ")}</Text>
                          <Text style={styles.metaLine}>{formatCurrency(match.hourlyRateCents)}/hr</Text>
                          {match.status === "pending-provider-review" ? (
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={isWorking}
                                onPress={() => void handleReviewMatch(match.id, "accept")}
                                style={styles.completeButton}
                              >
                                <Text style={styles.completeButtonLabel}>
                                  {isWorking ? "Working..." : "Accept"}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={isWorking}
                                onPress={() => void handleReviewMatch(match.id, "deny")}
                                style={styles.chatButton}
                              >
                                <Text style={styles.chatButtonLabel}>Deny</Text>
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
                                  ? "Assigned route leader"
                                  : "Lead this route"}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                  ) : null}
                  {isManageOpen &&
                  expandedStaffingSections[job.bookingId] &&
                  overview?.provider.routeLeaderMode === "accepted-crew-fallback" &&
                  job.assignedRouteLeaderCrewMemberId &&
                  !job.onRouteConfirmedAt ? (
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void assignRouteLeader(job.bookingId)}
                      style={styles.chatButton}
                    >
                      <Text style={styles.chatButtonLabel}>Clear explicit route leader</Text>
                    </Pressable>
                  ) : null}
                  {isManageOpen && expandedProofSections[job.bookingId] ? (
                    <View style={styles.ticketStack}>
                      <TextInput
                        multiline
                        onChangeText={(value) =>
                          setEvidenceNoteDrafts((current) => ({
                            ...current,
                            [`${job.bookingId}:before`]: value
                          }))
                        }
                        placeholder="Add a before-work note for ops and disputes."
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
                            {job.beforeEvidenceCount > 0 ? "Add before photo" : "Capture before photo"}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void saveEvidenceNote(job.bookingId, "before")}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Save before note</Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void saveEvidenceChecklist(job.bookingId, "before")}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Save arrival checklist</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        multiline
                        onChangeText={(value) =>
                          setEvidenceNoteDrafts((current) => ({
                            ...current,
                            [`${job.bookingId}:after`]: value
                          }))
                        }
                        placeholder="Add an after-work note for ops and disputes."
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
                            {job.afterEvidenceCount > 0 ? "Add after photo" : "Capture after photo"}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void saveEvidenceNote(job.bookingId, "after")}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Save after note</Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void saveEvidenceChecklist(job.bookingId, "after")}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Save completion checklist</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {isManageOpen && expandedIssueSections[job.bookingId] ? (
                    <View style={styles.actionRow}>
                      {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void reportIssue(
                              job.bookingId,
                              "customer-no-show",
                              "The customer did not appear for the scheduled service window."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Customer no-show</Text>
                        </Pressable>
                      ) : null}
                      {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void markLate(
                              job.bookingId,
                              buildLateEta(job.scheduledStartIso, 15),
                              "Running about 15 minutes behind the route."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>+15 min</Text>
                        </Pressable>
                      ) : null}
                      {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void markLate(
                              job.bookingId,
                              buildLateEta(job.scheduledStartIso, 30),
                              "Running about 30 minutes behind the route."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>+30 min</Text>
                        </Pressable>
                      ) : null}
                      {(job.status === "confirmed" || job.status === "in-progress") ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void reportIssue(
                              job.bookingId,
                              "customer-not-ready",
                              "The property owner is not ready for the scheduled service."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Customer not ready</Text>
                        </Pressable>
                      ) : null}
                      {(job.status === "confirmed" || job.status === "in-progress") ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void reportIssue(
                              job.bookingId,
                              "unable-to-access-property",
                              "The crew could not safely access the property as scheduled."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>No access</Text>
                        </Pressable>
                      ) : null}
                      {job.status === "in-progress" ? (
                        <Pressable
                          disabled={isWorking}
                          onPress={() =>
                            void reportIssue(
                              job.bookingId,
                              "service-could-not-be-completed",
                              "The service could not be completed during this visit."
                            )
                          }
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Could not complete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {isManageOpen && expandedCustomerSections[job.bookingId] ? (
                    <View style={styles.chatStack}>
                      <View style={styles.actionRow}>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openCustomerChat(job.bookingId)}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Message customer</Text>
                        </Pressable>
                        <Pressable
                          disabled={isWorking}
                          onPress={() => void openArrivalTracking(job.bookingId)}
                          style={styles.chatButton}
                        >
                          <Text style={styles.chatButtonLabel}>Track crew</Text>
                        </Pressable>
                      </View>
                      {job.onRouteConfirmedAt &&
                      activeTrackingBookingId === job.bookingId &&
                      tracking ? (
                        <View style={styles.trackingCard}>
                          <Text style={styles.clientLabel}>
                            {tracking.etaMinutes ? `${tracking.etaMinutes} min away` : "At the property"}
                          </Text>
                          <Text style={styles.metaLine}>{tracking.message}</Text>
                          <Text style={styles.metaLine}>
                            {tracking.progressPercent}% complete •{" "}
                            {tracking.remainingDistanceMiles !== undefined
                              ? `${tracking.remainingDistanceMiles.toFixed(1)} miles left`
                              : "Waiting for route"}
                          </Text>
                          <Text style={styles.metaLine}>
                            {tracking.source === "provider-device"
                              ? tracking.isLiveLocationStale
                                ? "Live location paused a few minutes ago."
                                : `Live provider location${
                                    tracking.liveUpdatedAt
                                      ? ` • updated ${new Date(tracking.liveUpdatedAt).toLocaleTimeString(undefined, {
                                          timeStyle: "short"
                                        })}`
                                      : ""
                                  }`
                              : "Estimated route from provider base"}
                          </Text>
                          {tracking.activeRouteStop ? (
                            <Text style={styles.metaLine}>
                              Interim stop: {tracking.activeRouteStop.label}
                              {tracking.etaToCurrentLegMinutes
                                ? ` • ${tracking.etaToCurrentLegMinutes} min to stop`
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
                                {message.senderRole === "provider" ? "You" : job.customerName}
                              </Text>
                              <Text style={styles.metaLine}>{message.body}</Text>
                            </View>
                          ))}
                          <TextInput
                            multiline
                            onChangeText={setChatDraft}
                            placeholder="Message the property owner."
                            placeholderTextColor={BrandTokens.colors.muted}
                            style={styles.input}
                            value={chatDraft}
                          />
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void sendCustomerChat(job.bookingId)}
                            style={styles.submitButton}
                          >
                            <Text style={styles.submitButtonLabel}>{isWorking ? "Sending..." : "Send message"}</Text>
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
