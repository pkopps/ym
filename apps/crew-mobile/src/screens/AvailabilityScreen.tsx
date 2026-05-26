import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function AvailabilityScreen() {
  return (
    <ScreenShell
      eyebrow="Availability"
      title="Set your work preferences so landscaping businesses can staff jobs realistically."
      description="Availability should reflect when you can work, how far you can travel, and what kinds of service categories you are prepared to handle."
    >
      <InfoCard
        title="Preferred schedule"
        description="Support full-time, part-time, seasonal, and flexible work patterns from one profile."
      >
        <Text>Current preference: Flexible • Weekends available • Snow work enabled</Text>
      </InfoCard>
      <InfoCard
        title="Travel limits"
        description="Publish a realistic meeting radius so route planning and crew staffing stay efficient."
      >
        <Text>Example: Up to 20 miles from home base</Text>
      </InfoCard>
      <InfoCard
        title="Skill catalog"
        description="Match specialties like mowing, trimming, cleanup, and winter work to businesses that need those skills on a crew."
      />
    </ScreenShell>
  );
}
