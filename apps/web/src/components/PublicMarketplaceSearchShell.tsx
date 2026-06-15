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
  selectedTiming
}: {
  areaQuery: string;
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming?: CustomerTimingPreference;
}) {
  const params = new URLSearchParams({
    service: selectedService,
    area: selectedSuggestion?.label ?? areaQuery.trim()
  });

  if (selectedTiming) {
    params.set("when", selectedTiming);
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
  | "day-after-afternoon";

export const customerTimingOptions: Array<{ value: CustomerTimingPreference; label: string }> = [
  { value: "tomorrow-morning", label: "Tomorrow morning" },
  { value: "tomorrow-afternoon", label: "Tomorrow afternoon" },
  { value: "tomorrow-evening", label: "Tomorrow evening" },
  { value: "day-after-morning", label: "Day after morning" },
  { value: "day-after-afternoon", label: "Day after afternoon" }
];

export function getCustomerTimingLabel(timing: CustomerTimingPreference) {
  return (
    customerTimingOptions.find((option) => option.value === timing)?.label ?? "Tomorrow morning"
  );
}

export function buildDateIsoForCustomerTiming(timing: CustomerTimingPreference) {
  const date = new Date();
  const isDayAfter = timing.startsWith("day-after");
  const windowPart = timing.endsWith("morning")
    ? "morning"
    : timing.endsWith("afternoon")
      ? "afternoon"
      : "evening";
  date.setDate(date.getDate() + (isDayAfter ? 2 : 1));

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
  onSelectedServiceChange,
  onSelectedSuggestionChange,
  onSelectedTimingChange,
  selectedService,
  selectedSuggestion,
  selectedTiming
}: {
  areaQuery: string;
  onAreaQueryChange: (value: string) => void;
  onSearch?: (
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined,
    timing: CustomerTimingPreference
  ) => void;
  onSelectedServiceChange: (value: ServiceCategory) => void;
  onSelectedSuggestionChange: (value: PlaceSuggestion | undefined) => void;
  onSelectedTimingChange: (value: CustomerTimingPreference) => void;
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
  const [hasFinishedSearch, setHasFinishedSearch] = useState(false);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(false);

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
      onSearch(service, suggestion, selectedTiming);
      return;
    }

    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion,
      selectedTiming
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
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="customer-search-shell__field">
          <span>When</span>
          <select
            onChange={(event) => onSelectedTimingChange(event.target.value as CustomerTimingPreference)}
            value={selectedTiming}
          >
            {customerTimingOptions.map((option) => (
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
      {submitGuidance ? <p className="customer-search-shell__guidance">{submitGuidance}</p> : null}
    </div>
  );
}
