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
  ProviderStaffingOverview
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

const externalCalendarBlockOptions: ExternalCalendarBlockType[] = [
  "off-platform-client",
  "personal-time",
  "travel-buffer",
  "equipment-maintenance"
];
const externalCalendarImportProviders: ExternalCalendarProvider[] = ["google", "apple", "ical"];

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
  const nextRouteJob = useMemo(
    () =>
      jobs
        .filter((job) => job.status === "confirmed" && !job.onRouteConfirmedAt)
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [jobs]
  );

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

  async function handleStaffingModeChange(staffingMode: "auto-accept" | "review-first") {
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
        staffingMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setStatusMessage(
        staffingMode === "auto-accept"
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

  async function handleDispatchSettingsUpdate(
    updates: Partial<
      Pick<
        ProviderProfile,
        | "serviceRadiusMiles"
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
      await api.updateProviderSettings({
        serviceRadiusMiles: updates.serviceRadiusMiles ?? provider.serviceRadiusMiles,
        staffingMode: updates.staffingMode ?? provider.staffingMode,
        crewReviewLeadHours: updates.crewReviewLeadHours ?? provider.crewReviewLeadHours,
        departureReminderLeadMinutes:
          updates.departureReminderLeadMinutes ?? provider.departureReminderLeadMinutes,
        routeLeaderMode: updates.routeLeaderMode ?? provider.routeLeaderMode,
        weeklyPayoutDay: updates.weeklyPayoutDay ?? provider.weeklyPayoutDay,
        instantPayoutsEnabled:
          updates.instantPayoutsEnabled ?? provider.instantPayoutsEnabled,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setStatusMessage(successMessage);
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
        <p>Use the seeded provider account to test live jobs, staffing review, and chat.</p>
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

      {provider ? (
        <section className="card">
          <span className="eyebrow">Business verification</span>
          <h2>
            {provider.verificationStatus === "verified"
              ? "Your business is verified and visible in search."
              : provider.verificationStatus === "rejected"
                ? "Your business needs a quick profile update before going live."
                : "Your business is pending review before it appears in search."}
          </h2>
          <p>
            {provider.verificationStatus === "verified"
              ? "Customers can now discover this business in public YardMatch search results."
              : provider.verificationStatus === "rejected"
                ? provider.verificationNotes ??
                  "Ops left review notes for this business before it can be shown to customers."
                : "Ops will review the business profile, service area, and marketplace details before customers can book."}
          </p>
          <div className="chip-row">
            <span>Status: {provider.verificationStatus.replaceAll("-", " ")}</span>
            <span>
              Submitted:{" "}
              {formatDateTime(provider.verificationSubmittedAt ?? provider.createdAt)}
            </span>
            {provider.verificationReviewedAt ? (
              <span>Reviewed: {formatDateTime(provider.verificationReviewedAt)}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="card">
        <span className="eyebrow">Assistant</span>
        <h2>Change bookings in plain language.</h2>
        <p>
          Try a command like “Change my afternoon appointment to evening and notify the customer.”
        </p>
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
              {assistantResult.targetWindowLabel ? <p>Target window: {assistantResult.targetWindowLabel}</p> : null}
              {assistantResult.customerNotificationPreview ? (
                <p>{assistantResult.customerNotificationPreview}</p>
              ) : null}
            </article>
            {assistantResult.bookingCandidates.length > 1 ? (
              <div className="stack-md">
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
              <a className="button-secondary" href={calendarSubscription.feedUrl} target="_blank" rel="noreferrer">
                Open feed URL
              </a>
              <a className="button-secondary" href={calendarSubscription.webcalUrl}>
                Subscribe with webcal
              </a>
            </div>
            <div className="stack-md" style={{ paddingTop: "1rem" }}>
              {calendarSubscription.instructions.map((instruction) => (
                <p key={instruction}>{instruction}</p>
              ))}
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

      {nextRouteJob ? (
        <section className="card">
          <span className="eyebrow">Leave soon</span>
          <h2>{nextRouteJob.customerName}</h2>
          <p>
            {formatBookingWindowSummary(nextRouteJob.scheduledStartIso)} • {nextRouteJob.serviceAddress.line1}
          </p>
          <p>
            In v1 the business owner starts the route for the job. Once you head out, customer
            tracking goes live automatically.
          </p>
          <div className="cta-row">
            <button
              className="button"
              disabled={isWorking}
              onClick={() => void handleStartRoute(nextRouteJob.bookingId)}
              type="button"
            >
              Start route
            </button>
          </div>
        </section>
      ) : null}

      <section className="stack-lg">
        {jobs.map((job) => (
          <article className="history-card" key={job.bookingId}>
            <div className="history-card__header">
              <div>
                <span className="eyebrow">{job.category.replaceAll("-", " ")}</span>
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
                <p>Status: {job.status.replaceAll("-", " ")}</p>
              </div>
            </div>

            <div className="cta-row">
              {job.status === "requested" ? (
                <button
                  className="button"
                  disabled={isWorking}
                  onClick={() => void handleConfirmBooking(job.bookingId)}
                  type="button"
                >
                  Confirm booking
                </button>
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
                </>
              ) : null}
              {job.status === "confirmed" && job.onRouteConfirmedAt ? (
                <button
                  className="button-secondary"
                  disabled={isWorking}
                  onClick={() => void handleStartWork(job.bookingId)}
                  type="button"
                >
                  Start work
                </button>
              ) : null}
              {(job.status === "confirmed" || job.status === "in-progress") ? (
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
              ) : null}
              {(job.status === "confirmed" || job.status === "in-progress") ? (
                <button
                  className="button-secondary"
                  disabled={isWorking}
                  onClick={() => void completeJob(job.bookingId)}
                  type="button"
                >
                  Complete job
                </button>
              ) : null}
              {(job.status === "confirmed" || job.status === "in-progress") ? (
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
              ) : null}
              {(job.status === "confirmed" || job.status === "in-progress") ? (
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
              ) : null}
              {job.status === "in-progress" ? (
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
              ) : null}
            </div>

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
            </div>

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
