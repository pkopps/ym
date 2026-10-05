"use client";
import { bookingScheduleStartIso, type AvailabilitySlot } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
export function ProviderAvailabilityPanel() {
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [hour, setHour] = useState(7);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { void createAuthenticatedWebApiClient().getOwnProviderAvailability().then(setSlots).catch(error => setMessage(String(error))); }, []);
  async function save(slotId?: string) {
    setWorking(true);
    try {
      const startIso = bookingScheduleStartIso(date, hour);
      setSlots(await createAuthenticatedWebApiClient().manageProviderAvailability(slotId ? { action: "remove", slotId } : { action: "add", startIso, endIso: new Date(Date.parse(startIso) + (hour === 7 ? 5 : 4) * 3600000).toISOString() }));
      setMessage(slotId ? "Opening removed. Existing bookings stay scheduled." : "Opening published. Customers can request it after marketplace approval.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save opening."); }
    finally { setWorking(false); }
  }
  return <section className="list-panel" aria-label="Provider availability"><h3>Service openings</h3><p>Publish the dates you can work. Times use Eastern time. External calendar blocks and existing visits still protect your schedule.</p>
    <div className="form-grid"><label className="form-field">Opening date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label className="form-field">Opening window<select aria-label="Opening window" value={hour} onChange={event => setHour(Number(event.target.value))}><option value={7}>Morning, 7 AM–noon</option><option value={12}>Afternoon, noon–4 PM</option><option value={16}>Evening, 4–8 PM</option></select></label></div>
    <button className="button-secondary" disabled={working} onClick={() => void save()}>Publish opening</button>
    <ul>{slots.map(slot => <li key={slot.id}>{new Date(slot.startIso).toLocaleString("en-US", { timeZone: "America/New_York" })} ET <button className="button-secondary" disabled={working || slot.isBooked} onClick={() => void save(slot.id)}>Remove opening</button></li>)}</ul>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
