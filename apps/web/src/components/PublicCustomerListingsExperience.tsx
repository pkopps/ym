"use client";

import {
  PlaceSuggestion,
  SearchProviderResult,
  SearchProvidersResponse,
  ServiceCategory,
  formatBookingWindowSummary
} from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createWebApiClient } from "../lib/api";
import { BookedBusinessResults } from "./BookedBusinessResults";
import { buildCustomerListingsSearchParams } from "./PublicMarketplaceSearchShell";
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

function formatAreaDescription(areaLabel: string | undefined, serviceLabel: string) {
  const resolvedArea = areaLabel?.trim() || "your area";
  return `See verified ${serviceLabel.toLowerCase()} providers around ${resolvedArea}, compare why they rank highly, and move straight into a real booking flow when you're ready.`;
}

export function PublicCustomerListingsExperience({
  initialAreaLabel,
  initialCity,
  initialLat,
  initialLng,
  initialPostalCode,
  initialService,
  initialState
}: {
  initialAreaLabel?: string;
  initialCity?: string;
  initialLat?: number;
  initialLng?: number;
  initialPostalCode?: string;
  initialService?: ServiceCategory;
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

  const serviceLabel = serviceCategoryLabels[selectedService];
  const rankedProviders = providerResults?.rankedProviders ?? [];
  const liveMetrics = formatSearchMetrics(providerResults);
  const providersWithOpenWindows = rankedProviders.filter((provider) => provider.hasOpenSlot);

  async function runSearch({
    nextAreaQuery,
    nextService,
    nextSuggestion,
    shouldUpdateUrl
  }: {
    nextAreaQuery: string;
    nextService: ServiceCategory;
    nextSuggestion?: PlaceSuggestion;
    shouldUpdateUrl: boolean;
  }) {
    setSearchState("loading");
    setErrorMessage(undefined);

    try {
      let resolvedSuggestion = nextSuggestion;
      if (!resolvedSuggestion) {
        const placeResponse = await api.searchPlaces(nextAreaQuery);
        resolvedSuggestion = placeResponse.suggestions[0];
      }

      if (!resolvedSuggestion) {
        setProviderResults(undefined);
        setResolvedAreaLabel(nextAreaQuery);
        setSearchState("loaded");
        if (shouldUpdateUrl) {
          const params = buildCustomerListingsSearchParams({
            areaQuery: nextAreaQuery,
            selectedService: nextService
          });
          router.replace(`/customer/listings?${params.toString()}`);
        }
        return;
      }

      const nextResults = await api.searchProviders({
        address: resolvedSuggestion.address,
        categories: [nextService],
        dateIso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      });

      setAreaQuery(resolvedSuggestion.label);
      setResolvedAreaLabel(resolvedSuggestion.label);
      setSelectedSuggestion(resolvedSuggestion);
      setSelectedService(nextService);
      setProviderResults(nextResults);
      setSearchState("loaded");

      if (shouldUpdateUrl) {
        const params = buildCustomerListingsSearchParams({
          areaQuery: resolvedSuggestion.label,
          selectedService: nextService,
          selectedSuggestion: resolvedSuggestion
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
      shouldUpdateUrl: false
    });
    // This runs once on mount to hydrate the page with the current URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <CustomerListingsHero
        areaQuery={areaQuery}
        description={formatAreaDescription(resolvedAreaLabel, serviceLabel)}
        initialAreaLabel={initialAreaLabel}
        initialService={initialService}
        metrics={liveMetrics}
        onAreaQueryChange={setAreaQuery}
        onSearch={(service, suggestion) =>
          void runSearch({
            nextAreaQuery: suggestion?.label ?? areaQuery,
            nextService: service,
            nextSuggestion: suggestion,
            shouldUpdateUrl: true
          })
        }
        onSelectedServiceChange={setSelectedService}
        onSelectedSuggestionChange={setSelectedSuggestion}
        selectedService={selectedService}
        selectedSuggestion={selectedSuggestion}
      />

      <section className="card live-listings-card">
        <div className="results-summary">
          <div className="results-summary__copy">
            <strong>Live provider matches</strong>
            <span>
              {serviceLabel} near {resolvedAreaLabel}
            </span>
            <small>
              Public search now ranks verified providers by service fit, distance, reliability,
              and whether they still have room in the route.
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
              <p>Looking at route openings, rating history, and service fit for this area.</p>
            </article>
            <article className="list-panel live-listings-card__message">
              <h3>Sorting real route availability</h3>
              <p>
                GreenRain weighs which providers serve this area well and which crews still have
                room in the schedule.
              </p>
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
            <p>Try a nearby city, a ZIP code, or a more specific address so we can locate providers accurately.</p>
          </article>
        ) : null}

        {searchState === "loaded" && selectedSuggestion && rankedProviders.length === 0 ? (
          <article className="list-panel live-listings-card__message">
            <h3>No verified providers are live in this area yet.</h3>
            <p>
              We do not currently have a verified landscaping business serving this search area.
              Try a nearby market or contact support so we can flag the area for expansion.
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
                <h3>Providers cover this area, but their near-term route windows are full.</h3>
                <p>
                  You can still compare the best local businesses below, then create an account to
                  watch for the next route opening.
                </p>
              </article>
            ) : null}
            {rankedProviders.map((result, index) => (
              <LiveProviderCard key={result.provider.id} result={result} rank={index + 1} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>What fully booked calendars can look like</h2>
          <p>
            This showcase gives customers a cleaner feel for route density and how busy established
            GreenRain providers can look when their schedules are packed.
          </p>
        </div>
        <BookedBusinessResults allowMapToggle />
      </section>
    </>
  );
}

function LiveProviderCard({
  rank,
  result
}: {
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
            {rank === 1 ? <span className="result-badge">Best fit</span> : null}
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

      <div className="calendar-card__metric-row">
        <span>{result.distanceMiles.toFixed(1)} mi away</span>
        <span>{provider.serviceRadiusMiles} mile radius</span>
        <span>{provider.yearsExperience}+ years</span>
      </div>

      <p className="live-provider-card__window">
        {result.suggestedSlot
          ? `Next open window: ${formatBookingWindowSummary(result.suggestedSlot.startIso)}`
          : "This business serves the area, but the next route window is currently full."}
      </p>

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
          Create account to book
        </a>
        <a className="button-secondary" href="/login/customer">
          Log in
        </a>
      </div>
    </article>
  );
}
