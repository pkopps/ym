"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { bookedBusinessShowcase, serviceCategoryLabels } from "@yardmatch/ui";
import { useState } from "react";
import { PublicMarketplaceSearchShell } from "./PublicMarketplaceSearchShell";

function formatAverageRating() {
  const average =
    bookedBusinessShowcase.reduce((sum, business) => sum + Number(business.rating), 0) /
    bookedBusinessShowcase.length;
  return average.toFixed(1);
}

function formatAverageDistance() {
  const average =
    bookedBusinessShowcase.reduce((sum, business) => sum + business.distanceMiles, 0) /
    bookedBusinessShowcase.length;
  return average.toFixed(1);
}

export function CustomerListingsHero({
  initialAreaLabel,
  initialService,
  areaQuery,
  onAreaQueryChange,
  onSearch,
  onSelectedServiceChange,
  onSelectedSuggestionChange,
  selectedService,
  selectedSuggestion,
  metrics,
  description
}: {
  initialAreaLabel?: string;
  initialService?: ServiceCategory;
  areaQuery?: string;
  onAreaQueryChange?: (value: string) => void;
  onSearch?: (service: ServiceCategory, suggestion?: PlaceSuggestion) => void;
  onSelectedServiceChange?: (value: ServiceCategory) => void;
  onSelectedSuggestionChange?: (value: PlaceSuggestion | undefined) => void;
  selectedService?: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  metrics?: Array<{ value: string; label: string }>;
  description?: string;
}) {
  const [localAreaQuery, setLocalAreaQuery] = useState(initialAreaLabel ?? "Brooklyn, NY");
  const [localSelectedService, setLocalSelectedService] = useState<ServiceCategory>(initialService ?? "lawn-mowing");
  const [localSelectedSuggestion, setLocalSelectedSuggestion] = useState<PlaceSuggestion | undefined>();

  const resolvedAreaQuery = areaQuery ?? localAreaQuery;
  const resolvedSelectedService = selectedService ?? localSelectedService;
  const resolvedSelectedSuggestion = selectedSuggestion ?? localSelectedSuggestion;
  const serviceLabel = serviceCategoryLabels[resolvedSelectedService];
  const metricItems = metrics ?? [
    { value: String(bookedBusinessShowcase.length), label: "busy providers shown" },
    { value: formatAverageRating(), label: "average rating" },
    { value: `${formatAverageDistance()} mi`, label: "average distance" }
  ];

  return (
    <section className="page-hero page-hero--listings">
      <div className="page-hero__copy">
        <span className="eyebrow">Listings</span>
        <h1>{serviceLabel} businesses with real local demand.</h1>
        <p>
          {description ??
            "Refine the service and area, compare highly rated landscaping businesses, and get a cleaner sense of who is already running packed routes nearby."}
        </p>
        <div className="page-hero__metrics">
          {metricItems.map((metric) => (
            <div className="page-hero__metric" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="page-hero__search-card">
        <span className="eyebrow">Refine search</span>
        <h2>Update the service or area.</h2>
        <p>The search panel routes directly into the current listings view.</p>
        <PublicMarketplaceSearchShell
          areaQuery={resolvedAreaQuery}
          onAreaQueryChange={(value) => {
            setLocalAreaQuery(value);
            onAreaQueryChange?.(value);
          }}
          onSearch={onSearch}
          onSelectedServiceChange={(value) => {
            setLocalSelectedService(value);
            onSelectedServiceChange?.(value);
          }}
          onSelectedSuggestionChange={(value) => {
            setLocalSelectedSuggestion(value);
            onSelectedSuggestionChange?.(value);
          }}
          selectedService={resolvedSelectedService}
          selectedSuggestion={resolvedSelectedSuggestion}
        />
      </div>
    </section>
  );
}
