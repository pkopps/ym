"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { isPlaceSuggestionSafeToAutoSelect, type AvailabilitySlot, type PlaceSuggestion, type PublicProviderReview, type SearchProviderResult, type SearchProvidersResponse, type ServiceCategory } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { createWebApiClient } from "../lib/api";
import { getLaunchAttributionContext } from "../lib/launchAttribution";
import { trackWebEvent } from "../lib/tracking";
import { launchAreaLabel } from "../lib/site";
import { availabilityRange, openingLabel, serviceDay, uniqueOpenings, type ArrivalWindow } from "../lib/bookingJourney";
import { buildCustomerListingsSearchParams, PublicMarketplaceSearchShell, type CustomerCustomTimingWindow, type CustomerTimingPreference } from "./PublicMarketplaceSearchShell";
import { BookingScheduleModal } from "./BookingScheduleModal";
import { LoadingSkeleton } from "./LoadingSkeleton";

const DirectoryMap = dynamic(() => import("./ProviderDirectoryMap"), { ssr: false });
type Props = {
  initialAreaLabel?: string; initialCity?: string; initialState?: string; initialPostalCode?: string; initialLat?: number; initialLng?: number;
  initialService?: ServiceCategory; initialDirectoryView?: boolean; initialTiming?: CustomerTimingPreference;
  initialAdditionalTimings?: CustomerTimingPreference[]; initialCustomDate?: string; initialCustomEndDate?: string;
  initialCustomWindow?: CustomerCustomTimingWindow; initialCustomWindows?: CustomerCustomTimingWindow[];
};
export function PublicCustomerListingsExperience(props: Props) {
  const i18n = useI18n(); const router = useRouter(); const searchParams = useSearchParams();
  const api = useMemo(() => createWebApiClient(), []);
  const [service, setService] = useState<ServiceCategory>(props.initialService ?? "lawn-mowing");
  const [area, setArea] = useState(props.initialAreaLabel ?? launchAreaLabel);
  const [suggestion, setSuggestion] = useState<PlaceSuggestion | undefined>(() => props.initialCity && props.initialState && props.initialLat !== undefined && props.initialLng !== undefined ? {
    id: "search-area", label: props.initialAreaLabel ?? props.initialCity, source: "local-dataset",
    address: { line1: props.initialAreaLabel ?? props.initialCity, city: props.initialCity, state: props.initialState, postalCode: props.initialPostalCode ?? "", country: "US", point: { latitude: props.initialLat, longitude: props.initialLng } }
  } : undefined);
  const [request, setRequest] = useState({ service, area, suggestion });
  const [result, setResult] = useState<SearchProvidersResponse>();
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0); const [day, setDay] = useState(""); const [window, setWindow] = useState<ArrivalWindow | "any">("any");
  const [selectedMapId, setSelectedMapId] = useState<string>();
  const [schedule, setSchedule] = useState<{ result: SearchProviderResult; slot?: AvailabilitySlot; rank: number }>();
  const revision = useRef(0);
  const directory = searchParams.get("view") === "directory";
  const [resolvedSuggestion, setResolvedSuggestion] = useState(suggestion);

  useEffect(() => {
    const version = ++revision.current;
    setLoading(true); setLoadingMore(false); setError(""); setResult(undefined);
    void (async () => {
      try {
        const place = request.suggestion ?? (await api.searchPlaces(request.area)).suggestions.find(isPlaceSuggestionSafeToAutoSelect);
        if (version !== revision.current) return;
        if (!place) throw new Error(i18n.t("customer.search.choose_area_guidance"));
        setResolvedSuggestion(place); setSuggestion(place); setArea(place.label);
        const next = await api.searchProviders({ address: place.address, categories: [request.service], dateIso: new Date().toISOString(),
          ...(directory ? { directory: { offset: 0, limit: 12 }, availability: availabilityRange(day, window) } : {}),
          requestSource: directory ? "public-web-directory" : "public-web-listings", attribution: getLaunchAttributionContext() });
        if (version === revision.current) setResult(next);
      } catch (err) { if (version === revision.current) setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
      finally { if (version === revision.current) setLoading(false); }
    })();
    return () => { revision.current = version + 1; };
  }, [api, request, directory, day, window, retry, i18n]);

  function toggleDirectory(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("view", "directory"); else params.delete("view");
    globalThis.window.history.pushState(null, "", `${globalThis.location.pathname}?${params.toString()}`);
    if (open) void trackWebEvent(MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed, {
      recommendationSessionId: result?.recommendationSessionId ?? "none", recommendedProviderId: result?.recommendedProviderId ?? "none",
      providerCount: result?.totalMatches ?? 0, requestSource: "public-web-listings"
    });
  }
  async function more() {
    if (!resolvedSuggestion || !result || loadingMore) return;
    const version = revision.current;
    setLoadingMore(true); setError("");
    try {
      const next = await api.searchProviders({ address: resolvedSuggestion.address, categories: [request.service], dateIso: new Date().toISOString(), directory: { offset: result.rankedProviders.length, limit: 12 }, availability: availabilityRange(day, window), requestSource: "public-web-directory" });
      if (version === revision.current) setResult(current => current ? { ...current, rankedProviders: [...current.rankedProviders, ...next.rankedProviders], suggestedSlots: [...current.suggestedSlots, ...next.suggestedSlots] } : next);
    } catch (err) { if (version === revision.current) setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
    finally { if (version === revision.current) setLoadingMore(false); }
  }
  const selectMapProvider = useCallback((id: string) => { setSelectedMapId(id); document.getElementById(`provider-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);
  const providers = result?.rankedProviders ?? [];
  const searchArea = resolvedSuggestion?.label ?? request.area;
  return <div className={`booking-discovery${directory ? " booking-discovery--directory" : ""}`}>
    <header className="booking-discovery__header">
      <div><span className="eyebrow">{i18n.t(serviceCategoryLabelKeys[request.service])} · {searchArea}</span>
        <h1>{i18n.t(directory ? "booking_journey.directory.title" : "booking_journey.recommendations.title")}</h1>
        <p>{i18n.t(directory ? "booking_journey.directory.body" : "booking_journey.recommendations.body")}</p></div>
      {directory ? <button className="button-secondary" type="button" onClick={() => toggleDirectory(false)}>{i18n.t("booking_journey.directory.back")}</button> : null}
    </header>
    <details className="booking-discovery__edit"><summary>{i18n.t("booking_journey.change_search")}</summary><PublicMarketplaceSearchShell areaQuery={area} onAreaQueryChange={setArea} selectedService={service} onSelectedServiceChange={setService} selectedSuggestion={suggestion} onSelectedSuggestionChange={setSuggestion} selectedTiming="tomorrow-morning" onSelectedTimingChange={() => undefined} showTimingSelection={false}
      onSearch={(nextService, place) => {
        setRequest({ service: nextService, area: place?.label ?? area, suggestion: place });
        const params = buildCustomerListingsSearchParams({ areaQuery: area, selectedService: nextService, selectedSuggestion: place }); if (directory) params.set("view", "directory");
        router.replace(addLocalePrefix(`/customer/listings?${params}`, i18n.locale), { scroll: false });
      }} /></details>
    {directory ? <div className="journey-directory-filters"><label>{i18n.t("booking_journey.day")}<input type="date" min={serviceDay(new Date().toISOString())} value={day} onChange={event => setDay(event.target.value)} /></label><label>{i18n.t("booking_journey.window")}<select disabled={!day} value={window} onChange={event => setWindow(event.target.value as ArrivalWindow | "any")}><option value="any">{i18n.t("booking_journey.any_time")}</option>{(["morning", "afternoon", "evening"] as const).map(value => <option value={value} key={value}>{i18n.t(`customer.window.${value}`)}</option>)}</select></label>{day ? <button className="button-secondary" type="button" onClick={() => { setDay(""); setWindow("any"); }}>{i18n.t("booking_journey.clear_filters")}</button> : null}</div> : null}
    {loading ? <LoadingSkeleton cardCount={2} label={i18n.t("booking_journey.loading")} showAvatar showAction /> : null}
    {error ? <div className="journey-error" role="alert"><p>{error}</p><button className="button-secondary" onClick={() => result ? void more() : setRetry(value => value + 1)} type="button">{i18n.t("booking_journey.retry")}</button></div> : null}
    {!loading && result && providers.length === 0 ? <section className="card"><h2>{i18n.t("booking_journey.empty")}</h2><p>{i18n.t("booking_journey.empty.body")}</p><a className="button-secondary" href={addLocalePrefix("/help#contact-us", i18n.locale)}>{i18n.t("journey.coverage")}</a></section> : null}
    {!loading && providers.length > 0 ? <div className="booking-discovery__layout"><div className="booking-discovery__providers">
      {providers.map((provider, index) => <JourneyProviderCard key={provider.provider.id} result={provider} recommended={index === 0 && !directory} selected={selectedMapId === provider.provider.id}
        slots={result?.suggestedSlots.filter(slot => slot.providerId === provider.provider.id) ?? []} onSchedule={slot => setSchedule({ result: provider, slot, rank: index + 1 })} />)}
      {directory && providers.length < (result?.totalMatches ?? 0) ? <button className="button-secondary" disabled={loadingMore} onClick={() => void more()} type="button">{i18n.t(loadingMore ? "booking_journey.openings.loading" : "booking_journey.directory.more")}</button> : null}
      {!directory ? <div className="booking-discovery__browse"><button className="button-secondary" type="button" onClick={() => toggleDirectory(true)}>{i18n.t("booking_journey.directory.cta")} <span aria-hidden="true">→</span></button></div> : null}
    </div>{directory && resolvedSuggestion ? <aside className="booking-discovery__map"><DirectoryMap results={providers} origin={resolvedSuggestion.address.point} selectedId={selectedMapId} onSelect={selectMapProvider} /><small>{i18n.t("booking_journey.directory.map_note")}</small></aside> : null}</div> : null}
    {schedule && resolvedSuggestion ? <BookingScheduleModal provider={schedule.result.provider} address={resolvedSuggestion.address} category={request.service} opening={schedule.slot} rank={schedule.rank} directory={directory} recommendationSessionId={result?.recommendationSessionId} recommendedProviderId={result?.recommendedProviderId} onClose={() => setSchedule(undefined)} /> : null}
  </div>;
}

function JourneyProviderCard({ result, slots, recommended, selected, onSchedule }: { result: SearchProviderResult; slots: AvailabilitySlot[]; recommended: boolean; selected: boolean; onSchedule: (slot?: AvailabilitySlot) => void }) {
  const i18n = useI18n(); const provider = result.provider;
  const [reviews, setReviews] = useState<PublicProviderReview[]>(); const [reviewError, setReviewError] = useState(false); const reviewsRequested = useRef(false);
  async function loadReviews() { if (reviewsRequested.current) return; reviewsRequested.current = true; setReviewError(false); try { setReviews(await createWebApiClient().getProviderReviews(provider.id)); } catch { reviewsRequested.current = false; setReviewError(true); } }
  return <article id={`provider-${provider.id}`} className={`live-provider-card journey-provider-card${recommended ? " journey-provider-card--recommended" : ""}${selected ? " journey-provider-card--selected" : ""}`}>
    {recommended ? <div className="journey-provider-card__recommendation">{i18n.t("booking_journey.recommendations.best")}</div> : null}
    <div className="journey-provider-card__identity"><div className="journey-provider-avatar" aria-hidden="true">{provider.companyName.split(" ").slice(0, 2).map(word => word[0]).join("")}</div><div><h3>{provider.companyName}</h3><p><span className="journey-rating" aria-hidden="true">★ </span>{i18n.t("common.format.rating_reviews", { rating: Number(provider.rating.toFixed(1)), count: provider.reviewCount })}</p><p>{provider.serviceArea.city}, {provider.serviceArea.state} · {i18n.t("common.format.miles", { count: Number(result.distanceMiles.toFixed(1)) })}</p></div></div>
    <div className="journey-provider-tags">
      {result.distanceMiles <= 5 || result.nearbyCompletedJobCount > 0 ? <span>{i18n.t("booking_journey.recommendations.nearby")}</span> : null}
      {provider.rating >= 4.7 && provider.reviewCount >= 5 ? <span>{i18n.t("booking_journey.recommendations.reviews")}</span> : null}
      {provider.yearsExperience >= 5 ? <span>{i18n.t("booking_journey.recommendations.experienced")}</span> : <span>{i18n.t("booking_journey.recommendations.fit")}</span>}
    </div>
    <p className="journey-provider-card__bio">{provider.bio}</p>
    <details className="journey-provider-details" onToggle={event => { if (event.currentTarget.open) void loadReviews(); }}><summary>{i18n.t("booking_journey.profile")}</summary><div><p>{provider.categories.map(value => i18n.t(serviceCategoryLabelKeys[value])).join(" · ")}</p><p>{result.reliabilityDetail}</p>
      {reviews?.slice(0, 5).map(review => <blockquote key={review.id}><strong>★ {review.overallRating}/5</strong><p>{review.reviewText}</p>{review.publicReplyBody ? <p>{review.publicReplyBody}</p> : null}</blockquote>)}
      {reviewError ? <button className="button-secondary" type="button" onClick={() => void loadReviews()}>{i18n.t("booking_journey.retry")}</button> : null}
    </div></details>
    <div className="journey-openings"><span>{i18n.t("booking_journey.openings")}</span><div className="journey-slot-pills">{uniqueOpenings(slots).slice(0, 3).map(slot => <button key={slot.id} className="journey-slot-pill" type="button" onClick={() => onSchedule(slot)}>{openingLabel(i18n, slot.startIso)}</button>)}</div>
      {!slots.length ? <small>{i18n.t("booking_journey.openings.none")}</small> : null}
      <button className="journey-text-button" type="button" onClick={() => onSchedule(slots[0])}>{i18n.t("booking_journey.openings.other")}</button>
    </div><small className="journey-provider-card__note">{i18n.t("booking_journey.book.no_charge")}</small>
  </article>;
}
