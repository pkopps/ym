import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function DashboardScreen() {
  return (
    <ScreenShell
      eyebrow="Crew member app"
      title="A focused field app for assignments, availability, and day-of-job clarity."
      description="Crew members get only the tools they need to show up prepared, stay coordinated, and track work completed."
    >
      <InfoCard
        title="Today at a glance"
        description="Surface the next meeting point, assigned crew lead, route notes, and expected shift length as the first screen."
      >
        <Text>Example: Meet at 7:15 AM • 3 assigned properties • 1 winter salting stop added</Text>
      </InfoCard>
      <InfoCard
        title="Work history"
        description="Keep completed-job history and dependability signals visible without mixing in customer billing or owner-side controls."
      >
        <Text>Example: 42 completed jobs • 98% on-time check-in rate</Text>
      </InfoCard>
      <InfoCard
        title="Support path"
        description="Escalate assignment confusion, unsafe conditions, or account issues from the same role-specific app."
      />
    </ScreenShell>
  );
}
