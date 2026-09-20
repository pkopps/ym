"use client";

import {
  BookingEvidenceReviewStatus,
  CreateOpsBookingInterventionRequest,
  CreateOpsRefundOverrideRequest,
  ReviewBookingEvidenceForOpsRequest,
  SupportOpsTicket,
  SupportTicket,
  SupportTicketStatus
} from "@yardmatch/contracts";
import { ComplaintReviewPanel } from "./ComplaintReviewPanel";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

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

function shouldKeepCompletedBooking(ticket: SupportOpsTicket) {
  return Boolean(ticket.booking?.completedAt);
}

function isActionBlockedByPolicy(
  policy: SupportOpsTicket["resolutionPolicy"],
  action: SupportTicket["resolutionAction"]
) {
  return action ? (policy?.blockedActions ?? []).includes(action) : false;
}

function isDetailedManualRationale(
  note: string,
  policy: SupportOpsTicket["resolutionPolicy"]
) {
  if (!policy?.requiresDetailedRationale) {
    return true;
  }

  const normalized = note.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized.length < (policy.minimumDetailedRationaleLength ?? 48)) {
    return false;
  }

  return !(policy.disallowedDetailedRationaleNotes ?? []).includes(normalized);
}

export function OpsSupportQueue() {
  const i18n = useI18n();
  const [tickets, setTickets] = useState<SupportOpsTicket[]>([]);
  const [refundOverrideDrafts, setRefundOverrideDrafts] = useState<Record<string, string>>({});
  const [interventionDrafts, setInterventionDrafts] = useState<
    Record<string, { note: string; scheduledStartLocal: string; scheduledEndLocal: string }>
  >({});
  const [resolutionNoteDrafts, setResolutionNoteDrafts] = useState<Record<string, string>>({});
  const [evidenceReviewDrafts, setEvidenceReviewDrafts] = useState<
    Record<string, { reviewStatus: BookingEvidenceReviewStatus; reviewNotes: string }>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadQueue() {
    const api = createAuthenticatedWebApiClient();
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
      const api = createAuthenticatedWebApiClient();
      const updatedTicket = await api.updateOpsSupportTicket({
        ticketId,
        status,
        resolutionAction,
        resolutionNotes
      });
      setStatusMessage(
        updatedTicket.status !== "resolved" && status === "resolved"
          ? updatedTicket.resolutionNotes ?? "The case remains open for payment reconciliation."
          : status === "triaged"
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
      setErrorMessage(i18n.t("ops_auto.ops_support_queue.a_refund_reason_is_required_before_customer_service_46unxq"));
      return;
    }

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
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
        reviewStatus: "inconclusive",
        reviewNotes: ""
      }
    );
  }

  function getResolutionNoteDraft(ticketId: string) {
    return resolutionNoteDrafts[ticketId] ?? "";
  }

  async function applyIntervention(
    ticket: SupportOpsTicket,
    action: CreateOpsBookingInterventionRequest["action"]
  ) {
    if (!ticket.booking) {
      setErrorMessage(i18n.t("ops_auto.ops_support_queue.this_support_ticket_is_not_tied_to_a_rlzu7j"));
      return;
    }

    const draft = getInterventionDraft(ticket);
    const note = draft.note.trim();
    if (!note) {
      setErrorMessage(i18n.t("ops_auto.ops_support_queue.an_ops_intervention_note_is_required_mbr2nz"));
      return;
    }

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
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
      setErrorMessage(i18n.t("ops_auto.ops_support_queue.this_support_ticket_is_not_tied_to_a_rlzu7j"));
      return;
    }

    const draft = getEvidenceReviewDraft(ticket.ticket.id, evidenceId);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
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
      <span className="eyebrow">{i18n.t("ops_auto.ops_support_queue.support_queue_r58hb4")}</span>
      <h2>{i18n.t("ops_auto.ops_support_queue.resolve_disputes_and_field_issues_mis84o")}</h2>
      <p>
        {i18n.t("ops_auto.ops_support_queue.triage_live_incidents_then_resolve_them_with_an_e7b7ep")} </p>
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
              resolutionPolicy,
              timeline
            } = supportTicket;
            const resolutionLockedForEvidenceReview =
              Boolean(resolutionPolicy?.requiresEvidenceReview && (evidenceSummary?.reviewedCount ?? 0) === 0);
            const keepCompletedBooking = shouldKeepCompletedBooking(supportTicket);
            const primaryResolutionAction = keepCompletedBooking ? "complete-booking" : "restore-active-booking";
            const primaryResolutionLabel = keepCompletedBooking ? "Resolve and keep complete" : "Resolve and restore";
            const interventionRestoreAction = keepCompletedBooking ? "complete-booking" : "restore-active-booking";
            const interventionRestoreLabel = keepCompletedBooking ? "Keep complete" : "Restore active";
            const interventionDraft = getInterventionDraft(supportTicket);
            const interventionNote = interventionDraft.note.trim();
            const requiresDetailedRationale = Boolean(resolutionPolicy?.requiresDetailedRationale);
            const resolutionNoteDraft = getResolutionNoteDraft(ticket.id);
            const hasDetailedResolutionRationale = isDetailedManualRationale(
              resolutionNoteDraft,
              resolutionPolicy
            );
            const hasDetailedInterventionRationale = isDetailedManualRationale(
              interventionNote,
              resolutionPolicy
            );
            const primaryResolutionBlockedForEvidenceDirection = isActionBlockedByPolicy(
              resolutionPolicy,
              primaryResolutionAction
            );
            const cancelResolutionBlockedForEvidenceDirection = isActionBlockedByPolicy(
              resolutionPolicy,
              "cancel-booking"
            );
            const approveRefundBlockedForEvidenceDirection = isActionBlockedByPolicy(
              resolutionPolicy,
              "approve-refund"
            );
            const denyRefundBlockedForEvidenceDirection = isActionBlockedByPolicy(
              resolutionPolicy,
              "deny-refund"
            );
            const interventionBlockedForDetailedRationale =
              requiresDetailedRationale && !hasDetailedInterventionRationale;
            const finalResolutionBlockedForDetailedRationale =
              requiresDetailedRationale && !hasDetailedResolutionRationale;
            const restoreInterventionBlockedForEvidenceDirection = isActionBlockedByPolicy(
              resolutionPolicy,
              interventionRestoreAction
            );
            const primaryResolutionNotes = requiresDetailedRationale
              ? resolutionNoteDraft.trim()
              : keepCompletedBooking
                ? "Support reviewed the issue and kept the booking marked complete."
                : "Support reviewed the issue and restored the booking to the active schedule.";
            const approveRefundNotes = requiresDetailedRationale
              ? resolutionNoteDraft.trim()
              : "Support approved the refund review and reversed the customer payment.";
            const denyRefundNotes = requiresDetailedRationale
              ? resolutionNoteDraft.trim()
              : "Support reviewed the refund request and kept the payment captured.";
            const cancelResolutionNotes = requiresDetailedRationale
              ? resolutionNoteDraft.trim()
              : "Support resolved the issue by cancelling the booking.";
            const completeResolutionNotes = requiresDetailedRationale
              ? resolutionNoteDraft.trim()
              : "Support confirmed the service should be treated as complete.";

            return (
            <article className="list-panel" key={ticket.id}>
              <div className="search-result-title">
                <div>
                  <h3>{ticket.subject}</h3>
                  <p>
                    {ticket.issueType.replaceAll("-", " ")} • {ticket.status} {i18n.t("ops_auto.ops_support_queue.opened_mrnt47")}{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <span className="result-badge">{ticket.status}</span>
              </div>
              <p>{ticket.description}</p>
              {booking ? (
                <div className="stack-md">
                  <p>
                    {i18n.t("ops_auto.ops_support_queue.booking_y8dgyp")} {booking.category.replaceAll("-", " ")} • {formatDateTime(booking.scheduledStartIso)}
                  </p>
                  <p>
                    {i18n.t("ops_auto.ops_support_queue.customer_b8ip6s")} {customerName ?? booking.customerId} {i18n.t("ops_auto.ops_support_queue.provider_gudo7f")}{" "}
                    {providerName ?? booking.providerId}
                  </p>
                  <p>
                    {i18n.t("ops_auto.ops_support_queue.booking_state_mu7vyo")} {booking.status}
                    {booking.disputeReason ? ` • dispute: ${booking.disputeReason}` : ""}
                    {booking.activeExceptionType ? ` • issue: ${booking.activeExceptionType}` : ""}
                  </p>
                  {evidenceSummary ? (
                    <div className="list-panel" style={{ padding: "0.9rem" }}>
                      <strong>{i18n.t("ops_auto.ops_support_queue.evidence_signal_sp19jj")}</strong>
                      <p>
                        {evidenceSummary.photoCount} {i18n.t("ops_auto.ops_support_queue.photos_l2nhrx")} {evidenceSummary.noteCount} {i18n.t("ops_auto.ops_support_queue.notes_z7p7r7")}{" "}
                        {evidenceSummary.checklistCount} checklists
                      </p>
                      <p>
                        {i18n.t("ops_auto.ops_support_queue.reviewed_390nvt")} {evidenceSummary.reviewedCount} {i18n.t("ops_auto.ops_support_queue.supports_provider_gsvw1")}{" "}
                        {evidenceSummary.supportsProviderCount} {i18n.t("ops_auto.ops_support_queue.supports_customer_pw0zuk")}{" "}
                        {evidenceSummary.supportsCustomerCount} {i18n.t("ops_auto.ops_support_queue.inconclusive_iv07iq")}{" "}
                        {evidenceSummary.inconclusiveCount} {i18n.t("ops_auto.ops_support_queue.unreviewed_9i5opa")} {evidenceSummary.unreviewedCount}
                      </p>
                      {resolutionGuidance ? (
                        <p className="warning-copy" style={{ marginBottom: 0 }}>
                          {i18n.t("ops_auto.ops_support_queue.guidance_18vw3i")}{" "}
                          {resolutionGuidance.recommendedAction
                            ? `${resolutionGuidance.recommendedAction.replaceAll("-", " ")}`
                            : "manual review"}{" "}
                          • {resolutionGuidance.confidence} {i18n.t("ops_auto.ops_support_queue.confidence_wb26es")} {resolutionGuidance.rationale}
                        </p>
                      ) : null}
                      {resolutionPolicy ? (
                        <p style={{ marginBottom: 0 }}>
                          {i18n.t("ops_auto.ops_support_queue.policy_ky4s2w")} {resolutionPolicy.evidenceSignal.replaceAll("-", " ")} •{" "}
                          {resolutionPolicy.confidence} confidence
                        </p>
                      ) : null}
                      {resolutionPolicy?.warnings.map((warning) => (
                        <p className="warning-copy" key={warning} style={{ marginBottom: 0 }}>
                          {warning}
                        </p>
                      ))}
                      {resolutionGuidance?.templates.length ? (
                        <div className="stack-sm" style={{ marginTop: "0.75rem" }}>
                          <p>{i18n.t("ops_auto.ops_support_queue.suggested_customer_updates_9otdkr")}</p>
                          <div className="stack-sm">
                            {resolutionGuidance.templates.map((template) => (
                              <article className="card" key={`${ticket.id}-${template.key}`}>
                                <div className="cta-row" style={{ justifyContent: "space-between", gap: "1rem" }}>
                                  <div>
                                    <strong>{template.title}</strong>
                                    <p>
                                      {template.channel} • {template.reason}
                                    </p>
                                  </div>
                                  <span className="eyebrow">{template.key.replaceAll("-", " ")}</span>
                                </div>
                                {template.subject ? (
                                  <label className="form-field">
                                    <span>{i18n.t("ops_auto.ops_support_queue.subject_3czyt0")}</span>
                                    <input readOnly value={template.subject} />
                                  </label>
                                ) : null}
                                <label className="form-field">
                                  <span>{i18n.t("ops_auto.ops_support_queue.copy_ready_draft_tvbbdg")}</span>
                                  <textarea
                                    readOnly
                                    rows={Math.min(10, Math.max(4, template.body.split("\n").length + 1))}
                                    value={template.body}
                                  />
                                </label>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <p>
                    {i18n.t("ops_auto.ops_support_queue.evidence_before_photos_12wryd")}{" "}
                    {
                      booking.serviceEvidence.filter(
                        (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo"
                      ).length
                    }{" "}
                    {i18n.t("ops_auto.ops_support_queue.after_photos_s2dbi5")}{" "}
                    {
                      booking.serviceEvidence.filter(
                        (evidence) => evidence.phase === "after" && evidence.evidenceType === "photo"
                      ).length
                    }{" "}
                    {i18n.t("ops_auto.ops_support_queue.notes_30da9v")}{" "}
                    {booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "note").length} {i18n.t("ops_auto.ops_support_queue.checklists_jsndth")}{" "}
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
                                      <strong>{i18n.t("ops_auto.ops_support_queue.onsite_note_fuonas")}</strong>
                                      <p style={{ margin: "0.35rem 0 0 0" }}>{evidence.note}</p>
                                    </div>
                                  ) : null}
                                  {evidence.evidenceType === "checklist" ? (
                                    <div className="list-panel" style={{ padding: "0.75rem" }}>
                                      <strong>{i18n.t("ops_auto.ops_support_queue.checklist_va9pbu")}</strong>
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
                                      {i18n.t("ops_auto.ops_support_queue.ops_review_njh6ss")} {evidence.reviewStatus.replaceAll("-", " ")}
                                      {evidence.reviewNotes ? ` • ${evidence.reviewNotes}` : ""}
                                    </p>
                                  ) : null}
                                  <label>
                                    {i18n.t("ops_auto.ops_support_queue.evidence_review_t80l3z")} <select
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
                                      <option value="supports-provider">{i18n.t("ops_auto.ops_support_queue.supports_provider_jf785v")}</option>
                                      <option value="supports-customer">{i18n.t("ops_auto.ops_support_queue.supports_customer_6xmnkq")}</option>
                                      <option value="inconclusive">{i18n.t("ops_auto.ops_support_queue.inconclusive_gfzi8c")}</option>
                                    </select>
                                  </label>
                                  <label>
                                    {i18n.t("ops_auto.ops_support_queue.ops_evidence_notes_hmoykm")} <textarea
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
                                    {i18n.t("ops_auto.ops_support_queue.save_evidence_review_xqxi9q")} </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <ComplaintReviewPanel item={supportTicket} onChanged={loadQueue} />
                  {payment ? (
                    <p>
                      {i18n.t("ops_auto.ops_support_queue.payment_nxp89g")} {payment.status}
                      {payment.refundReviewStatus ? ` • refund review ${payment.refundReviewStatus}` : ""}
                      {payment.refundReason ? ` • reason: ${payment.refundReason}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {ticket.resolutionNotes ? <p>{i18n.t("ops_auto.ops_support_queue.resolution_bdvm6q")} {ticket.resolutionNotes}</p> : null}
              {timeline.length > 0 ? (
                <div className="stack-md">
                  <p>{i18n.t("ops_auto.ops_support_queue.support_timeline_hsrn8u")}</p>
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
                  {ticket.status !== "resolved" ? (
                    <label>
                      {i18n.t("ops_auto.ops_support_queue.final_resolution_rationale_ongnpp")} <textarea
                        onChange={(event) =>
                          setResolutionNoteDrafts((current) => ({
                            ...current,
                            [ticket.id]: event.target.value
                          }))
                        }
                        placeholder={
                          requiresDetailedRationale
                            ? resolutionPolicy?.rationalePrompt
                            : "Optional custom final rationale. Leave blank to use the standard action note."
                        }
                        rows={3}
                        value={resolutionNoteDraft}
                      />
                    </label>
                  ) : null}
                  <label>
                    {i18n.t("ops_auto.ops_support_queue.ops_intervention_note_2sjl9v")} <textarea
                        onChange={(event) =>
                          setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                              ...interventionDraft,
                              note: event.target.value
                            }
                          }))
                        }
                        placeholder={
                          requiresDetailedRationale
                            ? resolutionPolicy?.rationalePrompt
                            : undefined
                        }
                        rows={3}
                        value={interventionDraft.note}
                      />
                  </label>
                  <div className="grid-two">
                    <label>
                      {i18n.t("ops_auto.ops_support_queue.new_start_vdgzi")} <input
                        onChange={(event) =>
                          setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                              ...interventionDraft,
                              scheduledStartLocal: event.target.value
                            }
                          }))
                        }
                        type="datetime-local"
                        value={interventionDraft.scheduledStartLocal}
                      />
                    </label>
                    <label>
                      {i18n.t("ops_auto.ops_support_queue.new_end_d0cukl")} <input
                        onChange={(event) =>
                          setInterventionDrafts((current) => ({
                            ...current,
                            [ticket.id]: {
                              ...interventionDraft,
                              scheduledEndLocal: event.target.value
                            }
                          }))
                        }
                        type="datetime-local"
                        value={interventionDraft.scheduledEndLocal}
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
                      {i18n.t("ops_auto.ops_support_queue.save_note_z7zwyd")} </button>
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
                      {i18n.t("ops_auto.ops_support_queue.reschedule_tpjswm")} </button>
                    <button
                      className="button-secondary"
                      disabled={
                        isWorking ||
                        resolutionLockedForEvidenceReview ||
                        restoreInterventionBlockedForEvidenceDirection ||
                        interventionBlockedForDetailedRationale
                      }
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          interventionRestoreAction
                        )
                      }
                      type="button"
                    >
                      {interventionRestoreLabel}
                    </button>
                    {!keepCompletedBooking ? (
                      <button
                        className="button-secondary"
                        disabled={
                          isWorking ||
                          resolutionLockedForEvidenceReview ||
                          isActionBlockedByPolicy(resolutionPolicy, "complete-booking") ||
                          interventionBlockedForDetailedRationale
                        }
                        onClick={() =>
                          void applyIntervention(
                            supportTicket,
                            "complete-booking"
                          )
                        }
                        type="button"
                      >
                        {i18n.t("ops_auto.ops_support_queue.complete_booking_lrvyi6")} </button>
                    ) : null}
                    <button
                      className="button-secondary"
                      disabled={
                        isWorking ||
                        resolutionLockedForEvidenceReview ||
                        cancelResolutionBlockedForEvidenceDirection ||
                        interventionBlockedForDetailedRationale
                      }
                      onClick={() =>
                        void applyIntervention(
                          supportTicket,
                          "cancel-booking"
                        )
                      }
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_support_queue.cancel_booking_lg9u4z")} </button>
                  </div>
                  {booking.interventions.length > 0 ? (
                    <div className="stack-md">
                      <p>{i18n.t("ops_auto.ops_support_queue.intervention_history_c0pfu3")}</p>
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
                                {i18n.t("ops_auto.ops_support_queue.new_window_2he6ae")} {formatDateTime(intervention.nextScheduledStartIso)}
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
                    {i18n.t("ops_auto.ops_support_queue.mark_triaged_fwxbnh")} </button>
                ) : null}
                {ticket.status !== "resolved" && (ticket.issueType === "billing" || Boolean(ticket.complaint)) && payment?.refundReviewStatus === "requested" ? (
                  <>
                  <button
                    className="button-secondary"
                    disabled={
                      isWorking ||
                      resolutionLockedForEvidenceReview ||
                      approveRefundBlockedForEvidenceDirection ||
                      finalResolutionBlockedForDetailedRationale
                    }
                    onClick={() =>
                      void updateTicket(
                        ticket.id,
                          "resolved",
                          "approve-refund",
                          approveRefundNotes
                        )
                      }
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_support_queue.approve_refund_otmmj")} </button>
                  <button
                    className="button-secondary"
                    disabled={
                      isWorking ||
                      resolutionLockedForEvidenceReview ||
                      denyRefundBlockedForEvidenceDirection ||
                      finalResolutionBlockedForDetailedRationale
                    }
                    onClick={() =>
                      void updateTicket(
                        ticket.id,
                          "resolved",
                          "deny-refund",
                          denyRefundNotes
                        )
                      }
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_support_queue.deny_refund_9bsycs")} </button>
                  </>
                ) : null}
                {ticket.status !== "resolved" &&
                (ticket.issueType === "billing" || Boolean(ticket.complaint && ticket.complaint.kind !== "property-damage")) &&
                payment?.status === "captured" &&
                payment.refundReviewStatus !== "requested" ? (
                  <div className="stack-md">
                    <label>
                      {i18n.t("ops_auto.ops_support_queue.customer_service_refund_note_d4sznx")} <textarea
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
                      {i18n.t("ops_auto.ops_support_queue.open_refund_review_m2htme")} </button>
                  </div>
                ) : null}
                {ticket.status !== "resolved" && ticket.issueType !== "billing" ? (
                  <>
                    <button
                      className="button-secondary"
                      disabled={
                        isWorking ||
                        resolutionLockedForEvidenceReview ||
                        primaryResolutionBlockedForEvidenceDirection ||
                        finalResolutionBlockedForDetailedRationale
                      }
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          primaryResolutionAction,
                          primaryResolutionNotes
                        )
                      }
                      type="button"
                    >
                      {primaryResolutionLabel}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={
                        isWorking ||
                        resolutionLockedForEvidenceReview ||
                        cancelResolutionBlockedForEvidenceDirection ||
                        finalResolutionBlockedForDetailedRationale
                      }
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "cancel-booking",
                          cancelResolutionNotes
                        )
                      }
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_support_queue.resolve_and_cancel_6sncmv")} </button>
                    {!keepCompletedBooking ? (
                      <button
                        className="button-secondary"
                        disabled={
                          isWorking ||
                          resolutionLockedForEvidenceReview ||
                          isActionBlockedByPolicy(resolutionPolicy, "complete-booking") ||
                          finalResolutionBlockedForDetailedRationale
                        }
                        onClick={() =>
                          void updateTicket(
                            ticket.id,
                            "resolved",
                            "complete-booking",
                            completeResolutionNotes
                          )
                        }
                        type="button"
                      >
                        {i18n.t("ops_auto.ops_support_queue.resolve_and_complete_bykudm")} </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          );
          })
        ) : (
          <p>{i18n.t("ops_auto.ops_support_queue.no_support_tickets_yet_vs9imp")}</p>
        )}
      </div>
    </section>
  );
}
