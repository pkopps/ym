"use client";
import { useState } from "react";
import type { PartialRefundRecord, SupportOpsTicket } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useLaunchFeatureFlags } from "./LaunchFeatureFlagsProvider";

export function ComplaintReviewPanel({ item, onChanged }: { item: SupportOpsTicket; onChanged: () => Promise<void> }) {
  const i18n = useI18n();
  const { payments } = useLaunchFeatureFlags();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [requestKey, setRequestKey] = useState<string>();
  const complaint = item.ticket.complaint;
  const payment = item.payment;
  const pending = payment?.partialRefunds?.find(refund => refund.status === "submitting" || refund.status === "pending");
  const validAmount = /^\d+(\.\d{1,2})?$/.test(amount);
  const remaining = payment ? payment.amountCents - (payment.refundedAmountCents ?? 0) : 0;
  const format = (cents: number) => i18n.formatCurrency(cents, payment?.currency ?? "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function perform(operation: () => Promise<unknown>) {
    setBusy(true); setError(""); setStatus("");
    try { await operation(); await onChanged(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to complete this action."); await onChanged().catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function refund(existing?: PartialRefundRecord) {
    if (!payment) return;
    const key = existing?.idempotencyKey ?? requestKey ?? crypto.randomUUID();
    setRequestKey(key);
    await perform(async () => {
      await createAuthenticatedWebApiClient().issuePartialRefund({ ticketId: existing?.ticketId ?? item.ticket.id, paymentId: payment.id,
        amountCents: existing?.amountCents ?? Math.round(Number(amount) * 100), reason: existing?.reason ?? reason, idempotencyKey: key });
      setStatus(i18n.t("complaint.refund_saved"));
    });
  }
  return <section className="list-panel stack-md" aria-label={i18n.t("complaint.review_title")}>
    {complaint ? <>
      <h4>{i18n.t("complaint.review_title")}</h4><p>{i18n.t(`complaint.${complaint.kind}`)} · {complaint.affectedArea} · {i18n.t(`complaint.${complaint.preferredRemedy}`)}</p>
      {complaint.noPhotoReason ? <p>{i18n.t("complaint.no_photo_reason")}: {complaint.noPhotoReason}</p> : null}
      {complaint.humanReviewRequested ? <strong>{i18n.t("complaint.human_requested")}</strong> : null}
      <p>{i18n.t("complaint.update_due")}: {new Date(complaint.nextUpdateDueAt).toLocaleString()}</p>
      {complaint.replies.map((reply, index) => <p key={index}>{reply.message}</p>)}
      {complaint.assessment ? <details open><summary>{i18n.t("complaint.ai_draft")} ({complaint.assessment.source})</summary><p>{complaint.assessment.summary}</p>
        <ul>{[...complaint.assessment.observations, ...complaint.assessment.limitations].map((text, index) => <li key={index}>{text}</li>)}</ul>
        <p>{complaint.assessment.suggestedQuestion}</p>
      </details> : <p>{i18n.t("complaint.assessment_missing")}</p>}
      <button className="button-secondary" type="button" disabled={busy} onClick={() => void perform(() => createAuthenticatedWebApiClient().assessServiceComplaint(item.ticket.id))}>{i18n.t("complaint.assess")}</button>
    </> : null}
    {payments && payment && payment.status === "captured" && item.booking?.status === "completed" && complaint?.kind !== "property-damage" && item.ticket.status !== "resolved" ? <>
      <h4>{i18n.t("complaint.partial_title")}</h4><p>{i18n.t("complaint.funding")}</p>
      {payment.processor !== "stripe" ? <strong>{i18n.t("complaint.simulation")}</strong> : null}
      <p>{i18n.t("complaint.remaining")}: {format(remaining)}</p>
      <label className="form-field"><span>{i18n.t("complaint.amount")}</span><input type="number" min="0.01" max={(remaining - 1) / 100} step="0.01" disabled={busy || Boolean(pending)} value={amount} onChange={event => { setAmount(event.target.value); setRequestKey(undefined); }} /></label>
      <label className="form-field"><span>{i18n.t("complaint.reason")}</span><textarea minLength={20} maxLength={2000} rows={3} disabled={busy || Boolean(pending)} value={reason} onChange={event => { setReason(event.target.value); setRequestKey(undefined); }} /></label>
      <button className="button-secondary" type="button" disabled={busy || Boolean(pending) || reason.trim().length < 20 || !validAmount || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Math.round(Number(amount) * 100) >= remaining} onClick={() => void refund()}>{busy ? i18n.t("complaint.busy") : i18n.t("complaint.issue_refund")}</button>
    </> : null}
    {payment?.partialRefunds?.length ? <div><h4>{i18n.t("complaint.refund_history")}</h4>{payment.partialRefunds.map(record => <div key={record.id}><p>{format(record.amountCents)} · {record.status} · {record.funding}<br />{record.reason}</p>
      {payments && record.status === "submitting" ? <button className="button-secondary" disabled={busy} onClick={() => void refund(record)}>{i18n.t("complaint.retry_refund")}</button> : null}
    </div>)}</div> : null}
    {status ? <p role="status">{status}</p> : null}{error ? <p role="alert">{error}</p> : null}
  </section>;
}
