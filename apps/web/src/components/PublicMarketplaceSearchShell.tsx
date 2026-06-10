"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient } from "../lib/api";

export function buildCustomerListingsSearchParams({
  areaQuery,
  selectedService,
  selectedSuggestion
}: {
  areaQuery: string;
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
}) {
  const params = new URLSearchParams({
    service: selectedService,
    area: selectedSuggestion?.label ?? areaQuery.trim()
  });

  if (selectedSuggestion) {
    params.set("city", selectedSuggestion.address.city);
    params.set("state", selectedSuggestion.address.state);
    params.set("postalCode", selectedSuggestion.address.postalCode);
    params.set("lat", String(selectedSuggestion.address.point.latitude));
    params.set("lng", String(selectedSuggestion.address.point.longitude));
  }

  return params;
}

export function PublicMarketplaceSearchShell({
  areaQuery,
  onAreaQueryChange,
  onSearch,
  onSelectedServiceChange,
  onSelectedSuggestionChange,
  selectedService,
  selectedSuggestion
}: {
  areaQuery: string;
  onAreaQueryChange: (value: string) => void;
  onSearch?: (service: ServiceCategory, suggestion?: PlaceSuggestion) => void;
  onSelectedServiceChange: (value: ServiceCategory) => void;
  onSelectedSuggestionChange: (value: PlaceSuggestion | undefined) => void;
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
}) {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const searchFieldRef = useRef<HTMLLabelElement | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasFinishedSearch, setHasFinishedSearch] = useState(false);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(false);

  useEffect(() => {
    if (areaQuery.trim().length < 2) {
      setSuggestions([]);
      setHasFinishedSearch(false);
      return;
    }

    if (selectedSuggestion && areaQuery.trim() === selectedSuggestion.label) {
      setSuggestions([]);
      setHasFinishedSearch(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      api
        .searchPlaces(areaQuery)
        .then((response) => {
          setSuggestions(response.suggestions);
          if (selectedSuggestion && !response.suggestions.some((item) => item.id === selectedSuggestion.id)) {
            onSelectedSuggestionChange(undefined);
          }
        })
        .catch(() => {
          setSuggestions([]);
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
    const suggestion = selectedSuggestion ?? suggestions[0];
    const service = serviceOverride ?? selectedService;
    setIsSuggestionMenuOpen(false);
    if (onSearch) {
      onSearch(service, suggestion);
      return;
    }

    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion
    });
    router.push(`/customer/listings?${params.toString()}`);
  }

  return (
    <div className="customer-search-shell">
      <div className="customer-search-shell__grid">
        <label className="customer-search-shell__field">
          <span>Service</span>
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
        <label className="customer-search-shell__field customer-search-shell__field--search" ref={searchFieldRef}>
          <span>Area</span>
          <input
            onChange={(event) => {
              onAreaQueryChange(event.target.value);
              onSelectedSuggestionChange(undefined);
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
            placeholder="City, town, or address"
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
                      setIsSuggestionMenuOpen(false);
                      setSuggestions([]);
                    }}
                    type="button"
                  >
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.source === "google-geocoding" ? "Google" : "Suggested area"}</span>
                  </button>
                );
              })}
            </div>
          ) : isSuggestionMenuOpen && areaQuery.trim().length >= 3 && hasFinishedSearch ? (
            <div className="customer-search-shell__suggestions">
              <div className="customer-search-shell__suggestion customer-search-shell__suggestion--static">
                <strong>No suggested area yet.</strong>
                <span>You can still search with the city, ZIP, or address you typed.</span>
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
          {isSearching ? "Checking area..." : "Search services"}
        </button>
      </div>
    </div>
  );
}
