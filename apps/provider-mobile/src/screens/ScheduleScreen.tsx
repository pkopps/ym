import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function ScheduleScreen() {
  return (
    <ScreenShell
      eyebrow="Schedule"
      title="Manage calendars, route density, crew coverage, and job durations in one operational view."
      description="The provider app should help business owners keep crews on time, protect travel efficiency, and avoid double-booking."
    >
      <InfoCard
        title="Calendar sync"
        description="Connect Apple, Google, or Outlook so YardMatch only exposes truly open windows."
      />
      <InfoCard
        title="Duration-aware bookings"
        description="Larger properties reserve longer windows automatically because the quote engine feeds duration into scheduling."
      >
        <Text>Example: 52-minute lawn mow vs. 140-minute cleanup for a larger lot</Text>
      </InfoCard>
      <InfoCard
        title="ICS and back-office visibility"
        description="Share a provider ICS feed so office staff and external scheduling tools stay aligned with marketplace availability."
      />
      <InfoCard
        title="Crew assignment fit"
        description="Schedule the right number of workers onto larger properties so quoted duration and field capacity stay aligned."
      >
        <Text>Example: 1-person mow vs. 3-person cleanup and mulch install</Text>
      </InfoCard>
    </ScreenShell>
  );
}
