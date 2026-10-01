"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AvailabilitySlot, Booking } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { useStoredWebSession } from "../lib/session";
import { journeyApi, openingLabel, uniqueOpenings } from "../lib/bookingJourney";
import { JourneyDialog } from "./JourneyDialog";

export function BookingConfirmationPage() {
  const i18n = useI18n(); const params = useSearchParams(); const id = params.get("bookingId") ?? ""; const { session, sessionReady } = useStoredWebSession();
  const [booking, setBooking] = useState<Booking>(); const [provider, setProvider] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false); const [slots, setSlots] = useState<AvailabilitySlot[]>([]); const [selectedSlot, setSelectedSlot] = useState(""); const [checking, setChecking] = useState(false); const [busy, setBusy] = useState(false); const [retry, setRetry] = useState(0); const submitting = useRef(false);
  useEffect(() => {
    let active = true; setBooking(undefined); setError("");
    if (!sessionReady || session?.role !== "customer") { setLoading(false); return; }
    setLoading(true);
    journeyApi().getCustomerBooking(id).then(async result => {
      const profile = await journeyApi().getProviderProfile(result.providerId);
      if (active) { setBooking(result); setProvider(profile.companyName); }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, session?.userId, session?.role, sessionReady, retry, i18n]);
  async function openReschedule() {
    if (!booking) return;
    setRescheduling(true); setChecking(true); setError(""); setSlots([]); setSelectedSlot("");
    try {
      const duration = booking.services?.reduce((sum, item) => sum + item.estimatedDurationMinutes, 0) || (Date.parse(booking.scheduledEndIso) - Date.parse(booking.scheduledStartIso)) / 60000;
      const openings = await journeyApi().getProviderAvailability({ providerId: booking.providerId, address: booking.serviceAddress, categories: booking.services?.length ? booking.services.map(item => item.category) : [booking.category], estimatedDurationMinutes: duration });
      setSlots(uniqueOpenings(openings).map(slot => ({ ...slot, endIso: new Date(Date.parse(slot.startIso) + duration * 60000).toISOString() })));
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
    finally { setChecking(false); }
  }
  async function reschedule() {
    const slot = slots.find(item => item.id === selectedSlot);
    if (!booking || !slot || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try { const result = await journeyApi().rescheduleBooking({ bookingId: booking.id, scheduledStartIso: slot.startIso, scheduledEndIso: slot.endIso }); setBooking(result); setRescheduling(false); setNotice(i18n.t("booking_journey.reschedule.success")); }
    catch (err) { setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!sessionReady || loading) return <main className="container journey-page"><p role="status">{i18n.t("booking_journey.confirmation.loading")}</p></main>;
  if (session?.role !== "customer") return <main className="container journey-page"><h1>{i18n.t("booking_journey.review.auth")}</h1><Link className="button" href={addLocalePrefix(`/login/customer?returnTo=${encodeURIComponent(addLocalePrefix(`/customer/booking/confirmation?bookingId=${encodeURIComponent(id)}`, i18n.locale))}`, i18n.locale)}>{i18n.t("booking_journey.review.login")}</Link></main>;
  if (!booking) return <main className="container journey-page"><p role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => setRetry(value => value + 1)}>{i18n.t("booking_journey.retry")}</button></main>;
  const canReschedule = ["requested", "confirmed"].includes(booking.status) && Date.parse(booking.scheduledStartIso) > Date.now() && (booking.status !== "confirmed" || Date.parse(booking.scheduledStartIso) - Date.now() >= 24 * 3600000);
  return <main className="container journey-page journey-confirmation"><div className="journey-success-icon" aria-hidden="true">✓</div>
    <h1>{i18n.t(booking.status === "requested" ? "booking_journey.confirmation.title" : booking.status === "confirmed" ? "booking_journey.confirmation.confirmed" : "booking_journey.confirmation.details")}</h1><p>{i18n.t(booking.status === "requested" ? "booking_journey.confirmation.body" : booking.status === "confirmed" ? "booking_journey.confirmation.confirmed_body" : "booking_journey.confirmation.details_body", { provider })}</p>
    {notice ? <p className="journey-notice" role="status">{notice}</p> : null}
    <section className="card journey-confirmation__card"><h2>{provider}</h2><p>{openingLabel(i18n, booking.scheduledStartIso)}</p><p>{booking.services?.length ? booking.services.map(item => i18n.t(serviceCategoryLabelKeys[item.category])).join(" · ") : i18n.t(serviceCategoryLabelKeys[booking.category])}</p><address>{booking.serviceAddress.line1}{booking.serviceAddress.line2 ? `, ${booking.serviceAddress.line2}` : ""}<br />{booking.serviceAddress.city}, {booking.serviceAddress.state} {booking.serviceAddress.postalCode}</address><div className="journey-total"><span>{i18n.t("booking_journey.review.total")}</span><strong>{i18n.formatCurrency(booking.totalCents, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div><small>{i18n.t("booking_journey.confirmation.reference")}: {booking.id.slice(-10).toUpperCase()}</small></section>
    <div className="journey-confirmation__actions">{canReschedule ? <button className="button" type="button" onClick={() => void openReschedule()}>{i18n.t("booking_journey.confirmation.reschedule")}</button> : null}<Link className="button-secondary" href={addLocalePrefix("/customer/dashboard", i18n.locale)}>{i18n.t("booking_journey.confirmation.manage")}</Link></div>
    {rescheduling ? <JourneyDialog title={i18n.t("booking_journey.reschedule.title")} onClose={() => { if (!busy) setRescheduling(false); }}><div className="journey-dialog__header"><h2>{i18n.t("booking_journey.reschedule.title")}</h2><button className="journey-close" type="button" disabled={busy} onClick={() => setRescheduling(false)} aria-label={i18n.t("booking_journey.close")}>×</button></div>
      {checking ? <p role="status">{i18n.t("booking_journey.openings.loading")}</p> : slots.length ? <fieldset className="journey-fieldset" disabled={busy}><legend>{i18n.t("booking_journey.openings")}</legend><div className="journey-slot-pills">{slots.map(slot => <button type="button" key={slot.id} className={`journey-slot-pill${selectedSlot === slot.id ? " journey-slot-pill--selected" : ""}`} aria-pressed={selectedSlot === slot.id} onClick={() => setSelectedSlot(slot.id)}>{openingLabel(i18n, slot.startIso)}</button>)}</div></fieldset> : <p>{i18n.t("booking_journey.reschedule.unavailable")}</p>}
      {error ? <p className="journey-error" role="alert">{error}</p> : null}<div className="journey-dialog__footer"><button className="button" disabled={checking || busy || !selectedSlot} type="button" onClick={() => void reschedule()}>{i18n.t(busy ? "booking_journey.book.checking" : "booking_journey.reschedule.confirm")}</button></div>
    </JourneyDialog> : null}
  </main>;
}
