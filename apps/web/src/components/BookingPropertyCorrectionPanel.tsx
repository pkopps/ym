"use client";
import { type Booking, type CustomerProperty, type BookingAddressChangeRequest } from "@yardmatch/contracts";
import { useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

export function BookingPropertyCorrectionPanel({ booking, properties, onUpdated }: { booking: Booking; properties: CustomerProperty[]; onUpdated: () => void }) {
  const [propertyId, setPropertyId] = useState(booking.servicePropertyId ?? "");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  async function submit() {
    const property = properties.find(item => item.id === propertyId);
    if (!property) return;
    setWorking(true);
    try {
      const response = await createAuthenticatedWebApiClient().updateBookingAddress({ bookingId: booking.id, newPropertyId: property.id, newAddress: property.address });
      setMessage(response.reason); onUpdated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to request correction."); }
    finally { setWorking(false); }
  }
  if (!["requested", "confirmed"].includes(booking.status)) return null;
  return <details className="list-panel"><summary>Wrong service property?</summary>
    <p>Choose one of your saved properties. Route, scope, and price changes require review before work begins.</p>
    <label className="form-field">Correct service property<select aria-label="Correct service property" value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="">Choose property</option>{properties.map(property => <option key={property.id} value={property.id}>{property.label} • {property.address.line1}</option>)}</select></label>
    <button className="button-secondary" disabled={working || !propertyId || propertyId === booking.servicePropertyId} onClick={() => void submit()}>Request property correction</button>
    <a href={`/help?bookingId=${booking.id}&issueType=general`}>Get help with property or access</a>
    {booking.addressChangeHistory.at(-1) ? <p>Last correction: {booking.addressChangeHistory.at(-1)!.outcome} • {booking.addressChangeHistory.at(-1)!.reason}</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </details>;
}

export function ProviderPropertyCorrectionPanel({ bookingId, history, onUpdated }: { bookingId: string; history?: BookingAddressChangeRequest[]; onUpdated: () => void }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const change = history?.at(-1);
  async function review(action: "approve" | "reject") {
    if (!change) return;
    setWorking(true);
    try { await createAuthenticatedWebApiClient().reviewBookingAddress({ bookingId, changeId: change.id, action, reason }); onUpdated(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to review correction."); }
    finally { setWorking(false); }
  }
  if (change?.outcome !== "requires-provider-review") return null;
  return <section aria-label="Property correction review" className="list-panel"><h3>Review service property correction</h3><p>{change.requestedAddress.line1} • {change.requestedAddress.city}</p><p>{change.reason}</p>
    <label>Property review reason<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
    <div className="cta-row"><button disabled={working || !reason.trim()} onClick={() => void review("approve")}>Approve property correction</button><button disabled={working || !reason.trim()} onClick={() => void review("reject")}>Reject property correction</button></div>
    {message ? <p role="alert">{message}</p> : null}
  </section>;
}
