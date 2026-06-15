"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { bookedBusinessShowcase, serviceCategoryLabels } from "@yardmatch/ui";
import { useState } from "react";
import {
  CustomerTimingPreference,
  PublicMarketplaceSearchShell,
  getCustomerTimingLabel
} from "./PublicMarketplaceSearchShell";

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
  initialTiming,
  areaQuery,
  onAreaQueryChange,
  onSearch,
  onSelectedServiceChange,
  onSelectedSuggestionChange,
  onSelectedTimingChange,
  selectedService,
  selectedSuggestion,
  selectedTiming,
  metrics,
  description
}: {
  initialAreaLabel?: string;
  initialService?: ServiceCategory;
  initialTiming?: CustomerTimingPreference;
  areaQuery?: string;
  onAreaQueryChange?: (value: string) => void;
  onSearch?: (
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined,
    timing: CustomerTimingPreference
  ) => void;
  onSelectedServiceChange?: (value: ServiceCategory) => void;
  onSelectedSuggestionChange?: (value: PlaceSuggestion | undefined) => void;
  onSelectedTimingChange?: (value: CustomerTimingPreference) => void;
  selectedService?: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming?: CustomerTimingPreference;
  metrics?: Array<{ value: string; label: string }>;
  description?: string;
}) {
  const [localAreaQuery, setLocalAreaQuery] = useState(initialAreaLabel ?? "Brooklyn, NY");
  const [localSelectedService, setLocalSelectedService] = useState<ServiceCategory>(initialService ?? "lawn-mowing");
  const [localSelectedSuggestion, setLocalSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [localSelectedTiming, setLocalSelectedTiming] = useState<CustomerTimingPreference>(
    initialTiming ?? "tomorrow-morning"
  );

  const resolvedAreaQuery = areaQuery ?? localAreaQuery;
  const resolvedSelectedService = selectedService ?? localSelectedService;
  const resolvedSelectedSuggestion = selectedSuggestion ?? localSelectedSuggestion;
  const resolvedSelectedTiming = selectedTiming ?? localSelectedTiming;
  const serviceLabel = serviceCategoryLabels[resolvedSelectedService];
  const timingLabel = getCustomerTimingLabel(resolvedSelectedTiming);
  const metricItems = metrics ?? [
    { value: String(bookedBusinessShowcase.length), label: "active providers shown" },
    { value: formatAverageRating(), label: "average rating" },
    { value: `${formatAverageDistance()} mi`, label: "average distance" }
  ];

  return (
    <section className="page-hero page-hero--listings">
      <div className="page-hero__copy">
        <span className="eyebrow">Recommended match</span>
        <h1>Start with the best local fit for {serviceLabel.toLowerCase()}.</h1>
        <p>
          {description ??
            `GreenRain will recommend the best local fit for ${timingLabel.toLowerCase()} first, then keep a short backup list ready if you want to compare.`}
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
        <span className="eyebrow">Update search</span>
        <h2>Change the job, timing, or area.</h2>
        <p>Keep the same recommendation-first flow with a new search.</p>
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
          onSelectedTimingChange={(value) => {
            setLocalSelectedTiming(value);
            onSelectedTimingChange?.(value);
          }}
          selectedService={resolvedSelectedService}
          selectedSuggestion={resolvedSelectedSuggestion}
          selectedTiming={resolvedSelectedTiming}
        />
      </div>
    </section>
  );
}
