import { Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { ServiceRadiusSettingsCard } from "../components/ServiceRadiusSettingsCard";

export function DashboardScreen() {
  return (
    <ScreenShell
      eyebrow="Provider business app"
      title="A dedicated operating app for schedules, crews, routes, clients, and payouts."
      description="Business owners get a focused operational workspace without customer-booking clutter in the same mobile shell."
    >
      <InfoCard
        title="Today at a glance"
        description="Surface open slots, booked jobs, route density, crew coverage, and payout expectations as the first screen."
      >
        <Text>Example: 6 jobs today • 2 route gaps to tighten • 1 open crew slot • 3 reviews waiting</Text>
      </InfoCard>
      <ServiceRadiusSettingsCard />
      <InfoCard
        title="Review reputation signals"
        description="Profiles track overall rating plus separate timeliness and attention-to-detail averages from real completed jobs."
      >
        <Text>Example: 4.8 overall • 4.7 timeliness • 4.9 attention to detail</Text>
      </InfoCard>
      <InfoCard
        title="Recent post-service reviews"
        description="Business owners can review customer feedback from completed jobs and spot coaching opportunities quickly."
      >
        <ReviewSnippet
          author="Jordan R."
          overall={5}
          timeliness={5}
          detail={4}
          text="Crew showed up on time, handled edging carefully, and left the walkways clean."
        />
        <ReviewSnippet
          author="Priya N."
          overall={4}
          timeliness={4}
          detail={5}
          text="Excellent attention to detail in the beds. Arrival was slightly later than expected but communication was clear."
        />
      </InfoCard>
      <InfoCard
        title="Crew coordination"
        description="Recruit, assign, and monitor crew members from the same app that manages customer-facing bookings."
      >
        <Text>Example: 2 recurring crew members assigned • 1 seasonal worker available nearby</Text>
      </InfoCard>
    </ScreenShell>
  );
}

function ReviewSnippet({
  author,
  overall,
  timeliness,
  detail,
  text
}: {
  author: string;
  overall: number;
  timeliness: number;
  detail: number;
  text: string;
}) {
  return (
    <Text style={{ color: BrandTokens.colors.inkSoft, lineHeight: 22 }}>
      <Text style={{ color: BrandTokens.colors.ink, fontWeight: "700" }}>{author}</Text>
      {"  "}
      <MaterialIcons color={BrandTokens.colors.accent} name="star" size={16} />
      <Text>{overall}/5 overall • {timeliness}/5 timeliness • {detail}/5 detail{"\n"}</Text>
      <Text>{text}</Text>
    </Text>
  );
}
