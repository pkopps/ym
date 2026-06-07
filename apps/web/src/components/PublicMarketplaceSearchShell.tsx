"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient } from "../lib/api";

export function PublicMarketplaceSearchShell() {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [areaQuery, setAreaQuery] = useState("Brooklyn, NY");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasFinishedSearch, setHasFinishedSearch] = useState(false);

  useEffect(() => {
    if (areaQuery.trim().length < 2) {
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
            setSelectedSuggestion(undefined);
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
  }, [api, areaQuery, selectedSuggestion]);

  function handleSubmit() {
    const suggestion = selectedSuggestion ?? suggestions[0];
    const params = new URLSearchParams({
      service: selectedService,
      area: suggestion?.label ?? areaQuery.trim()
    });

    if (suggestion) {
      params.set("city", suggestion.address.city);
      params.set("state", suggestion.address.state);
      params.set("postalCode", suggestion.address.postalCode);
      params.set("lat", String(suggestion.address.point.latitude));
      params.set("lng", String(suggestion.address.point.longitude));
    }

    router.push(`/customer/listings?${params.toString()}`);
  }

  return (
    <div className="customer-search-shell">
      <div className="customer-search-shell__grid">
        <label className="customer-search-shell__field">
          <span>Service</span>
          <select onChange={(event) => setSelectedService(event.target.value as ServiceCategory)} value={selectedService}>
            {Object.entries(serviceCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="customer-search-shell__field customer-search-shell__field--search">
          <span>Area</span>
          <input
            onChange={(event) => {
              setAreaQuery(event.target.value);
              setSelectedSuggestion(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="City, town, or address"
            value={areaQuery}
          />
          {suggestions.length > 0 ? (
            <div className="customer-search-shell__suggestions">
              {suggestions.map((suggestion) => {
                const isActive = selectedSuggestion?.id === suggestion.id;
                return (
                  <button
                    className={`customer-search-shell__suggestion${isActive ? " customer-search-shell__suggestion--active" : ""}`}
                    key={suggestion.id}
                    onClick={() => {
                      setAreaQuery(suggestion.label);
                      setSelectedSuggestion(suggestion);
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
          ) : areaQuery.trim().length >= 3 && hasFinishedSearch ? (
            <div className="customer-search-shell__suggestions">
              <div className="customer-search-shell__suggestion customer-search-shell__suggestion--static">
                <strong>No suggested area yet.</strong>
                <span>You can still search with the city, ZIP, or address you typed.</span>
              </div>
            </div>
          ) : areaQuery.trim().length >= 2 && isSearching ? (
            <div className="customer-search-shell__suggestions">
              <div className="customer-search-shell__suggestion customer-search-shell__suggestion--static">
                <strong>Searching areas…</strong>
              </div>
            </div>
          ) : null}
        </label>
        <button className="button customer-search-shell__action" onClick={handleSubmit} type="button">
          {isSearching ? "Checking area..." : "Search services"}
        </button>
      </div>
    </div>
  );
}
