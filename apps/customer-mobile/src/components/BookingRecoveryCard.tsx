import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { type Booking, type BookingRecoveryOptions, type RecoverBookingRequest } from "@yardmatch/contracts";
import { createCustomerMobileApiClient } from "../lib/api";
export function BookingRecoveryCard({ booking, token, onUpdated }: { booking: Booking; token?: string; onUpdated: () => void }) {
  const [options, setOptions] = useState<BookingRecoveryOptions>();
  const [plan, setPlan] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!token || !["requested", "confirmed"].includes(booking.status)) return;
    let active = true;
    const api = createCustomerMobileApiClient(); api.setAuthToken(token);
    void api.getBookingRecoveryOptions(booking.id).then(result => { if (active) setOptions(result); }).catch(error => { if (active) setMessage(String(error)); });
    return () => { active = false; };
  }, [token, booking.id, booking.status, booking.scheduleVersion]);
  async function recover(input: Partial<RecoverBookingRequest>) {
    if (!options?.recovery) return;
    setWorking(true);
    try {
      const api = createCustomerMobileApiClient(); api.setAuthToken(token);
      await api.recoverBooking({ bookingId: booking.id, recoveryId: options.recovery.id, action: "cancel", scope: plan ? "plan" : "visit", ...input });
      setOptions(undefined); onUpdated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Refresh this visit and try again."); }
    finally { setWorking(false); }
  }
  async function refresh() {
    setWorking(true);
    try { const api = createCustomerMobileApiClient(); api.setAuthToken(token); setOptions(await api.getBookingRecoveryOptions(booking.id)); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to refresh recovery options."); }
    finally { setWorking(false); }
  }
  if (!options?.recovery) return booking.recovery?.state === "open" && message ? <View><Text accessibilityRole="alert">{message}</Text><Pressable disabled={working} onPress={() => void refresh()}><Text>Retry recovery options</Text></Pressable></View> : null;
  return <View style={{ gap: 12, padding: 16 }}>
    <Text accessibilityRole="header">Recover this visit</Text>
    <Text>Your provider is unavailable or timing is overdue. Choose a replacement at the agreed price or cancel without a recovery fee. A replacement requires provider confirmation.</Text>
    {booking.recurringPlanId ? <View><Text>Also change future visits in this plan. Generated visits need separate review.</Text><Switch value={plan} onValueChange={setPlan} /></View> : null}
    {options.alternatives.map(item => <Pressable key={item.providerId} disabled={working} onPress={() => void recover({ action: "replace", providerId: item.providerId, scheduledStartIso: item.startIso, scheduledEndIso: item.endIso })}><Text>Request {item.companyName} • {new Date(item.startIso).toLocaleString()}</Text></Pressable>)}
    {options.supportRequired ? <Text>No equivalent opening is available. Use Help for a booking-linked support request.</Text> : null}
    <Pressable disabled={working} onPress={() => void refresh()}><Text>Refresh alternatives</Text></Pressable>
    <Pressable disabled={working} onPress={() => void recover({ action: "cancel" })}><Text>Cancel without a recovery fee</Text></Pressable>
    <Text>Captured payments remain subject to refund review.</Text>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
  </View>;
}
