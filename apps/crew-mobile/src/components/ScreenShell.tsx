import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BrandTokens } from "@yardmatch/branding";

export function ScreenShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingHorizontal: isTablet ? 36 : 20
        }
      ]}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={[styles.content, isTablet && styles.contentTablet]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: BrandTokens.spacing.hero,
    gap: BrandTokens.spacing.xl
  },
  hero: {
    gap: BrandTokens.spacing.md
  },
  eyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 38
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 16,
    lineHeight: 24
  },
  content: {
    gap: BrandTokens.spacing.lg
  },
  contentTablet: {
    flexDirection: "row",
    flexWrap: "wrap"
  }
});
