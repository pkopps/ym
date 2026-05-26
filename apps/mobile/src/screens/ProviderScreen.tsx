import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function ProviderScreen() {
  return (
    <ScreenShell
      eyebrow="Provider flow"
      title="Manage route density, client calendars, and payouts on the go."
      description="Tablet layouts can show more operations data, while phones keep the main actions reachable in the field."
    >
      <InfoCard
        title="Calendar sync"
        description="Sync Apple, Google, or Outlook so YardMatch only offers truly open time windows."
      />
      <InfoCard
        title="Lead management"
        description="Review incoming requests by service type, distance from your base, and estimated payout."
      >
        <Text>Highest demand category: lawn mowing</Text>
      </InfoCard>
      <InfoCard
        title="Operational analytics"
        description="Shared event logging helps analyze conversion, no-show rate, refund rate, and provider utilization."
      />
      <InfoCard
        title="Review quality signals"
        description="Profiles track overall rating plus separate timeliness and attention-to-detail averages from customer reviews."
      >
        <Text>Example: 4.8 overall • 4.7 timeliness • 4.9 attention to detail</Text>
      </InfoCard>
    </ScreenShell>
  );
}
