"use client";

import { useState } from "react";
import { bookingScheduleStartIso, bookingScheduleWindowHour, type Booking, BookingScheduleUpdate, ProviderStaffingJobSummary, UpdateBookingScheduleRequest } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { addLocalePrefix } from "@yardmatch/i18n";
import { createAuthenticatedWebApiClient } from "../lib/api";

type ScheduleBooking = Pick<Booking, "scheduledStartIso" | "scheduledEndIso" | "status" | "scheduleUpdates">;


export function BookingSchedulePanel({ booking, bookingId, provider = false, onUpdated }: {
  booking: ScheduleBooking | ProviderStaffingJobSummary;
  bookingId: string;
  provider?: boolean;
  onUpdated: () => Promise<void>;
}) {
  const i18n = useI18n();
  const [kind, setKind] = useState<BookingScheduleUpdate["kind"]>("running-late");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [nextMinutes, setNextMinutes] = useState(60);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(12);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const latest = booking.scheduleUpdates?.at(-1);
  const active = latest && ["active", "declined"].includes(latest.state);
  const actionable = ["confirmed", "in-progress"].includes(booking.status);
  const format = (iso: string) => i18n.formatDate(iso, { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const heading = (update: BookingScheduleUpdate) => i18n.t(update.state === "accepted" ? "schedule.accepted" : update.state === "declined" ? "schedule.declined" : update.kind === "weather" ? "schedule.weather" : update.kind === "reschedule" ? "schedule.proposal" : "schedule.late");

  async function run(action: () => Promise<unknown>) {
    setWorking(true); setError(""); setMessage("");
    try { await action(); await onUpdated(); setMessage(i18n.t("schedule.saved")); }
    catch (err) { setError(err instanceof Error ? err.message : i18n.t("schedule.error")); }
    finally { setWorking(false); }
  }

  async function sendUpdate() {
    await run(async () => {
      const now = Date.now();
      const eta = new Date(now + minutes * 60000).toISOString();
      const payload: UpdateBookingScheduleRequest = { bookingId, kind, reason,
        nextUpdateByIso: new Date(now + (kind === "running-late" ? Math.min(minutes, nextMinutes) : nextMinutes) * 60000).toISOString() };
      if (kind === "running-late") payload.expectedArrivalIso = eta;
      if (kind === "reschedule") {
        payload.proposedStartIso = bookingScheduleStartIso(date, hour);
        payload.proposedEndIso = new Date(Date.parse(payload.proposedStartIso) + Date.parse(booking.scheduledEndIso) - Date.parse(booking.scheduledStartIso)).toISOString();
      }
      await createAuthenticatedWebApiClient().updateBookingSchedule(payload);
    });
  }

  if (!actionable || (!provider && !latest)) return null;
  return <section className="list-panel booking-schedule-panel" aria-label={i18n.t("schedule.title")}>
    {latest && latest.state !== "resolved" && actionable ? <div role="status">
      <h3>{heading(latest)}</h3>
      <p>{latest.reason}</p>
      {latest.kind === "weather" && active ? <p>{i18n.t("schedule.weather_body")}</p> : null}
      {latest.expectedArrivalIso && active ? <p>{i18n.t("schedule.eta", { time: format(latest.expectedArrivalIso) })}</p> : null}
      {latest.proposedStartIso ? <p><strong>{i18n.formatDate(latest.proposedStartIso, { timeZone: "America/New_York", month: "short", day: "numeric" })} · {i18n.t(bookingScheduleWindowHour(latest.proposedStartIso) === 7 ? "schedule.morning" : bookingScheduleWindowHour(latest.proposedStartIso) === 12 ? "schedule.afternoon" : "schedule.evening")}</strong></p> : null}
      {latest.kind === "reschedule" && latest.state === "active" ? <p>{i18n.t(provider ? "schedule.provider_proposal_body" : "schedule.proposal_body")}</p> : null}
      {latest.state === "declined" ? <p>{i18n.t("schedule.declined_body")}</p> : null}
      {latest.state === "accepted" ? <p>{i18n.t("schedule.accepted_body")}</p> : null}
      {active ? <p><strong>{i18n.t(Date.parse(latest.nextUpdateByIso) <= Date.now() ? "schedule.overdue" : "schedule.next_update", { time: format(latest.nextUpdateByIso) })}</strong></p> : null}
      {!provider && latest.kind === "reschedule" && latest.state === "active" ? <div className="cta-row">
        <button className="button" type="button" disabled={working} onClick={() => void run(() => createAuthenticatedWebApiClient().respondBookingSchedule({ bookingId, updateId: latest.id, action: "accept" }))}>{i18n.t("schedule.accept")}</button>
        <button className="button-secondary" type="button" disabled={working} onClick={() => void run(() => createAuthenticatedWebApiClient().respondBookingSchedule({ bookingId, updateId: latest.id, action: "decline" }))}>{i18n.t("schedule.decline")}</button>
      </div> : null}
      {!provider && active ? <a href={addLocalePrefix(`/help?bookingId=${encodeURIComponent(bookingId)}&issueType=service-quality`, i18n.locale)}>{i18n.t("schedule.help")}</a> : null}
      <small>{i18n.t("schedule.updated", { time: format(latest.updatedAt) })}</small>
    </div> : null}
    {provider && actionable ? <details className="service-card-disclosure">
      <summary className="service-card-disclosure__summary">{i18n.t("schedule.send")}</summary>
      <form className="service-card-disclosure__body" onSubmit={event => { event.preventDefault(); void sendUpdate(); }}>
        <label className="form-field">{i18n.t("schedule.type")}<select value={kind} onChange={event => setKind(event.target.value as BookingScheduleUpdate["kind"])}>
          <option value="running-late">{i18n.t("schedule.late")}</option><option value="weather">{i18n.t("schedule.weather")}</option><option value="reschedule">{i18n.t("schedule.proposal")}</option>
        </select></label>
        {kind === "running-late" ? <label className="form-field">{i18n.t("schedule.arrival_in")}<select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>{[15, 30, 60, 90, 120, 180].map(value => <option key={value} value={value}>{i18n.t("schedule.minutes", { count: value })}</option>)}</select></label> : null}
        {kind === "reschedule" ? <>
          <p>{i18n.t(provider ? "schedule.provider_proposal_body" : "schedule.proposal_body")}</p>
          <label className="form-field">{i18n.t("schedule.date")}<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="form-field">{i18n.t("schedule.window")}<select value={hour} onChange={event => setHour(Number(event.target.value))}><option value={7}>{i18n.t("schedule.morning")}</option><option value={12}>{i18n.t("schedule.afternoon")}</option><option value={16}>{i18n.t("schedule.evening")}</option></select></label>
        </> : null}
        <label className="form-field">{i18n.t("schedule.reason")}<textarea required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <label className="form-field">{i18n.t("schedule.follow_up")}<select value={nextMinutes} onChange={event => setNextMinutes(Number(event.target.value))}>{[30, 60, 120, 240].map(value => <option key={value} value={value}>{i18n.t("schedule.minutes", { count: value })}</option>)}</select></label>
        <button className="button" disabled={working} type="submit">{i18n.t("schedule.notify")}</button>
      </form>
    </details> : null}
    {booking.scheduleUpdates && booking.scheduleUpdates.length > (latest?.state === "resolved" ? 0 : 1) ? <details><summary>{i18n.t("schedule.history")}</summary>{[...booking.scheduleUpdates].reverse().slice(latest?.state === "resolved" ? 0 : 1).map(update => <p key={update.id}><strong>{heading(update)}</strong> · {format(update.updatedAt)}<br />{update.reason}</p>)}</details> : null}
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
