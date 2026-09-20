"use client";

import Image from "next/image";
import { useState } from "react";
import type { ServiceComplaintKind, ServiceComplaint, SupportTicket } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { readEvidenceImage } from "../lib/imageUploads";

const kinds: ServiceComplaintKind[] = ["incomplete-work", "quality", "missed-visit", "property-damage", "billing"];
export function ServiceComplaintPanel({ bookings, tickets, initialBookingId, onChanged }: {
  bookings: { id: string; label: string }[]; tickets: SupportTicket[]; initialBookingId: string; onChanged: () => Promise<void>;
}) {
  const i18n = useI18n();
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [kind, setKind] = useState<ServiceComplaintKind>("incomplete-work");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [remedy, setRemedy] = useState<ServiceComplaint["preferredRemedy"]>("help-decide");
  const [photos, setPhotos] = useState<string[]>([]);
  const [cannotPhotograph, setCannotPhotograph] = useState(false);
  const [noPhotoReason, setNoPhotoReason] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const reports = tickets.filter(ticket => ticket.complaint);
  const selectedId = bookingId || initialBookingId;
  const needsPhoto = kind === "quality" || kind === "incomplete-work";

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await createAuthenticatedWebApiClient().createServiceComplaint({ bookingId: selectedId, kind, affectedArea: area, description,
        preferredRemedy: remedy, photos: cannotPhotograph ? [] : photos, noPhotoReason: cannotPhotograph ? noPhotoReason : undefined, aiConsent });
      setMessage(i18n.t("complaint.saved")); setDescription(""); setPhotos([]);
      await onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save your report."); }
    finally { setBusy(false); }
  }
  async function reply(ticketId: string, human = false) {
    setBusy(true); setError("");
    try {
      await createAuthenticatedWebApiClient().replyServiceComplaint({ ticketId, requestHumanReview: human,
        message: replies[ticketId]?.trim() || (human ? i18n.t("complaint.human_message") : "") });
      setReplies(current => ({ ...current, [ticketId]: "" })); await onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save your update."); }
    finally { setBusy(false); }
  }
  return <section className="card stack-lg" aria-labelledby="complaint-title" style={{ marginBottom: "1.5rem" }}>
    <div><span className="eyebrow">YardMatch Care</span><h2 id="complaint-title">{i18n.t("complaint.title")}</h2><p>{i18n.t("complaint.intro")}</p></div>
    {bookings.length ? <form onSubmit={event => void submit(event)} className="stack-lg">
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="form-grid">
          <label className="form-field"><span>{i18n.t("complaint.booking")}</span><select required value={selectedId} onChange={event => setBookingId(event.target.value)}>
            <option value="">{i18n.t("complaint.select_booking")}</option>{bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.label}</option>)}
          </select></label>
          <label className="form-field"><span>{i18n.t("complaint.kind")}</span><select value={kind} onChange={event => setKind(event.target.value as ServiceComplaintKind)}>{kinds.map(value => <option key={value} value={value}>{i18n.t(`complaint.${value}`)}</option>)}</select></label>
          <label className="form-field"><span>{i18n.t("complaint.area")}</span><input required minLength={2} maxLength={120} value={area} placeholder={i18n.t("complaint.area_hint")} onChange={event => setArea(event.target.value)} /></label>
          <label className="form-field"><span>{i18n.t("complaint.remedy")}</span><select value={remedy} onChange={event => setRemedy(event.target.value as ServiceComplaint["preferredRemedy"])}>{(["help-decide", "return-visit", "refund"] as const).map(value => <option key={value} value={value}>{i18n.t(`complaint.${value}`)}</option>)}</select></label>
          <label className="form-field form-field--full"><span>{i18n.t("complaint.description")}</span><textarea required minLength={10} maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
        </div>
        <div className="list-panel" style={{ marginTop: "1rem" }}>
          <label className="form-field"><span>{i18n.t("complaint.photos")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={cannotPhotograph} onChange={async event => {
            const files = Array.from(event.target.files ?? []); setError("");
            if (files.length > 2) { setError(i18n.t("complaint.photo_error")); event.target.value = ""; return; }
            setBusy(true);
            try { setPhotos(await Promise.all(files.map(file => readEvidenceImage(file, 850_000)))); }
            catch (error) { setError(error instanceof Error ? error.message : "Unable to read photos."); }
            finally { setBusy(false); }
          }} /></label>
          <p>{i18n.t("complaint.photo_hint")}</p>
          {photos.length && !cannotPhotograph ? <div><p>{i18n.t("complaint.photo_count")}: {photos.length}</p><div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{photos.map((photo, index) => <Image unoptimized width={120} height={90} key={index} src={photo} alt={`${i18n.t("complaint.photos")} ${index + 1}`} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8 }} />)}</div><button className="button-secondary" type="button" onClick={() => setPhotos([])}>{i18n.t("complaint.remove")}</button></div> : null}
          <label style={{ display: "flex", gap: "0.6rem", alignItems: "baseline" }}><input type="checkbox" checked={cannotPhotograph} onChange={event => setCannotPhotograph(event.target.checked)} />{i18n.t("complaint.no_photo")}</label>
          {cannotPhotograph ? <label className="form-field"><span>{i18n.t("complaint.no_photo_reason")}</span><textarea required={needsPhoto} minLength={5} maxLength={500} value={noPhotoReason} onChange={event => setNoPhotoReason(event.target.value)} /></label> : null}
          <p>{i18n.t("complaint.privacy")}</p>
        </div>
        <label style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", marginTop: "1rem" }}><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} />{i18n.t("complaint.ai_consent")}</label>
        <button className="button" style={{ marginTop: "1rem" }} disabled={!selectedId || (needsPhoto && !photos.length && !cannotPhotograph)} type="submit">{busy ? i18n.t("complaint.working") : i18n.t("complaint.submit")}</button>
      </fieldset>
    </form> : <p>{i18n.t("complaint.no_bookings")}</p>}
    {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
    {reports.length ? <div className="stack-lg"><h3>{i18n.t("complaint.reports")}</h3>{reports.map(ticket => <article className="list-panel stack-md" key={ticket.id}>
      <h4>{i18n.t(`complaint.${ticket.complaint!.kind}`)} · {ticket.complaint!.affectedArea}</h4>
      <p>{ticket.description}</p><p>{ticket.complaint!.customerMessage}</p>
      {ticket.status !== "resolved" ? <p>{i18n.t("complaint.update_due")}: {i18n.formatDate(ticket.complaint!.nextUpdateDueAt, { dateStyle: "medium", timeStyle: "short" })}</p> : null}
      {ticket.resolutionNotes ? <p>{ticket.resolutionNotes}</p> : null}
      {ticket.complaint!.replies.map((entry, index) => <p key={index}>{entry.message}</p>)}
      <label className="form-field"><span>{i18n.t("complaint.reply")}</span><textarea rows={2} maxLength={2000} value={replies[ticket.id] ?? ""} onChange={event => setReplies(current => ({ ...current, [ticket.id]: event.target.value }))} /></label>
      <p>{i18n.t("complaint.followup_hint")}</p><div className="cta-row"><button className="button-secondary" disabled={busy || (replies[ticket.id]?.trim().length ?? 0) < 3} onClick={() => void reply(ticket.id)}>{i18n.t("complaint.send")}</button><button className="button-secondary" disabled={busy} onClick={() => void reply(ticket.id, true)}>{i18n.t("complaint.human")}</button></div>
    </article>)}</div> : null}
  </section>;
}
