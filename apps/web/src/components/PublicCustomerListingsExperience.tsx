"use client";

import {
  buildCustomerProviderChoicePresentations,
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
import { trackWebEvent } from "../lib/tracking";
import {
  buildCustomerListingsSearchParams,
  buildDateIsoForCustomerTiming,
  CustomerTimingPreference,
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

function formatAreaDescription(
  areaLabel: string | undefined,
  serviceLabel: string,
  timing: CustomerTimingPreference
) {
  const resolvedArea = areaLabel?.trim() || "your area";
  return `See one recommended ${serviceLabel.toLowerCase()} provider for ${getCustomerTimingLabel(
    timing
  ).toLowerCase()} in ${resolvedArea}, then open a short backup list only if you want it.`;
}

function formatCompletedJobLabel(completedJobCount: number) {
  return completedJobCount > 0 ? `${completedJobCount} completed jobs` : "New on GreenRain";
}

export function PublicCustomerListingsExperience({
  initialAreaLabel,
  initialCity,
  initialLat,
  initialLng,
  initialPostalCode,
  initialService,
  initialTiming,
  initialState
}: {
  initialAreaLabel?: string;
  initialCity?: string;
  initialLat?: number;
  initialLng?: number;
  initialPostalCode?: string;
  initialService?: ServiceCategory;
  initialTiming?: CustomerTimingPreference;
  initialState?: string;
}) {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const [areaQuery, setAreaQuery] = useState(initialAreaLabel ?? "Brooklyn, NY");
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
  const [resolvedAreaLabel, setResolvedAreaLabel] = useState(initialAreaLabel ?? "Brooklyn, NY");
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>(
    initialTiming ?? "tomorrow-morning"
  );
  const [showAlternativeProviders, setShowAlternativeProviders] = useState(false);

  const serviceLabel = serviceCategoryLabels[selectedService];
  const timingLabel = getCustomerTimingLabel(selectedTiming);
  const rankedProviders = providerResults?.rankedProviders ?? [];
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(rankedProviders);
  const recommendedProvider = rankedProviders[0];
  const alternativeProviders = rankedProviders.slice(1, 4);
  const liveMetrics = formatSearchMetrics(providerResults);
  const providersWithOpenWindows = rankedProviders.filter((provider) => provider.hasOpenSlot);

  async function runSearch({
    nextAreaQuery,
    nextService,
    nextSuggestion,
    nextTiming,
    shouldUpdateUrl
  }: {
    nextAreaQuery: string;
    nextService: ServiceCategory;
    nextSuggestion?: PlaceSuggestion;
    nextTiming: CustomerTimingPreference;
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
              "Choose one of the suggested areas so GreenRain does not guess the wrong location."
          );
          if (shouldUpdateUrl) {
            const params = buildCustomerListingsSearchParams({
              areaQuery: nextAreaQuery,
              selectedService: nextService,
              selectedTiming: nextTiming
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
            selectedTiming: nextTiming
          });
          router.replace(`/customer/listings?${params.toString()}`);
        }
        return;
      }

      const nextResults = await api.searchProviders({
        address: resolvedSuggestion.address,
        categories: [nextService],
        dateIso: buildDateIsoForCustomerTiming(nextTiming),
        requestSource: "public-web-listings"
      });

      setAreaQuery(resolvedSuggestion.label);
      setResolvedAreaLabel(resolvedSuggestion.label);
      setSelectedSuggestion(resolvedSuggestion);
      setSelectedService(nextService);
      setSelectedTiming(nextTiming);
      setProviderResults(nextResults);
      setShowAlternativeProviders(false);
      setSearchState("loaded");

      if (shouldUpdateUrl) {
        const params = buildCustomerListingsSearchParams({
          areaQuery: resolvedSuggestion.label,
          selectedService: nextService,
          selectedSuggestion: resolvedSuggestion,
          selectedTiming: nextTiming
        });
        router.replace(`/customer/listings?${params.toString()}`);
      }
    } catch (error) {
      setSearchState("error");
      setProviderResults(undefined);
      setErrorMessage(error instanceof Error ? error.message : "Unable to search providers right now.");
    }
  }

  useEffect(() => {
    void runSearch({
      nextAreaQuery: areaQuery,
      nextService: selectedService,
      nextSuggestion: selectedSuggestion,
      nextTiming: selectedTiming,
      shouldUpdateUrl: false
    });
    // This runs once on mount to hydrate the page with the current URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <CustomerListingsHero
        areaQuery={areaQuery}
        description={formatAreaDescription(resolvedAreaLabel, serviceLabel, selectedTiming)}
        initialAreaLabel={initialAreaLabel}
        initialService={initialService}
        initialTiming={initialTiming}
        metrics={liveMetrics}
        onAreaQueryChange={setAreaQuery}
        onSearch={(service, suggestion, timing) =>
          void runSearch({
            nextAreaQuery: suggestion?.label ?? areaQuery,
            nextService: service,
            nextSuggestion: suggestion,
            nextTiming: timing,
            shouldUpdateUrl: true
          })
        }
        onSelectedServiceChange={setSelectedService}
        onSelectedSuggestionChange={setSelectedSuggestion}
        onSelectedTimingChange={setSelectedTiming}
        selectedService={selectedService}
        selectedSuggestion={selectedSuggestion}
        selectedTiming={selectedTiming}
      />

      <section className="card live-listings-card">
        <div className="results-summary">
          <div className="results-summary__copy">
            <strong>Recommended for {timingLabel.toLowerCase()}</strong>
            <span>
              {serviceLabel} near {resolvedAreaLabel}
            </span>
            <small>
              One verified recommendation first. Short backup options after that.
            </small>
          </div>
          <div className="results-summary__actions">
            <a className="button-secondary" href="/auth">
              Create account to book
            </a>
            <a className="button-secondary" href="/login/customer">
              Customer login
            </a>
          </div>
        </div>

        {searchState === "loading" ? (
          <div className="live-listings-card__grid">
            <article className="list-panel live-listings-card__message">
              <h3>Checking verified providers</h3>
              <p>Checking route openings, service fit, and reliability for {timingLabel.toLowerCase()}.</p>
            </article>
            <article className="list-panel live-listings-card__message">
              <h3>Sorting the best next fit</h3>
              <p>Only providers with real local coverage make the shortlist.</p>
            </article>
          </div>
        ) : null}

        {searchState === "error" ? (
          <article className="list-panel live-listings-card__message">
            <h3>We could not load live providers right now.</h3>
            <p>{errorMessage ?? "Try the search again in a moment."}</p>
          </article>
        ) : null}

        {searchState === "loaded" && !selectedSuggestion ? (
          <article className="list-panel live-listings-card__message">
            <h3>No suggested area matched that search yet.</h3>
            <p>
              {errorMessage ??
                "Try a nearby city, ZIP code, or fuller address so we can match the right market."}
            </p>
          </article>
        ) : null}

        {searchState === "loaded" && selectedSuggestion && rankedProviders.length === 0 ? (
          <article className="list-panel live-listings-card__message">
            <h3>No verified providers are live in this area yet.</h3>
            <p>
              We do not have a verified provider serving this exact area yet. Try a nearby market or flag the area for expansion.
            </p>
            <div className="cta-row">
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
                <h3>Providers cover this area, but the requested window is full.</h3>
                <p>
                  You can still review the best local businesses below and be ready when the next route window opens.
                </p>
              </article>
            ) : null}
            {recommendedProvider ? (
              <LiveProviderCard
                choicePresentation={providerChoicePresentations[0]}
                result={recommendedProvider}
                rank={1}
              />
            ) : null}
            {alternativeProviders.length > 0 && !showAlternativeProviders ? (
              <article className="list-panel live-listings-card__banner">
                <h3>Want a backup option before you book?</h3>
                <p>
                  The recommendation stays primary, but you can still open a short backup list for a confidence check.
                </p>
                <div className="cta-row">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setShowAlternativeProviders(true);
                      void trackWebEvent(
                        MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
                        {
                          recommendationSessionId: providerResults?.recommendationSessionId ?? "unknown",
                          recommendedProviderId: providerResults?.recommendedProviderId ?? "none",
                          providerCount: rankedProviders.length,
                          requestSource: "public-web-listings"
                        }
                      );
                    }}
                    type="button"
                  >
                    Show backup options
                  </button>
                </div>
              </article>
            ) : null}
            {showAlternativeProviders
              ? alternativeProviders.map((result, index) => (
                  <LiveProviderCard
                    choicePresentation={providerChoicePresentations[index + 1]}
                    key={result.provider.id}
                    result={result}
                    rank={index + 2}
                  />
                ))
              : null}
          </div>
        ) : null}
      </section>

    </>
  );
}

function LiveProviderCard({
  choicePresentation,
  rank,
  result
}: {
  choicePresentation?: { badge: string; heading: string; detail: string };
  rank: number;
  result: SearchProviderResult;
}) {
  const provider = result.provider;
  const displayedCategories = provider.categories
    .slice(0, 4)
    .map((category) => serviceCategoryLabels[category]);

  return (
    <article className="list-panel live-provider-card">
      <div className="live-provider-card__header">
        <div className="search-result-title">
          <h3>{provider.companyName}</h3>
          <div className="live-provider-card__badges">
            {choicePresentation ? <span className="result-badge">{choicePresentation.badge}</span> : rank === 1 ? <span className="result-badge">Best fit</span> : null}
            {provider.sponsoredListingEnabled ? <span className="result-badge">Sponsored</span> : null}
            <span className={`result-badge${result.hasOpenSlot ? "" : " result-badge--neutral"}`}>
              {result.hasOpenSlot ? "Open route window" : "Route full"}
            </span>
          </div>
        </div>
        <p>
          {provider.rating.toFixed(1)} overall • {provider.timelinessRating.toFixed(1)} punctuality •{" "}
          {provider.reviewCount} reviews
        </p>
      </div>

      {choicePresentation ? (
        <div className="live-provider-card__decision">
          <strong>{choicePresentation.heading}</strong>
          <p>{choicePresentation.detail}</p>
        </div>
      ) : null}

      <div className="live-provider-card__decision live-provider-card__decision--summary">
        <strong>{result.selectionSummaryLabel}</strong>
        <p>{result.selectionSummaryDetail}</p>
      </div>

      <div className="calendar-card__metric-row">
        <span>{result.distanceMiles.toFixed(1)} mi away</span>
        <span>{provider.serviceRadiusMiles} mile radius</span>
        <span>{formatCompletedJobLabel(result.completedJobCount)}</span>
      </div>

      <p className="live-provider-card__window">
        {result.suggestedSlot
          ? `Next open window: ${formatBookingWindowSummary(result.suggestedSlot.startIso)}`
          : "This business serves the area, but the next route window is currently full."}
      </p>

      <div className="stack-sm" style={{ paddingBottom: 0 }}>
        <p className="live-provider-card__address">
          <strong>{result.reliabilityLabel}.</strong> {result.reliabilityDetail}
        </p>
        <p className="live-provider-card__address">
          <strong>{result.neighborhoodFamiliarityLabel}.</strong> {result.neighborhoodFamiliarityDetail}
        </p>
        <p className="live-provider-card__address">
          <strong>{result.availabilityConfidenceLabel}.</strong>{" "}
          {result.hasOpenSlot
            ? `GreenRain found a real route opening for this property and service request.`
            : `This provider still serves the area, but there is no open route window to hold right now.`}
        </p>
      </div>

      <div className="chip-row">
        {displayedCategories.map((category) => (
          <span key={`${provider.id}-${category}`}>{category}</span>
        ))}
      </div>

      <div className="live-provider-card__reasons">
        {result.reasons.slice(0, 3).map((reason) => (
          <span className="live-provider-card__reason" key={`${provider.id}-${reason}`}>
            {reason}
          </span>
        ))}
      </div>

      <p className="live-provider-card__address">
        {provider.address.city}, {provider.address.state} • Verified provider
      </p>

      <div className="cta-row">
        <a className="button" href="/auth">
          {rank === 1 ? "Create account to book" : "Create account to book this provider"}
        </a>
        <a className="button-secondary" href="/login/customer">
          Log in
        </a>
      </div>
    </article>
  );
}
