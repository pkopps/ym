"use client";

import {
  isPlaceSuggestionSafeToAutoSelect,
  PlaceSuggestion,
  ServiceCategory
} from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient } from "../lib/api";

export function buildCustomerListingsSearchParams({
  areaQuery,
  selectedService,
  selectedSuggestion,
  selectedTiming,
  selectedCustomDate,
  selectedCustomEndDate,
  selectedCustomWindow,
  selectedCustomWindows,
  selectedAdditionalTimings
}: {
  areaQuery: string;
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming?: CustomerTimingPreference;
  selectedCustomDate?: string;
  selectedCustomEndDate?: string;
  selectedCustomWindow?: CustomerCustomTimingWindow;
  selectedCustomWindows?: CustomerCustomTimingWindow[];
  selectedAdditionalTimings?: CustomerTimingPreference[];
}) {
  const params = new URLSearchParams({
    service: selectedService,
    area: selectedSuggestion?.label ?? areaQuery.trim()
  });

  if (selectedTiming) {
    params.set("when", selectedTiming);
  }

  if ((selectedTiming === "custom-date" || selectedTiming === "custom-range") && selectedCustomDate) {
    params.set("date", selectedCustomDate);
    params.set("start", selectedCustomDate);
    params.set("end", selectedCustomEndDate ?? selectedCustomDate);
    params.set("window", selectedCustomWindow ?? selectedCustomWindows?.[0] ?? "morning");
    params.set("windows", (selectedCustomWindows?.length ? selectedCustomWindows : [selectedCustomWindow ?? "morning"]).join(","));
  } else if (selectedAdditionalTimings?.length) {
    params.set("also", selectedAdditionalTimings.join(","));
  }

  if (selectedSuggestion) {
    params.set("city", selectedSuggestion.address.city);
    params.set("state", selectedSuggestion.address.state);
    params.set("postalCode", selectedSuggestion.address.postalCode);
    params.set("lat", String(selectedSuggestion.address.point.latitude));
    params.set("lng", String(selectedSuggestion.address.point.longitude));
  }

  return params;
}

export type CustomerTimingPreference =
  | "tomorrow-morning"
  | "tomorrow-afternoon"
  | "tomorrow-evening"
  | "day-after-morning"
  | "day-after-afternoon"
  | "custom-date"
  | "custom-range";

export type CustomerCustomTimingWindow = "morning" | "afternoon" | "evening";

export type CustomerQuickServiceChip = {
  label: string;
  service: ServiceCategory;
  imageSrc?: string;
  description?: string;
};

export const customerTimingOptions: Array<{ value: CustomerTimingPreference; label: string }> = [
  { value: "tomorrow-morning", label: "Tomorrow morning" },
  { value: "tomorrow-afternoon", label: "Tomorrow afternoon" },
  { value: "tomorrow-evening", label: "Tomorrow evening" },
  { value: "day-after-morning", label: "Day after morning" },
  { value: "day-after-afternoon", label: "Day after afternoon" }
];

const customerSearchTimingOptions: Array<{ value: CustomerTimingPreference; label: string }> = [
  ...customerTimingOptions,
  { value: "custom-range", label: "Choose dates" }
];

export const customerCustomTimingWindowOptions: Array<{
  value: CustomerCustomTimingWindow;
  label: string;
}> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" }
];

const customerServicePickerLabels: Record<ServiceCategory, string> = {
  "lawn-mowing": "Lawn mowing",
  "hedge-trimming": "Hedges",
  "mulch-installation": "Mulch",
  "seasonal-cleanup": "Cleanup",
  "weed-control": "Weeds",
  "irrigation-check": "Irrigation",
  "leaf-blowing": "Leaf blowing",
  "aeration": "Aeration",
  "fertilization": "Fertilization",
  "gutter-cleaning": "Gutter clean",
  "snow-shoveling": "Snow shoveling",
  "ice-melt-salting": "Ice melt",
  "snow-blowing": "Snow blowing"
};

export function getDefaultCustomerCustomDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return formatDateInputValue(date);
}

export function getDefaultCustomerCustomEndDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  return formatDateInputValue(date);
}

export function getMinimumCustomerCustomDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateInputValue(date);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCustomTimingDate(customDate?: string) {
  const [year, month, day] = (customDate ?? getDefaultCustomerCustomDateString())
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

export function getCustomerTimingLabel(
  timing: CustomerTimingPreference,
  customDate?: string,
  customWindow: CustomerCustomTimingWindow = "morning"
) {
  if (timing === "custom-date" || timing === "custom-range") {
    const date = buildCustomTimingDate(customDate);
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(date);
    return `${dateLabel} ${customWindow}`;
  }

  return (
    customerTimingOptions.find((option) => option.value === timing)?.label ?? "Tomorrow morning"
  );
}

export function buildDateIsoForCustomerTiming(
  timing: CustomerTimingPreference,
  customDate?: string,
  customWindow: CustomerCustomTimingWindow = "morning"
) {
  const isCustomTiming = timing === "custom-date" || timing === "custom-range";
  const date = isCustomTiming ? buildCustomTimingDate(customDate) : new Date();
  const isDayAfter = !isCustomTiming && timing.startsWith("day-after");
  const windowPart =
    isCustomTiming
      ? customWindow
      : timing.endsWith("morning")
        ? "morning"
        : timing.endsWith("afternoon")
          ? "afternoon"
          : "evening";

  if (!isCustomTiming) {
    date.setDate(date.getDate() + (isDayAfter ? 2 : 1));
  }

  if (windowPart === "morning") {
    date.setHours(9, 0, 0, 0);
  } else if (windowPart === "afternoon") {
    date.setHours(14, 0, 0, 0);
  } else {
    date.setHours(18, 0, 0, 0);
  }

  return date.toISOString();
}

export function PublicMarketplaceSearchShell({
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
  selectedAdditionalTimings,
  selectedCustomDate,
  selectedCustomEndDate,
  selectedCustomWindow,
  selectedCustomWindows,
  selectedService,
  selectedSuggestion,
  selectedTiming
}: {
  areaQuery: string;
  onAreaQueryChange: (value: string) => void;
  onSearch?: (
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined,
    timing: CustomerTimingPreference,
    customDate?: string,
    customWindow?: CustomerCustomTimingWindow
  ) => void;
  onSelectedAdditionalTimingsChange?: (value: CustomerTimingPreference[]) => void;
  onSelectedCustomDateChange?: (value: string) => void;
  onSelectedCustomEndDateChange?: (value: string) => void;
  onSelectedCustomWindowChange?: (value: CustomerCustomTimingWindow) => void;
  onSelectedCustomWindowsChange?: (value: CustomerCustomTimingWindow[]) => void;
  onSelectedServiceChange: (value: ServiceCategory) => void;
  onSelectedSuggestionChange: (value: PlaceSuggestion | undefined) => void;
  onSelectedTimingChange: (value: CustomerTimingPreference) => void;
  selectedAdditionalTimings?: CustomerTimingPreference[];
  selectedCustomDate?: string;
  selectedCustomEndDate?: string;
  selectedCustomWindow?: CustomerCustomTimingWindow;
  selectedCustomWindows?: CustomerCustomTimingWindow[];
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming: CustomerTimingPreference;
}) {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const searchFieldRef = useRef<HTMLLabelElement | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | undefined>();
  const [submitGuidance, setSubmitGuidance] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [hasFinishedSearch, setHasFinishedSearch] = useState(false);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(false);
  const [locationGuidance, setLocationGuidance] = useState<string | undefined>();
  const resolvedCustomDate = selectedCustomDate ?? getDefaultCustomerCustomDateString();
  const resolvedCustomEndDate = selectedCustomEndDate ?? getDefaultCustomerCustomEndDateString();
  const resolvedCustomWindows = selectedCustomWindows?.length
    ? selectedCustomWindows
    : [selectedCustomWindow ?? "morning"];
  const resolvedCustomWindow = resolvedCustomWindows[0] ?? "morning";
  const additionalTimings = selectedAdditionalTimings ?? [];
  const isCustomRange = selectedTiming === "custom-date" || selectedTiming === "custom-range";

  function toggleAdditionalTiming(value: CustomerTimingPreference) {
    const nextTimings = additionalTimings.includes(value)
      ? additionalTimings.filter((timing) => timing !== value)
      : [...additionalTimings, value];
    onSelectedAdditionalTimingsChange?.(nextTimings);
  }

  function toggleCustomWindow(value: CustomerCustomTimingWindow) {
    const nextWindows = resolvedCustomWindows.includes(value)
      ? resolvedCustomWindows.filter((window) => window !== value)
      : [...resolvedCustomWindows, value];
    onSelectedCustomWindowsChange?.(nextWindows.length ? nextWindows : [value]);
  }

  async function handleUseCurrentLocation() {
    setSubmitGuidance(undefined);
    setLocationGuidance(undefined);

    if (!navigator.geolocation) {
      setLocationGuidance("This browser does not support location lookup. Try typing your city, ZIP, or address.");
      return;
    }

    setIsResolvingLocation(true);
    setIsSuggestionMenuOpen(false);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 5 * 60 * 1000,
          timeout: 10000
        });
      });
      const response = await api.reverseGeocodePlace({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      const autoSelectedSuggestion = response.suggestions.find((suggestion) =>
        isPlaceSuggestionSafeToAutoSelect(suggestion)
      );

      setSearchMessage(response.searchMessage);
      setHasFinishedSearch(true);

      if (autoSelectedSuggestion) {
        onAreaQueryChange(autoSelectedSuggestion.label);
        onSelectedSuggestionChange(autoSelectedSuggestion);
        setSuggestions([]);
        setLocationGuidance(`Using ${autoSelectedSuggestion.label}.`);
        return;
      }

      setSuggestions(response.suggestions);
      setIsSuggestionMenuOpen(response.suggestions.length > 0);
      setLocationGuidance(
        response.suggestions.length > 0
          ? "Choose the closest suggested service area so GreenRain does not guess."
          : response.searchMessage ?? "We could not resolve this location. Try typing your city, ZIP, or address."
      );
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? Number(error.code) : undefined;
      setLocationGuidance(
        code === 1
          ? "Location permission was blocked. You can allow it in the browser or type your city, ZIP, or address."
          : "We could not get your browser location. Try typing your city, ZIP, or address."
      );
    } finally {
      setIsResolvingLocation(false);
    }
  }

  useEffect(() => {
    if (areaQuery.trim().length < 2) {
      setSuggestions([]);
      setSearchMessage(undefined);
      setHasFinishedSearch(false);
      return;
    }

    if (selectedSuggestion && areaQuery.trim() === selectedSuggestion.label) {
      setSuggestions([]);
      setSearchMessage(undefined);
      setHasFinishedSearch(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      api
        .searchPlaces(areaQuery)
        .then((response) => {
          setSuggestions(response.suggestions);
          setSearchMessage(response.searchMessage);
          if (selectedSuggestion && !response.suggestions.some((item) => item.id === selectedSuggestion.id)) {
            onSelectedSuggestionChange(undefined);
          }
        })
        .catch(() => {
          setSuggestions([]);
          setSearchMessage(undefined);
        })
        .finally(() => {
          setHasFinishedSearch(true);
          setIsSearching(false);
        });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [api, areaQuery, onSelectedSuggestionChange, selectedSuggestion]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchFieldRef.current?.contains(event.target as Node)) {
        setIsSuggestionMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSubmit(serviceOverride?: ServiceCategory) {
    const suggestion = selectedSuggestion ?? suggestions.find((item) => isPlaceSuggestionSafeToAutoSelect(item));
    const service = serviceOverride ?? selectedService;

    if (!selectedSuggestion && suggestions.length > 0 && !suggestion) {
      setSubmitGuidance(
        "Choose one of the suggested areas before searching so GreenRain does not guess the wrong location."
      );
      setIsSuggestionMenuOpen(true);
      return;
    }

    setSubmitGuidance(undefined);
    setIsSuggestionMenuOpen(false);
    if (onSearch) {
      onSearch(service, suggestion, selectedTiming, resolvedCustomDate, resolvedCustomWindow);
      return;
    }

    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion,
      selectedTiming,
      selectedCustomDate: resolvedCustomDate,
      selectedCustomEndDate: resolvedCustomEndDate,
      selectedCustomWindow: resolvedCustomWindow,
      selectedCustomWindows: resolvedCustomWindows,
      selectedAdditionalTimings: additionalTimings
    });
    router.push(`/customer/listings?${params.toString()}`);
  }

  return (
    <div className="customer-search-shell">
      <div className="customer-search-shell__grid">
        <label className="customer-search-shell__field">
          <span>Need</span>
          <select
            onChange={(event) => onSelectedServiceChange(event.target.value as ServiceCategory)}
            value={selectedService}
          >
            {Object.entries(serviceCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {customerServicePickerLabels[value as ServiceCategory] ?? label}
              </option>
            ))}
          </select>
        </label>
        <label className="customer-search-shell__field">
          <span>When</span>
          <select
            onChange={(event) => {
              const nextTiming = event.target.value as CustomerTimingPreference;
              onSelectedTimingChange(nextTiming);
              if (nextTiming === "custom-range" && !selectedCustomDate) {
                onSelectedCustomDateChange?.(resolvedCustomDate);
              }
            }}
            value={selectedTiming}
          >
            {customerSearchTimingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="customer-search-shell__field customer-search-shell__field--search" ref={searchFieldRef}>
          <span>Where</span>
          <input
            onChange={(event) => {
              onAreaQueryChange(event.target.value);
              onSelectedSuggestionChange(undefined);
              setSubmitGuidance(undefined);
              setLocationGuidance(undefined);
              setIsSuggestionMenuOpen(true);
            }}
            onFocus={() => setIsSuggestionMenuOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              } else if (event.key === "Escape") {
                setIsSuggestionMenuOpen(false);
              }
            }}
            placeholder="City, ZIP, or address"
            value={areaQuery}
          />
          <button
            className="customer-search-shell__location-action"
            disabled={isResolvingLocation}
            onClick={handleUseCurrentLocation}
            type="button"
          >
            {isResolvingLocation ? "Finding your area..." : "Use my location"}
          </button>
          {isSuggestionMenuOpen && suggestions.length > 0 ? (
            <div className="customer-search-shell__suggestions">
              {suggestions.map((suggestion) => {
                const isActive = selectedSuggestion?.id === suggestion.id;
                return (
                  <button
                    className={`customer-search-shell__suggestion${isActive ? " customer-search-shell__suggestion--active" : ""}`}
                    key={suggestion.id}
                    onClick={() => {
                      onAreaQueryChange(suggestion.label);
                      onSelectedSuggestionChange(suggestion);
                      setSubmitGuidance(undefined);
                      setLocationGuidance(undefined);
                      setIsSuggestionMenuOpen(false);
                      setSuggestions([]);
                    }}
                    type="button"
                  >
                    <strong>{suggestion.label}</strong>
                    <span>
                      {suggestion.source === "google-geocoding"
                        ? suggestion.matchReason ?? "Google-verified area"
                        : suggestion.matchReason ?? "Suggested area"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : isSuggestionMenuOpen && areaQuery.trim().length >= 3 && hasFinishedSearch ? (
            <div className="customer-search-shell__suggestions">
              <div className="customer-search-shell__suggestion customer-search-shell__suggestion--static">
                <strong>No suggested area yet.</strong>
                <span>{searchMessage ?? "Try a nearby city, ZIP, or fuller address."}</span>
              </div>
            </div>
          ) : isSuggestionMenuOpen && areaQuery.trim().length >= 2 && isSearching ? (
            <div className="customer-search-shell__suggestions">
              <div className="customer-search-shell__suggestion customer-search-shell__suggestion--static">
                <strong>Searching areas…</strong>
              </div>
            </div>
          ) : null}
        </label>
        <button className="button customer-search-shell__action" onClick={() => handleSubmit()} type="button">
          {isSearching ? "Checking area..." : "Find my match"}
        </button>
      </div>
      {!isCustomRange ? (
        <div className="customer-search-shell__backup-windows" aria-label="Backup times">
          <span>Also works</span>
          <div className="customer-search-shell__backup-options">
            {customerTimingOptions
              .filter((option) => option.value !== selectedTiming)
              .map((option) => {
                const isSelected = additionalTimings.includes(option.value);
                return (
                  <button
                    className={`customer-search-shell__choice${isSelected ? " customer-search-shell__choice--active" : ""}`}
                    key={option.value}
                    onClick={() => toggleAdditionalTiming(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
      {isCustomRange ? (
        <div className="customer-search-shell__custom-date">
          <label className="customer-search-shell__field">
            <span>Start</span>
            <input
              min={getMinimumCustomerCustomDateString()}
              onChange={(event) => {
                const nextDate = event.target.value;
                onSelectedCustomDateChange?.(nextDate);
                if (resolvedCustomEndDate < nextDate) {
                  onSelectedCustomEndDateChange?.(nextDate);
                }
              }}
              type="date"
              value={resolvedCustomDate}
            />
          </label>
          <label className="customer-search-shell__field">
            <span>End</span>
            <input
              min={resolvedCustomDate}
              onChange={(event) => onSelectedCustomEndDateChange?.(event.target.value)}
              type="date"
              value={resolvedCustomEndDate}
            />
          </label>
          <div className="customer-search-shell__window-picks">
            <span>Preferred windows</span>
            <div className="customer-search-shell__backup-options">
              {customerCustomTimingWindowOptions.map((option) => (
                <button
                  className={`customer-search-shell__choice${
                    resolvedCustomWindows.includes(option.value) ? " customer-search-shell__choice--active" : ""
                  }`}
                  key={option.value}
                  onClick={() => {
                    onSelectedCustomWindowChange?.(option.value);
                    toggleCustomWindow(option.value);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {submitGuidance ? <p className="customer-search-shell__guidance">{submitGuidance}</p> : null}
      {locationGuidance ? <p className="customer-search-shell__guidance">{locationGuidance}</p> : null}
    </div>
  );
}
