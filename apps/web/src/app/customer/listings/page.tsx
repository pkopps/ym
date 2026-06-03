import type { Metadata } from "next";
import { BookedBusinessResults } from "../../../components/BookedBusinessResults";
import { serviceCategoryLabels } from "@yardmatch/ui";

export const metadata: Metadata = {
  title: "Listings and map",
  description:
    "Browse a wider YardMatch results layout with dense provider information and an expandable map."
};

export default function CustomerListingsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const serviceValue = typeof searchParams?.service === "string" ? searchParams.service : undefined;
  const areaLabel = typeof searchParams?.area === "string" ? searchParams.area : undefined;
  const serviceLabel =
    serviceValue && serviceValue in serviceCategoryLabels
      ? serviceCategoryLabels[serviceValue as keyof typeof serviceCategoryLabels]
      : undefined;

  return (
    <main className="container container--wide stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Listings</span>
        <h1>
          {serviceLabel ? `Browse ${serviceLabel.toLowerCase()} providers` : "Browse providers with a full map view."}
        </h1>
        <p>{areaLabel ? `Showing matches near ${areaLabel}.` : "See more at once."}</p>
      </section>

      <BookedBusinessResults
        allowMapToggle
        serviceLabel={serviceLabel}
        searchAreaLabel={areaLabel}
      />
    </main>
  );
}
