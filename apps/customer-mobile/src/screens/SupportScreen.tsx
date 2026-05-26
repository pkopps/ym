import { Text, View } from "react-native";
import { getHelpCollection } from "@yardmatch/help-center";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function SupportScreen() {
  const collection = getHelpCollection("customer");

  return (
    <ScreenShell
      eyebrow="Customer support"
      title="Get help with billing, refunds, booking issues, and post-service follow-up."
      description="Customer help content stays shared with the website, but this app only renders the homeowner-facing collection."
    >
      <InfoCard title={collection.title} description={collection.description}>
        <Text>{collection.quickLinks.join(" • ")}</Text>
      </InfoCard>
      {collection.articles.map((article) => (
        <InfoCard key={article.id} title={article.title} description={article.summary}>
          <Text>
            {article.readTimeMinutes} min read • Updated {article.updatedAt}
          </Text>
          {article.sections.map((section) => (
            <View key={section.heading} style={{ gap: 4, marginTop: 12 }}>
              <Text style={{ fontWeight: "700" }}>{section.heading}</Text>
              <Text>{section.body}</Text>
              {section.bullets.map((bullet) => (
                <Text key={bullet}>• {bullet}</Text>
              ))}
            </View>
          ))}
        </InfoCard>
      ))}
    </ScreenShell>
  );
}
