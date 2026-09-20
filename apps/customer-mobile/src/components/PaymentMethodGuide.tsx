import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { useI18n } from "@yardmatch/i18n/react";

export function PaymentMethodGuide({ returningCustomer = false }: { returningCustomer?: boolean }) {
  const i18n = useI18n();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.guide}>
      <Text style={styles.title}>{i18n.t("payments.choice.title")}</Text>
      <Text style={styles.body}>{i18n.t("payments.choice.body")}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.disclosure}>
        <Text style={styles.title}>{i18n.t(returningCustomer ? "payments.bank.returning" : "payments.bank.option")}</Text>
      </Pressable>
      {expanded ? <>
        <Text style={styles.body}>{i18n.t("payments.bank.body")}</Text>
        <Text style={styles.body}>{i18n.t("payments.bank.timing")}</Text>
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: 6, marginVertical: 12 },
  title: { color: BrandTokens.colors.ink, fontWeight: "600", lineHeight: 22 },
  body: { color: BrandTokens.colors.inkSoft, lineHeight: 22 },
  disclosure: { minHeight: 44, justifyContent: "center" }
});
