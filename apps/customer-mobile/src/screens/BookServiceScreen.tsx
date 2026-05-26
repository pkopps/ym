import { Text, View } from "react-native";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function BookServiceScreen() {
  return (
    <ScreenShell
      eyebrow="Book service"
      title="Search by address, compare nearby pros, and reserve the right time window."
      description="The booking flow is built around low-friction address capture, instant quoting, and payment protection."
    >
      <InfoCard
        title="Address-first intake"
        description="Capture the property address, geocode it, and rank providers by proximity, availability, and category fit."
      >
        <Text>Suggested address: 220 Willow St, Nashville, TN 37206</Text>
      </InfoCard>
      <InfoCard
        title="Instant quote engine"
        description="Estimate turf, shrub, driveway, and sidewalk work automatically before asking any clarifying questions."
      >
        <Text>Example: $68 estimate • 52 minutes • high confidence</Text>
      </InfoCard>
      <InfoCard
        title="Property-aware booking"
        description="Customers can save multiple homes and choose the right address at checkout without rewriting old bookings."
      >
        <Text>Examples: Primary home, rental property, parents' house</Text>
      </InfoCard>
      <InfoCard
        title="Service catalog"
        description={`Popular options: ${Object.values(serviceCategoryLabels).slice(0, 6).join(", ")}.`}
      />
      <InfoCard
        title="Payment protection"
        description="Authorize payment at booking and let support review refunds and service quality issues against the booking record."
      >
        <View>
          <Text>Refund review window: 48 hours after completion</Text>
        </View>
      </InfoCard>
    </ScreenShell>
  );
}
