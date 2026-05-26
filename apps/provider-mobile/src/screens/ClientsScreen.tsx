import { Text } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function ClientsScreen() {
  return (
    <ScreenShell
      eyebrow="Clients"
      title="See lead quality, active jobs, client notes, staffing needs, and payout context without switching apps."
      description="This screen focuses the business-owner experience on operational follow-through rather than customer discovery."
    >
      <InfoCard
        title="Lead management"
        description="Review requests by service type, neighborhood, estimated payout, and route fit before accepting more work."
      >
        <Text>Highest demand category: lawn mowing</Text>
      </InfoCard>
      <InfoCard
        title="Crew hiring pipeline"
        description="Compare available crew members by skills, travel radius, and preferred schedule when demand rises."
      >
        <Text>Need next: 2 part-time workers for spring cleanups</Text>
      </InfoCard>
      <InfoCard
        title="Address-change review"
        description="If a confirmed customer booking changes location more than 24 hours out, the provider can review route impact before accepting."
      />
      <InfoCard
        title="Review follow-through"
        description="Customer reviews should only land after completed service, so business owners can evaluate feedback in the right operational context."
      >
        <Text>Monitor which completed jobs are generating 5-star feedback vs. coaching opportunities.</Text>
      </InfoCard>
      <InfoCard
        title="Payout and dispute context"
        description="Keep payment authorization, completion state, refund exposure, and support escalation connected to each job."
      />
    </ScreenShell>
  );
}
