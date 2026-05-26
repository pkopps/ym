import { Text } from "react-native";
import { landingMetrics } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function DashboardScreen() {
  return (
    <ScreenShell
      eyebrow="Customer app"
      title="One focused app for booking, saved properties, and post-service follow-up."
      description="The customer app keeps discovery, scheduling, payments, and support in one streamlined mobile experience."
    >
      {landingMetrics.map((metric) => (
        <InfoCard key={metric.label} title={metric.value} description={metric.label}>
          <Text>{metric.label}</Text>
        </InfoCard>
      ))}
      <InfoCard
        title="Dedicated customer experience"
        description="This app only serves the homeowner and property-manager journey, so there is no landscaper operational clutter in the nav."
      >
        <Text>Primary actions: book service, manage properties, track bookings, get help</Text>
      </InfoCard>
    </ScreenShell>
  );
}
