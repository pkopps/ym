import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { bookingScheduleWindowHour, type Booking } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createCustomerMobileApiClient } from "../lib/api";

export function BookingScheduleCard({ booking, token, onUpdated }: { booking: Booking; token?: string; onUpdated: () => Promise<void> }) {
  const i18n = useI18n();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const update = booking.scheduleUpdates?.at(-1);
  if (!update || update.state === "resolved" || !["confirmed", "in-progress"].includes(booking.status)) return null;
  const format = (iso: string) => i18n.formatDate(iso, { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const active = ["active", "declined"].includes(update.state);
  async function respond(action: "accept" | "decline") {
    if (!token || !update) return;
    setWorking(true); setError("");
    try {
      const api = createCustomerMobileApiClient(); api.setAuthToken(token);
      await api.respondBookingSchedule({ bookingId: booking.id, updateId: update.id, action });
      await onUpdated();
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("schedule.error")); }
    finally { setWorking(false); }
  }
  return <View style={styles.card}>
    <Text style={styles.title}>{i18n.t(update.state === "accepted" ? "schedule.accepted" : update.state === "declined" ? "schedule.declined" : update.kind === "weather" ? "schedule.weather" : update.kind === "reschedule" ? "schedule.proposal" : "schedule.late")}</Text>
    <Text style={styles.body}>{update.reason}</Text>
    {update.kind === "weather" && active ? <Text style={styles.body}>{i18n.t("schedule.weather_body")}</Text> : null}
    {update.expectedArrivalIso && active ? <Text style={styles.body}>{i18n.t("schedule.eta", { time: format(update.expectedArrivalIso) })}</Text> : null}
    {update.proposedStartIso ? <Text style={styles.title}>{i18n.formatDate(update.proposedStartIso, { timeZone: "America/New_York", month: "short", day: "numeric" })} · {i18n.t(bookingScheduleWindowHour(update.proposedStartIso) === 7 ? "schedule.morning" : bookingScheduleWindowHour(update.proposedStartIso) === 12 ? "schedule.afternoon" : "schedule.evening")}</Text> : null}
    {update.kind === "reschedule" ? <Text style={styles.body}>{i18n.t(update.state === "accepted" ? "schedule.accepted_body" : update.state === "declined" ? "schedule.declined_body" : "schedule.proposal_body")}</Text> : null}
    {active ? <Text style={styles.body}>{i18n.t(Date.parse(update.nextUpdateByIso) <= Date.now() ? "schedule.overdue" : "schedule.next_update", { time: format(update.nextUpdateByIso) })}</Text> : null}
    {update.kind === "reschedule" && update.state === "active" ? <View style={styles.actions}>{(["accept", "decline"] as const).map(action => <Pressable accessibilityRole="button" disabled={working || !token} key={action} onPress={() => void respond(action)} style={styles.button}><Text style={styles.buttonText}>{i18n.t(action === "accept" ? "schedule.accept" : "schedule.decline")}</Text></Pressable>)}</View> : null}
    <Text style={styles.body}>{i18n.t("schedule.updated", { time: format(update.updatedAt) })}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, gap: 10, borderRadius: 14, backgroundColor: BrandTokens.colors.surfaceStrong }, title: { color: BrandTokens.colors.ink, fontWeight: "700", fontSize: 16 }, body: { color: BrandTokens.colors.inkSoft, lineHeight: 21 }, actions: { gap: 8 }, button: { backgroundColor: BrandTokens.colors.primary, padding: 14, borderRadius: 14 }, buttonText: { color: BrandTokens.colors.card, textAlign: "center", fontWeight: "700" }, error: { color: BrandTokens.colors.danger } });
