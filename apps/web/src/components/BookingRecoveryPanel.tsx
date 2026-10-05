"use client";
import { type Booking, type BookingRecoveryOptions, type RecoverBookingRequest } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

export function BookingRecoveryPanel({ booking, onUpdated }: { booking: Booking; onUpdated: () => void }) {
  const [options, setOptions] = useState<BookingRecoveryOptions>();
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!["requested", "confirmed"].includes(booking.status)) return;
    let active = true;
    void createAuthenticatedWebApiClient().getBookingRecoveryOptions(booking.id).then(result => { if (active) setOptions(result); }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Unable to check recovery options."); });
    return () => { active = false; };
  }, [booking.id, booking.status, booking.scheduleVersion]);
  async function recover(input: Partial<RecoverBookingRequest>) {
    if (!options?.recovery) return;
    setWorking(true);
    try {
      await createAuthenticatedWebApiClient().recoverBooking({ bookingId: booking.id, recoveryId: options.recovery.id, action: "cancel", scope: plan ? "plan" : "visit", ...input });
      setOptions(undefined); onUpdated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to recover visit. Refresh and try again."); }
    finally { setWorking(false); }
  }
  async function refresh() {
    setWorking(true);
    try { setOptions(await createAuthenticatedWebApiClient().getBookingRecoveryOptions(booking.id)); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to refresh alternatives."); }
    finally { setWorking(false); }
  }
  if (!options?.recovery) return booking.recovery?.state === "open" && message ? <section aria-label="Visit recovery"><p role="alert">{message}</p><button disabled={working} onClick={() => void refresh()}>Retry recovery options</button></section> : null;
  return <section aria-label="Visit recovery" className="list-panel">
    <h3>Choose how to recover this visit</h3>
    <p>Your provider is unavailable or the timing update is overdue. Your booking stays open until you choose. A replacement keeps your agreed price and requires provider confirmation.</p>
    {booking.recurringPlanId ? <label><input type="checkbox" checked={plan} onChange={event => setPlan(event.target.checked)} />Also change future visits in this recurring plan. Existing generated visits need separate review.</label> : <p>This changes only this visit.</p>}
    {options.alternatives.map(item => <div key={item.providerId}>
      <p>{item.companyName} • {new Date(item.startIso).toLocaleString()}</p>
      <button className="button-secondary" disabled={working} onClick={() => void recover({ action: "replace", providerId: item.providerId, scheduledStartIso: item.startIso, scheduledEndIso: item.endIso })}>Request replacement from {item.companyName}</button>
    </div>)}
    {options.supportRequired ? <p>No equivalent opening is available. Contact support for help with another arrangement.</p> : null}
    <div className="cta-row">
      <button className="button-secondary" disabled={working} onClick={() => void refresh()}>Refresh alternatives</button>
      <button className="button-secondary" disabled={working} onClick={() => void recover({ action: "cancel" })}>Cancel without a recovery fee</button>
      <a className="button-secondary" href={`/help?bookingId=${booking.id}&issueType=general`}>Get help with this visit</a>
    </div>
    <p>Any captured payment remains subject to the existing refund review; this action does not promise an immediate refund.</p>
    {message ? <p role="alert">{message}</p> : null}
  </section>;
}
