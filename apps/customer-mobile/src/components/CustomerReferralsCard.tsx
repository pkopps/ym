import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { buildReferralInvitationHref, type CustomerReferral, type CustomerReferralChannel, type CustomerReferralsOverview } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { createCustomerMobileApiClient } from "../lib/api";
import { useCustomerSession } from "../session/CustomerSessionContext";
import { InfoCard } from "./InfoCard";

export function CustomerReferralsCard() {
  const { envelope } = useCustomerSession();
  return envelope?.session.token ? <ReferralForm key={envelope.session.token} token={envelope.session.token} /> : null;
}

function ReferralForm({ token }: { token: string }) {
  const i18n = useI18n();
  const [overview, setOverview] = useState<CustomerReferralsOverview>();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CustomerReferralChannel>("email");
  const [contact, setContact] = useState("");
  const [area, setArea] = useState("");
  const [permission, setPermission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<CustomerReferral>();
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const api = createCustomerMobileApiClient(); api.setAuthToken(token);
    api.listCustomerReferrals().then((value) => { if (active) setOverview(value); })
      .catch(() => { if (active) setError(i18n.t("referrals.load_error")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refresh, i18n]);

  async function save() {
    if (busy.current || !overview) return;
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const api = createCustomerMobileApiClient(); api.setAuthToken(token);
      const result = await api.createCustomerReferral({ friendName: name, channel, contact, areaLabel: area, contactPermission: permission });
      setOverview((current) => current && ({ ...current, referrals: [result.referral, ...current.referrals.filter((item) => item.id !== result.referral.id)].slice(0, 100) }));
      setSelected(result.referral); setMessage(i18n.t(result.created ? "referrals.saved" : "referrals.duplicate"));
      setName(""); setContact(""); setArea(""); setPermission(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : i18n.t("referrals.save_error")); }
    finally { busy.current = false; setSaving(false); }
  }

  const invitation = selected && overview ? i18n.t("referrals.invitation", { name: selected.friendName,
    url: new URL(addLocalePrefix("/customer", i18n.locale), overview.shareBaseUrl).toString() }) : "";
  async function openInvitation() {
    if (!selected) return;
    try { await Linking.openURL(buildReferralInvitationHref(selected, i18n.t("referrals.subject"), invitation, Platform.OS === "ios")); }
    catch { setError(i18n.t("referrals.open_error")); }
  }

  return <InfoCard title={i18n.t("referrals.title")} description={i18n.t("referrals.description")}>
    <Text>{i18n.t("referrals.how")}</Text>
    <Text>{i18n.t("referrals.name")}</Text><TextInput accessibilityLabel={i18n.t("referrals.name")} style={styles.input} value={name} onChangeText={setName} maxLength={80} editable={!saving} />
    <Text>{i18n.t("referrals.channel")}</Text><View style={styles.row}>{(["email", "phone"] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: channel === value, disabled: saving }} disabled={saving}
      onPress={() => { setChannel(value); setContact(""); }} style={[styles.choice, channel === value && styles.selected]}><Text style={channel === value ? styles.light : styles.dark}>{i18n.t(value === "email" ? "referrals.email" : "referrals.phone")}</Text></Pressable>)}</View>
    <Text>{i18n.t(channel === "email" ? "referrals.email_address" : "referrals.phone_number")}</Text><TextInput accessibilityLabel={i18n.t(channel === "email" ? "referrals.email_address" : "referrals.phone_number")} style={styles.input} value={contact} onChangeText={setContact} keyboardType={channel === "email" ? "email-address" : "phone-pad"} autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!saving} />
    <Text>{i18n.t("referrals.area")}</Text><TextInput accessibilityLabel={i18n.t("referrals.area")} style={styles.input} value={area} onChangeText={setArea} maxLength={100} editable={!saving} />
    <View style={styles.row}><Switch accessibilityLabel={i18n.t("referrals.permission")} value={permission} onValueChange={setPermission} disabled={saving} /><Text style={styles.permission}>{i18n.t("referrals.permission")}</Text></View>
    <Pressable accessibilityRole="button" disabled={saving || loading || !overview || !permission || name.trim().length < 2 || !contact.trim()} onPress={() => void save()} style={[styles.button, (saving || loading || !overview || !permission || name.trim().length < 2 || !contact.trim()) && styles.disabled]}><Text style={styles.light}>{i18n.t(saving ? "referrals.saving" : "referrals.save")}</Text></Pressable>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    {selected ? <View style={styles.item}><Text style={styles.dark}>{selected.friendName}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => void openInvitation()}><Text style={styles.light}>{i18n.t(selected.channel === "email" ? "referrals.open_email" : "referrals.open_text")}</Text></Pressable><Text selectable>{invitation}</Text></View> : null}
    <Text>{i18n.t("referrals.reward_note")}</Text>
    <Text style={styles.dark}>{i18n.t("referrals.history")}</Text><Text>{i18n.t("referrals.latest")}</Text>
    <Pressable accessibilityRole="button" style={styles.choice} disabled={loading || saving} onPress={() => setRefresh((value) => value + 1)}><Text style={styles.dark}>{i18n.t("referrals.refresh")}</Text></Pressable>
    {loading ? <Text>{i18n.t("common.loading.content")}</Text> : null}
    {!loading && overview && !overview.referrals.length ? <Text>{i18n.t("referrals.empty")}</Text> : null}
    {overview?.referrals.map((referral) => <View style={styles.item} key={referral.id}><Text style={styles.dark}>{referral.friendName}</Text><Text>{referral.contact}</Text><Text>{i18n.t(`referrals.status.${referral.status}`)}</Text>
      <Pressable accessibilityRole="button" style={styles.choice} onPress={() => { setSelected(referral); setMessage(""); }}><Text style={styles.dark}>{i18n.t("referrals.preview")}</Text></Pressable></View>)}
  </InfoCard>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: BrandTokens.colors.border, borderRadius: BrandTokens.radius.sm, padding: BrandTokens.spacing.md, color: BrandTokens.colors.ink, backgroundColor: "#fff", fontSize: 16 },
  row: { flexDirection: "row", gap: BrandTokens.spacing.sm, alignItems: "center", flexWrap: "wrap" },
  permission: { flex: 1, minWidth: 180 },
  choice: { padding: BrandTokens.spacing.md, borderWidth: 1, borderColor: BrandTokens.colors.border, borderRadius: BrandTokens.radius.sm },
  selected: { backgroundColor: BrandTokens.colors.primary },
  button: { backgroundColor: BrandTokens.colors.primary, padding: BrandTokens.spacing.md, borderRadius: BrandTokens.radius.sm, alignItems: "center" },
  disabled: { opacity: 0.5 }, light: { color: "#fff", fontWeight: "700" }, dark: { color: BrandTokens.colors.primaryStrong, fontWeight: "700" },
  item: { gap: BrandTokens.spacing.sm, borderTopWidth: 1, borderTopColor: BrandTokens.colors.border, paddingTop: BrandTokens.spacing.md }
});
