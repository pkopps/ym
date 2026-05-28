import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";

export function InfoCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandTokens.colors.card,
    borderColor: "rgba(20, 40, 29, 0.08)",
    borderWidth: 1,
    borderRadius: BrandTokens.radius.md,
    padding: 20,
    gap: BrandTokens.spacing.md
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 20,
    fontWeight: "700"
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  }
});
