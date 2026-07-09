"use client";

import {
  buildCustomerProviderChoicePresentations,
  GeoPoint,
  isPlaceSuggestionSafeToAutoSelect,
  PlaceSuggestion,
  SearchProviderResult,
  SearchProvidersResponse,
  ServiceCategory,
  formatBookingWindowSummary
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient } from "../lib/api";
import { getLaunchAttributionContext } from "../lib/launchAttribution";
import { launchAreaLabel } from "../lib/site";
import { trackWebEvent } from "../lib/tracking";
import {
  buildCustomerListingsSearchParams,
  buildDateIsoForCustomerTiming,
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  customerTimingOptions,
  getDefaultCustomerCustomEndDateString,
  getDefaultCustomerCustomDateString,
  getCustomerTimingLabel
} from "./PublicMarketplaceSearchShell";
import { CustomerListingsHero } from "./CustomerListingsHero";

function buildInitialSuggestion({
  areaLabel,
  city,
  state,
  postalCode,
  lat,
  lng
}: {
  areaLabel?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}): PlaceSuggestion | undefined {
  if (!city || !state || lat === undefined || lng === undefined) {
    return undefined;
  }

  const label = areaLabel?.trim() || `${city}, ${state}`;
  return {
    id: `listings-${city}-${state}-${postalCode ?? "unknown"}`,
    label,
    source: "local-dataset",
    address: {
      line1: label,
      city,
      state,
      postalCode: postalCode ?? "",
      country: "US",
      point: {
        latitude: lat,
        longitude: lng
      }
    }
  };
}

function formatSearchMetrics(results?: SearchProvidersResponse): Array<{ value: string; label: string }> | undefined {
  if (!results) {
    return undefined;
  }

  const ranked = results.rankedProviders;
  if (ranked.length === 0) {
    return [
      { value: "0", label: "verified providers" },
      { value: "0", label: "open route windows" },
      { value: "0 mi", label: "closest match" }
    ];
  }

  const openWindows = ranked.filter((provider) => provider.hasOpenSlot).length;
  const closestDistance = Math.min(...ranked.map((provider) => provider.distanceMiles));

  return [
    { value: String(ranked.length), label: "verified providers" },
    { value: String(openWindows), label: "open route windows" },
    { value: `${closestDistance.toFixed(1)} mi`, label: "closest match" }
  ];
}

function getAlternativeTimingSuggestions(selectedTiming: CustomerTimingPreference) {
  const selectedIndex = customerTimingOptions.findIndex((option) => option.value === selectedTiming);

  if (selectedIndex === -1) {
    return customerTimingOptions.slice(0, 2);
  }

  return [...customerTimingOptions.slice(selectedIndex + 1), ...customerTimingOptions.slice(0, selectedIndex)].slice(0, 2);
}

function formatProviderCount(count: number) {
  return `${count} provider${count === 1 ? "" : "s"}`;
}

function formatOpenWindowCount(count: number) {
  if (count === 0) {
    return "No open windows";
  }

  return `${count} open window${count === 1 ? "" : "s"}`;
}

type ListingsStepStatus = "complete" | "current" | "pending";

function getListingsStepStatus(stepIndex: number, activeStepIndex: number): ListingsStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

function buildCustomerSignupHref({
  areaQuery,
  rank,
  result,
  selectedCustomDate,
  selectedCustomEndDate,
  selectedCustomWindow,
  selectedCustomWindows,
  selectedService,
  selectedSuggestion,
  selectedTiming
}: {
  areaQuery: string;
  rank?: number;
  result?: SearchProviderResult;
  selectedCustomDate: string;
  selectedCustomEndDate: string;
  selectedCustomWindow: CustomerCustomTimingWindow;
  selectedCustomWindows: CustomerCustomTimingWindow[];
  selectedService: ServiceCategory;
  selectedSuggestion?: PlaceSuggestion;
  selectedTiming: CustomerTimingPreference;
}) {
  const params = buildCustomerListingsSearchParams({
    areaQuery,
    selectedCustomDate,
    selectedCustomEndDate,
    selectedCustomWindow,
    selectedCustomWindows,
    selectedService,
    selectedSuggestion,
    selectedTiming
  });

  params.set("source", "listings");

  if (result) {
    params.set("providerId", result.provider.id);
    params.set("providerName", result.provider.companyName);
    params.set("rank", String(rank ?? 1));
    if (result.suggestedSlot) {
      params.set("slot", result.suggestedSlot.startIso);
    }
  }

  return `/auth/customer?${params.toString()}`;
}

function buildBoundingBox(origin: GeoPoint, results: SearchProviderResult[]) {
  const points = [origin, ...results.map((result) => result.provider.address.point)];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.01, (maxLat - minLat) * 0.45);
  const lngPadding = Math.max(0.01, (maxLng - minLng) * 0.45);

  return {
    left: minLng - lngPadding,
    right: maxLng + lngPadding,
    top: maxLat + latPadding,
    bottom: minLat - latPadding
  };
}

function buildMapUrl(origin: GeoPoint, results: SearchProviderResult[]) {
  const bbox = buildBoundingBox(origin, results);
  const params = new URLSearchParams({
    bbox: `${bbox.left},${bbox.bottom},${bbox.right},${bbox.top}`,
    layer: "mapnik",
    marker: `${origin.latitude},${origin.longitude}`
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function buildMarkerPosition(point: GeoPoint, bbox: ReturnType<typeof buildBoundingBox>) {
  const width = Math.max(bbox.right - bbox.left, 0.0001);
  const height = Math.max(bbox.top - bbox.bottom, 0.0001);
  const left = ((point.longitude - bbox.left) / width) * 100;
  const top = ((bbox.top - point.latitude) / height) * 100;

  return {
    left: `${Math.min(94, Math.max(6, left)).toFixed(2)}%`,
    top: `${Math.min(92, Math.max(8, top)).toFixed(2)}%`
  };
}

export function PublicCustomerListingsExperience({
  initialAreaLabel,
  initialCity,
  initialLat,
  initialLng,
  initialPostalCode,
  initialAdditionalTimings,
  initialCustomDate,
  initialCustomEndDate,
  initialCustomWindow,
  initialCustomWindows,
  initialService,
  initialTiming,
  initialState
}: {
  initialAreaLabel?: string;
  initialCity?: string;
  initialLat?: number;
  initialLng?: number;
  initialPostalCode?: string;
  initialAdditionalTimings?: CustomerTimingPreference[];
  initialCustomDate?: string;
  initialCustomEndDate?: string;
  initialCustomWindow?: CustomerCustomTimingWindow;
  initialCustomWindows?: CustomerCustomTimingWindow[];
  initialService?: ServiceCategory;
  initialTiming?: CustomerTimingPreference;
  initialState?: string;
}) {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const launchAreaSuggestion = useMemo(
    () =>
      buildInitialSuggestion({
        areaLabel: initialAreaLabel ?? launchAreaLabel,
        city: initialCity,
        state: initialState,
        postalCode: initialPostalCode,
        lat: initialLat,
        lng: initialLng
      }),
    [initialAreaLabel, initialCity, initialState, initialPostalCode, initialLat, initialLng]
  );
  const [areaQuery, setAreaQuery] = useState(initialAreaLabel ?? launchAreaLabel);
  const [selectedService, setSelectedService] = useState<ServiceCategory>(initialService ?? "lawn-mowing");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>(
    buildInitialSuggestion({
      areaLabel: initialAreaLabel,
      city: initialCity,
      state: initialState,
      postalCode: initialPostalCode,
      lat: initialLat,
      lng: initialLng
    })
  );
  const [providerResults, setProviderResults] = useState<SearchProvidersResponse | undefined>();
  const [searchState, setSearchState] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [resolvedAreaLabel, setResolvedAreaLabel] = useState(initialAreaLabel ?? launchAreaLabel);
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>(
    initialTiming ?? "tomorrow-morning"
  );
  const [selectedAdditionalTimings, setSelectedAdditionalTimings] = useState<CustomerTimingPreference[]>(
    initialAdditionalTimings ?? []
  );
  const [selectedCustomDate, setSelectedCustomDate] = useState(
    initialCustomDate ?? getDefaultCustomerCustomDateString()
  );
  const [selectedCustomEndDate, setSelectedCustomEndDate] = useState(
    initialCustomEndDate ?? getDefaultCustomerCustomEndDateString()
  );
  const [selectedCustomWindow, setSelectedCustomWindow] = useState<CustomerCustomTimingWindow>(
    initialCustomWindow ?? "morning"
  );
  const [selectedCustomWindows, setSelectedCustomWindows] = useState<CustomerCustomTimingWindow[]>(
    initialCustomWindows?.length ? initialCustomWindows : [initialCustomWindow ?? "morning"]
  );

  const serviceLabel = serviceCategoryLabels[selectedService];
  const timingLabel = getCustomerTimingLabel(selectedTiming, selectedCustomDate, selectedCustomWindow);
  const normalizedLaunchAreaLabel = launchAreaLabel.trim().toLowerCase();
  const canTryLaunchArea =
    (selectedSuggestion?.label ?? areaQuery).trim().toLowerCase() !== normalizedLaunchAreaLabel;
  const rankedProviders = providerResults?.rankedProviders ?? [];
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(rankedProviders);
  const featuredProviders = rankedProviders.slice(0, 3);
  const liveMetrics = formatSearchMetrics(providerResults);
  const providersWithOpenWindows = rankedProviders.filter((provider) => provider.hasOpenSlot);
  const alternativeTimingSuggestions = getAlternativeTimingSuggestions(selectedTiming);
  const listingsActiveStepIndex =
    searchState === "loading" ? 1 : searchState === "loaded" && rankedProviders.length > 0 ? 2 : 0;
  const listingsSteps = [
    {
      label: "Search",
      value: `${serviceLabel} • ${resolvedAreaLabel}`
    },
    {
      label: "Match",
      value:
        searchState === "loading"
          ? "Checking"
          : rankedProviders.length > 0
            ? formatProviderCount(rankedProviders.length)
            : "Needs area"
    },
    {
      label: "Review",
      value: rankedProviders[0]?.provider.companyName ?? "Best fit"
    },
    {
      label: "Request",
      value: rankedProviders[0]?.hasOpenSlot ? "No charge yet" : "After review"
    }
  ].map((step, index) => ({
    ...step,
    status: getListingsStepStatus(index, listingsActiveStepIndex)
  }));
  const listingsFilterChips = [
    { label: "Service", value: serviceLabel },
    { label: "When", value: timingLabel },
    { label: "Area", value: resolvedAreaLabel },
    {
      label: "Availability",
      value: searchState === "loading" ? "Checking" : formatOpenWindowCount(providersWithOpenWindows.length)
    }
  ];
  const listingsMapRadiusMiles = rankedProviders.length
    ? Math.max(
        12,
        Math.min(
          25,
          Math.ceil(
            rankedProviders[Math.min(rankedProviders.length, 6) - 1]?.distanceMiles ??
              rankedProviders[rankedProviders.length - 1]?.distanceMiles ??
              12
          )
        )
      )
    : 12;
  const mapProviders = rankedProviders.filter((provider) => provider.distanceMiles <= listingsMapRadiusMiles);

  async function runSearch({
    nextAreaQuery,
    nextService,
    nextSuggestion,
    nextTiming,
    nextAdditionalTimings,
    nextCustomDate,
    nextCustomEndDate,
    nextCustomWindow,
    nextCustomWindows,
    shouldUpdateUrl
  }: {
    nextAreaQuery: string;
    nextService: ServiceCategory;
    nextSuggestion?: PlaceSuggestion;
    nextTiming: CustomerTimingPreference;
    nextAdditionalTimings: CustomerTimingPreference[];
    nextCustomDate: string;
    nextCustomEndDate: string;
    nextCustomWindow: CustomerCustomTimingWindow;
    nextCustomWindows: CustomerCustomTimingWindow[];
    shouldUpdateUrl: boolean;
  }) {
    setSearchState("loading");
    setErrorMessage(undefined);

    try {
      if (providerResults?.recommendationSessionId) {
        await trackWebEvent(MarketplaceTelemetryEventCatalog.recommendationDismissed, {
          recommendationSessionId: providerResults.recommendationSessionId,
          recommendedProviderId: providerResults.recommendedProviderId ?? "none",
          requestSource: "public-web-listings"
        });
      }

      let resolvedSuggestion = nextSuggestion;
      if (!resolvedSuggestion) {
        const placeResponse = await api.searchPlaces(nextAreaQuery);
        resolvedSuggestion = placeResponse.suggestions.find((suggestion) =>
          isPlaceSuggestionSafeToAutoSelect(suggestion)
        );

        if (!resolvedSuggestion && placeResponse.suggestions.length > 0) {
          setProviderResults(undefined);
          setSelectedSuggestion(undefined);
          setResolvedAreaLabel(nextAreaQuery);
          setSearchState("loaded");
          setErrorMessage(
            placeResponse.searchMessage ??
              "Choose one of the suggested areas so YardMatch does not guess the wrong location."
          );
          if (shouldUpdateUrl) {
            const params = buildCustomerListingsSearchParams({
              areaQuery: nextAreaQuery,
              selectedService: nextService,
              selectedTiming: nextTiming,
              selectedCustomDate: nextCustomDate,
              selectedCustomEndDate: nextCustomEndDate,
              selectedCustomWindow: nextCustomWindow,
              selectedCustomWindows: nextCustomWindows,
              selectedAdditionalTimings: nextAdditionalTimings
            });
            router.replace(`/customer/listings?${params.toString()}`);
          }
          return;
        }
      }

      if (!resolvedSuggestion) {
        setProviderResults(undefined);
        setSelectedSuggestion(undefined);
        setResolvedAreaLabel(nextAreaQuery);
        setSearchState("loaded");
        if (shouldUpdateUrl) {
          const params = buildCustomerListingsSearchParams({
            areaQuery: nextAreaQuery,
            selectedService: nextService,
            selectedTiming: nextTiming,
            selectedCustomDate: nextCustomDate,
            selectedCustomEndDate: nextCustomEndDate,
            selectedCustomWindow: nextCustomWindow,
            selectedCustomWindows: nextCustomWindows,
            selectedAdditionalTimings: nextAdditionalTimings
          });
          router.replace(`/customer/listings?${params.toString()}`);
        }
        return;
      }

      const nextResults = await api.searchProviders({
        address: resolvedSuggestion.address,
        categories: [nextService],
        dateIso: buildDateIsoForCustomerTiming(nextTiming, nextCustomDate, nextCustomWindow),
        requestSource: "public-web-listings",
        attribution: getLaunchAttributionContext()
      });

      setAreaQuery(resolvedSuggestion.label);
      setResolvedAreaLabel(resolvedSuggestion.label);
      setSelectedSuggestion(resolvedSuggestion);
      setSelectedService(nextService);
      setSelectedTiming(nextTiming);
      setSelectedAdditionalTimings(nextAdditionalTimings);
      setSelectedCustomDate(nextCustomDate);
      setSelectedCustomEndDate(nextCustomEndDate);
      setSelectedCustomWindow(nextCustomWindow);
      setSelectedCustomWindows(nextCustomWindows);
      setProviderResults(nextResults);
      setSearchState("loaded");

      if (shouldUpdateUrl) {
        const params = buildCustomerListingsSearchParams({
          areaQuery: resolvedSuggestion.label,
          selectedService: nextService,
          selectedSuggestion: resolvedSuggestion,
          selectedTiming: nextTiming,
          selectedCustomDate: nextCustomDate,
          selectedCustomEndDate: nextCustomEndDate,
          selectedCustomWindow: nextCustomWindow,
          selectedCustomWindows: nextCustomWindows,
          selectedAdditionalTimings: nextAdditionalTimings
        });
        router.replace(`/customer/listings?${params.toString()}`);
      }
    } catch (error) {
      console.error("Unable to load public provider recommendations", error);
      setSearchState("error");
      setProviderResults(undefined);
      setErrorMessage("Try the search again in a moment.");
    }
  }

  useEffect(() => {
    void runSearch({
      nextAreaQuery: areaQuery,
      nextService: selectedService,
      nextSuggestion: selectedSuggestion,
      nextTiming: selectedTiming,
      nextAdditionalTimings: selectedAdditionalTimings,
      nextCustomDate: selectedCustomDate,
      nextCustomEndDate: selectedCustomEndDate,
      nextCustomWindow: selectedCustomWindow,
      nextCustomWindows: selectedCustomWindows,
      shouldUpdateUrl: false
    });
    // This runs once on mount to hydrate the page with the current URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTimingSearch(nextTiming: CustomerTimingPreference) {
    void runSearch({
      nextAreaQuery: selectedSuggestion?.label ?? areaQuery,
      nextService: selectedService,
      nextSuggestion: selectedSuggestion,
      nextTiming,
      nextAdditionalTimings: selectedAdditionalTimings,
      nextCustomDate: selectedCustomDate,
      nextCustomEndDate: selectedCustomEndDate,
      nextCustomWindow: selectedCustomWindow,
      nextCustomWindows: selectedCustomWindows,
      shouldUpdateUrl: true
    });
  }

  return (
    <>
      <CustomerListingsHero
        areaQuery={areaQuery}
        initialAreaLabel={initialAreaLabel}
        initialAdditionalTimings={initialAdditionalTimings}
        initialCustomDate={initialCustomDate}
        initialCustomEndDate={initialCustomEndDate}
        initialCustomWindow={initialCustomWindow}
        initialCustomWindows={initialCustomWindows}
        initialService={initialService}
        initialTiming={initialTiming}
        metrics={liveMetrics}
        onAreaQueryChange={setAreaQuery}
        onSearch={(service, suggestion, timing, customDate = selectedCustomDate, customWindow = selectedCustomWindow) =>
          void runSearch({
            nextAreaQuery: suggestion?.label ?? areaQuery,
            nextService: service,
            nextSuggestion: suggestion,
            nextTiming: timing,
            nextAdditionalTimings: selectedAdditionalTimings,
            nextCustomDate: customDate,
            nextCustomEndDate: selectedCustomEndDate,
            nextCustomWindow: customWindow,
            nextCustomWindows: selectedCustomWindows,
            shouldUpdateUrl: true
          })
        }
        onSelectedAdditionalTimingsChange={setSelectedAdditionalTimings}
        onSelectedCustomDateChange={setSelectedCustomDate}
        onSelectedCustomEndDateChange={setSelectedCustomEndDate}
        onSelectedCustomWindowChange={setSelectedCustomWindow}
        onSelectedCustomWindowsChange={setSelectedCustomWindows}
        onSelectedServiceChange={setSelectedService}
        onSelectedSuggestionChange={setSelectedSuggestion}
        onSelectedTimingChange={setSelectedTiming}
        selectedAdditionalTimings={selectedAdditionalTimings}
        selectedCustomDate={selectedCustomDate}
        selectedCustomEndDate={selectedCustomEndDate}
        selectedCustomWindow={selectedCustomWindow}
        selectedCustomWindows={selectedCustomWindows}
        selectedService={selectedService}
        selectedSuggestion={selectedSuggestion}
        selectedTiming={selectedTiming}
      />

      <section className="card live-listings-card">
        <div className="customer-listings-spine" aria-label="Search progress">
          <ol className="customer-listings-spine__steps">
            {listingsSteps.map((step, index) => (
              <li
                aria-current={step.status === "current" ? "step" : undefined}
                className={`customer-listings-spine__step customer-listings-spine__step--${step.status}`}
                key={step.label}
              >
                <span className="customer-listings-spine__index">{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.value}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="customer-listings-filterbar" aria-label="Active search filters">
            {listingsFilterChips.map((chip) => (
              <div className="customer-listings-filterbar__chip" key={chip.label}>
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
          <details className="customer-listings-filterdrawer">
            <summary>Timing options</summary>
            <div className="customer-listings-filterdrawer__body">
              {alternativeTimingSuggestions.map((option) => (
                <button
                  className="button-secondary"
                  key={option.value}
                  onClick={() => handleTimingSearch(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </details>
        </div>

        {searchState === "loading" ? (
          <div className="live-listings-card__grid">
            <article className="list-panel live-listings-card__message">
              <h3>Checking providers</h3>
              <p>Looking at route openings, service fit, and reliability for {timingLabel.toLowerCase()}.</p>
            </article>
            <article className="list-panel live-listings-card__message">
              <h3>Sorting the best fit</h3>
              <p>Only providers with real local coverage make the shortlist.</p>
            </article>
          </div>
        ) : null}

        {searchState === "error" ? (
          <article className="list-panel live-listings-card__message">
            <h3>Providers are unavailable right now.</h3>
            <p>{errorMessage ?? "Try the search again in a moment."}</p>
            <div className="cta-row">
              <button
                className="button-secondary"
                onClick={() =>
                  void runSearch({
                    nextAreaQuery: areaQuery,
                    nextService: selectedService,
                    nextSuggestion: selectedSuggestion,
                    nextTiming: selectedTiming,
                    nextAdditionalTimings: selectedAdditionalTimings,
                    nextCustomDate: selectedCustomDate,
                    nextCustomEndDate: selectedCustomEndDate,
                    nextCustomWindow: selectedCustomWindow,
                    nextCustomWindows: selectedCustomWindows,
                    shouldUpdateUrl: false
                  })
                }
                type="button"
              >
                Try again
              </button>
            </div>
          </article>
        ) : null}

        {searchState === "loaded" && !selectedSuggestion ? (
          <article className="list-panel live-listings-card__message">
            <h3>No suggested area matched that search yet.</h3>
            <p>
              {errorMessage ??
                "Try a nearby city, ZIP code, or fuller address so we can match the right market."}
            </p>
            {canTryLaunchArea ? (
              <div className="cta-row">
                <button
                  className="button-secondary"
                  onClick={() =>
                    void runSearch({
                      nextAreaQuery: launchAreaLabel,
                      nextService: selectedService,
                      nextSuggestion: launchAreaSuggestion,
                      nextTiming: selectedTiming,
                      nextAdditionalTimings: selectedAdditionalTimings,
                      nextCustomDate: selectedCustomDate,
                      nextCustomEndDate: selectedCustomEndDate,
                      nextCustomWindow: selectedCustomWindow,
                      nextCustomWindows: selectedCustomWindows,
                      shouldUpdateUrl: true
                    })
                  }
                  type="button"
                >
                  Try {launchAreaLabel}
                </button>
              </div>
            ) : null}
          </article>
        ) : null}

        {searchState === "loaded" && selectedSuggestion && rankedProviders.length === 0 ? (
          <article className="list-panel live-listings-card__message">
            <h3>No verified businesses yet.</h3>
            <p>Try a nearby market or ask us to review coverage.</p>
            <div className="cta-row">
              {canTryLaunchArea ? (
                <button
                  className="button-secondary"
                  onClick={() =>
                    void runSearch({
                      nextAreaQuery: launchAreaLabel,
                      nextService: selectedService,
                      nextSuggestion: launchAreaSuggestion,
                      nextTiming: selectedTiming,
                      nextAdditionalTimings: selectedAdditionalTimings,
                      nextCustomDate: selectedCustomDate,
                      nextCustomEndDate: selectedCustomEndDate,
                      nextCustomWindow: selectedCustomWindow,
                      nextCustomWindows: selectedCustomWindows,
                      shouldUpdateUrl: true
                    })
                  }
                  type="button"
                >
                  Try {launchAreaLabel}
                </button>
              ) : null}
              <a className="button-secondary" href="/help?issueType=general&subject=Need service in my area">
                Request service in this area
              </a>
            </div>
          </article>
        ) : null}

        {searchState === "loaded" && rankedProviders.length > 0 ? (
          <div className="live-listings-card__grid">
            {providersWithOpenWindows.length === 0 ? (
              <article className="list-panel live-listings-card__banner">
                <h3>Routes are full for this window.</h3>
                <p>Try another time or review local businesses below.</p>
                <div className="cta-row">
                  {alternativeTimingSuggestions.map((option) => (
                    <button
                      className="button-secondary"
                      key={option.value}
                      onClick={() => handleTimingSearch(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </article>
            ) : null}
            <div className="live-listings-card__featured-grid">
              {featuredProviders.map((result, index) => (
                <LiveProviderCard
                  choicePresentation={providerChoicePresentations[index]}
                  isPrimaryRecommendation={index === 0}
                  key={result.provider.id}
                  result={result}
                  rank={index + 1}
                  signupHref={buildCustomerSignupHref({
                    areaQuery,
                    rank: index + 1,
                    result,
                    selectedCustomDate,
                    selectedCustomEndDate,
                    selectedCustomWindow,
                    selectedCustomWindows,
                    selectedService,
                    selectedSuggestion,
                    selectedTiming
                  })}
                />
              ))}
            </div>
            {selectedSuggestion && mapProviders.length > 0 ? (
              <LiveProviderMap
                areaLabel={resolvedAreaLabel}
                providerResults={mapProviders}
                radiusMiles={listingsMapRadiusMiles}
                selectedSuggestion={selectedSuggestion}
                serviceLabel={serviceLabel}
              />
            ) : null}
          </div>
        ) : null}
      </section>

    </>
  );
}

function LiveProviderCard({
  choicePresentation,
  isPrimaryRecommendation = false,
  rank,
  result,
  signupHref
}: {
  choicePresentation?: { badge: string; heading: string; detail: string };
  isPrimaryRecommendation?: boolean;
  rank: number;
  result: SearchProviderResult;
  signupHref: string;
}) {
  const provider = result.provider;
  const displayedCategories = provider.categories
    .slice(0, 4)
    .map((category) => serviceCategoryLabels[category]);
  const nextWindowLabel = result.suggestedSlot
    ? formatBookingWindowSummary(result.suggestedSlot.startIso)
    : "Window full";
  const requestCtaLabel = result.hasOpenSlot
    ? rank === 1
      ? "Request this match"
      : "Request"
    : "Review provider";
  const matchHeading = choicePresentation?.heading ?? result.selectionSummaryLabel;
  const matchDetail = choicePresentation?.detail ?? result.selectionSummaryDetail;
  const availabilityNote = result.hasOpenSlot
    ? "Provider confirms before payment."
    : "Try another time before requesting.";
  const detailServices = displayedCategories.length ? displayedCategories.join(", ") : "Requested yard service";
  const detailReasons = result.reasons.length
    ? result.reasons.slice(0, 3).join(" • ")
    : "Service area, timing, and job type match this request.";

  return (
    <article className={`list-panel live-provider-card${isPrimaryRecommendation ? " live-provider-card--recommended" : ""}`}>
      <div className="live-provider-card__header">
        <div className="live-provider-card__identity">
          <h3>{provider.companyName}</h3>
          <p>
            {provider.address.city}, {provider.address.state} • {provider.rating.toFixed(1)} rating •{" "}
            {provider.reviewCount} reviews
          </p>
        </div>
        <div className="live-provider-card__badges">
          {choicePresentation ? (
            <span className="result-badge">{choicePresentation.badge}</span>
          ) : rank === 1 ? (
            <span className="result-badge">Best fit</span>
          ) : null}
          {provider.sponsoredListingEnabled ? <span className="result-badge">Sponsored</span> : null}
          <span className={`result-badge${result.hasOpenSlot ? "" : " result-badge--neutral"}`}>
            {result.hasOpenSlot ? "Open time" : "Window full"}
          </span>
        </div>
      </div>

      <div className="live-provider-card__match-note">
        <strong>{matchHeading}</strong>
        <p>{matchDetail}</p>
      </div>

      <div className="live-provider-card__request-row" aria-label="Provider request facts">
        <div className="live-provider-card__slot">
          <span>{result.hasOpenSlot ? "Next opening" : "Availability"}</span>
          <strong>{nextWindowLabel}</strong>
          <small>{availabilityNote}</small>
        </div>
        <dl className="live-provider-card__facts">
          <div>
            <dt>Distance</dt>
            <dd>{result.distanceMiles.toFixed(1)} mi</dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>{result.selectionSummaryLabel}</dd>
          </div>
        </dl>
        <a className="button live-provider-card__action" href={signupHref}>
          {requestCtaLabel}
        </a>
      </div>

      <details className="service-card-disclosure">
        <summary className="service-card-disclosure__summary">Details</summary>
        <div className="service-card-disclosure__body live-provider-card__details">
          <div>
            <span>Services</span>
            <p>{detailServices}</p>
          </div>
          <div>
            <span>Why it fits</span>
            <p>{detailReasons}</p>
          </div>
          <div>
            <span>Route check</span>
            <p>
              <strong>{result.reliabilityLabel}.</strong> {result.reliabilityDetail}
            </p>
          </div>
          <div>
            <span>Local coverage</span>
            <p>
              <strong>{result.neighborhoodFamiliarityLabel}.</strong>{" "}
              {result.neighborhoodFamiliarityDetail}
            </p>
          </div>
          <div>
            <span>Timing</span>
            <p>
              <strong>{result.availabilityConfidenceLabel}.</strong>{" "}
              {result.hasOpenSlot ? "Route has room for this request." : "No route window is open for this time."}
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}

function LiveProviderMap({
  areaLabel,
  providerResults,
  radiusMiles,
  selectedSuggestion,
  serviceLabel
}: {
  areaLabel: string;
  providerResults: SearchProviderResult[];
  radiusMiles: number;
  selectedSuggestion: PlaceSuggestion;
  serviceLabel: string;
}) {
  const origin = selectedSuggestion.address.point;
  const bbox = buildBoundingBox(origin, providerResults);
  const mapUrl = buildMapUrl(origin, providerResults);
  const customerMarker = buildMarkerPosition(origin, bbox);

  return (
    <section className="map-panel live-provider-map">
      <div className="map-panel__toolbar">
        <span className="eyebrow">Nearby providers</span>
        <strong>
          {providerResults.length} verified providers within {radiusMiles} miles of {areaLabel}
        </strong>
        <p>These are the nearby businesses YardMatch considered for this {serviceLabel.toLowerCase()} request.</p>
      </div>

      <div className="map-viewport" aria-label="Map of nearby provider recommendations">
        <iframe
          className="map-viewport__frame"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrl}
          title="Nearby provider recommendation map"
        />
        <div className="map-viewport__overlay" />
        <div className="map-user-marker" style={customerMarker}>
          <span>Property</span>
        </div>
        {providerResults.map((result, index) => (
          <div
            className={`map-business-marker${index === 0 ? " map-business-marker--recommended" : ""}`}
            key={`${result.provider.id}-marker`}
            style={buildMarkerPosition(result.provider.address.point, bbox)}
          >
            <strong>{index + 1}</strong>
            <span>{result.distanceMiles.toFixed(1)} mi</span>
          </div>
        ))}
      </div>

      <div className="map-legend">
        {providerResults.map((result, index) => (
          <article className="map-legend__row" key={`${result.provider.id}-legend`}>
            <div className="map-legend__business">
              <strong>{index + 1}</strong>
              <div>
                <h4>{result.provider.companyName}</h4>
                <p>
                  {result.provider.address.city}, {result.provider.address.state}
                  {index === 0 ? " • Recommended first" : ""}
                </p>
              </div>
            </div>
            <span>{result.distanceMiles.toFixed(1)} mi</span>
          </article>
        ))}
      </div>
    </section>
  );
}
