import type { Metadata } from "next";
import { PublicCustomerListingsExperience } from "../../../components/PublicCustomerListingsExperience";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { ServiceCategory } from "@yardmatch/contracts";

export const metadata: Metadata = {
  title: "Find landscaping providers",
  description:
    "Compare verified landscaping providers, review live route availability, and explore booked calendar context in one search experience."
};

export default function CustomerListingsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const serviceValue = typeof searchParams?.service === "string" ? searchParams.service : undefined;
  const areaLabel = typeof searchParams?.area === "string" ? searchParams.area : undefined;
  const city = typeof searchParams?.city === "string" ? searchParams.city : undefined;
  const state = typeof searchParams?.state === "string" ? searchParams.state : undefined;
  const postalCode = typeof searchParams?.postalCode === "string" ? searchParams.postalCode : undefined;
  const serviceLabel =
    serviceValue && serviceValue in serviceCategoryLabels
      ? serviceCategoryLabels[serviceValue as keyof typeof serviceCategoryLabels]
      : undefined;
  const initialService =
    serviceValue && serviceValue in serviceCategoryLabels ? (serviceValue as ServiceCategory) : undefined;
  const lat = typeof searchParams?.lat === "string" ? Number.parseFloat(searchParams.lat) : undefined;
  const lng = typeof searchParams?.lng === "string" ? Number.parseFloat(searchParams.lng) : undefined;

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
      />
    </main>
  );
}
