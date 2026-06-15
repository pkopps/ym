import type { Metadata } from "next";
import { PublicCustomerListingsExperience } from "../../../components/PublicCustomerListingsExperience";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { ServiceCategory } from "@yardmatch/contracts";
import { CustomerTimingPreference } from "../../../components/PublicMarketplaceSearchShell";

export const metadata: Metadata = {
  title: "Recommended landscaping match",
  description:
    "Pick the job and timing, then review one recommended provider first with a short backup list if needed."
};

export default async function CustomerListingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const serviceValue =
    typeof resolvedSearchParams.service === "string" ? resolvedSearchParams.service : undefined;
  const areaLabel =
    typeof resolvedSearchParams.area === "string" ? resolvedSearchParams.area : undefined;
  const city = typeof resolvedSearchParams.city === "string" ? resolvedSearchParams.city : undefined;
  const state =
    typeof resolvedSearchParams.state === "string" ? resolvedSearchParams.state : undefined;
  const postalCode =
    typeof resolvedSearchParams.postalCode === "string"
      ? resolvedSearchParams.postalCode
      : undefined;
  const initialService =
    serviceValue && serviceValue in serviceCategoryLabels ? (serviceValue as ServiceCategory) : undefined;
  const initialTiming =
    typeof resolvedSearchParams.when === "string"
      ? (resolvedSearchParams.when as CustomerTimingPreference)
      : undefined;
  const lat =
    typeof resolvedSearchParams.lat === "string" ? Number.parseFloat(resolvedSearchParams.lat) : undefined;
  const lng =
    typeof resolvedSearchParams.lng === "string" ? Number.parseFloat(resolvedSearchParams.lng) : undefined;

  return (
    <main className="container container--wide stack-lg">
      <PublicCustomerListingsExperience
        initialAreaLabel={areaLabel}
        initialCity={city}
        initialLat={Number.isFinite(lat) ? lat : undefined}
        initialLng={Number.isFinite(lng) ? lng : undefined}
        initialPostalCode={postalCode}
        initialService={initialService}
        initialState={state}
        initialTiming={initialTiming}
      />
    </main>
  );
}
