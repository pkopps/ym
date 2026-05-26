import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function AssignmentsScreen() {
  return (
    <ScreenShell
      eyebrow="Assignments"
      title="See where to go, who to meet, and what work is expected for each shift."
      description="Assignments should remove ambiguity for crew members while keeping customer billing and business-owner workflows out of the way."
    >
      <InfoCard
        title="Route notes"
        description="Show the meeting point, destination property, access notes, and service type before the shift starts."
      >
        <Text>Example: Meet truck at 401 Main Yard • Gate code 1842 • Focus on rear hedge line</Text>
      </InfoCard>
      <InfoCard
        title="Crew-aware duration"
        description="Use the shared quote engine and booking duration estimates so workers know whether a stop is a quick mow or a multi-hour cleanup."
      >
        <Text>Example: 55-minute mow vs. 3-hour mulch and cleanup block</Text>
      </InfoCard>
      <InfoCard
        title="Check-in workflow"
        description="Capture arrival and completion status for internal operations while the provider business remains the customer-facing account."
      />
    </ScreenShell>
  );
}
