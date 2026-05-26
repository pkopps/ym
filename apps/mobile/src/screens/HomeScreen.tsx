import { Text } from "react-native";
import { landingMetrics } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function HomeScreen() {
  return (
    <ScreenShell
      eyebrow="Shared mobile experience"
      title="One React Native app serves phones and tablets."
      description="The mobile app focuses on fast field workflows while web handles SEO-heavy discovery and conversion."
    >
      {landingMetrics.map((metric) => (
        <InfoCard
          key={metric.label}
          title={metric.value}
          description={metric.label}
        >
          <Text>{metric.label}</Text>
        </InfoCard>
      ))}
    </ScreenShell>
  );
}
