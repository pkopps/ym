import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { bookingScheduleStartIso, type ProviderStaffingJobSummary, type UpdateBookingScheduleRequest } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createProviderMobileApiClient } from "../lib/api";

export function BookingScheduleCard({ job, token, onUpdated }: { job: ProviderStaffingJobSummary; token?: string; onUpdated: () => Promise<void> }) {
  const i18n = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<UpdateBookingScheduleRequest["kind"]>("weather");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(12);
  const [minutes, setMinutes] = useState(30);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const update = job.scheduleUpdates?.at(-1);
  if (!["confirmed", "in-progress"].includes(job.status)) return null;
  const format = (iso: string) => i18n.formatDate(iso, { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  async function send() {
    if (!token) return;
    setWorking(true); setError("");
    try {
      const now = Date.now();
      const payload: UpdateBookingScheduleRequest = { bookingId: job.bookingId, kind, reason, nextUpdateByIso: new Date(now + (kind === "running-late" ? Math.min(minutes, 60) : 60) * 60000).toISOString() };
      if (kind === "running-late") payload.expectedArrivalIso = new Date(now + minutes * 60000).toISOString();
      if (kind === "reschedule") {
        payload.proposedStartIso = bookingScheduleStartIso(date, hour);
        payload.proposedEndIso = new Date(Date.parse(payload.proposedStartIso) + Date.parse(job.scheduledEndIso) - Date.parse(job.scheduledStartIso)).toISOString();
      }
      const api = createProviderMobileApiClient(); api.setAuthToken(token);
      await api.updateBookingSchedule(payload); await onUpdated(); setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("schedule.error")); }
    finally { setWorking(false); }
  }
  return <View style={styles.card}>
    {update && update.state !== "resolved" ? <>
      <Text style={styles.title}>{i18n.t(update.state === "accepted" ? "schedule.accepted" : update.state === "declined" ? "schedule.declined" : update.kind === "weather" ? "schedule.weather" : update.kind === "reschedule" ? "schedule.proposal" : "schedule.late")}</Text>
      <Text style={styles.body}>{update.reason}</Text>
      {update.proposedStartIso ? <Text style={styles.body}>{format(update.proposedStartIso)}</Text> : null}
      {["active", "declined"].includes(update.state) ? <Text style={styles.body}>{i18n.t(Date.parse(update.nextUpdateByIso) <= Date.now() ? "schedule.overdue" : "schedule.next_update", { time: format(update.nextUpdateByIso) })}</Text> : null}
    </> : null}
    <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.button}><Text style={styles.buttonText}>{i18n.t("schedule.send")}</Text></Pressable>
    {open ? <View style={styles.form}>
      <Text style={styles.title}>{i18n.t("schedule.type")}</Text>
      <View style={styles.row}>{(["running-late", "weather", "reschedule"] as const).map(value => <Pressable accessibilityRole="radio" accessibilityState={{ checked: kind === value }} key={value} onPress={() => setKind(value)} style={[styles.choice, kind === value && styles.selected]}><Text style={styles.body}>{i18n.t(value === "weather" ? "schedule.weather" : value === "reschedule" ? "schedule.proposal" : "schedule.late")}</Text></Pressable>)}</View>
      {kind === "running-late" ? <><Text style={styles.body}>{i18n.t("schedule.arrival_in")}</Text><View style={styles.row}>{[15, 30, 60, 120].map(value => <Pressable accessibilityRole="radio" accessibilityState={{ checked: minutes === value }} key={value} onPress={() => setMinutes(value)} style={[styles.choice, minutes === value && styles.selected]}><Text style={styles.body}>{i18n.t("schedule.minutes", { count: value })}</Text></Pressable>)}</View></> : null}
      {kind === "reschedule" ? <>
        <Text style={styles.body}>{i18n.t("schedule.provider_proposal_body")}</Text>
        <Text style={styles.body}>{i18n.t("schedule.date")}</Text><TextInput accessibilityLabel={i18n.t("schedule.date")} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} style={styles.input} />
        <Text style={styles.body}>{i18n.t("schedule.window")}</Text><View style={styles.form}>{[7, 12, 16].map(value => <Pressable accessibilityRole="radio" accessibilityState={{ checked: hour === value }} key={value} onPress={() => setHour(value)} style={[styles.choice, hour === value && styles.selected]}><Text style={styles.body}>{i18n.t(value === 7 ? "schedule.morning" : value === 12 ? "schedule.afternoon" : "schedule.evening")}</Text></Pressable>)}</View>
      </> : null}
      <Text style={styles.body}>{i18n.t("schedule.reason")}</Text><TextInput accessibilityLabel={i18n.t("schedule.reason")} value={reason} onChangeText={setReason} maxLength={500} multiline style={styles.input} />
      <Text style={styles.body}>{i18n.t("schedule.next_update", { time: format(new Date(Date.now() + (kind === "running-late" ? Math.min(minutes, 60) : 60) * 60000).toISOString()) })}</Text>
      <Pressable accessibilityRole="button" disabled={working || reason.trim().length < 3} onPress={() => void send()} style={styles.button}><Text style={styles.buttonText}>{i18n.t("schedule.notify")}</Text></Pressable>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, gap: 10, borderRadius: 14, backgroundColor: BrandTokens.colors.surfaceStrong }, title: { color: BrandTokens.colors.ink, fontWeight: "700", fontSize: 16 }, body: { color: BrandTokens.colors.inkSoft, lineHeight: 21 }, form: { gap: 10 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { borderWidth: 1, borderColor: BrandTokens.colors.border, padding: 12, borderRadius: 14 }, selected: { borderColor: BrandTokens.colors.primary, backgroundColor: BrandTokens.colors.card }, input: { borderColor: BrandTokens.colors.border, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: BrandTokens.colors.card, color: BrandTokens.colors.ink }, button: { backgroundColor: BrandTokens.colors.primary, padding: 14, borderRadius: 14 }, buttonText: { color: BrandTokens.colors.card, textAlign: "center", fontWeight: "700" }, error: { color: BrandTokens.colors.danger } });
