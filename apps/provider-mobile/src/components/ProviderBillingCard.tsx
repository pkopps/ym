import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { openBrowserAsync } from "expo-web-browser";
import { BrandTokens } from "@yardmatch/branding";
import type { ProviderBillingStatusResponse } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createProviderMobileApiClient } from "../lib/api";
import { InfoCard } from "./InfoCard";

/** Card on file for finder fees. Stripe setup opens in the browser; the app picks the card up on return. */
export function ProviderBillingCard({ token }: { token?: string }) {
  const i18n = useI18n();
  const [status, setStatus] = useState<ProviderBillingStatusResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const client = useCallback(() => {
    const api = createProviderMobileApiClient();
    if (token) api.setAuthToken(token);
    return api;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setStatus(await client().refreshProviderBilling());
      setError("");
    } catch {
      setError(i18n.t("provider_billing.error"));
    }
  }, [client, i18n, token]);

  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => listener.remove();
  }, [refresh]);

  async function startSetup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const hadCard = status?.card?.last4;
      const { url } = await client().startProviderCardSetup({ returnPath: "/provider/card-saved" });
      await openBrowserAsync(url);
      const next = await client().refreshProviderBilling();
      setStatus(next);
      if (next.card?.last4 && next.card.last4 !== hadCard) setMessage(i18n.t("provider_billing.saved"));
    } catch {
      setError(i18n.t("provider_billing.error"));
    } finally {
      setBusy(false);
    }
  }

  const amount = (cents: number) => i18n.formatCurrency(cents, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const size = (sqFt: number) => new Intl.NumberFormat(i18n.locale).format(sqFt);

  return <InfoCard title={i18n.t("provider_billing.title")} description={i18n.t("provider_billing.description")}>
    {status?.finderFees.map((row, index) => {
      const previous = status.finderFees[index - 1]?.maxLawnSqFt;
      const label = row.maxLawnSqFt !== undefined
        ? i18n.t("provider_billing.tier_up_to", { size: size(row.maxLawnSqFt) })
        : i18n.t("provider_billing.tier_over", { size: size(previous ?? 0) });
      return <View key={row.tier} style={styles.row}><Text style={styles.label}>{amount(row.feeCents)}</Text><Text style={styles.text}>{label}</Text></View>;
    })}
    {status?.firstCustomerFree ? <Text style={styles.text}>{i18n.t("provider_billing.first_free")}</Text> : null}
    {!status && !error ? <Text style={styles.text}>{i18n.t("provider_billing.loading")}</Text> : null}
    {status ? <Text style={styles.label}>
      {status.hasCardOnFile && status.card?.last4
        ? i18n.t("provider_billing.card_on_file", {
          brand: (status.card.brand ?? "card").replace(/^\w/, letter => letter.toUpperCase()),
          last4: status.card.last4,
          expiry: status.card.expMonth && status.card.expYear ? `${String(status.card.expMonth).padStart(2, "0")}/${status.card.expYear}` : "—"
        })
        : i18n.t("provider_billing.no_card")}
    </Text> : null}
    {status && status.chargesNeedingAttention > 0 ? <Text accessibilityRole="alert" style={styles.text}>{i18n.t("provider_billing.attention", { count: status.chargesNeedingAttention })}</Text> : null}
    {status && !status.billingConfigured ? <Text style={styles.text}>{i18n.t("provider_billing.unavailable")}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    {message ? <Text style={styles.text}>{message}</Text> : null}
    {status?.billingConfigured ? <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && { opacity: 0.5 }]} onPress={() => void startSetup()}>
      <Text style={styles.buttonText}>{status.hasCardOnFile ? i18n.t("provider_billing.replace_card") : i18n.t("provider_billing.add_card")}</Text>
    </Pressable> : null}
    {status?.billingConfigured ? <Text style={styles.text}>{i18n.t("provider_billing.secure_note")}</Text> : null}
  </InfoCard>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "baseline" },
  text: { color: BrandTokens.colors.inkSoft, lineHeight: 21, flexShrink: 1 },
  label: { color: BrandTokens.colors.ink, fontWeight: "700" },
  button: { backgroundColor: BrandTokens.colors.ink, padding: 14, borderRadius: BrandTokens.radius.sm },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700" }
});
