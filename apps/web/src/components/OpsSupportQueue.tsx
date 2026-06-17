"use client";

import {
  BookingEvidenceReviewStatus,
  CreateOpsBookingInterventionRequest,
  MarketplaceApiClient,
  CreateOpsRefundOverrideRequest,
  ReviewBookingEvidenceForOpsRequest,
  SupportOpsTicket,
  SupportTicket,
  SupportTicketStatus
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { getWebApiBaseUrl } from "../lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDateTimeLocalInput(iso: string) {
  const value = new Date(iso);
  const offsetMinutes = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}

function requiresReviewedEvidenceBeforeResolution(ticket: SupportOpsTicket) {
  const hasEvidence = (ticket.booking?.serviceEvidence.length ?? 0) > 0;
  if (!hasEvidence) {
    return false;
  }

  const reviewedCount = ticket.evidenceSummary?.reviewedCount ?? 0;
  if (reviewedCount > 0) {
    return false;
  }

  return (
    ticket.ticket.issueType === "billing" ||
    ticket.ticket.issueType === "service-quality" ||
    ticket.booking?.status === "disputed"
  );
}

export function OpsSupportQueue() {
  const [tickets, setTickets] = useState<SupportOpsTicket[]>([]);
  const [refundOverrideDrafts, setRefundOverrideDrafts] = useState<Record<string, string>>({});
  const [interventionDrafts, setInterventionDrafts] = useState<
    Record<string, { note: string; scheduledStartLocal: string; scheduledEndLocal: string }>
  >({});
  const [evidenceReviewDrafts, setEvidenceReviewDrafts] = useState<
    Record<string, { reviewStatus: BookingEvidenceReviewStatus; reviewNotes: string }>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadQueue() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    const nextTickets = await api.getOpsSupportTickets();
    setTickets(nextTickets);
  }

  useEffect(() => {
    void loadQueue().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the ops queue.");
    });
  }, []);

  async function updateTicket(
    ticketId: string,
    status: SupportTicketStatus,
    resolutionAction?: SupportTicket["resolutionAction"],
    resolutionNotes?: string
  ) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.updateOpsSupportTicket({
        ticketId,
        status,
        resolutionAction,
        resolutionNotes
      });
      setStatusMessage(
        status === "triaged"
          ? "Ticket triaged."
          : resolutionAction === "approve-refund"
            ? "Refund approved and payment reversed."
            : resolutionAction === "deny-refund"
              ? "Refund review denied and payment left captured."
              : "Ticket resolved and booking state updated."
      );
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that ticket.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openRefundOverride(ticketId: string, paymentId: string) {
    const reason = (refundOverrideDrafts[ticketId] ?? "").trim();
    if (!reason) {
      setErrorMessage("A refund reason is required before customer service opens a refund review.");
      return;
    }

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.createOpsRefundOverride({
        ticketId,
        paymentId,
        reason
      } satisfies CreateOpsRefundOverrideRequest);
      setRefundOverrideDrafts((current) => ({
        ...current,
        [ticketId]: ""
      }));
      setStatusMessage("Customer service opened a refund review and placed payouts on hold.");
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open that refund review.");
    } finally {
      setIsWorking(false);
    }
  }

  function getInterventionDraft(ticket: SupportOpsTicket) {
    if (!ticket.booking) {
      return {
        note: "",
        scheduledStartLocal: "",
        scheduledEndLocal: ""
      };
    }

    return (
      interventionDrafts[ticket.ticket.id] ?? {
        note: "",
        scheduledStartLocal: formatDateTimeLocalInput(ticket.booking.scheduledStartIso),
        scheduledEndLocal: formatDateTimeLocalInput(ticket.booking.scheduledEndIso)
      }
    );
  }

  function getEvidenceReviewDraft(ticketId: string, evidenceId: string) {
    return (
      evidenceReviewDrafts[`${ticketId}:${evidenceId}`] ?? {
        reviewStatus: "inconclusive" as BookingEvidenceReviewStatus,
        reviewNotes: ""
      }
    );
  }

  async function applyIntervention(
    ticket: SupportOpsTicket,
    action: CreateOpsBookingInterventionRequest["action"]
  ) {
    if (!ticket.booking) {
      setErrorMessage("This support ticket is not tied to a booking.");
      return;
    }

    const draft = getInterventionDraft(ticket);
    const note = draft.note.trim();
    if (!note) {
      setErrorMessage("An ops intervention note is required.");
      return;
    }

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.createOpsBookingIntervention({
        bookingId: ticket.booking.id,
        ticketId: ticket.ticket.id,
        action,
        note,
        scheduledStartIso:
          action === "reschedule-booking" ? new Date(draft.scheduledStartLocal).toISOString() : undefined,
        scheduledEndIso:
          action === "reschedule-booking" ? new Date(draft.scheduledEndLocal).toISOString() : undefined
      } satisfies CreateOpsBookingInterventionRequest);
      setStatusMessage(
        action === "add-note"
          ? "Ops note saved to the booking history."
          : action === "reschedule-booking"
            ? "Booking rescheduled and customers/providers notified."
            : action === "cancel-booking"
              ? "Booking cancelled through ops intervention."
              : action === "complete-booking"
                ? "Booking completed through ops intervention."
                : "Booking restored to the active schedule."
      );
      setInterventionDrafts((current) => ({
        ...current,
        [ticket.ticket.id]: {
          ...draft,
          note: ""
        }
      }));
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to apply that booking intervention.");
    } finally {
      setIsWorking(false);
    }
  }

  async function reviewEvidence(
    ticket: SupportOpsTicket,
    evidenceId: string
  ) {
    if (!ticket.booking) {
      setErrorMessage("This support ticket is not tied to a booking.");
      return;
    }

    const draft = getEvidenceReviewDraft(ticket.ticket.id, evidenceId);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.reviewBookingEvidenceForOps({
        bookingId: ticket.booking.id,
        ticketId: ticket.ticket.id,
        evidenceId,
        reviewStatus: draft.reviewStatus,
        reviewNotes: draft.reviewNotes.trim() || undefined
      } satisfies ReviewBookingEvidenceForOpsRequest);
      setStatusMessage("Evidence review saved to the booking record.");
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that evidence review.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">Support queue</span>
      <h2>Resolve disputes and field issues.</h2>
      <p>
        Triage live incidents, then resolve them with an explicit booking outcome so customers and
        providers land in a clean state.
      </p>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      <div className="stack-lg" style={{ paddingBottom: 0 }}>
        {tickets.length > 0 ? (
          tickets.map((supportTicket) => {
            const {
              ticket,
              booking,
              payment,
              customerName,
              providerName,
              evidenceSummary,
              resolutionGuidance,
              timeline
            } = supportTicket;
            const resolutionLockedForEvidenceReview =
              requiresReviewedEvidenceBeforeResolution(supportTicket);

            return (
            <article className="list-panel" key={ticket.id}>
              <div className="search-result-title">
                <div>
                  <h3>{ticket.subject}</h3>
                  <p>
                    {ticket.issueType.replaceAll("-", " ")} • {ticket.status} • opened{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <span className="result-badge">{ticket.status}</span>
              </div>
              <p>{ticket.description}</p>
              {booking ? (
                <div className="stack-md">
                  <p>
                    Booking: {booking.category.replaceAll("-", " ")} • {formatDateTime(booking.scheduledStartIso)}
                  </p>
                  <p>
                    Customer: {customerName ?? booking.customerId} • Provider:{" "}
                    {providerName ?? booking.providerId}
                  </p>
                  <p>
                    Booking state: {booking.status}
                    {booking.disputeReason ? ` • dispute: ${booking.disputeReason}` : ""}
                    {booking.activeExceptionType ? ` • issue: ${booking.activeExceptionType}` : ""}
                  </p>
                  {evidenceSummary ? (
                    <div className="list-panel" style={{ padding: "0.9rem" }}>
                      <strong>Evidence signal</strong>
                      <p>
                        {evidenceSummary.photoCount} photos • {evidenceSummary.noteCount} notes •{" "}
                        {evidenceSummary.checklistCount} checklists
                      </p>
                      <p>
                        Reviewed {evidenceSummary.reviewedCount} • supports provider{" "}
                        {evidenceSummary.supportsProviderCount} • supports customer{" "}
                        {evidenceSummary.supportsCustomerCount} • inconclusive{" "}
                        {evidenceSummary.inconclusiveCount} • unreviewed {evidenceSummary.unreviewedCount}
                      </p>
                      {resolutionGuidance ? (
                        <p className="warning-copy" style={{ marginBottom: 0 }}>
                          Guidance:{" "}
                          {resolutionGuidance.recommendedAction
                            ? `${resolutionGuidance.recommendedAction.replaceAll("-", " ")}`
                            : "manual review"}{" "}
                          • {resolutionGuidance.confidence} confidence • {resolutionGuidance.rationale}
                        </p>
                      ) : null}
                      {resolutionLockedForEvidenceReview ? (
                        <p className="warning-copy" style={{ marginBottom: 0 }}>
                          Resolve actions stay locked until ops reviews at least one submitted evidence item.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <p>
                    Evidence: before photos{" "}
                    {
                      booking.serviceEvidence.filter(
                        (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo"
                      ).length
                    }{" "}
                    • after photos{" "}
                    {
                      booking.serviceEvidence.filter(
                        (evidence) => evidence.phase === "after" && evidence.evidenceType === "photo"
                      ).length
                    }{" "}
                    • notes{" "}
                    {booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "note").length} •
                    checklists{" "}
                    {
                      booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "checklist").length
                    }
                  </p>
                  {booking.serviceEvidence.length > 0 ? (
                    <div className="stack-md">
                      {(["before", "after"] as const).map((phase) => {
                        const evidenceItems = booking.serviceEvidence.filter((evidence) => evidence.phase === phase);
                        if (evidenceItems.length === 0) {
                          return null;
                        }

                        return (
                          <div key={phase} className="stack-md">
                            <p>{phase === "before" ? "Before-work evidence" : "After-work evidence"}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                              {evidenceItems.slice(0, 6).map((evidence) => (
                                <div
                                  key={evidence.id}
                                  style={{
                                    display: "grid",
                                    gap: "0.5rem",
                                    width: "12rem"
                                  }}
                                >
                                  {evidence.evidenceType === "photo" && evidence.imageDataUrl ? (
                                    <img
                                      alt={`${phase} evidence`}
                                      src={evidence.imageDataUrl}
                                      style={{
                                        width: "7rem",
                                        height: "7rem",
                                        objectFit: "cover",
                                        borderRadius: "1rem",
                                        border: "1px solid rgba(21, 54, 47, 0.12)"
                                      }}
                                    />
                                  ) : null}
                                  {evidence.evidenceType === "note" ? (
                                    <div className="list-panel" style={{ padding: "0.75rem" }}>
                                      <strong>Onsite note</strong>
                                      <p style={{ margin: "0.35rem 0 0 0" }}>{evidence.note}</p>
                                    </div>
                                  ) : null}
                                  {evidence.evidenceType === "checklist" ? (
                                    <div className="list-panel" style={{ padding: "0.75rem" }}>
                                      <strong>Checklist</strong>
                                      <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.35rem" }}>
                                        {(evidence.checklistItems ?? []).map((item) => (
                                          <p key={item.label} style={{ margin: 0 }}>
                                            {item.completed ? "Done" : "Open"} • {item.label}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <p style={{ margin: 0, fontSize: "0.9rem" }}>
                                    {evidence.capturedByRole} • {formatDateTime(evidence.capturedAt)}
                                  </p>
                                  {evidence.evidenceType !== "note" && evidence.note ? (
                                    <p style={{ margin: 0 }}>{evidence.note}</p>
                                  ) : null}
                                  {evidence.reviewStatus ? (
                                    <p className="warning-copy" style={{ margin: 0 }}>
                                      Ops review: {evidence.reviewStatus.replaceAll("-", " ")}
                                      {evidence.reviewNotes ? ` • ${evidence.reviewNotes}` : ""}
                                    </p>
                                  ) : null}
                                  <label>
                                    Evidence review
                                    <select
                                      onChange={(event) =>
                                        setEvidenceReviewDrafts((current) => ({
                                          ...current,
                                          [`${ticket.id}:${evidence.id}`]: {
                                            ...getEvidenceReviewDraft(ticket.id, evidence.id),
                                            reviewStatus: event.target.value as BookingEvidenceReviewStatus
                                          }
                                        }))
                                      }
                                      value={getEvidenceReviewDraft(ticket.id, evidence.id).reviewStatus}
                                    >
                                      <option value="supports-provider">Supports provider</option>
                                      <option value="supports-customer">Supports customer</option>
                                      <option value="inconclusive">Inconclusive</option>
                                    </select>
                                  </label>
                                  <label>
                                    Ops evidence notes
                                    <textarea
                                      onChange={(event) =>
                                        setEvidenceReviewDrafts((current) => ({
                                          ...current,
                                          [`${ticket.id}:${evidence.id}`]: {
                                            ...getEvidenceReviewDraft(ticket.id, evidence.id),
                                            reviewNotes: event.target.value
                                          }
                                        }))
                                      }
                                      rows={2}
                                      value={getEvidenceReviewDraft(ticket.id, evidence.id).reviewNotes}
                                    />
                                  </label>
                                  <button
                                    className="button-secondary"
                                    disabled={isWorking}
                                    onClick={() =>
                                      void reviewEvidence(
                                        supportTicket,
                                        evidence.id
                                      )
                                    }
                                    type="button"
                                  >
                                    Save evidence review
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {payment ? (
                    <p>
                      Payment: {payment.status}
                      {payment.refundReviewStatus ? ` • refund review ${payment.refundReviewStatus}` : ""}
                      {payment.refundReason ? ` • reason: ${payment.refundReason}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {ticket.resolutionNotes ? <p>Resolution: {ticket.resolutionNotes}</p> : null}
              {timeline.length > 0 ? (
                <div className="stack-md">
                  <p>Support timeline</p>
                  {timeline.map((entry) => (
                    <article className="list-panel" key={entry.id}>
                      <h3>{entry.title}</h3>
                      <p>
                        {formatDateTime(entry.occurredAt)} • {entry.actorRole.replaceAll("-", " ")}
                      </p>
                      <p>{entry.detail}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              {booking ? (
                <div className="stack-md">
                  <label>
                    Ops intervention note
                    <textarea
                      onChange={(event) =>
                        setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                            ...getInterventionDraft(supportTicket),
                            note: event.target.value
                          }
                        }))
                      }
                      rows={3}
                      value={getInterventionDraft(supportTicket).note}
                    />
                  </label>
                  <div className="grid-two">
                    <label>
                      New start
                      <input
                        onChange={(event) =>
                          setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                              ...getInterventionDraft(supportTicket),
                              scheduledStartLocal: event.target.value
                            }
                          }))
                        }
                        type="datetime-local"
                        value={getInterventionDraft(supportTicket).scheduledStartLocal}
                      />
                    </label>
                    <label>
                      New end
                      <input
                        onChange={(event) =>
                          setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                              ...getInterventionDraft(supportTicket),
                              scheduledEndLocal: event.target.value
                            }
                          }))
                        }
                        type="datetime-local"
                        value={getInterventionDraft(supportTicket).scheduledEndLocal}
                      />
                    </label>
                  </div>
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void applyIntervention(supportTicket, "add-note")}
                      type="button"
                    >
                      Save note
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          "reschedule-booking"
                        )
                      }
                      type="button"
                    >
                      Reschedule
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          "restore-active-booking"
                        )
                      }
                      type="button"
                    >
                      Restore active
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          "complete-booking"
                        )
                      }
                      type="button"
                    >
                      Complete booking
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          "cancel-booking"
                        )
                      }
                      type="button"
                    >
                      Cancel booking
                    </button>
                  </div>
                  {booking.interventions.length > 0 ? (
                    <div className="stack-md">
                      <p>Intervention history</p>
                      {booking.interventions
                        .slice()
                        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                        .map((intervention) => (
                          <article className="list-panel" key={intervention.id}>
                            <h3>{intervention.action.replaceAll("-", " ")}</h3>
                            <p>{formatDateTime(intervention.createdAt)}</p>
                            <p>{intervention.note}</p>
                            {intervention.nextScheduledStartIso ? (
                              <p>
                                New window: {formatDateTime(intervention.nextScheduledStartIso)}
                                {intervention.nextScheduledEndIso
                                  ? ` to ${formatDateTime(intervention.nextScheduledEndIso)}`
                                  : ""}
                              </p>
                            ) : null}
                          </article>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="cta-row">
                {ticket.status === "open" ? (
                  <button
                    className="button-secondary"
                    disabled={isWorking}
                    onClick={() => void updateTicket(ticket.id, "triaged")}
                    type="button"
                  >
                    Mark triaged
                  </button>
                ) : null}
                {ticket.status !== "resolved" && ticket.issueType === "billing" && payment?.refundReviewStatus === "requested" ? (
                  <>
                  <button
                    className="button-secondary"
                    disabled={isWorking || resolutionLockedForEvidenceReview}
                    onClick={() =>
                      void updateTicket(
                        ticket.id,
                          "resolved",
                          "approve-refund",
                          "Support approved the refund review and reversed the customer payment."
                        )
                      }
                      type="button"
                    >
                      Approve refund
                    </button>
                  <button
                    className="button-secondary"
                    disabled={isWorking || resolutionLockedForEvidenceReview}
                    onClick={() =>
                      void updateTicket(
                        ticket.id,
                          "resolved",
                          "deny-refund",
                          "Support reviewed the refund request and kept the payment captured."
                        )
                      }
                      type="button"
                    >
                      Deny refund
                    </button>
                  </>
                ) : null}
                {ticket.status !== "resolved" &&
                ticket.issueType === "billing" &&
                payment?.status === "captured" &&
                payment.refundReviewStatus !== "requested" ? (
                  <div className="stack-md">
                    <label>
                      Customer service refund note
                      <textarea
                        onChange={(event) =>
                          setRefundOverrideDrafts((current) => ({
                            ...current,
                            [ticket.id]: event.target.value
                          }))
                        }
                        rows={3}
                        value={refundOverrideDrafts[ticket.id] ?? ""}
                      />
                    </label>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void openRefundOverride(ticket.id, payment.id)}
                      type="button"
                    >
                      Open refund review
                    </button>
                  </div>
                ) : null}
                {ticket.status !== "resolved" && ticket.issueType !== "billing" ? (
                  <>
                    <button
                      className="button-secondary"
                      disabled={isWorking || resolutionLockedForEvidenceReview}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "restore-active-booking",
                          "Support reviewed the issue and restored the booking to the active schedule."
                        )
                      }
                      type="button"
                    >
                      Resolve and restore
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || resolutionLockedForEvidenceReview}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "cancel-booking",
                          "Support resolved the issue by cancelling the booking."
                        )
                      }
                      type="button"
                    >
                      Resolve and cancel
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || resolutionLockedForEvidenceReview}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "complete-booking",
                          "Support confirmed the service should be treated as complete."
                        )
                      }
                      type="button"
                    >
                      Resolve and complete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
          })
        ) : (
          <p>No support tickets yet.</p>
        )}
      </div>
    </section>
  );
}
