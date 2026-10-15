import { useState } from "react";
import { AppState, Linking, Pressable, Text, TextInput, View } from "react-native";
import { useEffect } from "react";
import { bookingScheduleStartIso, type AvailabilitySlot, type ProviderProfile, type ProviderCredentialType, type ProviderConnectStatusResponse } from "@yardmatch/contracts";
import { createProviderMobileApiClient } from "../lib/api";
import { unlessFeatureDisabled } from "../lib/launchFeatures";

const types: ProviderCredentialType[] = ["business-registration", "general-liability-insurance", "workers-compensation", "commercial-auto-insurance", "pesticide-applicator-license"];
export function ProviderActivationCard({ provider, token, onUpdated }: { provider: ProviderProfile; token?: string; onUpdated: (profile: ProviderProfile) => void }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [openingDate, setOpeningDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [openingHour, setOpeningHour] = useState(7);
  const [type, setType] = useState<ProviderCredentialType>("business-registration");
  const [reference, setReference] = useState("");
  const [expiry, setExpiry] = useState("");
  const [status, setStatus] = useState<ProviderConnectStatusResponse>();
  const [payoutsAvailable, setPayoutsAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  function api() { const client = createProviderMobileApiClient(); client.setAuthToken(token); return client; }
  useEffect(() => {
    if (!token) return;
    const client = createProviderMobileApiClient(); client.setAuthToken(token);
    const refresh = () => { void unlessFeatureDisabled(client.getProviderConnectStatus()).then(next => { setPayoutsAvailable(Boolean(next)); setStatus(next); }).catch(error => setMessage(error instanceof Error ? error.message : "Unable to refresh payout setup.")); };
    refresh();
    void client.getOwnProviderAvailability().then(setSlots).catch(error => setMessage(String(error)));
    const listener = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => listener.remove();
  }, [token]);
  async function act(action: "submit" | "connect") {
    setWorking(true);
    try {
      if (action === "submit") {
        if (!reference.trim()) throw new Error("Enter a registration or policy reference.");
        if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new Error("Use YYYY-MM-DD for expiration.");
        onUpdated(await api().submitProviderCredential({ type, referenceNumber: reference, jurisdiction: provider.address.state, expiresAt: expiry ? new Date(`${expiry}T23:59:59Z`).toISOString() : undefined }));
        setMessage("Credential submitted for review."); setReference("");
      } else {
        const response = await api().startProviderConnectOnboarding();
        await Linking.openURL(response.onboardingUrl);
        setMessage("Complete payout setup in your browser, then return here and refresh. You may need to sign in on the web to resume.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete this action."); }
    finally { setWorking(false); }
  }
  async function opening(slotId?: string) {
    setWorking(true);
    try {
      const startIso = bookingScheduleStartIso(openingDate, openingHour);
      setSlots(await api().manageProviderAvailability(slotId ? { action: "remove", slotId } : { action: "add", startIso, endIso: new Date(Date.parse(startIso) + (openingHour === 7 ? 5 : 4) * 3600000).toISOString() }));
      setMessage(slotId ? "Opening removed." : "Opening published. Marketplace approval is required before customers can request it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save opening."); }
    finally { setWorking(false); }
  }
  return <View style={{ gap: 12, padding: 16 }}>
    <Text accessibilityRole="header">Service openings</Text>
    <Text>Publish the dates you can work. Windows use Eastern time.</Text>
    <TextInput accessibilityLabel="Opening date" placeholder="Opening date YYYY-MM-DD" value={openingDate} onChangeText={setOpeningDate} />
    {[7, 12, 16].map(hour => <Pressable key={hour} onPress={() => setOpeningHour(hour)}><Text>{openingHour === hour ? "✓ " : ""}{hour === 7 ? "Morning" : hour === 12 ? "Afternoon" : "Evening"}</Text></Pressable>)}
    <Pressable disabled={working} onPress={() => void opening()}><Text>Publish opening</Text></Pressable>
    {slots.map(slot => <View key={slot.id}><Text>{new Date(slot.startIso).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</Text><Pressable disabled={working || slot.isBooked} onPress={() => void opening(slot.id)}><Text>Remove opening</Text></Pressable></View>)}
    <Text accessibilityRole="header">{payoutsAvailable ? "Business credentials and payout setup" : "Business credentials"}</Text>
    {payoutsAvailable ? <Text>Marketplace: {provider.verificationStatus}. Payout account: {status?.account?.onboardingStatus ?? "not started"}. {status?.transferReady ? "Account capabilities ready; job and credential gates still apply." : "Payout setup required."}</Text> : <Text>Marketplace: {provider.verificationStatus}.</Text>}
    <Text>Your business engages, supervises, insures, and compensates its crew.</Text>
    {provider.credentials?.map(credential => <Text key={credential.id}>{credential.type}: {credential.expiresAt && Date.parse(credential.expiresAt) <= Date.now() ? "expired" : credential.status} {credential.reviewNotes}</Text>)}
    {types.map(value => <Pressable key={value} accessibilityRole="button" onPress={() => setType(value)}><Text>{value === type ? "✓ " : ""}{value.replaceAll("-", " ")}</Text></Pressable>)}
    <TextInput accessibilityLabel="Registration or policy reference" placeholder="Registration or policy reference" value={reference} onChangeText={setReference} />
    <TextInput accessibilityLabel="Credential expiration" placeholder="Expiration YYYY-MM-DD" value={expiry} onChangeText={setExpiry} />
    <Pressable disabled={working} onPress={() => void act("submit")}><Text>Submit credential</Text></Pressable>
    {payoutsAvailable ? <>
      <Pressable disabled={working || !status?.stripeConfigured} onPress={() => void act("connect")}><Text>Start or resume payout setup</Text></Pressable>
      <Pressable onPress={() => void api().getProviderConnectStatus().then(setStatus).catch(error => setMessage(String(error)))}><Text>Refresh payout status</Text></Pressable>
    </> : null}
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
  </View>;
}
