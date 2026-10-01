import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { defaultServiceStartingPrices, parsePriceDollars, type ProviderPricingOverview, type ProviderServicePrice, type ServiceCategory } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { createProviderMobileApiClient } from "../lib/api";
import { InfoCard } from "./InfoCard";
export function ProviderPricingCard({ postalCode, categories, token, onChange }: {
  postalCode: string; categories: ServiceCategory[]; token?: string; onChange?: (prices: ProviderServicePrice[]) => void;
}) {
  const i18n = useI18n();
  const [zipInput, setZipInput] = useState(postalCode.slice(0, 5));
  const [rows, setRows] = useState<ProviderPricingOverview["prices"]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadedZip, setLoadedZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const zip = (onChange ? postalCode : zipInput).trim().slice(0, 5);
  const categoriesKey = categories.join(",");
  useEffect(() => {
    let active = true; setRows([]); setLoadedZip(""); setError(""); setMessage(""); onChange?.([]);
    if (!/^\d{5}$/.test(zip)) { setBusy(false); return; }
    setBusy(true);
    const api = createProviderMobileApiClient(); if (token) api.setAuthToken(token);
    const request = onChange ? api.getZipServiceMinimums(zip).then(minimums => ({ postalCode: zip,
      prices: (categoriesKey.split(",") as ServiceCategory[]).filter(Boolean).map(category => {
        const minimumStartingPriceCents = minimums.find(row => row.category === category)?.minimumStartingPriceCents;
        return { category, minimumStartingPriceCents, effectiveStartingPriceCents: Math.max(defaultServiceStartingPrices[category], minimumStartingPriceCents ?? 0) };
      }) })) : api.getProviderPricing(zip);
    request.then(result => {
      if (!active) return; setRows(result.prices); setLoadedZip(zip);
      setValues(Object.fromEntries(result.prices.map(row => [row.category, (row.effectiveStartingPriceCents / 100).toFixed(2)])));
      onChange?.(result.prices.filter(row => row.minimumStartingPriceCents !== undefined).map(row => ({ postalCode: zip, category: row.category, startingPriceCents: row.effectiveStartingPriceCents })));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : i18n.t("pricing.error")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [zip, categoriesKey, token, onChange, i18n]);
  const configured = rows.filter(row => row.minimumStartingPriceCents !== undefined);
  const invalid = configured.some(row => (parsePriceDollars(values[row.category] ?? "") ?? 0) < row.minimumStartingPriceCents!);
  function change(category: ServiceCategory, value: string) {
    const next = { ...values, [category]: value }; setValues(next); setMessage("");
    onChange?.(configured.map(row => ({ postalCode: loadedZip, category: row.category, startingPriceCents: parsePriceDollars(next[row.category] ?? "") ?? 0 })));
  }
  async function save() {
    if (busy || invalid || zip !== loadedZip || !configured.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const api = createProviderMobileApiClient(); if (token) api.setAuthToken(token);
      const result = await api.updateProviderPricing(configured.map(row => ({ postalCode: loadedZip, category: row.category, startingPriceCents: parsePriceDollars(values[row.category])! })));
      setRows(result.prices); setMessage(i18n.t("pricing.saved"));
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("pricing.error")); }
    finally { setBusy(false); }
  }
  const disabled = busy || invalid || zip !== loadedZip || !configured.length;
  return <InfoCard title={i18n.t("pricing.title")} description={i18n.t("pricing.description")}>
    <Text style={styles.text}>{i18n.t("pricing.zip")}{onChange ? `: ${zip || "—"}` : ""}</Text>
    {!onChange ? <TextInput accessibilityLabel={i18n.t("pricing.zip")} keyboardType="number-pad" maxLength={5} editable={!busy} value={zipInput} onChangeText={setZipInput} style={styles.input} /> : null}
    {busy && !rows.length ? <Text style={styles.text}>{i18n.t("pricing.loading")}</Text> : null}
    {rows.map(row => <View key={row.category} style={styles.row}><Text style={styles.label}>{i18n.t(serviceCategoryLabelKeys[row.category])}</Text>
      {row.minimumStartingPriceCents !== undefined ? <>
        <Text style={styles.text}>{i18n.t("pricing.starting")}</Text>
        <TextInput accessibilityLabel={`${i18n.t(serviceCategoryLabelKeys[row.category])} — ${i18n.t("pricing.starting")}`} keyboardType="decimal-pad" editable={!busy && zip === loadedZip} value={values[row.category] ?? ""} onChangeText={value => change(row.category, value)} style={styles.input} />
        <Text style={styles.text}>{i18n.t("pricing.minimum", { amount: i18n.formatCurrency(row.minimumStartingPriceCents, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</Text>
        {row.savedStartingPriceCents !== undefined && row.savedStartingPriceCents < row.minimumStartingPriceCents ? <Text style={styles.text}>{i18n.t("pricing.raised")}</Text> : null}
      </> : <Text style={styles.text}>{i18n.t("pricing.unavailable")}</Text>}
    </View>)}
    {!/^\d{5}$/.test(zip) ? <Text style={styles.text}>{i18n.t("pricing.enter_zip")}</Text> : null}
    <Text style={styles.text}>{i18n.t("pricing.existing")}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    {message ? <Text style={styles.text}>{message}</Text> : null}
    {!onChange ? <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && { opacity: 0.5 }]} onPress={() => void save()}><Text style={styles.buttonText}>{i18n.t("pricing.save")}</Text></Pressable> : null}
  </InfoCard>;
}
const styles = StyleSheet.create({
  row: { gap: 8 }, text: { color: BrandTokens.colors.inkSoft, lineHeight: 21 },
  label: { color: BrandTokens.colors.ink, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#cdd6cf", borderRadius: BrandTokens.radius.sm, padding: 12, backgroundColor: BrandTokens.colors.card, color: BrandTokens.colors.ink },
  button: { backgroundColor: BrandTokens.colors.ink, padding: 14, borderRadius: BrandTokens.radius.sm },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700" }
});
