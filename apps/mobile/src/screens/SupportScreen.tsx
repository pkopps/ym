import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { getHelpCollection, helpAudienceLabels, HelpAudience } from "@yardmatch/help-center";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function SupportScreen() {
  const [audience, setAudience] = useState<HelpAudience>("customer");
  const collection = getHelpCollection(audience);

  return (
    <ScreenShell
      eyebrow="Shared help center"
      title="Read customer and provider help documents from the same content layer."
      description="Mobile renders the same help collections used by web so documentation updates only need to happen in one place."
    >
      <View style={styles.toggleRow}>
        {(["customer", "provider"] as HelpAudience[]).map((item) => {
          const isActive = item === audience;
          return (
            <Pressable
              accessibilityRole="button"
              key={item}
              onPress={() => setAudience(item)}
              style={[styles.toggleButton, isActive && styles.toggleButtonActive]}
            >
              <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>
                {helpAudienceLabels[item]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <InfoCard
        title={collection.title}
        description={collection.description}
      >
        <Text>{collection.quickLinks.join(" • ")}</Text>
      </InfoCard>
      {collection.articles.map((article) => (
        <InfoCard key={article.id} title={article.title} description={article.summary}>
          <View style={styles.articleMeta}>
            <Text>{article.readTimeMinutes} min read</Text>
            <Text>Updated {article.updatedAt}</Text>
          </View>
          {article.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text>{section.body}</Text>
              {section.bullets.map((bullet) => (
                <Text key={bullet} style={styles.bullet}>
                  • {bullet}
                </Text>
              ))}
            </View>
          ))}
        </InfoCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  toggleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  toggleButtonActive: {
    backgroundColor: BrandTokens.colors.primary
  },
  toggleText: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "600"
  },
  toggleTextActive: {
    color: "#ffffff"
  },
  articleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.sm
  },
  section: {
    gap: BrandTokens.spacing.xs,
    marginTop: BrandTokens.spacing.md
  },
  sectionHeading: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  bullet: {
    color: BrandTokens.colors.muted
  }
});
