import { Text, View } from "react-native";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function CustomerScreen() {
  return (
    <ScreenShell
      eyebrow="Customer flow"
      title="Search by address, compare nearby pros, and book a slot."
      description="The customer experience is designed for quick booking with strong loading states around search, payment, and support."
    >
      <InfoCard
        title="Geolocation intake"
        description="Capture property address, geocode it, and use distance-aware provider ranking."
      >
        <Text>Suggested address: 220 Willow St, Nashville, TN 37206</Text>
      </InfoCard>
      <InfoCard
        title="Instant quote engine"
        description="Address first, automated yard estimate second, and only a couple of follow-up questions if confidence is low."
      >
        <Text>Example: $68 estimate, 52 minutes, high confidence</Text>
      </InfoCard>
      <InfoCard
        title="Multiple saved properties"
        description="Customers can keep several homes or managed properties on file and choose one as the default booking address."
      >
        <Text>Examples: Primary home, rental property, parents' house</Text>
      </InfoCard>
      <InfoCard
        title="Service selection"
        description={`Popular options: ${Object.values(serviceCategoryLabels).slice(0, 4).join(", ")}.`}
      />
      <InfoCard
        title="Wrong address after booking"
        description="Requested bookings can be updated immediately. Confirmed bookings usually require provider review, and near-term jobs are routed to support."
      >
        <Text>Blocked if outside provider radius or too close to service time</Text>
      </InfoCard>
      <InfoCard
        title="Payment protection"
        description="Authorize payment at booking and make refunds available from the booking record when quality issues arise."
      >
        <View>
          <Text>Refund review window: 48 hours after completion</Text>
        </View>
      </InfoCard>
      <InfoCard
        title="Post-service reviews"
        description="Reviews unlock only after a completed booking and a delayed booking-specific invite, not from a generic provider profile."
      >
        <Text>Default cadence: send review email and in-app prompt 48 hours after completion</Text>
      </InfoCard>
    </ScreenShell>
  );
}
