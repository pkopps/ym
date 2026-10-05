import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type CrewOpportunity } from "@yardmatch/contracts";
import { createCrewMobileApiClient } from "../lib/api";
export function CrewOpeningsCard({ token, onClaimed }: { token?: string; onClaimed: () => void }) {
  const [openings, setOpenings] = useState<CrewOpportunity[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!token) return;
    const api = createCrewMobileApiClient(); api.setAuthToken(token);
    void api.getPublicCrewOpportunities().then(setOpenings).catch(error => setMessage(String(error)));
  }, [token]);
  async function claim(id: string) {
    setWorking(true);
    const api = createCrewMobileApiClient(); api.setAuthToken(token);
    try {
      const match = await api.claimPublicCrewOpportunity({ opportunityId: id });
      setMessage(match.status === "accepted" ? "Assignment accepted. Check your schedule before travelling." : match.status === "denied" ? "The provider declined this match. Choose another opening." : "Request received. Wait for provider acceptance before travelling.");
      setOpenings(await api.getPublicCrewOpportunities()); onClaimed();
    } catch (error) { setMessage(`Your account is ready. This opening could not be claimed: ${error instanceof Error ? error.message : "Refresh available openings and try another."}`); }
    finally { setWorking(false); }
  }
  return <View style={{ padding: 16, gap: 12 }}>
    <Text accessibilityRole="header">Available crew openings</Text>
    <Text>The provider business engages, supervises, insures, and compensates crew. Confirm compensation with the provider.</Text>
    {openings.slice(0, 10).map(item => <View key={item.id}><Text>{item.providerCompanyName} • {item.title} • {new Date(item.neededByStartIso).toLocaleString()}</Text><Pressable disabled={working} onPress={() => void claim(item.id)}><Text>Request this opening</Text></Pressable></View>)}
    <Pressable onPress={() => { const api = createCrewMobileApiClient(); api.setAuthToken(token); void api.getPublicCrewOpportunities().then(setOpenings).catch(error => setMessage(String(error))); }}><Text>Refresh openings</Text></Pressable>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
  </View>;
}
