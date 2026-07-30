"use client";

import {
  BookingEvidencePhase,
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
import { addLocalePrefix, I18nInstance } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { ArrivalTrackingPanel } from "./ArrivalTrackingPanel";
import { FloatingChatWindow } from "./FloatingChatWindow";

function formatDateTime(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildLateEta(bookingIso: string, minutes: number) {
  return new Date(new Date(bookingIso).getTime() + minutes * 60_000).toISOString();
}

function readEvidenceImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read that image."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read that image.")));
    reader.readAsDataURL(file);
  });
}

function formatLocalInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatMinutesAsHours(i18n: I18nInstance, minutes: number) {
  if (minutes < 60) {
    return i18n.t("provider_live.duration.minutes", { count: minutes });
  }

  const hours = minutes / 60;
  return i18n.t("provider_live.duration.hours", {
    count: Number.isInteger(hours) ? hours : Number(hours.toFixed(1))
  });
}

function formatWeekdayLabel(i18n: I18nInstance, weekday: ProviderProfile["weeklyPayoutDay"]) {
  const map: Record<ProviderProfile["weeklyPayoutDay"], Parameters<I18nInstance["t"]>[0]> = {
    Mon: "provider_live.weekday.mon",
    Tue: "provider_live.weekday.tue",
    Wed: "provider_live.weekday.wed",
    Thu: "provider_live.weekday.thu",
    Fri: "provider_live.weekday.fri",
    Sat: "provider_live.weekday.sat",
    Sun: "provider_live.weekday.sun"
  };

  return i18n.t(map[weekday]);
}

function formatMinimumLeadHoursLabel(i18n: I18nInstance, hours: number) {
  if (hours <= 0) {
    return i18n.t("provider_live.lead_time.no_minimum");
  }

  return i18n.t("provider_live.duration.hours", { count: hours });
}

function formatRouteStatusLabel(i18n: I18nInstance, status: "comfortable" | "watch" | "overloaded") {
  switch (status) {
    case "comfortable":
      return i18n.t("provider_live.route_status.balanced");
    case "watch":
      return i18n.t("provider_live.route_status.watch");
    case "overloaded":
      return i18n.t("provider_live.route_status.overloaded");
  }
}

function formatCalendarHealthLabel(i18n: I18nInstance, status: "healthy" | "attention" | "at-risk") {
  switch (status) {
    case "healthy":
      return i18n.t("provider_live.calendar_health.healthy");
    case "attention":
      return i18n.t("provider_live.calendar_health.attention");
    case "at-risk":
      return i18n.t("provider_live.calendar_health.at_risk");
  }
}

function formatCrewRecommendationLabel(i18n: I18nInstance, label?: "best-fit" | "good-fit" | "backup") {
  switch (label) {
    case "best-fit":
      return i18n.t("common.state.best_fit");
    case "good-fit":
      return i18n.t("provider_live.crew.good_fit");
    case "backup":
      return i18n.t("provider_live.crew.backup");
    default:
      return undefined;
  }
}

function formatVerificationChecklistStatus(i18n: I18nInstance, status: "ready" | "review" | "missing") {
  switch (status) {
    case "ready":
      return i18n.t("provider_live.verification.ready");
    case "review":
      return i18n.t("provider_live.verification.review");
    case "missing":
      return i18n.t("provider_live.verification.needs_update");
  }
}

type ProviderJobSummary = ProviderStaffingOverview["jobs"][number];
type ProviderJobPrimaryAction = "confirm" | "start-route" | "start-work" | "complete";
type ProviderRouteStepStatus = "complete" | "current" | "pending";

function formatServiceCategoryLabel(i18n: I18nInstance, category: ServiceCategory | string) {
  if (category === "lawn-mowing" || category === "hedge-trimming" || category === "mulch-installation" || category === "seasonal-cleanup" || category === "weed-control" || category === "irrigation-check" || category === "leaf-blowing" || category === "gutter-cleaning") {
    return i18n.t(serviceCategoryToI18nKey(category));
  }

  return category.replaceAll("-", " ");
}

function getProviderJobStatusLabel(i18n: I18nInstance, job: ProviderJobSummary) {
  if (job.status === "requested") {
    return i18n.t("provider_live.job_status.requested");
  }

  if (job.status === "confirmed" && job.onRouteConfirmedAt) {
    return i18n.t("provider_live.job_status.on_route");
  }

  if (job.status === "confirmed") {
    return i18n.t("provider_live.job_status.confirmed");
  }

  if (job.status === "in-progress") {
    return i18n.t("provider_live.job_status.in_progress");
  }

  if (job.status === "disputed") {
    return i18n.t("provider_live.job_status.disputed");
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

function getProviderJobActionLabel(i18n: I18nInstance, job: ProviderJobSummary) {
  const primaryAction = getProviderJobPrimaryAction(job);

  if (primaryAction === "confirm") {
    return i18n.t("provider_live.action.confirm");
  }

  if (hasCrewDecisionPending(job)) {
    return i18n.t("provider_live.action.staff");
  }

  if (primaryAction === "start-route") {
    return i18n.t("provider_live.action.start_route");
  }

  if (primaryAction === "start-work") {
    return i18n.t("provider_live.action.start_work");
  }

  if (primaryAction === "complete") {
    return i18n.t("provider_live.action.complete");
  }

  return i18n.t("provider_live.action.review");
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
const providerCategoryOptions: ServiceCategory[] = [
  "lawn-mowing",
  "hedge-trimming",
  "mulch-installation",
  "seasonal-cleanup",
  "weed-control",
  "irrigation-check",
  "leaf-blowing"
];

export function ProviderLiveManagementBoard() {
  const i18n = useI18n();
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
  const [blockTitle, setBlockTitle] = useState(() => i18n.t("provider_live.calendar.default_block_title"));
  const [blockType, setBlockType] = useState<ExternalCalendarBlockType>("off-platform-client");
  const [importTitle, setImportTitle] = useState(() => i18n.t("provider_live.calendar.default_import_title"));
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
    () => i18n.t("provider_live.assistant.default_command")
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
          label: i18n.t("provider_live.step.confirm"),
          value: priorityJob.status === "requested" ? i18n.t("provider_live.step.needed") : i18n.t("provider_live.step.done")
        },
        {
          label: i18n.t("provider_live.step.crew"),
          value:
            priorityJob.crewGap > 0
              ? i18n.t("provider_live.step.crew_gap", { count: priorityJob.crewGap })
              : priorityJob.requiresRouteLeaderAssignment
                ? i18n.t("provider_live.step.lead")
                : i18n.t("provider_live.step.ready")
        },
        {
          label: i18n.t("provider_live.step.route"),
          value: priorityJob.onRouteConfirmedAt ? i18n.t("provider_live.step.live") : formatBookingWindowSummary(priorityJob.scheduledStartIso)
        },
        {
          label: i18n.t("provider_live.step.finish"),
          value: priorityJob.status === "in-progress" ? i18n.t("provider_live.step.now") : i18n.t("provider_live.step.proof_count", { count: priorityJob.afterEvidenceCount })
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.load_portal"));
    });
  }, [sessionReady, session?.token, session?.role]);

  async function handleReviewMatch(crewMatchId: string, action: "accept" | "deny") {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.reviewCrewMatch({ crewMatchId, action });
      setStatusMessage(action === "accept" ? i18n.t("provider_live.message.crew_accepted") : i18n.t("provider_live.message.crew_declined"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.update_crew_match"));
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
          ? i18n.t("provider_live.message.route_leader_assigned")
          : i18n.t("provider_live.message.route_leader_cleared")
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.update_route_leader"));
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
          ? i18n.t("provider_live.message.staffing_review_updated")
          : staffingMode === "auto-accept"
            ? i18n.t("provider_live.message.auto_accept_on")
            : i18n.t("provider_live.message.review_first_on")
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.update_staffing_mode"));
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
      setErrorMessage(i18n.t("provider_live.error.profile_required"));
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
          ? i18n.t("provider_live.message.profile_back_to_review")
          : i18n.t("provider_live.message.profile_updated")
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.update_profile"));
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
          ? i18n.t("provider_live.message.settings_back_to_review", { message: successMessage })
          : successMessage
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.update_controls"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleProviderAssistant(execute: boolean) {
    if (!assistantCommand.trim()) {
      setErrorMessage(i18n.t("provider_live.error.assistant_command_required"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.run_assistant"));
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
          ? i18n.t("provider_live.message.calendar_blocks_enabled")
          : i18n.t("provider_live.message.calendar_blocks_saved")
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : i18n.t("provider_live.error.update_calendar_blocking")
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
      setErrorMessage(i18n.t("provider_live.error.calendar_block_time"));
      return;
    }

    await saveCalendarBlockingSettings(
      [
        ...calendarBlocks,
        {
          id: `manual-block-${Date.now()}`,
          title: blockTitle.trim() || i18n.t("provider_live.calendar.default_block_title"),
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

    setBlockTitle(i18n.t("provider_live.calendar.default_block_title"));
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
      setErrorMessage(i18n.t("provider_live.error.calendar_import_required"));
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
      setStatusMessage(i18n.t("provider_live.message.calendar_synced"));
      setImportFeedUrl("");
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.import_calendar"));
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
      setStatusMessage(i18n.t("provider_live.message.calendar_refreshed"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.refresh_calendar"));
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
          ? i18n.t("provider_live.message.no_stale_feeds")
          : i18n.t("provider_live.message.stale_feeds_refreshed", {
              synced: nextImports.syncedSubscriptionCount,
              failed: nextImports.failedSubscriptionCount
            })
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.refresh_stale_calendars"));
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
      setStatusMessage(i18n.t("provider_live.message.calendar_removed"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.remove_calendar"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.open_conversation"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.open_tracking"));
    }
  }

  async function handleConfirmBooking(bookingId: string) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const api = createAuthenticatedWebApiClient();
      await api.confirmBooking({ bookingId });
      setStatusMessage(i18n.t("provider_live.message.booking_confirmed"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.confirm_booking"));
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
      setStatusMessage(i18n.t("provider_live.message.booking_declined"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.decline_booking"));
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
      setStatusMessage(i18n.t("provider_live.message.route_started"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.start_route"));
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
      setStatusMessage(i18n.t("provider_live.message.work_started"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.start_work"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleEvidencePhoto(bookingId: string, phase: BookingEvidencePhase, file: File) {
    setIsWorking(true);
    setStatusMessage(undefined);
    setErrorMessage(undefined);

    try {
      const imageDataUrl = await readEvidenceImage(file);
      const api = createAuthenticatedWebApiClient();
      await api.addBookingEvidence({ bookingId, phase, imageDataUrl });
      setStatusMessage(
        phase === "before"
          ? i18n.t("provider_live.message.before_photo_saved")
          : i18n.t("provider_live.message.after_photo_saved")
      );
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.capture_photo"));
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
      setStatusMessage(i18n.t("provider_live.message.delay_sent"));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.send_delay"));
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
      setStatusMessage(i18n.t("provider_live.message.issue_shared", { issue: getBookingExceptionLabel(exceptionType) }));
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.log_issue"));
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
      setStatusMessage(i18n.t("provider_live.message.job_complete"));
      setActiveBookingId(undefined);
      setActiveCustomerThread(undefined);
      await loadProviderView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.complete_job"));
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
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_live.error.send_message"));
    } finally {
      setIsWorking(false);
    }
  }

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>{i18n.t("provider_live.loading")}</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("provider_live.login_required.title")}</h2>
        <p>{i18n.t("provider_live.login_required.body")}</p>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/login/provider", i18n.locale)}>
            {i18n.t("provider_live.login_required.cta")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {statusMessage ? (
        <section className="card">
          <h2>{i18n.t("provider_live.updated")}</h2>
          <p>{statusMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("common.state.needs_attention")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {priorityJob ? (
        <section className="provider-route-focus" aria-label={i18n.t("provider_live.today_path")}>
          <div className="search-result-title">
            <div>
              <span className="eyebrow">{i18n.t("provider_live.today_path")}</span>
              <h2>{getProviderJobActionLabel(i18n, priorityJob)}</h2>
              <p>
                {priorityJob.customerName} • {priorityJob.serviceAddress.line1}
              </p>
            </div>
            <span className="result-badge result-badge--neutral">{getProviderJobStatusLabel(i18n, priorityJob)}</span>
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
          <div className="provider-route-summary" aria-label={i18n.t("provider_live.priority_summary_aria")}>
            <div>
              <span>{i18n.t("customer_live.label.window")}</span>
              <strong>{formatBookingWindowSummary(priorityJob.scheduledStartIso)}</strong>
            </div>
            <div>
              <span>{i18n.t("provider_live.step.crew")}</span>
              <strong>
                {priorityJob.assignedCrewMembers}/{priorityJob.requiredCrewMembers}
                {priorityJob.crewGap ? ` • ${i18n.t("provider_live.step.crew_gap", { count: priorityJob.crewGap })}` : ""}
              </strong>
            </div>
            <div>
              <span>{i18n.t("customer_live.label.service")}</span>
              <strong>{formatServiceCategoryLabel(i18n, priorityJob.category)}</strong>
            </div>
            <div>
              <span>{i18n.t("provider_live.total")}</span>
              <strong>{i18n.formatCurrency(priorityJob.totalCents)}</strong>
            </div>
          </div>
          <div className="cta-row">
            {hasCrewDecisionPending(priorityJob) && priorityJobPrimaryAction !== "confirm" ? (
              <a className="button" href="#provider-jobs">
                {i18n.t("provider_live.action.review_staffing")}
              </a>
            ) : null}
            {priorityJobPrimaryAction === "confirm" ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleConfirmBooking(priorityJob.bookingId)}
                type="button"
              >
                {i18n.t("provider_live.action.confirm_booking")}
              </button>
            ) : null}
            {priorityJobPrimaryAction === "start-route" && !hasCrewDecisionPending(priorityJob) ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleStartRoute(priorityJob.bookingId)}
                type="button"
              >
                {i18n.t("provider_live.action.start_route")}
              </button>
            ) : null}
            {priorityJobPrimaryAction === "start-work" && priorityJob.beforeEvidenceCount > 0 ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void handleStartWork(priorityJob.bookingId)}
                type="button"
              >
                {i18n.t("provider_live.action.start_work")}
              </button>
            ) : null}
            {priorityJobPrimaryAction === "complete" && priorityJob.afterEvidenceCount > 0 ? (
              <button
                className="button"
                disabled={isWorking}
                onClick={() => void completeJob(priorityJob.bookingId)}
                type="button"
              >
                {i18n.t("provider_live.action.complete_job")}
              </button>
            ) : null}
            {priorityJobPrimaryAction === "start-work" && priorityJob.beforeEvidenceCount === 0 ? (
              <a className="button" href={`#provider-evidence-${priorityJob.bookingId}`}>
                {i18n.t("provider_live.evidence.add_before")}
              </a>
            ) : null}
            {priorityJobPrimaryAction === "complete" && priorityJob.afterEvidenceCount === 0 ? (
              <a className="button" href={`#provider-evidence-${priorityJob.bookingId}`}>
                {i18n.t("provider_live.evidence.add_after")}
              </a>
            ) : null}
            <a className="button-secondary" href="#provider-jobs">
              {i18n.t("provider_live.action.job_details")}
            </a>
          </div>
        </section>
      ) : (
        <section className="provider-route-focus" aria-label={i18n.t("provider_live.today_path")}>
          <span className="eyebrow">{i18n.t("provider_live.today_path")}</span>
          <h2>{i18n.t("provider_live.no_jobs.title")}</h2>
          <p>{i18n.t("provider_live.no_jobs.body")}</p>
        </section>
      )}

      {provider ? (
        <section className="card">
          <span className="eyebrow">{i18n.t("provider_live.verification.eyebrow")}</span>
          <h2>
            {provider.verificationSummary?.headline ??
              (provider.verificationStatus === "verified"
                ? i18n.t("provider_live.verification.verified_title")
                : provider.verificationStatus === "rejected"
                  ? i18n.t("provider_live.verification.rejected_title")
                  : i18n.t("provider_live.verification.pending_title"))}
          </h2>
          <p>
            {provider.verificationSummary?.summary ??
              (provider.verificationStatus === "verified"
                ? i18n.t("provider_live.verification.verified_body")
                : provider.verificationStatus === "rejected"
                  ? provider.verificationNotes ??
                    i18n.t("provider_live.verification.rejected_body")
                  : i18n.t("provider_live.verification.pending_body"))}
          </p>
          <div className="chip-row">
            <span>{i18n.t("provider_live.verification.status", { status: provider.verificationStatus.replaceAll("-", " ") })}</span>
            <span>
              {i18n.t("provider_live.verification.submitted", {
                date: formatDateTime(i18n, provider.verificationSubmittedAt ?? provider.createdAt)
              })}
            </span>
            {provider.verificationReviewedAt ? (
              <span>{i18n.t("provider_live.verification.last_review", { date: formatDateTime(i18n, provider.verificationReviewedAt) })}</span>
            ) : null}
          </div>
          {provider.verificationSummary?.nextSteps.length ? (
            <div className="stack-sm">
              <p>{i18n.t("provider_live.verification.next_steps")}</p>
              <ul className="timeline">
                {provider.verificationSummary.nextSteps.map((step) => (
                  <li key={step}>
                    <strong>{i18n.t("provider_live.verification.next")}</strong>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {provider.verificationSummary?.checklist.length ? (
            <div className="stack-sm">
              <p>{i18n.t("provider_live.verification.checklist")}</p>
              <ul className="timeline">
                {provider.verificationSummary.checklist.map((item) => (
                  <li key={item.key}>
                    <strong>{formatVerificationChecklistStatus(i18n, item.status)}</strong>
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
          <span className="eyebrow">{i18n.t("provider_live.profile.eyebrow")}</span>
          <h2>{i18n.t("provider_live.profile.title")}</h2>
          <p>{i18n.t("provider_live.profile.body")}</p>
          <div className="stack-md">
            <label className="form-field form-field--full">
              <span>{i18n.t("provider_live.profile.company_name")}</span>
              <input
                type="text"
                value={profileCompanyName}
                onChange={(event) => setProfileCompanyName(event.target.value)}
              />
            </label>
            <label className="form-field form-field--full">
              <span>{i18n.t("provider_live.profile.business_description")}</span>
              <textarea
                rows={4}
                value={profileBio}
                onChange={(event) => setProfileBio(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("provider_live.profile.years_experience")}</span>
              <input
                min={0}
                max={60}
                type="number"
                value={profileYearsExperience}
                onChange={(event) => setProfileYearsExperience(event.target.value)}
              />
            </label>
            <div className="stack-sm">
              <p>{i18n.t("provider_live.profile.services_offered")}</p>
              <div className="chip-row">
                {providerCategoryOptions.map((option) => (
                  <label key={option} className="result-badge">
                    <input
                      type="checkbox"
                      checked={profileCategories.includes(option)}
                      onChange={(event) => toggleProfileCategory(option, event.target.checked)}
                    />{" "}
                    {i18n.t(serviceCategoryToI18nKey(option))}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleProviderProfileUpdate()} type="button">
              {i18n.t("provider_live.profile.save")}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <span className="eyebrow">{i18n.t("provider_live.assistant.eyebrow")}</span>
        <h2>{i18n.t("provider_live.assistant.title")}</h2>
        <p>{i18n.t("provider_live.assistant.body")}</p>
        <details className="service-card-disclosure">
          <summary className="service-card-disclosure__summary">{i18n.t("provider_live.assistant.examples")}</summary>
          <div className="service-card-disclosure__body">
            <ul className="timeline">
              <li>
                <strong>{i18n.t("provider_live.action.review")}</strong>
                <span>{i18n.t("provider_live.assistant.example.review")}</span>
              </li>
              <li>
                <strong>{i18n.t("provider_live.assistant.example.move_label")}</strong>
                <span>{i18n.t("provider_live.assistant.example.move")}</span>
              </li>
              <li>
                <strong>{i18n.t("provider_live.action.staff")}</strong>
                <span>{i18n.t("provider_live.assistant.example.staff")}</span>
              </li>
              <li>
                <strong>{i18n.t("provider_live.step.route")}</strong>
                <span>{i18n.t("provider_live.assistant.example.route")}</span>
              </li>
              <li>
                <strong>{i18n.t("provider_live.assistant.example.issue_label")}</strong>
                <span>{i18n.t("provider_live.assistant.example.issue")}</span>
              </li>
            </ul>
          </div>
        </details>
        <label className="form-field form-field--full">
          <span>{i18n.t("provider_live.assistant.command")}</span>
          <textarea
            rows={3}
            value={assistantCommand}
            onChange={(event) => setAssistantCommand(event.target.value)}
          />
        </label>
        {selectedAssistantBookingId ? <p>{i18n.t("provider_live.assistant.selected_booking", { bookingId: selectedAssistantBookingId })}</p> : null}
        <div className="cta-row">
          <button
            className="button-secondary"
            disabled={isWorking}
            onClick={() => void handleProviderAssistant(false)}
            type="button"
          >
            {i18n.t("provider_live.assistant.preview_command")}
          </button>
          <button
            className="button"
            disabled={isWorking || !assistantResult?.requiresConfirmation}
            onClick={() => void handleProviderAssistant(true)}
            type="button"
          >
            {i18n.t("provider_live.assistant.run_command")}
          </button>
        </div>
        {assistantResult ? (
          <div className="stack-md" style={{ paddingTop: "1rem" }}>
            <article className="list-panel">
              <strong>{assistantResult.previewLabel}</strong>
              <p>{assistantResult.previewMessage}</p>
              {assistantResult.actionTypes && assistantResult.actionTypes.length > 1 ? (
                <p>{i18n.t("provider_live.assistant.planned_steps", { steps: assistantResult.actionTypes.join(" -> ") })}</p>
              ) : null}
              {assistantResult.targetWindowLabel ? <p>{i18n.t("provider_live.assistant.target_window", { window: assistantResult.targetWindowLabel })}</p> : null}
              {assistantResult.lateEtaIso ? (
                <p>
                  {i18n.t("provider_live.assistant.new_eta", {
                    eta: i18n.formatDate(assistantResult.lateEtaIso, { timeStyle: "short" })
                  })}
                </p>
              ) : null}
              {assistantResult.dispatchDaySummary ? (
                <p>
                  {i18n.t("provider_live.assistant.dispatch_day", {
                    routeStatus: assistantResult.dispatchDaySummary.routeStatus,
                    jobs: assistantResult.dispatchDaySummary.yardmatchJobCount,
                    crewGap: assistantResult.dispatchDaySummary.crewGap,
                    miles: assistantResult.dispatchDaySummary.estimatedDriveMiles
                  })}
                </p>
              ) : null}
              {assistantResult.dispatchRangeSummary ? (
                <p>
                  {i18n.t("provider_live.assistant.dispatch_range", {
                    activeDays: assistantResult.dispatchRangeSummary.activeDayCount,
                    watchDays: assistantResult.dispatchRangeSummary.watchDayCount,
                    overloadedDays: assistantResult.dispatchRangeSummary.overloadedDayCount,
                    crewGap: assistantResult.dispatchRangeSummary.totalCrewGap
                  })}
                </p>
              ) : null}
              {assistantResult.dispatchWindowSummary ? (
                <p>
                  {i18n.t("provider_live.assistant.dispatch_window", {
                    window: assistantResult.dispatchWindowSummary.label,
                    jobs: assistantResult.dispatchWindowSummary.yardmatchJobCount,
                    crewGap: assistantResult.dispatchWindowSummary.crewGap,
                    blockedMinutes: assistantResult.dispatchWindowSummary.blockedMinutes
                  })}
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
                    ? i18n.t("provider_live.assistant.matches.focus_area")
                    : assistantResult.actionType === "recommend-dispatch-adjustment"
                      ? i18n.t("provider_live.assistant.matches.pressured_window")
                      : assistantResult.actionType === "recommend-staffing-adjustment"
                        ? i18n.t("provider_live.assistant.matches.need_crew")
                    : i18n.t("provider_live.assistant.matches.default")}
                </p>
                {assistantResult.bookingCandidates.map((candidate) => (
                  <article className="list-panel" key={candidate.bookingId}>
                    <strong>{candidate.customerName}</strong>
                    <p>
                      {candidate.currentWindowLabel} • {formatDateTime(i18n, candidate.scheduledStartIso)}
                    </p>
                    <p>{candidate.addressLine}</p>
                    <button
                      className={selectedAssistantBookingId === candidate.bookingId ? "button" : "button-secondary"}
                      onClick={() => setSelectedAssistantBookingId(candidate.bookingId)}
                      type="button"
                    >
                      {i18n.t("provider_live.assistant.use_appointment")}
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
          <span className="eyebrow">{i18n.t("provider_live.staffing.eyebrow")}</span>
          <h2>
            {totalCrewGap > 0
              ? i18n.t("provider_live.staffing.gap_title", { count: totalCrewGap })
              : i18n.t("provider_live.staffing.covered_title")}
          </h2>
          <p>{i18n.t("provider_live.staffing.body")}</p>
        </div>
        <div className="cta-row">
          <button
            className={provider?.staffingMode === "auto-accept" ? "button" : "button-secondary"}
            disabled={isWorking}
            onClick={() => void handleStaffingModeChange("auto-accept")}
            type="button"
          >
            {i18n.t("provider_live.staffing.auto_accept")}
          </button>
          <button
            className={provider?.staffingMode === "review-first" ? "button" : "button-secondary"}
            disabled={isWorking}
            onClick={() => void handleStaffingModeChange("review-first")}
            type="button"
          >
            {i18n.t("provider_live.staffing.review_first")}
          </button>
        </div>
      </section>

      <section className="grid-three">
        <article className="card">
          <span className="eyebrow">{i18n.t("provider_live.settings.service_area")}</span>
          <h2>{i18n.t("common.format.miles", { count: provider?.serviceRadiusMiles ?? 0 })}</h2>
          <p>{i18n.t("provider_live.settings.service_area_body")}</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { serviceRadiusMiles: Math.max(5, (provider?.serviceRadiusMiles ?? 15) - 5) },
                  i18n.t("provider_live.message.service_radius_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.minus_5_miles")}
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { serviceRadiusMiles: Math.min(60, (provider?.serviceRadiusMiles ?? 15) + 5) },
                  i18n.t("provider_live.message.service_radius_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.plus_5_miles")}
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">{i18n.t("provider_live.settings.reminder_timing")}</span>
          <h2>{i18n.t("provider_live.duration.minutes", { count: provider?.departureReminderLeadMinutes ?? 0 })}</h2>
          <p>{i18n.t("provider_live.settings.reminder_timing_body")}</p>
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
                  i18n.t("provider_live.message.departure_reminder_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.minus_10_min")}
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
                  i18n.t("provider_live.message.departure_reminder_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.plus_10_min")}
            </button>
          </div>
          <p>{i18n.t("provider_live.settings.staffing_reminders", { count: provider?.crewReviewLeadHours ?? 0 })}</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { crewReviewLeadHours: Math.max(1, (provider?.crewReviewLeadHours ?? 24) - 1) },
                  i18n.t("provider_live.message.staffing_review_timing_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.minus_1_hour")}
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { crewReviewLeadHours: Math.min(72, (provider?.crewReviewLeadHours ?? 24) + 1) },
                  i18n.t("provider_live.message.staffing_review_timing_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.plus_1_hour")}
            </button>
          </div>
          <p>
            {i18n.t("provider_live.lead_time.booking_rule", {
              leadTime: formatMinimumLeadHoursLabel(i18n, provider?.minimumBookingLeadHours ?? 0)
            })}
          </p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { minimumBookingLeadHours: Math.max(0, (provider?.minimumBookingLeadHours ?? 0) - 1) },
                  i18n.t("provider_live.message.acceptance_window_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.minus_1_hour")}
            </button>
            <button
              className="button-secondary"
              disabled={isWorking || !provider}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { minimumBookingLeadHours: Math.min(72, (provider?.minimumBookingLeadHours ?? 0) + 1) },
                  i18n.t("provider_live.message.acceptance_window_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.plus_1_hour")}
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">{i18n.t("provider_live.settings.route_leader")}</span>
          <h2>{provider?.routeLeaderMode === "accepted-crew-fallback" ? i18n.t("provider_live.settings.provider_or_crew") : i18n.t("provider_live.settings.provider_only")}</h2>
          <p>{i18n.t("provider_live.settings.route_leader_body")}</p>
          <div className="cta-row">
            <button
              className={provider?.routeLeaderMode === "provider-only" ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { routeLeaderMode: "provider-only" },
                  i18n.t("provider_live.message.route_leader_mode_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.provider_only")}
            </button>
            <button
              className={provider?.routeLeaderMode === "accepted-crew-fallback" ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { routeLeaderMode: "accepted-crew-fallback" },
                  i18n.t("provider_live.message.route_leader_mode_updated")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.allow_crew_fallback")}
            </button>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">{i18n.t("provider_live.settings.payout_timing")}</span>
          <h2>{provider ? formatWeekdayLabel(i18n, provider.weeklyPayoutDay) : formatWeekdayLabel(i18n, "Thu")}</h2>
          <p>{i18n.t("provider_live.settings.payout_timing_body")}</p>
          <p>{i18n.t("provider_live.settings.payout_security_body")}</p>
          <div className="cta-row">
            {(["Tue", "Thu", "Fri"] as const).map((weekday) => (
              <button
                className={provider?.weeklyPayoutDay === weekday ? "button" : "button-secondary"}
                disabled={isWorking}
                key={weekday}
                onClick={() =>
                  void handleDispatchSettingsUpdate(
                    { weeklyPayoutDay: weekday },
                    i18n.t("provider_live.message.weekly_payout_updated")
                  )
                }
                type="button"
              >
                {formatWeekdayLabel(i18n, weekday)}
              </button>
            ))}
          </div>
          <p>
            {i18n.t("provider_live.settings.instant_payouts", {
              state: provider?.instantPayoutsEnabled ? i18n.t("provider_live.settings.enabled") : i18n.t("provider_live.settings.off")
            })}
          </p>
          <div className="cta-row">
            <button
              className={provider?.instantPayoutsEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { instantPayoutsEnabled: true },
                  i18n.t("provider_live.message.instant_payouts_enabled")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.enable_instant")}
            </button>
            <button
              className={!provider?.instantPayoutsEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() =>
                void handleDispatchSettingsUpdate(
                  { instantPayoutsEnabled: false },
                  i18n.t("provider_live.message.instant_payouts_off")
                )
              }
              type="button"
            >
              {i18n.t("provider_live.settings.weekly_only")}
            </button>
          </div>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{jobs.length}</h2>
          <p>{i18n.t("provider_live.metrics.open_jobs")}</p>
        </article>
        <article className="card">
          <h2>{totalAssignedCrew}</h2>
          <p>{i18n.t("provider_live.metrics.crew_assigned")}</p>
        </article>
        <article className="card">
          <h2>{totalCrewGap}</h2>
          <p>{i18n.t("provider_live.metrics.open_crew_slots")}</p>
        </article>
      </section>

      <section className="card">
        <span className="eyebrow">{i18n.t("provider_live.calendar.eyebrow")}</span>
        <h2>{i18n.t("provider_live.calendar.title")}</h2>
        <p>{i18n.t("provider_live.calendar.body")}</p>
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
                    <strong>{i18n.t("provider_live.calendar.health", { status: formatCalendarHealthLabel(i18n, calendarHealth.status) })}</strong>
                    <p>
                      {i18n.t("provider_live.calendar.health_counts", {
                        feeds: calendarHealth.subscriptionCount,
                        importedBlocks: calendarHealth.importedBlockCount,
                        mode: calendarHealth.externalBlockingEnabled
                          ? i18n.t("provider_live.calendar.blocking_on")
                          : i18n.t("provider_live.calendar.save_only")
                      })}
                    </p>
                    <p>
                      {i18n.t("provider_live.calendar.health_issues", {
                        errors: calendarHealth.erroredSubscriptionCount,
                        staleFeeds: calendarHealth.staleSubscriptionCount,
                        conflicts: calendarHealth.conflictingYardmatchJobCount
                      })}
                    </p>
                    <div className="stack-sm" style={{ paddingBottom: 0 }}>
                      {calendarHealth.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </article>
                ) : null}
                <div className="chip-row">
                  <span>{i18n.t("provider_live.calendar.yardmatch_jobs", { count: calendarOverview.yardmatchJobCount })}</span>
                  <span>{i18n.t("provider_live.calendar.outside_blocks", { count: calendarOverview.externalBlockCount })}</span>
                  <span>{i18n.t("provider_live.calendar.total_events", { count: calendarOverview.totalEvents })}</span>
                </div>
                {dispatchDays.length ? (
                  <div className="stack-md">
                    <h3>{i18n.t("provider_live.calendar.dispatch_plan")}</h3>
                    <div className="grid-two">
                      {dispatchDays.map((day) => (
                        <article className="card" key={day.dateIso}>
                          <div className="chip-row" style={{ justifyContent: "space-between" }}>
                            <span>{day.dayLabel}</span>
                            <span>{formatRouteStatusLabel(i18n, day.routeStatus)}</span>
                          </div>
                          <p>
                            {i18n.t("provider_live.calendar.day_summary", {
                              jobs: day.yardmatchJobCount,
                              assigned: day.totalCrewAssigned,
                              required: day.totalCrewRequired,
                              miles: day.estimatedDriveMiles
                            })}
                          </p>
                          <p>
                            {i18n.t("provider_live.calendar.longest_leg", { miles: day.longestDriveLegMiles })}
                            {day.largestIdleGapMinutes ? ` • ${i18n.t("provider_live.calendar.longest_idle_gap", { duration: formatMinutesAsHours(i18n, day.largestIdleGapMinutes) })}` : ""}
                            {day.outlierStopCount ? ` • ${i18n.t("provider_live.calendar.outlier_stops", { count: day.outlierStopCount })}` : ""}
                          </p>
                          <p>
                            {i18n.t("provider_live.calendar.booked_duration", { duration: formatMinutesAsHours(i18n, day.bookedMinutes) })}
                            {day.externalBlockCount ? ` • ${i18n.t("provider_live.calendar.outside_blocks_duration", { duration: formatMinutesAsHours(i18n, day.blockedMinutes) })}` : ""}
                          </p>
                          {day.firstStopAddressLine ? <p>{i18n.t("provider_live.calendar.first_stop", { address: day.firstStopAddressLine })}</p> : null}
                          <div className="stack-md">
                            {day.windowSummaries.map((window) => (
                              <div className="list-panel" key={`${day.dateIso}-${window.windowKey}`}>
                                <strong>{window.label}</strong>
                                <p>
                                  {i18n.t("provider_live.calendar.window_summary", {
                                    jobs: window.yardmatchJobCount,
                                    assigned: window.totalCrewAssigned,
                                    required: window.totalCrewRequired
                                  })}
                                  {window.crewGap ? ` • ${i18n.t("provider_live.step.crew_gap", { count: window.crewGap })}` : ""}
                                </p>
                                {window.externalBlockCount ? (
                                  <p>
                                    {i18n.t("provider_live.calendar.window_outside_blocks", {
                                      count: window.externalBlockCount,
                                      duration: formatMinutesAsHours(i18n, window.blockedMinutes)
                                    })}
                                  </p>
                                ) : (
                                  <p>{i18n.t("provider_live.calendar.booked_duration", { duration: formatMinutesAsHours(i18n, window.bookedMinutes) })}</p>
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
                      {i18n.t("provider_live.calendar.time_range", {
                        start: formatDateTime(i18n, event.startIso),
                        end: formatDateTime(i18n, event.endIso)
                      })}
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
                {i18n.t("provider_live.calendar.sync_stale_feeds")}
              </button>
            </div>
          ) : null}
          <div className="grid-two">
            <label className="form-field">
              <span>{i18n.t("provider_live.calendar.import_title")}</span>
              <input
                value={importTitle}
                onChange={(event) => setImportTitle(event.target.value)}
                placeholder={i18n.t("provider_live.calendar.default_import_title")}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("provider_live.calendar.import_type")}</span>
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
            <span>{i18n.t("provider_live.calendar.external_feed_url")}</span>
            <input
              value={importFeedUrl}
              onChange={(event) => setImportFeedUrl(event.target.value)}
              placeholder={i18n.t("provider_live.calendar.feed_url_placeholder")}
            />
          </label>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleCreateCalendarImport()} type="button">
              {i18n.t("provider_live.calendar.import_outside")}
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
                    {i18n.t("provider_live.calendar.imported_events", { count: subscription.importedEventCount })}
                    {subscription.lastSyncedAt ? ` • ${i18n.t("provider_live.calendar.synced_at", { date: formatDateTime(i18n, subscription.lastSyncedAt) })}` : ""}
                  </p>
                  <p>
                    {i18n.t("provider_live.job.status", {
                      status: subscription.syncStatus === "active"
                        ? i18n.t("provider_live.calendar.sync_active")
                        : i18n.t("provider_live.calendar.sync_issue")
                    })}
                  </p>
                  {subscription.lastError ? <p>{subscription.lastError}</p> : null}
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleSyncCalendarImport(subscription.id)}
                      type="button"
                    >
                      {i18n.t("provider_live.calendar.sync_now")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleRemoveCalendarImport(subscription.id)}
                      type="button"
                    >
                      {i18n.t("provider_live.calendar.remove_feed")}
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
              {i18n.t("provider_live.calendar.blocks_affect_availability")}
            </button>
            <button
              className={!externalBlockingEnabled ? "button" : "button-secondary"}
              disabled={isWorking}
              onClick={() => void handleToggleCalendarBlocking(false)}
              type="button"
            >
              {i18n.t("provider_live.calendar.save_only_no_block")}
            </button>
          </div>
          <div className="grid-two">
            <label className="form-field">
              <span>{i18n.t("provider_live.calendar.block_title")}</span>
              <input
                value={blockTitle}
                onChange={(event) => setBlockTitle(event.target.value)}
                placeholder={i18n.t("provider_live.calendar.block_title_placeholder")}
              />
            </label>
            <label className="form-field">
              <span>{i18n.t("provider_live.calendar.block_type")}</span>
              <select value={blockType} onChange={(event) => setBlockType(event.target.value as ExternalCalendarBlockType)}>
                {externalCalendarBlockOptions.map((option) => (
                  <option key={option} value={option}>
                    {getExternalCalendarBlockLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>{i18n.t("customer.search.start")}</span>
              <input type="datetime-local" value={blockStartLocal} onChange={(event) => setBlockStartLocal(event.target.value)} />
            </label>
            <label className="form-field">
              <span>{i18n.t("customer.search.end")}</span>
              <input type="datetime-local" value={blockEndLocal} onChange={(event) => setBlockEndLocal(event.target.value)} />
            </label>
          </div>
          <label className="form-field form-field--full">
            <span>{i18n.t("customer_live.label.notes")}</span>
            <textarea
              rows={3}
              value={blockNotes}
              onChange={(event) => setBlockNotes(event.target.value)}
              placeholder={i18n.t("provider_live.calendar.block_notes_placeholder")}
            />
          </label>
          <div className="cta-row">
            <button className="button-secondary" disabled={isWorking} onClick={() => void handleAddCalendarBlock()} type="button">
              {i18n.t("provider_live.calendar.add_outside_block")}
            </button>
          </div>
          <div className="stack-md">
            {calendarBlocks.length > 0 ? (
              calendarBlocks.map((block) => (
                <article className="card" key={block.id}>
                  <span className="eyebrow">{getExternalCalendarBlockLabel(block.blockType)}</span>
                  <h3>{block.title}</h3>
                  <p>
                    {i18n.t("provider_live.calendar.time_range", {
                      start: formatDateTime(i18n, block.startIso),
                      end: formatDateTime(i18n, block.endIso)
                    })}
                  </p>
                  {block.notes ? <p>{block.notes}</p> : null}
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleRemoveCalendarBlock(block.id)}
                      type="button"
                    >
                      {i18n.t("provider_live.calendar.remove_block")}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>{i18n.t("provider_live.calendar.no_outside_blocks")}</p>
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
                <span className="eyebrow">{formatServiceCategoryLabel(i18n, job.category)}</span>
                <h2>{job.customerName}</h2>
              </div>
              <strong>{i18n.formatCurrency(job.totalCents)}</strong>
            </div>
            <div className="history-card__grid">
              <div>
                <h3>{i18n.t("provider_live.job.schedule")}</h3>
                <p>{formatBookingWindowSummary(job.scheduledStartIso)}</p>
                <p>{formatDateTime(i18n, job.scheduledStartIso)}</p>
              </div>
              <div>
                <h3>{i18n.t("provider_live.job.address")}</h3>
                <p>{job.serviceAddress.line1}</p>
                <p>
                  {job.serviceAddress.city}, {job.serviceAddress.state} {job.serviceAddress.postalCode}
                </p>
              </div>
              <div>
                <h3>{i18n.t("provider_live.job.staffing")}</h3>
                <p>{i18n.t("provider_live.job.required_crew", { count: job.requiredCrewMembers })}</p>
                <p>{i18n.t("provider_live.job.assigned_crew", { count: job.assignedCrewMembers })}</p>
                <p>{i18n.t("provider_live.job.open_crew", { count: job.crewGap })}</p>
                <p>{i18n.t("provider_live.job.status", { status: getProviderJobStatusLabel(i18n, job) })}</p>
                {provider?.routeLeaderMode === "accepted-crew-fallback" ? (
                  <p>
                    {i18n.t("provider_live.job.route_leader", {
                      name: job.assignedRouteLeaderCrewMemberName ?? i18n.t("provider_live.job.provider")
                    })}
                    {job.requiresRouteLeaderAssignment ? ` • ${i18n.t("provider_live.job.route_leader_pick_hint")}` : ""}
                  </p>
                ) : null}
              </div>
            </div>

            {(job.status === "confirmed" && job.onRouteConfirmedAt) || job.status === "in-progress" ? (
              <section className="evidence-capture-panel" id={`provider-evidence-${job.bookingId}`}>
                <div>
                  <strong>{i18n.t("provider_live.evidence.title")}</strong>
                  <p>
                    {job.status === "in-progress"
                      ? i18n.t("provider_live.evidence.after_help", { count: job.afterEvidenceCount })
                      : i18n.t("provider_live.evidence.before_help", { count: job.beforeEvidenceCount })}
                  </p>
                </div>
                <label className="button-secondary evidence-upload-button">
                  <span>
                    {job.status === "in-progress"
                      ? i18n.t("provider_live.evidence.add_after")
                      : i18n.t("provider_live.evidence.add_before")}
                  </span>
                  <input
                    accept="image/*"
                    aria-label={
                      job.status === "in-progress"
                        ? i18n.t("provider_live.evidence.after_label")
                        : i18n.t("provider_live.evidence.before_label")
                    }
                    capture="environment"
                    className="visually-hidden"
                    disabled={isWorking}
                    onChange={(event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) {
                        return;
                      }
                      void handleEvidencePhoto(
                        job.bookingId,
                        job.status === "in-progress" ? "after" : "before",
                        file
                      ).finally(() => {
                        input.value = "";
                      });
                    }}
                    type="file"
                  />
                </label>
              </section>
            ) : null}

            <div className="cta-row">
              {job.status === "requested" ? (
                <>
                  <button
                    className="button"
                    disabled={isWorking}
                    onClick={() => void handleConfirmBooking(job.bookingId)}
                    type="button"
                  >
                    {i18n.t("provider_live.action.confirm_booking")}
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
                    {i18n.t("provider_live.action.start_route")}
                  </button>
                </>
              ) : null}
              {job.status === "confirmed" && job.onRouteConfirmedAt ? (
                <button
                  className="button"
                  disabled={isWorking || job.beforeEvidenceCount === 0}
                  onClick={() => void handleStartWork(job.bookingId)}
                  type="button"
                >
                  {i18n.t("provider_live.action.start_work")}
                </button>
              ) : null}
              {job.status === "in-progress" ? (
                <button
                  className="button"
                  disabled={isWorking || job.afterEvidenceCount === 0}
                  onClick={() => void completeJob(job.bookingId)}
                  type="button"
                >
                  {i18n.t("provider_live.action.complete_job")}
                </button>
              ) : null}
            </div>

            {job.status === "requested" ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">{i18n.t("customer_live.more_options")}</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void handleDeclineBooking(job.bookingId)}
                      type="button"
                    >
                      {i18n.t("provider_live.action.decline_request")}
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">{i18n.t("provider_live.action.report_issue")}</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleMarkLate(
                          job.bookingId,
                          buildLateEta(job.scheduledStartIso, 15),
                          i18n.t("provider_live.issue.late_15_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("provider_live.issue.late_15")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleMarkLate(
                          job.bookingId,
                          buildLateEta(job.scheduledStartIso, 30),
                          i18n.t("provider_live.issue.late_30_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("provider_live.issue.late_30")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-no-show",
                          i18n.t("provider_live.issue.customer_no_show_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.customer_no_show")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-not-ready",
                          i18n.t("provider_live.issue.customer_not_ready_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.customer_not_ready")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "unable-to-access-property",
                          i18n.t("provider_live.issue.no_access_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.unable_to_access_property")}
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.status === "in-progress" ? (
              <details className="service-card-disclosure">
                <summary className="service-card-disclosure__summary">{i18n.t("provider_live.action.report_issue")}</summary>
                <div className="service-card-disclosure__body">
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-no-show",
                          i18n.t("provider_live.issue.customer_no_show_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.customer_no_show")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "customer-not-ready",
                          i18n.t("provider_live.issue.customer_not_ready_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.customer_not_ready")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "unable-to-access-property",
                          i18n.t("provider_live.issue.no_access_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("booking.exception.unable_to_access_property")}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void handleReportIssue(
                          job.bookingId,
                          "service-could-not-be-completed",
                          i18n.t("provider_live.issue.could_not_complete_reason")
                        )
                      }
                      type="button"
                    >
                      {i18n.t("provider_live.issue.could_not_complete")}
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            {job.lateEtaIso && !job.onRouteConfirmedAt ? (
              <div className="list-panel">
                <strong>{i18n.t("provider_live.job.delay_notice_sent")}</strong>
                <p>
                  {i18n.t("provider_live.job.delay_expected", { date: formatDateTime(i18n, job.lateEtaIso) })}
                  {job.lateReason ? ` ${job.lateReason}` : ""}
                </p>
              </div>
            ) : null}

            {job.activeExceptionType ? (
              <div className="list-panel">
                <strong>{getBookingExceptionLabel(job.activeExceptionType)}</strong>
                <p>
                  {i18n.t("provider_live.job.logged", {
                    date: job.activeExceptionReportedAt
                      ? formatDateTime(i18n, job.activeExceptionReportedAt)
                      : i18n.t("provider_live.just_now")
                  })}
                  {job.activeExceptionNotes ? ` ${job.activeExceptionNotes}` : ""}
                </p>
                <div className="cta-row">
                  <a
                    className="button-secondary"
                    href={`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent(
                      getBookingExceptionLabel(job.activeExceptionType)
                    )}`}
                  >
                    {i18n.t("provider_live.job.open_support")}
                  </a>
                </div>
              </div>
            ) : null}
            {job.status === "disputed" ? (
              <div className="list-panel">
                <strong>{i18n.t("provider_live.job.booking_disputed")}</strong>
                <p>
                  {job.disputeReason ?? i18n.t("provider_live.job.dispute_default")}
                </p>
                <div className="cta-row">
                  <a
                    className="button-secondary"
                    href={addLocalePrefix(`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent(i18n.t("provider_live.subject.disputed_booking_support"))}`, i18n.locale)}
                  >
                    {i18n.t("provider_live.job.open_support")}
                  </a>
                </div>
              </div>
            ) : null}

            {job.requiresRouteLeaderAssignment ? (
              <div className="list-panel">
                <strong>{i18n.t("provider_live.job.route_leader_needed_title")}</strong>
                <p>{i18n.t("provider_live.job.route_leader_needed_body")}</p>
              </div>
            ) : null}
            {job.crewGap > 0 ? (
              <div className="list-panel">
                <strong>{i18n.t("provider_live.job.crew_slots_open", { count: job.crewGap })}</strong>
                <p>{i18n.t("provider_live.job.staffing_options_warning")}</p>
              </div>
            ) : null}
            <details className="service-card-disclosure">
              <summary className="service-card-disclosure__summary">
                {i18n.t("provider_live.job.staffing")}
                {job.matches.length
                  ? ` • ${i18n.t("provider_live.job.staffing_match_count", { count: job.matches.length })}`
                  : ""}
              </summary>
              <div className="service-card-disclosure__body">
                <div className="stack-md">
                  {job.matches.length === 0 ? (
                    <div className="list-panel">
                      <strong>{i18n.t("provider_live.crew.no_matches_title")}</strong>
                      <p>{i18n.t("provider_live.crew.no_matches_body")}</p>
                    </div>
                  ) : (
                    job.matches.map((match) => {
                      return (
                        <div className="list-panel" key={match.id}>
                          <div className="search-result-title">
                            <div>
                              <h3>{match.crewMemberName}</h3>
                              <p>
                                {match.categories.map((category) => formatServiceCategoryLabel(i18n, category)).join(" • ")}
                              </p>
                            </div>
                            <span className="result-badge">{match.status.replaceAll("-", " ")}</span>
                          </div>
                          <p>
                            {i18n.t("provider_live.crew.distance_schedule", {
                              distance: match.distanceMiles,
                              schedule: match.preferredSchedule,
                              days: match.availableWeekdays.join(", ")
                            })}
                          </p>
                          {match.recommendationLabel ? (
                            <p>
                              {formatCrewRecommendationLabel(i18n, match.recommendationLabel)}
                              {typeof match.recommendationScore === "number"
                                ? ` • ${i18n.t("provider_live.crew.score", { score: match.recommendationScore })}`
                                : ""}
                            </p>
                          ) : null}
                          {match.recommendationReasons?.length ? (
                            <p>{match.recommendationReasons.join(" • ")}</p>
                          ) : null}
                          {match.status === "cancelled-by-crew" && match.cancellationReason ? (
                            <p className="warning-copy">{i18n.t("provider_live.crew.note", { note: match.cancellationReason })}</p>
                          ) : null}
                          {match.status === "accepted" && job.assignedRouteLeaderCrewMemberId === match.crewMemberId ? (
                            <p>{i18n.t("provider_live.crew.assigned_route_leader")}</p>
                          ) : null}
                          <p>{i18n.t("provider_live.crew.hourly_rate", { rate: i18n.formatCurrency(match.hourlyRateCents) })}</p>
                          <div className="cta-row">
                            {match.status === "pending-provider-review" ? (
                              <>
                                <button
                                  className="button"
                                  disabled={isWorking}
                                  onClick={() => void handleReviewMatch(match.id, "accept")}
                                  type="button"
                                >
                                  {i18n.t("provider_live.crew.accept")}
                                </button>
                                <button
                                  className="button-secondary"
                                  disabled={isWorking}
                                  onClick={() => void handleReviewMatch(match.id, "deny")}
                                  type="button"
                                >
                                  {i18n.t("provider_live.crew.deny")}
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
                                  ? i18n.t("provider_live.crew.assigned_route_leader_button")
                                  : i18n.t("provider_live.crew.lead_this_route")}
                              </button>
                            ) : null}
                            <a className="button-secondary" href={`tel:${match.crewMemberPhone}`}>
                              {i18n.t("provider_live.crew.call")}
                            </a>
                            <a
                              className="button-secondary"
                              href={addLocalePrefix(`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=general&subject=${encodeURIComponent(i18n.t("provider_live.subject.crew_staffing_support"))}`, i18n.locale)}
                            >
                              {i18n.t("crew_live.action.get_help")}
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
                        {i18n.t("provider_live.crew.clear_route_leader")}
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
                    <h3>{i18n.t("provider_live.chat.title")}</h3>
                    <p>{i18n.t("provider_live.chat.body")}</p>
                  </div>
                </div>
                <div className="cta-row">
                  <button
                    className="button-secondary"
                    onClick={() => void openCustomerChat(job.bookingId)}
                    type="button"
                  >
                    {i18n.t("provider_live.chat.message_customer")}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => void openArrivalTracking(job.bookingId)}
                    type="button"
                  >
                    {i18n.t("customer_live.action.track_crew")}
                  </button>
                  <a
                    className="button-secondary"
                    href={addLocalePrefix(`/help?bookingId=${encodeURIComponent(job.bookingId)}&issueType=service-quality&subject=${encodeURIComponent(i18n.t("provider_live.subject.customer_job_support"))}`, i18n.locale)}
                  >
                    {i18n.t("crew_live.action.get_help")}
                  </a>
                </div>
                {activeTrackingBookingId === job.bookingId && activeTracking ? (
                  <ArrivalTrackingPanel
                    showProviderRouteDetails
                    subtitle={job.customerName}
                    title={i18n.t("provider_live.chat.arrival_route_title")}
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
          inputPlaceholder={i18n.t("provider_live.chat.input_placeholder")}
          isOpen={Boolean(activeBookingId)}
          launcherLabel={i18n.t("provider_live.chat.open_customer_chat")}
          messages={activeCustomerThread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            senderLabel:
              message.senderRole === "provider" ? i18n.t("customer_live.chat.you") : activeCustomerThread.thread.customerName,
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
          title={i18n.t("provider_live.chat.title")}
        />
      ) : null}
    </div>
  );
}
