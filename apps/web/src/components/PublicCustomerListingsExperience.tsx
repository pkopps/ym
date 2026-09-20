"use client";

import {
  buildCustomerProviderChoicePresentations,
  GeoPoint,
  isPlaceSuggestionSafeToAutoSelect,
  PlaceSuggestion,
  SearchProviderResult,
  SearchProvidersResponse,
  ServiceCategory,
  getBookingServiceWindow
} from "@yardmatch/contracts";
import { addLocalePrefix, I18nInstance, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
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
import { LoadingSkeleton } from "./LoadingSkeleton";

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

function formatSearchMetrics(
  i18n: I18nInstance,
  results?: SearchProvidersResponse
): Array<{ value: string; label: string }> | undefined {
  if (!results) {
    return undefined;
  }

  const ranked = results.rankedProviders;
  if (ranked.length === 0) {
    return [
      { value: "0", label: i18n.t("customer.listings.metrics.verified_providers") },
      { value: "0", label: i18n.t("customer.listings.metrics.open_route_windows") },
      { value: i18n.t("common.format.miles", { count: 0 }), label: i18n.t("customer.listings.metrics.closest_match") }
    ];
  }

  const openWindows = ranked.filter((provider) => provider.hasOpenSlot).length;
  const closestDistance = Math.min(...ranked.map((provider) => provider.distanceMiles));

  return [
    { value: String(ranked.length), label: i18n.t("customer.listings.metrics.verified_providers") },
    { value: String(openWindows), label: i18n.t("customer.listings.metrics.open_route_windows") },
    { value: i18n.t("common.format.miles", { count: Number(closestDistance.toFixed(1)) }), label: i18n.t("customer.listings.metrics.closest_match") }
  ];
}

function getAlternativeTimingSuggestions(selectedTiming: CustomerTimingPreference) {
  const selectedIndex = customerTimingOptions.findIndex((option) => option.value === selectedTiming);

  if (selectedIndex === -1) {
    return customerTimingOptions.slice(0, 2);
  }

  return [...customerTimingOptions.slice(selectedIndex + 1), ...customerTimingOptions.slice(0, selectedIndex)].slice(0, 2);
}

function formatProviderCount(i18n: I18nInstance, count: number) {
  return i18n.t("common.format.provider_count", { count });
}

function formatOpenWindowCount(i18n: I18nInstance, count: number) {
  if (count === 0) {
    return i18n.t("common.format.no_open_windows");
  }

  return i18n.t("common.format.open_window_count", { count });
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
  const points = [origin, ...results.map((result) => result.provider.serviceArea.center)];
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

function formatWindowSummary(i18n: I18nInstance, iso: string) {
  const window = getBookingServiceWindow(iso);
  const keyPrefix =
    window.key === "morning"
      ? "booking.window.morning"
      : window.key === "afternoon"
        ? "booking.window.afternoon"
        : "booking.window.late_afternoon_night";

  return i18n.t("booking.window.summary", {
    label: i18n.t(`${keyPrefix}.label` as TranslationKey),
    range: i18n.t(`${keyPrefix}.range` as TranslationKey)
  });
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
  const i18n = useI18n();
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
  const [showAlternatives, setShowAlternatives] = useState(false);
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

  const serviceLabel = i18n.t(serviceCategoryLabelKeys[selectedService]);
  const timingLabel = getCustomerTimingLabel(selectedTiming, selectedCustomDate, selectedCustomWindow, i18n);
  const normalizedLaunchAreaLabel = launchAreaLabel.trim().toLowerCase();
  const canTryLaunchArea =
    (selectedSuggestion?.label ?? areaQuery).trim().toLowerCase() !== normalizedLaunchAreaLabel;
  const rankedProviders = providerResults?.rankedProviders ?? [];
  const providerChoicePresentations = buildCustomerProviderChoicePresentations(rankedProviders);
  const featuredProviders = rankedProviders.slice(0, 3);
  const visibleProviders = showAlternatives ? featuredProviders : featuredProviders.slice(0, 1);
  const liveMetrics = formatSearchMetrics(i18n, providerResults);
  const providersWithOpenWindows = rankedProviders.filter((provider) => provider.hasOpenSlot);
  const alternativeTimingSuggestions = getAlternativeTimingSuggestions(selectedTiming);
  const listingsActiveStepIndex =
    searchState === "loading" ? 1 : searchState === "loaded" && rankedProviders.length > 0 ? 2 : 0;
  const listingsSteps = [
    {
      label: i18n.t("customer.listings.steps.search"),
      value: `${serviceLabel} • ${resolvedAreaLabel}`
    },
    {
      label: i18n.t("customer.listings.steps.match"),
      value:
        searchState === "loading"
          ? i18n.t("common.loading.checking")
          : rankedProviders.length > 0
            ? formatProviderCount(i18n, rankedProviders.length)
            : i18n.t("common.state.needs_area")
    },
    {
      label: i18n.t("customer.listings.steps.review"),
      value: rankedProviders[0]?.provider.companyName ?? i18n.t("common.state.best_fit")
    },
    {
      label: i18n.t("customer.listings.steps.request"),
      value: rankedProviders[0]?.hasOpenSlot ? i18n.t("common.state.no_charge_yet") : i18n.t("common.state.after_review")
    }
  ].map((step, index) => ({
    ...step,
    status: getListingsStepStatus(index, listingsActiveStepIndex)
  }));
  const listingsFilterChips = [
    { label: i18n.t("customer.listings.filter.service"), value: serviceLabel },
    { label: i18n.t("customer.listings.filter.when"), value: timingLabel },
    { label: i18n.t("customer.listings.filter.area"), value: resolvedAreaLabel },
    {
      label: i18n.t("customer.listings.filter.availability"),
      value: searchState === "loading" ? i18n.t("common.loading.checking") : formatOpenWindowCount(i18n, providersWithOpenWindows.length)
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
  const visibleProviderIds = new Set(visibleProviders.map((result) => result.provider.id));
  const visibleMapProviders = mapProviders.filter((result) => visibleProviderIds.has(result.provider.id));

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
    setShowAlternatives(false);
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
              i18n.t("customer.search.choose_area_guidance")
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
            router.replace(addLocalePrefix(`/customer/listings?${params.toString()}`, i18n.locale));
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
          router.replace(addLocalePrefix(`/customer/listings?${params.toString()}`, i18n.locale));
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
        router.replace(addLocalePrefix(`/customer/listings?${params.toString()}`, i18n.locale));
      }
    } catch (error) {
      console.error("Unable to load public provider recommendations", error);
      setSearchState("error");
      setProviderResults(undefined);
      setErrorMessage(i18n.t("customer.listings.error.body"));
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
        <details className="customer-listings-spine" aria-label={i18n.t("customer.listings.search_progress")}>
          <summary className="customer-listings-spine__summary">
            {i18n.t("customer.listings.request_details")}
          </summary>
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
          <div className="customer-listings-filterbar" aria-label={i18n.t("customer.listings.active_search_filters")}>
            {listingsFilterChips.map((chip) => (
              <div className="customer-listings-filterbar__chip" key={chip.label}>
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
          <details className="customer-listings-filterdrawer">
            <summary>{i18n.t("customer.search.backup_times")}</summary>
            <div className="customer-listings-filterdrawer__body">
              {alternativeTimingSuggestions.map((option) => (
                <button
                  className="button-secondary"
                  key={option.value}
                  onClick={() => handleTimingSearch(option.value)}
                  type="button"
                >
                  {i18n.t(option.labelKey)}
                </button>
              ))}
            </div>
          </details>
        </details>

        {searchState === "loading" ? (
          <LoadingSkeleton
            cardClassName="list-panel"
            cardCount={2}
            className="live-listings-card__grid"
            label={i18n.t("customer.listings.loading.checking.title")}
            lines={3}
            showAction
            showAvatar
          />
        ) : null}

        {searchState === "error" ? (
          <article className="list-panel live-listings-card__message">
            <h3>{i18n.t("customer.listings.error.title")}</h3>
            <p>{errorMessage ?? i18n.t("customer.listings.error.body")}</p>
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
                {i18n.t("customer.listings.error.retry")}
              </button>
            </div>
          </article>
        ) : null}

        {searchState === "loaded" && !selectedSuggestion ? (
          <article className="list-panel live-listings-card__message">
            <h3>{i18n.t("customer.listings.empty.no_area.title")}</h3>
            <p>
              {errorMessage ??
                i18n.t("customer.listings.empty.no_area.body")}
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
                  {i18n.t("customer.listings.empty.try_area", { area: launchAreaLabel })}
                </button>
              </div>
            ) : null}
          </article>
        ) : null}

        {searchState === "loaded" && selectedSuggestion && rankedProviders.length === 0 ? (
          <article className="list-panel live-listings-card__message">
            <h3>{i18n.t("customer.listings.empty.no_businesses.title")}</h3>
            <p>{i18n.t("customer.listings.empty.no_businesses.body")}</p>
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
                  {i18n.t("customer.listings.empty.try_area", { area: launchAreaLabel })}
                </button>
              ) : null}
              <a className="button-secondary" href={addLocalePrefix(`/help?${new URLSearchParams({service: selectedService, area: selectedSuggestion?.label ?? "", timing: selectedTiming, source: "coverage-inquiry"}).toString()}#contact-us`, i18n.locale)}>
                {i18n.t("journey.coverage")}
              </a>
            </div>
          </article>
        ) : null}

        {searchState === "loaded" && rankedProviders.length > 0 ? (
          <div className="live-listings-card__grid">
            {providersWithOpenWindows.length === 0 ? (
              <article className="list-panel live-listings-card__banner">
                <h3>{i18n.t("customer.listings.full.title")}</h3>
                <p>{i18n.t("customer.listings.full.body")}</p>
                <div className="cta-row">
                  {alternativeTimingSuggestions.map((option) => (
                    <button
                      className="button-secondary"
                      key={option.value}
                      onClick={() => handleTimingSearch(option.value)}
                      type="button"
                    >
                      {i18n.t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </article>
            ) : null}
            <div className="live-listings-card__featured-grid">
              {visibleProviders.map((result, index) => (
                <LiveProviderCard
                  choicePresentation={providerChoicePresentations[index]}
                  i18n={i18n}
                  isPrimaryRecommendation={index === 0}
                  key={result.provider.id}
                  result={result}
                  rank={index + 1}
                  signupHref={addLocalePrefix(
                    buildCustomerSignupHref({
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
                    }),
                    i18n.locale
                  )}
                />
              ))}
            </div>
            {featuredProviders.length > 1 && !showAlternatives ? (
              <article className="live-listings-card__alternatives">
                <div>
                  <strong>{i18n.t("customer.listings.alternatives.title")}</strong>
                  <p>{i18n.t("customer.listings.alternatives.body")}</p>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => {
                    setShowAlternatives(true);
                    void trackWebEvent(
                      MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
                      {
                        recommendationSessionId: providerResults?.recommendationSessionId ?? "none",
                        recommendedProviderId: providerResults?.recommendedProviderId ?? "none",
                        providerCount: featuredProviders.length,
                        requestSource: "public-web-listings"
                      }
                    );
                  }}
                  type="button"
                >
                  {i18n.t("customer.listings.alternatives.cta", { count: featuredProviders.length - 1 })}
                </button>
              </article>
            ) : null}
            {selectedSuggestion && visibleMapProviders.length > 0 ? (
              <LiveProviderMap
                areaLabel={resolvedAreaLabel}
                i18n={i18n}
                providerResults={visibleMapProviders}
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
  i18n,
  isPrimaryRecommendation = false,
  rank,
  result,
  signupHref
}: {
  choicePresentation?: { badge: string; heading: string; detail: string };
  i18n: I18nInstance;
  isPrimaryRecommendation?: boolean;
  rank: number;
  result: SearchProviderResult;
  signupHref: string;
}) {
  const provider = result.provider;
  const displayedCategories = provider.categories
    .slice(0, 4)
    .map((category) => i18n.t(serviceCategoryLabelKeys[category]));
  const nextWindowLabel = result.suggestedSlot
    ? formatWindowSummary(i18n, result.suggestedSlot.startIso)
    : i18n.t("customer.listings.card.window_full");
  const requestCtaLabel = result.hasOpenSlot
    ? rank === 1
      ? i18n.t("customer.listings.card.see_price_and_request")
      : i18n.t("customer.listings.card.request")
    : i18n.t("customer.listings.card.review_provider");
  const matchHeading = choicePresentation?.heading ?? result.selectionSummaryLabel;
  const matchDetail = choicePresentation?.detail ?? result.selectionSummaryDetail;
  const availabilityNote = result.hasOpenSlot
    ? i18n.t("customer.listings.card.provider_confirms")
    : i18n.t("customer.listings.card.try_another_time");
  const detailServices = displayedCategories.length ? displayedCategories.join(", ") : i18n.t("customer.listings.card.requested_yard_service");
  const detailReasons = result.reasons.length
    ? result.reasons.slice(0, 3).join(" • ")
    : i18n.t("customer.listings.card.service_fit_fallback");

  return (
    <article className={`list-panel live-provider-card${isPrimaryRecommendation ? " live-provider-card--recommended" : ""}`}>
      <div className="live-provider-card__header">
        <div className="live-provider-card__identity">
          <h3>{provider.companyName}</h3>
          <p>
            {provider.serviceArea.city}, {provider.serviceArea.state} •{" "}
            {i18n.t("common.format.rating_reviews", {
              rating: Number(provider.rating.toFixed(1)),
              count: provider.reviewCount
            })}
          </p>
        </div>
        <div className="live-provider-card__badges">
          {choicePresentation ? (
            <span className="result-badge">{choicePresentation.badge}</span>
          ) : rank === 1 ? (
            <span className="result-badge">{i18n.t("customer.listings.card.best_fit")}</span>
          ) : null}
          <span className={`result-badge${result.hasOpenSlot ? "" : " result-badge--neutral"}`}>
            {result.hasOpenSlot ? i18n.t("customer.listings.card.open_time") : i18n.t("customer.listings.card.window_full")}
          </span>
        </div>
      </div>

      <div className="live-provider-card__match-note">
        <strong>{matchHeading}</strong>
        <p>{matchDetail}</p>
      </div>

      <div className="live-provider-card__request-row" aria-label={i18n.t("customer.listings.card.provider_facts")}>
        <div className="live-provider-card__slot">
          <span>{result.hasOpenSlot ? i18n.t("customer.listings.card.next_opening") : i18n.t("customer.listings.card.availability")}</span>
          <strong>{nextWindowLabel}</strong>
          <small>{availabilityNote}</small>
        </div>
        <dl className="live-provider-card__facts">
          <div>
            <dt>{i18n.t("customer.listings.card.distance")}</dt>
            <dd>{i18n.t("common.format.miles", { count: Number(result.distanceMiles.toFixed(1)) })}</dd>
          </div>
          <div>
            <dt>{i18n.t("customer.listings.card.fit")}</dt>
            <dd>{result.selectionSummaryLabel}</dd>
          </div>
        </dl>
        <div className="live-provider-card__conversion">
          <a className="button live-provider-card__action" href={signupHref}>
            {requestCtaLabel}
          </a>
          <small>{i18n.t("customer.listings.card.price_next")}</small>
        </div>
      </div>

      <details className="service-card-disclosure">
        <summary className="service-card-disclosure__summary">{i18n.t("customer.listings.card.details")}</summary>
        <div className="service-card-disclosure__body live-provider-card__details">
          <div>
            <span>{i18n.t("customer.listings.card.services")}</span>
            <p>{detailServices}</p>
          </div>
          <div>
            <span>{i18n.t("customer.listings.card.why_it_fits")}</span>
            <p>{detailReasons}</p>
          </div>
          <div>
            <span>{i18n.t("customer.listings.card.route_check")}</span>
            <p>
              <strong>{result.reliabilityLabel}.</strong> {result.reliabilityDetail}
            </p>
          </div>
          <div>
            <span>{i18n.t("customer.listings.card.local_coverage")}</span>
            <p>
              <strong>{result.neighborhoodFamiliarityLabel}.</strong>{" "}
              {result.neighborhoodFamiliarityDetail}
            </p>
          </div>
          <div>
            <span>{i18n.t("customer.listings.card.timing")}</span>
            <p>
              <strong>{result.availabilityConfidenceLabel}.</strong>{" "}
              {result.hasOpenSlot ? i18n.t("customer.listings.card.route_has_room") : i18n.t("customer.listings.card.no_route_window")}
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}

function LiveProviderMap({
  areaLabel,
  i18n,
  providerResults,
  radiusMiles,
  selectedSuggestion,
  serviceLabel
}: {
  areaLabel: string;
  i18n: I18nInstance;
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
        <span className="eyebrow">{i18n.t("customer.listings.map.nearby")}</span>
        <strong>
          {i18n.t("customer.listings.map.provider_count", {
            count: providerResults.length,
            miles: radiusMiles,
            area: areaLabel
          })}
        </strong>
        <p>{i18n.t("customer.listings.map.considered", { service: serviceLabel.toLowerCase() })}</p>
      </div>

      <div className="map-viewport" aria-label={i18n.t("customer.listings.map.aria")}>
        <iframe
          className="map-viewport__frame"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrl}
          title={i18n.t("customer.listings.map.title")}
        />
        <div className="map-viewport__overlay" />
        <div className="map-user-marker" style={customerMarker}>
          <span>{i18n.t("customer.listings.map.property")}</span>
        </div>
        {providerResults.map((result, index) => (
          <div
            className={`map-business-marker${index === 0 ? " map-business-marker--recommended" : ""}`}
            key={`${result.provider.id}-marker`}
            style={buildMarkerPosition(result.provider.serviceArea.center, bbox)}
          >
            <strong>{index + 1}</strong>
            <span>{i18n.t("common.format.miles", { count: Number(result.distanceMiles.toFixed(1)) })}</span>
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
                  {result.provider.serviceArea.city}, {result.provider.serviceArea.state}
                  {index === 0 ? ` • ${i18n.t("customer.listings.map.recommended_first")}` : ""}
                </p>
              </div>
            </div>
            <span>{i18n.t("common.format.miles", { count: Number(result.distanceMiles.toFixed(1)) })}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
