"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useState } from "react";
import {
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  getDefaultCustomerCustomDateString,
  PublicMarketplaceSearchShell,
  getCustomerTimingLabel
} from "./PublicMarketplaceSearchShell";
import { launchAreaLabel } from "../lib/site";

export function CustomerListingsHero({
  initialAreaLabel,
  initialService,
  initialTiming,
  initialAdditionalTimings,
  initialCustomDate,
  initialCustomEndDate,
  initialCustomWindow,
  initialCustomWindows,
  areaQuery,
  onAreaQueryChange,
  onSearch,
  onSelectedAdditionalTimingsChange,
  onSelectedCustomDateChange,
  onSelectedCustomEndDateChange,
  onSelectedCustomWindowChange,
  onSelectedCustomWindowsChange,
  onSelectedServiceChange,
  onSelectedSuggestionChange,
  onSelectedTimingChange,
  selectedCustomDate,
  selectedCustomEndDate,
  selectedCustomWindow,
  selectedCustomWindows,
  selectedService,
  selectedSuggestion,
  selectedTiming,
  selectedAdditionalTimings,
  metrics
}: {
  initialAreaLabel?: string;
  initialService?: ServiceCategory;
  initialTiming?: CustomerTimingPreference;
  initialAdditionalTimings?: CustomerTimingPreference[];
  initialCustomDate?: string;
  initialCustomEndDate?: string;
  initialCustomWindow?: CustomerCustomTimingWindow;
  initialCustomWindows?: CustomerCustomTimingWindow[];
  areaQuery?: string;
  onAreaQueryChange?: (value: string) => void;
  onSearch?: (
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined,
    timing: CustomerTimingPreference,
    customDate?: string,
    customWindow?: CustomerCustomTimingWindow
  ) => void;
  onSelectedCustomDateChange?: (value: string) => void;
  onSelectedCustomEndDateChange?: (value: string) => void;
  onSelectedCustomWindowChange?: (value: CustomerCustomTimingWindow) => void;
  onSelectedCustomWindowsChange?: (value: CustomerCustomTimingWindow[]) => void;
  onSelectedAdditionalTimingsChange?: (value: CustomerTimingPreference[]) => void;
  onSelectedServiceChange?: (value: ServiceCategory) => void;
  onSelectedSuggestionChange?: (value: PlaceSuggestion | undefined) => void;
  onSelectedTimingChange?: (value: CustomerTimingPreference) => void;
  selectedCustomDate?: string;
  selectedCustomEndDate?: string;
  selectedCustomWindow?: CustomerCustomTimingWindow;
  selectedCustomWindows?: CustomerCustomTimingWindow[];
  selectedAdditionalTimings?: CustomerTimingPreference[];
  selectedService?: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming?: CustomerTimingPreference;
  metrics?: Array<{ value: string; label: string }>;
}) {
  const [localAreaQuery, setLocalAreaQuery] = useState(initialAreaLabel ?? launchAreaLabel);
  const [localSelectedService, setLocalSelectedService] = useState<ServiceCategory>(initialService ?? "lawn-mowing");
  const [localSelectedSuggestion, setLocalSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [localSelectedTiming, setLocalSelectedTiming] = useState<CustomerTimingPreference>(
    initialTiming ?? "tomorrow-morning"
  );
  const [localSelectedCustomDate, setLocalSelectedCustomDate] = useState(
    initialCustomDate ?? getDefaultCustomerCustomDateString()
  );
  const [localSelectedCustomEndDate, setLocalSelectedCustomEndDate] = useState(initialCustomEndDate);
  const [localSelectedCustomWindow, setLocalSelectedCustomWindow] = useState<CustomerCustomTimingWindow>(
    initialCustomWindow ?? "morning"
  );
  const [localSelectedCustomWindows, setLocalSelectedCustomWindows] = useState<CustomerCustomTimingWindow[]>(
    initialCustomWindows?.length ? initialCustomWindows : [initialCustomWindow ?? "morning"]
  );
  const [localSelectedAdditionalTimings, setLocalSelectedAdditionalTimings] = useState<CustomerTimingPreference[]>(
    initialAdditionalTimings ?? []
  );

  const resolvedAreaQuery = areaQuery ?? localAreaQuery;
  const resolvedSelectedService = selectedService ?? localSelectedService;
  const resolvedSelectedSuggestion = selectedSuggestion ?? localSelectedSuggestion;
  const resolvedSelectedTiming = selectedTiming ?? localSelectedTiming;
  const resolvedSelectedCustomDate = selectedCustomDate ?? localSelectedCustomDate;
  const resolvedSelectedCustomEndDate = selectedCustomEndDate ?? localSelectedCustomEndDate;
  const resolvedSelectedCustomWindow = selectedCustomWindow ?? localSelectedCustomWindow;
  const resolvedSelectedCustomWindows = selectedCustomWindows ?? localSelectedCustomWindows;
  const resolvedSelectedAdditionalTimings = selectedAdditionalTimings ?? localSelectedAdditionalTimings;
  const serviceLabel = serviceCategoryLabels[resolvedSelectedService];
  const timingLabel = getCustomerTimingLabel(
    resolvedSelectedTiming,
    resolvedSelectedCustomDate,
    resolvedSelectedCustomWindow
  );
  const metricItems = metrics ?? [];
  const resolvedAreaLabel = resolvedSelectedSuggestion?.label ?? resolvedAreaQuery;

  return (
    <section className="page-hero page-hero--listings">
      <div className="page-hero__copy">
        <div className="listings-query">
          <div className="listings-query__title">
            <span>Current request</span>
            <h1>{serviceLabel}</h1>
          </div>
          <div className="listings-query__chips" aria-label="Current search">
            <span>{resolvedAreaLabel}</span>
            <span>{timingLabel}</span>
          </div>
        </div>
        {metricItems.length > 0 ? (
          <div className="page-hero__metrics">
            {metricItems.map((metric) => (
              <div className="page-hero__metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="page-hero__search-card" aria-label="Update current search">
        <PublicMarketplaceSearchShell
          areaQuery={resolvedAreaQuery}
          onAreaQueryChange={(value) => {
            setLocalAreaQuery(value);
            onAreaQueryChange?.(value);
          }}
          onSearch={onSearch}
          onSelectedAdditionalTimingsChange={(value) => {
            setLocalSelectedAdditionalTimings(value);
            onSelectedAdditionalTimingsChange?.(value);
          }}
          onSelectedCustomDateChange={(value) => {
            setLocalSelectedCustomDate(value);
            onSelectedCustomDateChange?.(value);
          }}
          onSelectedCustomEndDateChange={(value) => {
            setLocalSelectedCustomEndDate(value);
            onSelectedCustomEndDateChange?.(value);
          }}
          onSelectedCustomWindowChange={(value) => {
            setLocalSelectedCustomWindow(value);
            onSelectedCustomWindowChange?.(value);
          }}
          onSelectedCustomWindowsChange={(value) => {
            setLocalSelectedCustomWindows(value);
            onSelectedCustomWindowsChange?.(value);
          }}
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
          selectedAdditionalTimings={resolvedSelectedAdditionalTimings}
          selectedCustomDate={resolvedSelectedCustomDate}
          selectedCustomEndDate={resolvedSelectedCustomEndDate}
          selectedCustomWindow={resolvedSelectedCustomWindow}
          selectedCustomWindows={resolvedSelectedCustomWindows}
          selectedSuggestion={resolvedSelectedSuggestion}
          selectedTiming={resolvedSelectedTiming}
        />
      </div>
    </section>
  );
}
