"use client";

import {
  BookingArrivalTracking,
  CustomerProviderConversationThread,
  ProviderStaffingOverview
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient, loadStoredSession } from "../lib/api";
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

export function ProviderLiveManagementBoard() {
  const [sessionReady, setSessionReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [activeCustomerThread, setActiveCustomerThread] = useState<
    CustomerProviderConversationThread | undefined
  >();
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [activeTracking, setActiveTracking] = useState<BookingArrivalTracking | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  const provider = overview?.provider;
  const jobs = overview?.jobs ?? [];
  const totalAssignedCrew = useMemo(
    () => jobs.reduce((sum, job) => sum + job.assignedCrewMembers, 0),
    [jobs]
  );
  const totalCrewGap = useMemo(() => jobs.reduce((sum, job) => sum + job.crewGap, 0), [jobs]);

  async function loadProviderView() {
    const session = loadStoredSession();
    if (!session || session.role !== "provider") {
      setAccessDenied(true);
      setSessionReady(true);
      return;
    }

    setAccessDenied(false);
    const api = createAuthenticatedWebApiClient();
    const nextOverview = await api.getProviderStaffingOverview();
    setOverview(nextOverview);
    setSessionReady(true);
  }

  useEffect(() => {
    void loadProviderView().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the provider portal.");
      setSessionReady(true);
    });
  }, []);

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
                <p>{formatDateTime(job.scheduledStartIso)}</p>
                <p>{formatDateTime(job.scheduledEndIso)}</p>
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
            </div>

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
                    <p>Crew is on the way. Chat is now open with the property owner.</p>
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
