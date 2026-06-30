"use client";

import {
  BookingArrivalTracking,
  CreateExternalCalendarImportRequest,
  CustomerProviderConversationThread,
  ExternalCalendarBlock,
  ExternalCalendarBlockType,
  ExternalCalendarProvider,
  formatBookingWindowSummary,
  getExternalCalendarBlockLabel,
  getBookingExceptionLabel,
  ProviderAssistantCommandResponse,
  ProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  ProviderProfile,
  ProviderCalendarSubscriptionResponse,
  ProviderStaffingOverview,
  ServiceCategory
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { ArrivalTrackingPanel } from "./ArrivalTrackingPanel";
import { FloatingChatWindow } from "./FloatingChatWindow";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildLateEta(bookingIso: string, minutes: number) {
  return new Date(new Date(bookingIso).getTime() + minutes * 60_000).toISOString();
}

function formatLocalInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatMinutesAsHours(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}

function formatWeekdayLabel(weekday: ProviderProfile["weeklyPayoutDay"]) {
  const map: Record<ProviderProfile["weeklyPayoutDay"], string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday"
  };

  return map[weekday];
}

function formatMinimumLeadHoursLabel(hours: number) {
  if (hours <= 0) {
    return "No minimum";
  }

  return hours === 1 ? "1 hour" : `${hours} hours`;
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

function formatCalendarHealthLabel(status: "healthy" | "attention" | "at-risk") {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "attention":
      return "Needs attention";
    case "at-risk":
      return "At risk";
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
      return undefined;
  }
}

function formatVerificationChecklistStatus(status: "ready" | "review" | "missing") {
  switch (status) {
    case "ready":
      return "Ready";
    case "review":
      return "Review";
    case "missing":
      return "Needs update";
  }
}

type ProviderJobSummary = ProviderStaffingOverview["jobs"][number];
type ProviderJobPrimaryAction = "confirm" | "start-route" | "start-work" | "complete";
type ProviderRouteStepStatus = "complete" | "current" | "pending";

function formatServiceCategoryLabel(category: string) {
  return category.replaceAll("-", " ");
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

function getProviderRouteStepStatus(stepIndex: number, activeStepIndex: number): ProviderRouteStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
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

const externalCalendarBlockOptions: ExternalCalendarBlockType[] = [
  "off-platform-client",
  "personal-time",
  "travel-buffer",
  "equipment-maintenance"
];
const externalCalendarImportProviders: ExternalCalendarProvider[] = ["google", "apple", "ical"];
const providerCategoryOptions: Array<{ value: ServiceCategory; label: string }> = [
  { value: "lawn-mowing", label: "Lawn mowing" },
  { value: "hedge-trimming", label: "Hedge trimming" },
  { value: "mulch-installation", label: "Mulch installation" },
  { value: "seasonal-cleanup", label: "Seasonal cleanup" },
  { value: "weed-control", label: "Weed control" },
  { value: "irrigation-check", label: "Irrigation check" },
  { value: "leaf-blowing", label: "Leaf blowing" }
];

export function ProviderLiveManagementBoard() {
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [activeCustomerThread, setActiveCustomerThread] = useState<
    CustomerProviderConversationThread | undefined
  >();
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [activeTracking, setActiveTracking] = useState<BookingArrivalTracking | undefined>();
  const [calendarOverview, setCalendarOverview] = useState<ProviderCalendarOverviewResponse | undefined>();
  const [calendarSubscription, setCalendarSubscription] = useState<
    ProviderCalendarSubscriptionResponse | undefined
  >();
  const [calendarImports, setCalendarImports] = useState<ProviderCalendarImportsResponse | undefined>();
  const [blockTitle, setBlockTitle] = useState("Off-platform client");
  const [blockType, setBlockType] = useState<ExternalCalendarBlockType>("off-platform-client");
  const [importTitle, setImportTitle] = useState("Google Calendar - Outside work");
  const [importProvider, setImportProvider] = useState<ExternalCalendarProvider>("google");
  const [importFeedUrl, setImportFeedUrl] = useState("");
  const [blockStartLocal, setBlockStartLocal] = useState(() =>
    formatLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [blockEndLocal, setBlockEndLocal] = useState(() =>
    formatLocalInputValue(new Date(Date.now() + 26 * 60 * 60 * 1000))
  );
  const [blockNotes, setBlockNotes] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [assistantCommand, setAssistantCommand] = useState(
    "Change my afternoon appointment to evening and notify the customer"
  );
  const [assistantResult, setAssistantResult] = useState<ProviderAssistantCommandResponse | undefined>();
  const [selectedAssistantBookingId, setSelectedAssistantBookingId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [profileCompanyName, setProfileCompanyName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileYearsExperience, setProfileYearsExperience] = useState("1");
  const [profileCategories, setProfileCategories] = useState<ServiceCategory[]>([]);

  const provider = overview?.provider;
  const jobs = overview?.jobs ?? [];
  const dispatchDays = calendarOverview?.dispatchDays ?? [];
  const calendarHealth = calendarOverview?.syncHealth ?? calendarImports?.syncHealth;
  const calendarBlocks = provider?.calendarConnection.externalBlocks ?? [];
  const externalBlockingEnabled = provider?.calendarConnection.externalEventsBlockingEnabled ?? false;
  const totalAssignedCrew = useMemo(
    () => jobs.reduce((sum, job) => sum + job.assignedCrewMembers, 0),
    [jobs]
  );
  const totalCrewGap = useMemo(() => jobs.reduce((sum, job) => sum + job.crewGap, 0), [jobs]);
  const visibleJobs = jobs;
  const priorityJob = useMemo(() => {
    const sortedJobs = [...jobs].sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));
    return sortedJobs.find((job) => Boolean(getProviderJobPrimaryAction(job)) || hasCrewDecisionPending(job)) ?? sortedJobs[0];
  }, [jobs]);
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
        status: getProviderRouteStepStatus(index, priorityJobActiveStepIndex)
      }))
    : [];
  const priorityJobPrimaryAction = priorityJob ? getProviderJobPrimaryAction(priorityJob) : undefined;

  useEffect(() => {
    if (!provider) {
      return;
    }

    setProfileCompanyName(provider.companyName);
    setProfileBio(provider.bio);
    setProfileYearsExperience(String(provider.yearsExperience));
    setProfileCategories(provider.categories);
  }, [provider]);

  async function loadProviderView() {
    if (!session || session.role !== "provider") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
    const api = createAuthenticatedWebApiClient();
    const [nextOverview, nextCalendarSubscription, nextCalendarOverview, nextCalendarImports] = await Promise.all([
      api.getProviderStaffingOverview(),
      api.getProviderCalendarSubscription(),
      api.getProviderCalendarOverview(),
      api.getProviderCalendarImports()
    ]);
    setOverview(nextOverview);
    setCalendarSubscription(nextCalendarSubscription);
    setCalendarOverview(nextCalendarOverview);
    setCalendarImports(nextCalendarImports);
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "provider") {
      setAccessDenied(true);
      return;
    }

    void loadProviderView().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the provider portal.");
    });
  }, [sessionReady, session?.token, session?.role]);

  async function handleReviewMatch(crewMatchId: string, action: "accept" | "deny") {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.reviewCrewMatch({ crewMatchId, action });
      setStatusMessage(action === "accept" ? "Crew member accepted." : "Crew member declined.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update this crew match right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAssignRouteLeader(bookingId: string, crewMemberId?: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.assignBookingRouteLeader({ bookingId, crewMemberId });
      setStatusMessage(
        crewMemberId
          ? "Crew route leader assigned for this job."
          : "Explicit crew route leader cleared for this job."
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the route leader right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStaffingModeChange(staffingMode: "auto-accept" | "review-first") {
    if (!provider) {
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const updatedProvider = await api.updateProviderSettings({
        serviceRadiusMiles: provider.serviceRadiusMiles,
        staffingMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setStatusMessage(
        provider.verificationStatus === "rejected" && updatedProvider.verificationStatus === "pending-review"
          ? "Staffing settings updated and the business is back in verification review."
          : staffingMode === "auto-accept"
            ? "Auto-accept is on for future crew matches."
            : "Provider review is now required before crew is added."
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update staffing mode right now.");
    } finally {
      setIsWorking(false);
    }
  }

  function toggleProfileCategory(category: ServiceCategory, checked: boolean) {
    setProfileCategories((current) =>
      checked ? Array.from(new Set([...current, category])) : current.filter((item) => item !== category)
    );
  }

  async function handleProviderProfileUpdate() {
    if (!provider) {
      return;
    }

    const parsedYearsExperience = Number(profileYearsExperience);
    if (
      !profileCompanyName.trim() ||
      !profileBio.trim() ||
      profileCategories.length === 0 ||
      !Number.isFinite(parsedYearsExperience)
    ) {
      setErrorMessage("Add a company name, business description, and at least one service category.");
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const updatedProvider = await api.updateProviderProfile({
        companyName: profileCompanyName.trim(),
        bio: profileBio.trim(),
        yearsExperience: parsedYearsExperience,
        categories: profileCategories
      });
      setStatusMessage(
        provider.verificationStatus === "rejected" && updatedProvider.verificationStatus === "pending-review"
          ? "Profile updated and automatically sent back into verification review."
          : "Business profile updated."
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the business profile right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDispatchSettingsUpdate(
    updates: Partial<
      Pick<
        ProviderProfile,
        | "serviceRadiusMiles"
        | "minimumBookingLeadHours"
        | "staffingMode"
        | "crewReviewLeadHours"
        | "departureReminderLeadMinutes"
        | "routeLeaderMode"
        | "weeklyPayoutDay"
        | "instantPayoutsEnabled"
      >
    >,
    successMessage: string
  ) {
    if (!provider) {
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const updatedProvider = await api.updateProviderSettings({
        serviceRadiusMiles: updates.serviceRadiusMiles ?? provider.serviceRadiusMiles,
        ...(updates.minimumBookingLeadHours !== undefined
          ? { minimumBookingLeadHours: updates.minimumBookingLeadHours }
          : {}),
        ...(updates.staffingMode !== undefined ? { staffingMode: updates.staffingMode } : {}),
        ...(updates.crewReviewLeadHours !== undefined
          ? { crewReviewLeadHours: updates.crewReviewLeadHours }
          : {}),
        ...(updates.departureReminderLeadMinutes !== undefined
          ? { departureReminderLeadMinutes: updates.departureReminderLeadMinutes }
          : {}),
        ...(updates.routeLeaderMode !== undefined ? { routeLeaderMode: updates.routeLeaderMode } : {}),
        ...(updates.weeklyPayoutDay !== undefined ? { weeklyPayoutDay: updates.weeklyPayoutDay } : {}),
        ...(updates.instantPayoutsEnabled !== undefined
          ? { instantPayoutsEnabled: updates.instantPayoutsEnabled }
          : {}),
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setStatusMessage(
        provider.verificationStatus === "rejected" && updatedProvider.verificationStatus === "pending-review"
          ? `${successMessage} The business is also back in verification review.`
          : successMessage
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update provider controls right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleProviderAssistant(execute: boolean) {
    if (!assistantCommand.trim()) {
      setErrorMessage("Enter a provider assistant command first.");
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
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
        await loadProviderView();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to run the provider assistant right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveCalendarBlockingSettings(nextBlocks: ExternalCalendarBlock[], enabled = externalBlockingEnabled) {
    if (!provider) {
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.updateProviderSettings({
        serviceRadiusMiles: provider.serviceRadiusMiles,
        staffingMode: provider.staffingMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled,
        externalEventsBlockingEnabled: enabled,
        externalCalendarBlocks: nextBlocks
      });
      setStatusMessage(
        enabled
          ? "Outside calendar blocks are now affecting YardMatch availability."
          : "Outside calendar blocks are saved, but they are not affecting YardMatch availability yet."
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update outside calendar blocking right now."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAddCalendarBlock() {
    if (!provider) {
      return;
    }

    const start = new Date(blockStartLocal);
    const end = new Date(blockEndLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setErrorMessage("Choose a valid start and end time for the outside block.");
      return;
    }

    await saveCalendarBlockingSettings(
      [
        ...calendarBlocks,
        {
          id: `manual-block-${Date.now()}`,
          title: blockTitle.trim() || getExternalCalendarBlockLabel(blockType),
          blockType,
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          notes: blockNotes.trim() || undefined,
          source: "manual",
          createdAt: new Date().toISOString()
        }
      ],
      true
    );

    setBlockTitle("Off-platform client");
    setBlockType("off-platform-client");
    setBlockNotes("");
  }

  async function handleRemoveCalendarBlock(blockId: string) {
    await saveCalendarBlockingSettings(calendarBlocks.filter((block) => block.id !== blockId));
  }

  async function handleToggleCalendarBlocking(enabled: boolean) {
    await saveCalendarBlockingSettings(calendarBlocks, enabled);
  }

  async function handleCreateCalendarImport() {
    if (!importTitle.trim() || !importFeedUrl.trim()) {
      setErrorMessage("Add a calendar title and feed URL first.");
      return;
    }

    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextImports = await api.createProviderCalendarImport({
        title: importTitle.trim(),
        provider: importProvider,
        feedUrl: importFeedUrl.trim()
      } satisfies CreateExternalCalendarImportRequest);
      setCalendarImports(nextImports);
      setStatusMessage("Outside calendar synced into YardMatch.");
      setImportFeedUrl("");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import that calendar right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSyncCalendarImport(subscriptionId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextImports = await api.syncProviderCalendarImport({ subscriptionId });
      setCalendarImports(nextImports);
      setStatusMessage("Outside calendar import refreshed.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to refresh that calendar right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSyncStaleCalendarImports() {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextImports = await api.syncStaleProviderCalendarImports();
      setCalendarImports(nextImports);
      setStatusMessage(
        nextImports.attemptedSubscriptionCount === 0
          ? "No stale or errored calendar feeds needed a refresh."
          : `Refreshed ${nextImports.syncedSubscriptionCount} feed${nextImports.syncedSubscriptionCount === 1 ? "" : "s"} and ${nextImports.failedSubscriptionCount} still need attention.`
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to refresh stale calendar feeds right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRemoveCalendarImport(subscriptionId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextImports = await api.removeProviderCalendarImport({ subscriptionId });
      setCalendarImports(nextImports);
      setStatusMessage("Outside calendar removed.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove that calendar right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openCustomerChat(bookingId: string) {
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const thread = await api.getCustomerProviderConversationThread(undefined, bookingId);
      setActiveBookingId(bookingId);
      setActiveCustomerThread(thread);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open this conversation.");
    }
  }

  async function openArrivalTracking(bookingId: string) {
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const tracking = await api.getBookingTracking(bookingId);
      setActiveTrackingBookingId(bookingId);
      setActiveTracking(tracking);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open arrival tracking.");
    }
  }

  async function handleConfirmBooking(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.confirmBooking({ bookingId });
      setStatusMessage("Booking confirmed. Your crew can now head out when ready.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to confirm this booking right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeclineBooking(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.declineBooking({ bookingId });
      setStatusMessage("Booking declined. The customer can choose another qualified provider.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to decline this booking right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStartRoute(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.markBookingOnRoute({ bookingId });
      setStatusMessage("Route started. Customer tracking and chat are now live.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start this route right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStartWork(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.startBooking({ bookingId });
      setStatusMessage("Work started.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start work right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMarkLate(bookingId: string, lateEtaIso: string, reason: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.markBookingLate({
        bookingId,
        lateEtaIso,
        reason
      });
      setStatusMessage("Customer updated about the delay.");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the delay update right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReportIssue(
    bookingId: string,
    exceptionType:
      | "customer-no-show"
      | "customer-not-ready"
      | "unable-to-access-property"
      | "service-could-not-be-completed",
    notes: string
  ) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.markBookingException({
        bookingId,
        exceptionType,
        notes
      });
      setStatusMessage(`${getBookingExceptionLabel(exceptionType)} shared with the customer.`);
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log that issue right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function completeJob(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.completeBooking({ bookingId });
      setStatusMessage("Job marked complete.");
      setActiveBookingId(undefined);
      setActiveCustomerThread(undefined);
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete this job right now.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSendCustomerChat() {
    const body = chatDraft.trim();
    if (!body || !activeBookingId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      const nextThread = await api.sendCustomerProviderMessage({
        threadId: activeCustomerThread?.thread.id,
        bookingId: activeBookingId,
        body
      });
      setActiveCustomerThread(nextThread);
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send this message right now.");
    } finally {
      setIsWorking(false);
    }
  }

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>Loading your management portal...</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>Business owner login required</h2>
        <p>Log in to manage live jobs, staffing review, calendar pressure, and chat.</p>
        <div className="cta-row">
          <a className="button" href="/login/provider">
            Go to provider login
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {statusMessage ? (
        <section className="card">
          <h2>Updated</h2>
          <p>{statusMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <h2>Something needs attention</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {priorityJob ? (
        <section className="provider-route-focus" aria-label="Today path">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Today path</span>
              <h2>{getProviderJobActionLabel(priorityJob)}</h2>
              <p>
                {priorityJob.customerName} • {priorityJob.serviceAddress.line1}
              </p>
            </div>
            <span className="result-badge result-badge--neutral">{getProviderJobStatusLabel(priorityJob)}</span>
          </div>
          <ol className="provider-route-spine">
            {priorityJobSteps.map((step, index) => (
              <li
                aria-current={step.status === "current" ? "step" : undefined}
                className={`provider-route-spine__step provider-route-spine__step--${step.status}`}
                key={step.label}
              >
                <span className="provider-route-spine__index">{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.value}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="provider-route-summary" aria-label="Priority job summary">
            <div>
              <span>Window</span>
              <strong>{formatBookingWindowSummary(priorityJob.scheduledStartIso)}</strong>
            </div>
            <div>
              <span>Crew</span>
              <strong>
                {priorityJob.assignedCrewMembers}/{priorityJob.requiredCrewMembers}
                {priorityJob.crewGap ? ` • gap ${priorityJob.crewGap}` : ""}
              </strong>
            </div>
            <div>
              <span>Service</span>
              <strong>{formatServiceCategoryLabel(priorityJob.category)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(priorityJob.totalCents)}</strong>
            </div>
          </div>
          <div className="cta-row">
            {hasCrewDecisionPending(priorityJob) && priorityJobPrimaryAction !== "confirm" ? (
              <a className="button" href="#provider-jobs">
                Review staffing
              </a>
            ) : null}
            {priorityJobPrimaryAction === "confirm" ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleConfirmBooking(priorityJob.bookingId)}
                type="button"
              >
                Confirm booking
              </button>
            ) : null}
            {priorityJobPrimaryAction === "start-route" && !hasCrewDecisionPending(priorityJob) ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleStartRoute(priorityJob.bookingId)}
                type="button"
              >
                Start route
              </button>
            ) : null}
            {priorityJobPrimaryAction === "start-work" ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleStartWork(priorityJob.bookingId)}
                type="button"
              >
                Start work
              </button>
            ) : null}
            {priorityJobPrimaryAction === "complete" ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void completeJob(priorityJob.bookingId)}
                type="button"
              >
                Complete job
              </button>
            ) : null}
            <a className="button-secondary" href="#provider-jobs">
              Job details
            </a>
          </div>
        </section>
      ) : (
        <section className="provider-route-focus" aria-label="Today path">
          <span className="eyebrow">Today path</span>
          <h2>No scheduled jobs.</h2>
          <p>Calendar, staffing, and assistant tools are ready when work is booked.</p>
        </section>
      )}

      {provider ? (
        <section className="card">
          <span className="eyebrow">Business verification</span>
          <h2>
            {provider.verificationSummary?.headline ??
              (provider.verificationStatus === "verified"
                ? "Your business is verified and visible in search."
                : provider.verificationStatus === "rejected"
                  ? "Your business needs a quick profile update before going live."
                  : "Your business is pending review before it appears in search.")}
          </h2>
          <p>
            {provider.verificationSummary?.summary ??
              (provider.verificationStatus === "verified"
                ? "Customers can now discover this business in public YardMatch search results."
                : provider.verificationStatus === "rejected"
                  ? provider.verificationNotes ??
                    "Ops left review notes for this business before it can be shown to customers."
                  : "Ops will review the business profile, service area, and marketplace details before customers can book.")}
          </p>
          <div className="chip-row">
            <span>Status: {provider.verificationStatus.replaceAll("-", " ")}</span>
            <span>
              Submitted:{" "}
              {formatDateTime(provider.verificationSubmittedAt ?? provider.createdAt)}
            </span>
            {provider.verificationReviewedAt ? (
              <span>Last review: {formatDateTime(provider.verificationReviewedAt)}</span>
            ) : null}
          </div>
          {provider.verificationSummary?.nextSteps.length ? (
            <div className="stack-sm">
              <p>Next steps</p>
              <ul className="timeline">
                {provider.verificationSummary.nextSteps.map((step) => (
                  <li key={step}>
                    <strong>Next</strong>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {provider.verificationSummary?.checklist.length ? (
            <div className="stack-sm">
              <p>Launch checklist</p>
              <ul className="timeline">
                {provider.verificationSummary.checklist.map((item) => (
                  <li key={item.key}>
                    <strong>{formatVerificationChecklistStatus(item.status)}</strong>
                    <span>
                      {item.label} • {item.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {provider ? (
        <section className="card">
          <span className="eyebrow">Verification profile</span>
          <h2>Keep the public business profile ready for launch review.</h2>
          <p>
            Update the customer-facing business details ops checks before this company goes live in
            recommendation-first search.
          </p>
          <div className="stack-md">
            <label className="form-field form-field--full">
              <span>Company name</span>
              <input
                type="text"
                value={profileCompanyName}
                onChange={(event) => setProfileCompanyName(event.target.value)}
              />
            </label>
            <label className="form-field form-field--full">
              <span>Business description</span>
              <textarea
                rows={4}
                value={profileBio}
                onChange={(event) => setProfileBio(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Years of experience</span>
              <input
                min={0}
                max={60}
                type="number"
                value={profileYearsExperience}
                onChange={(event) => setProfileYearsExperience(event.target.value)}
              />
            </label>
            <div className="stack-sm">
              <p>Services offered</p>
              <div className="chip-row">
                {providerCategoryOptions.map((option) => (
                  <label key={option.value} className="result-badge">
                    <input
                      type="checkbox"
                      checked={profileCategories.includes(option.value)}
                      onChange={(event) => toggleProfileCategory(option.value, event.target.checked)}
                    />{" "}
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleProviderProfileUpdate()} type="button">
              Save business profile
            </button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <span className="eyebrow">Assistant</span>
        <h2>Change bookings in plain language.</h2>
        <p>Ask for a schedule summary, move a job, staff a route, or notify a customer.</p>
        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">Examples</summary>
          <div className="service-card-disclosure__body">
            <ul className="timeline">
              <li>
                <strong>Review</strong>
                <span>What needs attention tomorrow?</span>
              </li>
              <li>
                <strong>Move</strong>
                <span>Change my afternoon appointment to evening and notify the customer.</span>
              </li>
              <li>
                <strong>Staff</strong>
                <span>Accept the best crew for my afternoon appointment.</span>
              </li>
              <li>
                <strong>Route</strong>
                <span>Start route for my afternoon appointment.</span>
              </li>
              <li>
                <strong>Issue</strong>
                <span>Mark my afternoon appointment no access because the gate is locked.</span>
              </li>
            </ul>
          </div>
        </details>
        <label className="form-field form-field--full">
          <span>Provider assistant command</span>
          <textarea
            rows={3}
            value={assistantCommand}
            onChange={(event) => setAssistantCommand(event.target.value)}
          />
        </label>
        {selectedAssistantBookingId ? <p>Selected booking: {selectedAssistantBookingId}</p> : null}
        <div className="cta-row">
          <button
            className="button-secondary"
            disabled={isWorking}
            onClick={() => void handleProviderAssistant(false)}
            type="button"
          >
            Preview command
          </button>
          <button
            className="button"
            disabled={isWorking || !assistantResult?.requiresConfirmation}
            onClick={() => void handleProviderAssistant(true)}
            type="button"
          >
            Run command
          </button>
        </div>
        {assistantResult ? (
          <div className="stack-md" style={{ paddingTop: "1rem" }}>
            <article className="list-panel">
              <strong>{assistantResult.previewLabel}</strong>
              <p>{assistantResult.previewMessage}</p>
              {assistantResult.actionTypes && assistantResult.actionTypes.length > 1 ? (
                <p>Planned steps: {assistantResult.actionTypes.join(" -> ")}</p>
              ) : null}
              {assistantResult.targetWindowLabel ? <p>Target window: {assistantResult.targetWindowLabel}</p> : null}
              {assistantResult.lateEtaIso ? (
                <p>
                  New ETA:{" "}
                  {new Date(assistantResult.lateEtaIso).toLocaleTimeString([], { timeStyle: "short" })}
                </p>
              ) : null}
              {assistantResult.dispatchDaySummary ? (
                <p>
                  Route: {assistantResult.dispatchDaySummary.routeStatus} • Jobs:{" "}
                  {assistantResult.dispatchDaySummary.yardmatchJobCount} • Crew gap:{" "}
                  {assistantResult.dispatchDaySummary.crewGap} • Drive miles:{" "}
                  {assistantResult.dispatchDaySummary.estimatedDriveMiles.toFixed(1)}
                </p>
              ) : null}
              {assistantResult.dispatchRangeSummary ? (
                <p>
                  Active days: {assistantResult.dispatchRangeSummary.activeDayCount} • Watch:{" "}
                  {assistantResult.dispatchRangeSummary.watchDayCount} • Overloaded:{" "}
                  {assistantResult.dispatchRangeSummary.overloadedDayCount} • Total crew gap:{" "}
                  {assistantResult.dispatchRangeSummary.totalCrewGap}
                </p>
              ) : null}
              {assistantResult.dispatchWindowSummary ? (
                <p>
                  Focus window: {assistantResult.dispatchWindowSummary.label} • Jobs:{" "}
                  {assistantResult.dispatchWindowSummary.yardmatchJobCount} • Crew gap:{" "}
                  {assistantResult.dispatchWindowSummary.crewGap} • Blocked minutes:{" "}
                  {assistantResult.dispatchWindowSummary.blockedMinutes}
                </p>
              ) : null}
              {assistantResult.customerNotificationPreview ? (
                <p>{assistantResult.customerNotificationPreview}</p>
              ) : null}
            </article>
            {assistantResult.bookingCandidates.length > 0 ? (
              <div className="stack-md">
                <p>
                  {assistantResult.actionType === "summarize-dispatch"
                    ? "Appointments in that focus area:"
                    : assistantResult.actionType === "recommend-dispatch-adjustment"
                      ? "Appointments in the pressured window:"
                      : assistantResult.actionType === "recommend-staffing-adjustment"
                        ? "Bookings that need more crew:"
                    : "Matching appointments:"}
                </p>
                {assistantResult.bookingCandidates.map((candidate) => (
                  <article className="list-panel" key={candidate.bookingId}>
                    <strong>{candidate.customerName}</strong>
                    <p>
                      {candidate.currentWindowLabel} • {formatDateTime(candidate.scheduledStartIso)}
                    </p>
                    <p>{candidate.addressLine}</p>
                    <button
                      className={selectedAssistantBookingId === candidate.bookingId ? "button" : "button-secondary"}
                      onClick={() => setSelectedAssistantBookingId(candidate.bookingId)}
                      type="button"
                    >
                      Use this appointment
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={`provider-capacity-alert ${totalCrewGap > 0 ? "provider-capacity-alert--warning" : ""}`}>
        <div>
          <span className="eyebrow">Live staffing</span>
          <h2>
            {totalCrewGap > 0
              ? `${totalCrewGap} crew slot${totalCrewGap === 1 ? "" : "s"} still need coverage.`
              : "Your upcoming work is fully covered right now."}
          </h2>
          <p>
            Crew members are auto-matched from their skills, availability, and travel radius. You
            can auto-accept or review each match first.
          </p>
        </div>
        <div className="cta-row">
          <button
            className={provider?.staffingMode === "auto-accept" ? "button" : "button-secondary"}
            disabled={isWorking}
            onClick={() => void handleStaffingModeChange("auto-accept")}
            type="button"
          >
            Auto-accept
          </button>
          <button
            className={provider?.staffingMode === "review-first" ? "button" : "button-secondary"}
            disabled={isWorking}
            onClick={() => void handleStaffingModeChange("review-first")}
            type="button"
          >
            Review first
          </button>
        </div>
      </section>

      <section className="grid-three">
        <article className="card">
          <span className="eyebrow">Service area</span>
          <h2>{provider?.serviceRadiusMiles ?? 0} mi</h2>
          <p>How far YardMatch should search around your base.</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { serviceRadiusMiles: Math.max(5, (provider?.serviceRadiusMiles ?? 15) - 5) },
                  "Service radius updated."
                )
              }
              type="button"
            >
              -5 miles
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { serviceRadiusMiles: Math.min(60, (provider?.serviceRadiusMiles ?? 15) + 5) },
                  "Service radius updated."
                )
              }
              type="button"
            >
              +5 miles
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">Reminder timing</span>
          <h2>{provider?.departureReminderLeadMinutes ?? 0} min</h2>
          <p>When YardMatch reminds you it is time to head out.</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  {
                    departureReminderLeadMinutes: Math.max(
                      10,
                      (provider?.departureReminderLeadMinutes ?? 60) - 10
                    )
                  },
                  "Departure reminder timing updated."
                )
              }
              type="button"
            >
              -10 min
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  {
                    departureReminderLeadMinutes: Math.min(
                      180,
                      (provider?.departureReminderLeadMinutes ?? 60) + 10
                    )
                  },
                  "Departure reminder timing updated."
                )
              }
              type="button"
            >
              +10 min
            </button>
          </div>
          <p>Staffing review reminders: {provider?.crewReviewLeadHours ?? 0} hours before start.</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { crewReviewLeadHours: Math.max(1, (provider?.crewReviewLeadHours ?? 24) - 1) },
                  "Staffing review timing updated."
                )
              }
              type="button"
            >
              -1 hour
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { crewReviewLeadHours: Math.min(72, (provider?.crewReviewLeadHours ?? 24) + 1) },
                  "Staffing review timing updated."
                )
              }
              type="button"
            >
              +1 hour
            </button>
          </div>
          <p>New bookings must land at least {formatMinimumLeadHoursLabel(provider?.minimumBookingLeadHours ?? 0)} ahead.</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { minimumBookingLeadHours: Math.max(0, (provider?.minimumBookingLeadHours ?? 0) - 1) },
                  "Acceptance window updated."
                )
              }
              type="button"
            >
              -1 hour
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { minimumBookingLeadHours: Math.min(72, (provider?.minimumBookingLeadHours ?? 0) + 1) },
                  "Acceptance window updated."
                )
              }
              type="button"
            >
              +1 hour
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">Route leader</span>
          <h2>{provider?.routeLeaderMode === "accepted-crew-fallback" ? "Provider or crew" : "Provider only"}</h2>
          <p>Choose whether an accepted crew member can start the route and share live tracking.</p>
          <div className="cta-row">
            <button
              className={provider?.routeLeaderMode === "provider-only" ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { routeLeaderMode: "provider-only" },
                  "Route leader mode updated."
                )
              }
              type="button"
            >
              Provider only
            </button>
            <button
              className={provider?.routeLeaderMode === "accepted-crew-fallback" ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { routeLeaderMode: "accepted-crew-fallback" },
                  "Route leader mode updated."
                )
              }
              type="button"
            >
              Allow crew fallback
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">Payout timing</span>
          <h2>{provider ? formatWeekdayLabel(provider.weeklyPayoutDay) : "Thursday"}</h2>
          <p>Choose the weekly day YardMatch groups provider payouts for this business.</p>
          <p>YardMatch may ask for a fresh sign-in before changing payout controls.</p>
          <div className="cta-row">
            {(["Tue", "Thu", "Fri"] as const).map((weekday) => (
              <button
                className={provider?.weeklyPayoutDay === weekday ? "button" : "button-secondary"}
                disabled={isWorking}
                key={weekday}
                onClick={() =>
                  void handleDispatchSettingsUpdate(
                    { weeklyPayoutDay: weekday },
                    "Weekly payout day updated."
                  )
                }
                type="button"
              >
                {formatWeekdayLabel(weekday)}
              </button>
            ))}
          </div>
          <p>
            Instant payouts are {provider?.instantPayoutsEnabled ? "enabled" : "off"} for ready balances
            above the platform minimum.
          </p>
          <div className="cta-row">
            <button
              className={provider?.instantPayoutsEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { instantPayoutsEnabled: true },
                  "Instant payouts enabled."
                )
              }
              type="button"
            >
              Enable instant
            </button>
            <button
              className={!provider?.instantPayoutsEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { instantPayoutsEnabled: false },
                  "Instant payouts turned off."
                )
              }
              type="button"
            >
              Weekly only
            </button>
          </div>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{jobs.length}</h2>
          <p>Open jobs</p>
        </article>
        <article className="card">
          <h2>{totalAssignedCrew}</h2>
          <p>Crew assigned</p>
        </article>
        <article className="card">
          <h2>{totalCrewGap}</h2>
          <p>Open crew slots</p>
        </article>
      </section>

      <section className="card">
        <span className="eyebrow">Calendar sync</span>
        <h2>Keep YardMatch jobs in your outside calendar.</h2>
        <p>
          Subscribe to your YardMatch schedule in Apple Calendar or Google Calendar so booked jobs stay
          visible alongside direct clients and personal blocks.
        </p>
        {calendarSubscription ? (
          <>
            <div className="cta-row">
              {calendarSubscription.actions.map((action) => (
                <a
                  className="button-secondary"
                  href={action.href}
                  key={action.platform}
                  rel={action.href.startsWith("http") ? "noreferrer" : undefined}
                  target={action.href.startsWith("http") ? "_blank" : undefined}
                >
                  {action.label}
                </a>
              ))}
            </div>
            <div className="stack-md" style={{ paddingTop: "1rem" }}>
              {calendarSubscription.instructions.map((instruction) => (
                <p key={instruction}>{instruction}</p>
              ))}
              <div className="stack-sm" style={{ paddingBottom: 0 }}>
                {calendarSubscription.actions.map((action) => (
                  <p key={`${action.platform}-helper`}>{action.label}: {action.helperText}</p>
                ))}
              </div>
            </div>
            {calendarOverview ? (
              <div className="stack-md" style={{ paddingTop: "1rem" }}>
                {calendarHealth ? (
                  <article className="list-panel">
                    <strong>Outside calendar health: {formatCalendarHealthLabel(calendarHealth.status)}</strong>
                    <p>
                      {calendarHealth.subscriptionCount} feeds • {calendarHealth.importedBlockCount} imported blocks •{" "}
                      {calendarHealth.externalBlockingEnabled ? "blocking on" : "save only"}
                    </p>
                    <p>
                      {calendarHealth.erroredSubscriptionCount} errors • {calendarHealth.staleSubscriptionCount} stale feeds •{" "}
                      {calendarHealth.conflictingYardmatchJobCount} booking conflicts
                    </p>
                    <div className="stack-sm" style={{ paddingBottom: 0 }}>
                      {calendarHealth.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </article>
                ) : null}
                <div className="chip-row">
                  <span>{calendarOverview.yardmatchJobCount} YardMatch jobs</span>
                  <span>{calendarOverview.externalBlockCount} outside blocks</span>
                  <span>{calendarOverview.totalEvents} total events</span>
                </div>
                {dispatchDays.length ? (
                  <div className="stack-md">
                    <h3>Dispatch plan</h3>
                    <div className="grid-two">
                      {dispatchDays.map((day) => (
                        <article className="card" key={day.dateIso}>
                          <div className="chip-row" style={{ justifyContent: "space-between" }}>
                            <span>{day.dayLabel}</span>
                            <span>{formatRouteStatusLabel(day.routeStatus)}</span>
                          </div>
                          <p>
                            {day.yardmatchJobCount} jobs • {day.totalCrewAssigned}/{day.totalCrewRequired} crew •{" "}
                            {day.estimatedDriveMiles} mi route
                          </p>
                          <p>
                            Longest leg {day.longestDriveLegMiles} mi
                            {day.largestIdleGapMinutes ? ` • Longest idle gap ${formatMinutesAsHours(day.largestIdleGapMinutes)}` : ""}
                            {day.outlierStopCount ? ` • ${day.outlierStopCount} outlier stop${day.outlierStopCount === 1 ? "" : "s"}` : ""}
                          </p>
                          <p>
                            {formatMinutesAsHours(day.bookedMinutes)} booked
                            {day.externalBlockCount ? ` • ${formatMinutesAsHours(day.blockedMinutes)} outside blocks` : ""}
                          </p>
                          {day.firstStopAddressLine ? <p>First stop: {day.firstStopAddressLine}</p> : null}
                          <div className="stack-md">
                            {day.windowSummaries.map((window) => (
                              <div className="list-panel" key={`${day.dateIso}-${window.windowKey}`}>
                                <strong>{window.label}</strong>
                                <p>
                                  {window.yardmatchJobCount} jobs • {window.totalCrewAssigned}/{window.totalCrewRequired} crew
                                  {window.crewGap ? ` • gap ${window.crewGap}` : ""}
                                </p>
                                {window.externalBlockCount ? (
                                  <p>
                                    {window.externalBlockCount} outside blocks • {formatMinutesAsHours(window.blockedMinutes)}
                                  </p>
                                ) : (
                                  <p>{formatMinutesAsHours(window.bookedMinutes)} booked</p>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="stack-md">
                            {day.recommendations.map((recommendation) => (
                              <p key={recommendation}>{recommendation}</p>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                {calendarOverview.events.slice(0, 8).map((event) => (
                  <div className="list-panel" key={event.id}>
                    <strong>{event.title}</strong>
                    <p>
                      {formatDateTime(event.startIso)} to {formatDateTime(event.endIso)}
                    </p>
                    <p>
                      {event.source === "yardmatch-booking"
                        ? `${event.customerName ?? "Customer"} • ${event.status?.replaceAll("-", " ")}`
                        : `${getExternalCalendarBlockLabel(event.blockType ?? "off-platform-client")} • Outside block`}
                    </p>
                    {event.addressLine ? <p>{event.addressLine}</p> : null}
                    {event.notes ? <p>{event.notes}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <div className="stack-md" style={{ paddingTop: "1.25rem" }}>
          {(calendarHealth?.staleSubscriptionCount ?? 0) > 0 || (calendarHealth?.erroredSubscriptionCount ?? 0) > 0 ? (
            <div className="cta-row">
              <button
                className="button-secondary"
                disabled={isWorking}
                onClick={() => void handleSyncStaleCalendarImports()}
                type="button"
              >
                Sync stale feeds
              </button>
            </div>
          ) : null}
          <div className="grid-two">
            <label className="form-field">
              <span>Imported calendar title</span>
              <input
                value={importTitle}
                onChange={(event) => setImportTitle(event.target.value)}
                placeholder="Google Calendar - Outside work"
              />
            </label>
            <label className="form-field">
              <span>Calendar type</span>
              <select
                value={importProvider}
                onChange={(event) => setImportProvider(event.target.value as ExternalCalendarProvider)}
              >
                {externalCalendarImportProviders.map((option) => (
                  <option key={option} value={option}>
                    {option === "ical" ? "Generic iCal feed" : `${option.charAt(0).toUpperCase()}${option.slice(1)} Calendar`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form-field form-field--full">
            <span>External feed URL</span>
            <input
              value={importFeedUrl}
              onChange={(event) => setImportFeedUrl(event.target.value)}
              placeholder="Paste a Google, Apple, or generic iCal feed URL"
            />
          </label>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleCreateCalendarImport()} type="button">
              Import outside calendar
            </button>
          </div>
          {calendarImports?.subscriptions.length ? (
            <div className="stack-md">
              {calendarImports.subscriptions.map((subscription) => (
                <article className="card" key={subscription.id}>
                  <span className="eyebrow">
                    {subscription.provider === "ical"
                      ? "Generic iCal feed"
                      : `${subscription.provider.charAt(0).toUpperCase()}${subscription.provider.slice(1)} Calendar`}
                  </span>
                  <h3>{subscription.title}</h3>
                  <p>{subscription.feedUrl}</p>
                  <p>
                    {subscription.importedEventCount} imported events
                    {subscription.lastSyncedAt ? ` • synced ${formatDateTime(subscription.lastSyncedAt)}` : ""}
                  </p>
                  <p>Status: {subscription.syncStatus === "active" ? "Active" : "Sync issue"}</p>
                  {subscription.lastError ? <p>{subscription.lastError}</p> : null}
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleSyncCalendarImport(subscription.id)}
                      type="button"
                    >
                      Sync now
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleRemoveCalendarImport(subscription.id)}
                      type="button"
                    >
                      Remove feed
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <div className="cta-row">
            <button
              className={externalBlockingEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() => void handleToggleCalendarBlocking(true)}
              type="button"
            >
              Outside blocks affect availability
            </button>
            <button
              className={!externalBlockingEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() => void handleToggleCalendarBlocking(false)}
              type="button"
            >
              Save only, do not block yet
            </button>
          </div>
          <div className="grid-two">
            <label className="form-field">
              <span>Block title</span>
              <input
                value={blockTitle}
                onChange={(event) => setBlockTitle(event.target.value)}
                placeholder="Direct client, personal time, travel buffer"
              />
            </label>
            <label className="form-field">
              <span>Block type</span>
              <select value={blockType} onChange={(event) => setBlockType(event.target.value as ExternalCalendarBlockType)}>
                {externalCalendarBlockOptions.map((option) => (
                  <option key={option} value={option}>
                    {getExternalCalendarBlockLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Start</span>
              <input type="datetime-local" value={blockStartLocal} onChange={(event) => setBlockStartLocal(event.target.value)} />
            </label>
            <label className="form-field">
              <span>End</span>
              <input type="datetime-local" value={blockEndLocal} onChange={(event) => setBlockEndLocal(event.target.value)} />
            </label>
          </div>
          <label className="form-field form-field--full">
            <span>Notes</span>
            <textarea
              rows={3}
              value={blockNotes}
              onChange={(event) => setBlockNotes(event.target.value)}
              placeholder="Optional note for why this off-platform block should protect the calendar."
            />
          </label>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleAddCalendarBlock()} type="button">
              Add outside block
            </button>
          </div>
          <div className="stack-md">
            {calendarBlocks.length > 0 ? (
              calendarBlocks.map((block) => (
                <article className="card" key={block.id}>
                  <span className="eyebrow">{getExternalCalendarBlockLabel(block.blockType)}</span>
                  <h3>{block.title}</h3>
                  <p>
                    {formatDateTime(block.startIso)} to {formatDateTime(block.endIso)}
                  </p>
                  {block.notes ? <p>{block.notes}</p> : null}
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleRemoveCalendarBlock(block.id)}
                      type="button"
                    >
                      Remove block
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>No outside-client or personal blocks yet. Add one to keep YardMatch from opening that window.</p>
            )}
          </div>
        </div>
      </section>

      {visibleJobs.length ? (
        <section className="stack-lg" id="provider-jobs">
        {visibleJobs.map((job) => (
          <article className="history-card" key={job.bookingId}>
            <div className="history-card__header">
              <div>
                <span className="eyebrow">{formatServiceCategoryLabel(job.category)}</span>
                <h2>{job.customerName}</h2>
              </div>
              <strong>{formatCurrency(job.totalCents)}</strong>
            </div>
            <div className="history-card__grid">
              <div>
                <h3>Schedule</h3>
                <p>{formatBookingWindowSummary(job.scheduledStartIso)}</p>
                <p>{formatDateTime(job.scheduledStartIso)}</p>
              </div>
              <div>
                <h3>Address</h3>
                <p>{job.serviceAddress.line1}</p>
                <p>
                  {job.serviceAddress.city}, {job.serviceAddress.state} {job.serviceAddress.postalCode}
                </p>
              </div>
              <div>
                <h3>Staffing</h3>
                <p>{job.requiredCrewMembers} needed</p>
                <p>{job.assignedCrewMembers} assigned</p>
                <p>{job.crewGap} open</p>
                <p>Status: {getProviderJobStatusLabel(job)}</p>
                {provider?.routeLeaderMode === "accepted-crew-fallback" ? (
                  <p>
                    Route leader: {job.assignedRouteLeaderCrewMemberName ?? "Provider"}
                    {job.requiresRouteLeaderAssignment ? " • pick one accepted crew member before delegating" : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="cta-row">
              {job.status === "requested" ? (
                <>
                  <button
                    className="button"
                    disabled={isWorking}
                    onClick={() => void handleConfirmBooking(job.bookingId)}
                    type="button"
                  >
                    Confirm booking
                  </button>
                </>
              ) : null}
              {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                <>
                  <button
                    className="button"
                    disabled={isWorking}
                    onClick={() => void handleStartRoute(job.bookingId)}
                    type="button"
                  >
                    Start route
                  </button>
                </>
              ) : null}
              {job.status === "confirmed" && job.onRouteConfirmedAt ? (
                <button
                  className="button"
                  disabled={isWorking}
                  onClick={() => void handleStartWork(job.bookingId)}
                  type="button"
                >
                  Start work
                </button>
              ) : null}
              {job.status === "in-progress" ? (
                <button
                  className="button"
                  disabled={isWorking}
                  onClick={() => void completeJob(job.bookingId)}
                  type="button"
                >
                  Complete job
                </button>
              ) : null}
            </div>

            {job.status === "requested" ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">More options</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleDeclineBooking(job.bookingId)}
                      type="button"
                    >
                      Decline request
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">Report issue</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleMarkLate(
                          job.bookingId,
                          buildLateEta(job.scheduledStartIso, 15),
                          "Running about 15 minutes behind the route."
                        )
                      }
                      type="button"
                    >
                      Running 15 min late
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleMarkLate(
                          job.bookingId,
                          buildLateEta(job.scheduledStartIso, 30),
                          "Running about 30 minutes behind the route."
                        )
                      }
                      type="button"
                    >
                      Running 30 min late
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-no-show",
                          "The customer did not appear for the scheduled service window."
                        )
                      }
                      type="button"
                    >
                      Customer no-show
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-not-ready",
                          "The property owner is not ready for the scheduled service."
                        )
                      }
                      type="button"
                    >
                      Customer not ready
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "unable-to-access-property",
                          "The crew could not safely access the property as scheduled."
                        )
                      }
                      type="button"
                    >
                      No access
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.status === "in-progress" ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">Report issue</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-no-show",
                          "The customer did not appear for the scheduled service window."
                        )
                      }
                      type="button"
                    >
                      Customer no-show
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-not-ready",
                          "The property owner is not ready for the scheduled service."
                        )
                      }
                      type="button"
                    >
                      Customer not ready
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "unable-to-access-property",
                          "The crew could not safely access the property as scheduled."
                        )
                      }
                      type="button"
                    >
                      No access
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "service-could-not-be-completed",
                          "The service could not be completed during this visit."
                        )
                      }
                      type="button"
                    >
                      Could not complete
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.lateEtaIso && !job.onRouteConfirmedAt ? (
              <div className="list-panel">
                <strong>Delay notice sent</strong>
                <p>
                  Customer now expects the team around {formatDateTime(job.lateEtaIso)}.
                  {job.lateReason ? ` ${job.lateReason}` : ""}
                </p>
              </div>
            ) : null}

            {job.activeExceptionType ? (
              <div className="list-panel">
                <strong>{getBookingExceptionLabel(job.activeExceptionType)}</strong>
                <p>
                  Logged {job.activeExceptionReportedAt ? formatDateTime(job.activeExceptionReportedAt) : "just now"}.
                  {job.activeExceptionNotes ? ` ${job.activeExceptionNotes}` : ""}
                </p>
                <div className="cta-row">
                  <a
                    className="button-secondary"
                    href={`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent(
                      getBookingExceptionLabel(job.activeExceptionType)
                    )}`}
                  >
                    Open support
                  </a>
                </div>
              </div>
            ) : null}
            {job.status === "disputed" ? (
              <div className="list-panel">
                <strong>Booking disputed</strong>
                <p>
                  {job.disputeReason ?? "A dispute was opened on this job."}
                </p>
                <div className="cta-row">
                  <a
                    className="button-secondary"
                    href={`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent("Disputed booking support")}`}
                  >
                    Open support
                  </a>
                </div>
              </div>
            ) : null}

            {job.requiresRouteLeaderAssignment ? (
              <div className="list-panel">
                <strong>Route leader still needs assignment</strong>
                <p>More than one accepted crew member is on this job. Pick who should start and share the route, or keep the route under provider control.</p>
              </div>
            ) : null}
            {job.crewGap > 0 ? (
              <div className="list-panel">
                <strong>{job.crewGap} crew slot{job.crewGap === 1 ? "" : "s"} still open</strong>
                <p>Review staffing options before this route falls behind.</p>
              </div>
            ) : null}
            <details className="service-card-disclosure">
              <summary className="service-card-disclosure__summary">
                Staffing
                {job.matches.length
                  ? ` • ${job.matches.length} match${job.matches.length === 1 ? "" : "es"}`
                  : ""}
              </summary>
              <div className="service-card-disclosure__body">
                <div className="stack-md">
                  {job.matches.length === 0 ? (
                    <div className="list-panel">
                      <strong>No matched crew yet</strong>
                      <p>As more crew availability comes in, matched candidates will appear here.</p>
                    </div>
                  ) : (
                    job.matches.map((match) => {
                      return (
                        <div className="list-panel" key={match.id}>
                          <div className="search-result-title">
                            <div>
                              <h3>{match.crewMemberName}</h3>
                              <p>
                                {match.categories.map((category) => category.replaceAll("-", " ")).join(" • ")}
                              </p>
                            </div>
                            <span className="result-badge">{match.status.replaceAll("-", " ")}</span>
                          </div>
                          <p>
                            {match.distanceMiles} miles away • {match.preferredSchedule} •{" "}
                            {match.availableWeekdays.join(", ")}
                          </p>
                          {match.recommendationLabel ? (
                            <p>
                              {formatCrewRecommendationLabel(match.recommendationLabel)}
                              {typeof match.recommendationScore === "number"
                                ? ` • score ${match.recommendationScore}`
                                : ""}
                            </p>
                          ) : null}
                          {match.recommendationReasons?.length ? (
                            <p>{match.recommendationReasons.join(" • ")}</p>
                          ) : null}
                          {match.status === "cancelled-by-crew" && match.cancellationReason ? (
                            <p className="warning-copy">Crew note: {match.cancellationReason}</p>
                          ) : null}
                          {match.status === "accepted" && job.assignedRouteLeaderCrewMemberId === match.crewMemberId ? (
                            <p>Assigned route leader for this job.</p>
                          ) : null}
                          <p>{formatCurrency(match.hourlyRateCents)}/hr</p>
                          <div className="cta-row">
                            {match.status === "pending-provider-review" ? (
                              <>
                                <button
                                  className="button"
                                  disabled={isWorking}
                                  onClick={() => void handleReviewMatch(match.id, "accept")}
                                  type="button"
                                >
                                  Accept
                                </button>
                                <button
                                  className="button-secondary"
                                  disabled={isWorking}
                                  onClick={() => void handleReviewMatch(match.id, "deny")}
                                  type="button"
                                >
                                  Deny
                                </button>
                              </>
                            ) : null}
                            {provider?.routeLeaderMode === "accepted-crew-fallback" &&
                            match.status === "accepted" &&
                            !job.onRouteConfirmedAt ? (
                              <button
                                className={
                                  job.assignedRouteLeaderCrewMemberId === match.crewMemberId ? "button" : "button-secondary"
                                }
                                disabled={isWorking}
                                onClick={() => void handleAssignRouteLeader(job.bookingId, match.crewMemberId)}
                                type="button"
                              >
                                {job.assignedRouteLeaderCrewMemberId === match.crewMemberId
                                  ? "Assigned route leader"
                                  : "Lead this route"}
                              </button>
                            ) : null}
                            <a className="button-secondary" href={`tel:${match.crewMemberPhone}`}>
                              Call crew
                            </a>
                            <a
                              className="button-secondary"
                              href={`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=general&subject=${encodeURIComponent("Crew staffing support")}`}
                            >
                              Get help
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {provider?.routeLeaderMode === "accepted-crew-fallback" &&
                  job.assignedRouteLeaderCrewMemberId &&
                  !job.onRouteConfirmedAt ? (
                    <div className="cta-row">
                      <button
                        className="button-secondary"
                        disabled={isWorking}
                        onClick={() => void handleAssignRouteLeader(job.bookingId)}
                        type="button"
                      >
                        Clear explicit route leader
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </details>

            {job.onRouteConfirmedAt ? (
              <div className="list-panel">
                <div className="search-result-title">
                  <div>
                    <h3>Customer chat</h3>
                    <p>The route is live. Chat is now open with the property owner.</p>
                  </div>
                </div>
                <div className="cta-row">
                  <button
                    className="button-secondary"
                    onClick={() => void openCustomerChat(job.bookingId)}
                    type="button"
                  >
                    Message customer
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => void openArrivalTracking(job.bookingId)}
                    type="button"
                  >
                    Track crew
                  </button>
                  <a
                    className="button-secondary"
                    href={`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent("Customer job support")}`}
                  >
                    Get help
                  </a>
                </div>
                {activeTrackingBookingId === job.bookingId && activeTracking ? (
                  <ArrivalTrackingPanel
                    showProviderRouteDetails
                    subtitle={job.customerName}
                    title="Crew arrival route"
                    tracking={activeTracking}
                  />
                ) : null}
              </div>
            ) : null}
          </article>
          ))}
        </section>
      ) : null}
      {activeBookingId && activeCustomerThread ? (
        <FloatingChatWindow
          busy={isWorking}
          draft={chatDraft}
          inputPlaceholder="Send a quick update before arrival."
          isOpen={Boolean(activeBookingId)}
          launcherLabel="Open customer chat"
          messages={activeCustomerThread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            senderLabel:
              message.senderRole === "provider" ? "You" : activeCustomerThread.thread.customerName,
            isCurrentUser: message.senderRole === "provider"
          }))}
          onClose={() => {
            setActiveBookingId(undefined);
            setActiveCustomerThread(undefined);
            setChatDraft("");
          }}
          onDraftChange={setChatDraft}
          onOpen={() => undefined}
          onSend={() => void handleSendCustomerChat()}
          subtitle={activeCustomerThread.thread.customerName}
          title="Customer chat"
        />
      ) : null}
    </div>
  );
}
