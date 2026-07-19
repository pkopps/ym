"use client";

import Link from "next/link";
import {
  PlaceSuggestion,
  PublicMarketplaceCoverageArea,
  PublicMarketplaceFeaturedProvider,
  PublicMarketplaceHighlightedReview,
  PublicMarketplaceOverviewResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { faqItems } from "@yardmatch/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LaunchLeadCaptureCard } from "./LaunchLeadCaptureCard";
import {
  CustomerQuickServiceChip,
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  buildCustomerListingsSearchParams,
  getDefaultCustomerCustomEndDateString,
  getDefaultCustomerCustomDateString,
  PublicMarketplaceSearchShell
} from "./PublicMarketplaceSearchShell";
import { createWebApiClient } from "../lib/api";
import { buildSiteUrl, launchAreaLabel } from "../lib/site";
import { localizeTrustPolicyPage, trustPolicyPages } from "../lib/trustPolicyContent";
import { StructuredData } from "./StructuredData";

const showCoveragePockets = false;

function getProviderInitials(provider: PublicMarketplaceFeaturedProvider) {
  return provider.companyName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatHighlightedReviewText(review: PublicMarketplaceHighlightedReview, maxLength = 160) {
  const normalized = review.reviewText.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatCoverageAreaLabel(area: PublicMarketplaceCoverageArea) {
  return `${area.city}, ${area.state}`;
}

function MarketplaceProviderRail({
  ctaLabel,
  description,
  onCta,
  providers,
  title,
  variant
}: {
  ctaLabel: string;
  description: string;
  onCta: () => void;
  providers: PublicMarketplaceFeaturedProvider[];
  title: string;
  variant: "top-rated" | "most-on-time";
}) {
  const i18n = useI18n();
  const railRef = useRef<HTMLDivElement | null>(null);

  function scrollRail(direction: -1 | 1) {
    railRef.current?.scrollBy({
      left: direction * 344,
      behavior: "smooth"
    });
  }

  return (
    <section className="container stack-lg market-home__provider-rail-section">
      <div className="market-home__provider-rail-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="market-home__provider-rail-actions">
          <button className="button-secondary market-home__provider-rail-link" onClick={onCta} type="button">
            {ctaLabel}
          </button>
          <div className="market-home__provider-rail-nav">
            <button aria-label={`Scroll ${title} left`} onClick={() => scrollRail(-1)} type="button">
              ‹
            </button>
            <button aria-label={`Scroll ${title} right`} onClick={() => scrollRail(1)} type="button">
              ›
            </button>
          </div>
        </div>
      </div>
      <div className="market-home__provider-rail" ref={railRef}>
        {providers.map((provider) => {
          const displayRating = provider.rating ?? 0;
          const displayTimeliness = provider.timelinessRating ?? provider.rating ?? 0;
          const emphasisLine =
            variant === "top-rated"
              ? i18n.t("market.home.provider.rating_line", { rating: displayRating, count: provider.reviewCount })
              : i18n.t("market.home.provider.punctuality_line", {
                  rating: displayTimeliness,
                  count: provider.reviewCount
                });
          const detailLine =
            variant === "top-rated"
              ? provider.yearsExperience
                ? i18n.t("market.home.provider.years_detail", { years: provider.yearsExperience })
                : i18n.t("market.home.provider.local_reviews")
              : provider.serviceRadiusMiles
                ? i18n.t("market.home.provider.route_detail", { miles: provider.serviceRadiusMiles })
                : i18n.t("market.home.provider.local_arrival");
          const availabilityLine = provider.ownerName
            ? i18n.t("market.home.provider.availability_owned", { ownerName: provider.ownerName })
            : i18n.t("market.home.provider.availability_verified");

          return (
            <article className="market-home__provider-rail-card" key={`${variant}-${provider.id}`}>
              <div className="market-home__provider-rail-top">
                <span className="market-home__provider-avatar" aria-hidden="true">
                  {getProviderInitials(provider)}
                </span>
                <div className="market-home__provider-copy">
                  <strong>{provider.companyName}</strong>
                  <span>
                    {provider.primaryCategory
                      ? i18n.t(serviceCategoryLabelKeys[provider.primaryCategory])
                      : i18n.t("market.home.provider.landscaping_business")}
                  </span>
                </div>
              </div>
              <p className="market-home__provider-rating">★ {emphasisLine}</p>
              <p className="market-home__provider-location">
                {provider.city}, {provider.state}
              </p>
              <p className="market-home__provider-detail">{detailLine}</p>
              <p className="market-home__provider-availability">{availabilityLine}</p>
              <button className="button market-home__provider-cta" onClick={onCta} type="button">
                {i18n.t("market.home.provider.cta")}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const quickServiceChips: CustomerQuickServiceChip[] = [
  {
    label: "market.home.quick.lawn_mowing.label",
    service: "lawn-mowing",
    imageSrc: "/media/landscaping-tools/lawn-mower.png",
    description: "market.home.quick.lawn_mowing.description"
  },
  {
    label: "market.home.quick.mulch_refresh.label",
    service: "mulch-installation",
    imageSrc: "/media/landscaping-tools/mulch-refresh.png",
    description: "market.home.quick.mulch_refresh.description"
  },
  {
    label: "market.home.quick.gutter_cleaning.label",
    service: "gutter-cleaning",
    imageSrc: "/media/landscaping-tools/gutter-cleaning.png",
    description: "market.home.quick.gutter_cleaning.description"
  },
  {
    label: "market.home.quick.seasonal_cleanup.label",
    service: "seasonal-cleanup",
    imageSrc: "/media/landscaping-tools/leaf-blower.png",
    description: "market.home.quick.seasonal_cleanup.description"
  },
  {
    label: "market.home.quick.hedge_trimming.label",
    service: "hedge-trimming",
    imageSrc: "/media/landscaping-tools/hedge-trimmer.png",
    description: "market.home.quick.hedge_trimming.description"
  }
];

export function PublicCustomerMarketplacePage() {
  const i18n = useI18n();
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const homeTrustPages = useMemo(
    () => trustPolicyPages.filter((page) => page.surfaces.includes("home")),
    []
  );
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [areaQuery, setAreaQuery] = useState(launchAreaLabel);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>("tomorrow-morning");
  const [selectedAdditionalTimings, setSelectedAdditionalTimings] = useState<CustomerTimingPreference[]>([]);
  const [selectedCustomDate, setSelectedCustomDate] = useState(getDefaultCustomerCustomDateString());
  const [selectedCustomEndDate, setSelectedCustomEndDate] = useState(getDefaultCustomerCustomEndDateString());
  const [selectedCustomWindow, setSelectedCustomWindow] = useState<CustomerCustomTimingWindow>("morning");
  const [selectedCustomWindows, setSelectedCustomWindows] = useState<CustomerCustomTimingWindow[]>(["morning"]);
  const [overview, setOverview] = useState<PublicMarketplaceOverviewResponse | undefined>();

  useEffect(() => {
    api
      .getPublicMarketplaceOverview()
      .then(setOverview)
      .catch(() => setOverview(undefined));
  }, [api]);

  function handleSearch(
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined,
    timing: CustomerTimingPreference,
    customDate = selectedCustomDate,
    customWindow = selectedCustomWindow
  ) {
    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion,
      selectedTiming: timing,
      selectedCustomDate: customDate,
      selectedCustomEndDate,
      selectedCustomWindow: customWindow,
      selectedCustomWindows,
      selectedAdditionalTimings
    });

    router.push(addLocalePrefix(`/customer/listings?${params.toString()}`, i18n.locale));
  }

  function handleBrowseRecommendedProviders() {
    handleSearch(selectedService, selectedSuggestion, selectedTiming, selectedCustomDate, selectedCustomWindow);
  }

  const topRatedProviders = overview?.topRatedProviders ?? overview?.featuredProviders ?? [];
  const mostOnTimeProviders = overview?.mostOnTimeProviders ?? overview?.featuredProviders ?? [];
  const highlightedReviews = useMemo(() => {
    const reviews = overview?.highlightedReviews ?? [];
    const categoryMatches = reviews.filter((review) => review.primaryCategory === selectedService);
    const selected = categoryMatches.length > 0 ? categoryMatches : reviews;
    return selected.slice(0, 2);
  }, [overview, selectedService]);
  const highlightedCoverageAreas = useMemo(() => {
    const areas = overview?.coverageAreas ?? [];
    const categoryMatches = areas.filter((area) => area.supportedCategories.includes(selectedService));
    const selected = categoryMatches.length > 0 ? categoryMatches : areas;
    return selected.slice(0, 3);
  }, [overview, selectedService]);
  const proofStats = [
    {
      labelKey: "market.home.proof.verified_providers.label",
      value: overview?.verifiedProviderCount ? String(overview.verifiedProviderCount) : i18n.t("common.state.growing")
    },
    {
      labelKey: "market.home.proof.average_rating.label",
      value: overview?.averageRating ? `${overview.averageRating.toFixed(1)}★` : i18n.t("common.state.new")
    },
    {
      labelKey: "market.home.proof.active_categories.label",
      value: overview?.activeCategoryCount ? String(overview.activeCategoryCount) : i18n.t("market.home.proof.active_categories.value")
    }
  ] as const;

  return (
    <main className="market-home">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "YardMatch",
          description: i18n.t("structured.home.description"),
          potentialAction: {
            "@type": "SearchAction",
            target: buildSiteUrl(addLocalePrefix("/customer?query={search_term_string}", i18n.locale)),
            "query-input": i18n.t("structured.home.query_input")
          }
        }}
      />

      <section className="container hero home-hero customer-public-hero">
        <div className="home-hero__content">
          <div className="home-hero__header">
            <span className="eyebrow">{i18n.t("market.home.eyebrow", { area: launchAreaLabel })}</span>
            <h1 className="home-hero__headline">{i18n.t("market.home.headline")}</h1>
          </div>
          <PublicMarketplaceSearchShell
            areaQuery={areaQuery}
            onAreaQueryChange={setAreaQuery}
            onSearch={handleSearch}
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
          <div className="home-hero__trust-strip" aria-label={i18n.t("market.home.request_basics_aria")}>
            <span>{i18n.t("common.state.verified_local_providers")}</span>
            <span>{i18n.t("common.state.request_first")}</span>
            <span>{i18n.t("common.state.pay_after_confirmation")}</span>
          </div>
          <div className="cta-row">
            <a className="button-secondary" href={addLocalePrefix("/provider", i18n.locale)}>
              {i18n.t("market.home.business_cta")}
            </a>
            <a className="button-secondary" href={addLocalePrefix("/auth/crew", i18n.locale)}>
              {i18n.t("market.home.crew_cta")}
            </a>
          </div>
        </div>
      </section>

      {topRatedProviders.length ? (
        <MarketplaceProviderRail
          ctaLabel={i18n.t("market.home.provider.see_all")}
          description={i18n.t("market.home.provider.top_rated.body")}
          onCta={handleBrowseRecommendedProviders}
          providers={topRatedProviders}
          title={i18n.t("market.home.provider.top_rated.title")}
          variant="top-rated"
        />
      ) : null}

      {mostOnTimeProviders.length ? (
        <MarketplaceProviderRail
          ctaLabel={i18n.t("market.home.provider.see_all")}
          description={i18n.t("market.home.provider.most_on_time.body")}
          onCta={handleBrowseRecommendedProviders}
          providers={mostOnTimeProviders}
          title={i18n.t("market.home.provider.most_on_time.title")}
          variant="most-on-time"
        />
      ) : null}

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.works.title")}</h2>
          <p>{i18n.t("market.home.works.body")}</p>
        </div>
        <div className="grid-three market-home__steps">
          <article className="card market-home__step">
            <strong>{i18n.t("market.home.works.job.title")}</strong>
            <p>{i18n.t("market.home.works.job.body")}</p>
          </article>
          <article className="card market-home__step">
            <strong>{i18n.t("market.home.works.review.title")}</strong>
            <p>{i18n.t("market.home.works.review.body")}</p>
          </article>
          <article className="card market-home__step">
            <strong>{i18n.t("market.home.works.request.title")}</strong>
            <p>{i18n.t("market.home.works.request.body")}</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.proof.section_title")}</h2>
          <p>{i18n.t("market.home.proof.section_body")}</p>
        </div>
        <div className="grid-three">
          {proofStats.map((item) => (
            <article className="card" key={item.labelKey}>
              <strong>{item.value}</strong>
              <p>{i18n.t(item.labelKey)}</p>
            </article>
          ))}
        </div>
        <div className="grid-two">
          <article className="card">
            <h3>{i18n.t("market.home.proof.supply.title")}</h3>
            <p>{i18n.t("market.home.proof.supply.body")}</p>
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <Link className="button-secondary" href={addLocalePrefix("/provider-verification", i18n.locale)}>
                {i18n.t("market.home.proof.supply.cta")}
              </Link>
            </div>
          </article>
          <article className="card">
            <h3>{i18n.t("market.home.proof.radius.title")}</h3>
            <p>{i18n.t("market.home.proof.radius.body")}</p>
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <Link className="button-secondary" href={addLocalePrefix("/barnegat-nj", i18n.locale)}>
                {i18n.t("market.home.proof.radius.cta")}
              </Link>
            </div>
          </article>
        </div>
        {highlightedReviews.length > 0 ? (
          <article className="card">
            <h3>{i18n.t("market.home.proof.reviews.title")}</h3>
            <p>{i18n.t("market.home.proof.reviews.body")}</p>
            <div className="grid-two" style={{ marginTop: "1rem" }}>
              {highlightedReviews.map((review) => (
                <article className="list-panel" key={review.reviewId}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{review.providerCompanyName}</strong>
                      <p>
                        {review.city}, {review.state}
                        {review.primaryCategory
                          ? ` • ${i18n.t(serviceCategoryLabelKeys[review.primaryCategory])}`
                          : ""}
                      </p>
                    </div>
                    <span>{review.overallRating.toFixed(1)}★</span>
                  </div>
                  <p>"{formatHighlightedReviewText(review)}"</p>
                </article>
              ))}
            </div>
          </article>
        ) : null}
        {showCoveragePockets && highlightedCoverageAreas.length > 0 ? (
          <article className="card">
            <h3>{i18n.t("market.home.proof.coverage_pockets.title")}</h3>
            <p>{i18n.t("market.home.proof.coverage_pockets.body")}</p>
            <div className="grid-three" style={{ marginTop: "1rem" }}>
              {highlightedCoverageAreas.map((area) => (
                <article className="list-panel" key={`${area.city}-${area.state}`}>
                  <strong>{formatCoverageAreaLabel(area)}</strong>
                  <p>{i18n.t("market.home.proof.verified_provider_count", { count: area.verifiedProviderCount })}</p>
                  <p>
                    {i18n.t("market.home.proof.completed_jobs", { count: area.completedBookingCount })}
                    {area.recentCompletedBookingCount > 0
                      ? ` • ${i18n.t("market.home.proof.recent", { count: area.recentCompletedBookingCount })}`
                      : ""}
                  </p>
                  <p>
                    {area.supportedCategories
                      .slice(0, 3)
                      .map((category) => i18n.t(serviceCategoryLabelKeys[category]))
                      .join(" • ")}
                  </p>
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.support.title")}</h2>
          <p>{i18n.t("market.home.support.body")}</p>
        </div>
        <div className="grid-two">
          {homeTrustPages.map((page) => {
            const localizedPage = localizeTrustPolicyPage(i18n, page);

            return (
              <Link className="list-panel" href={addLocalePrefix(localizedPage.href, i18n.locale)} key={localizedPage.id}>
                <span className="eyebrow">{localizedPage.eyebrow}</span>
                <h3>{localizedPage.title}</h3>
                <p>{localizedPage.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container stack-lg">
        <LaunchLeadCaptureCard
          defaultAreaLabel={areaQuery}
          defaultServiceCategory={selectedService}
          description={i18n.t("market.home.lead.description")}
          requestSource="public-homepage-lead-form"
          title={i18n.t("market.home.lead.title")}
        />
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.popular.title")}</h2>
          <p>{i18n.t("market.home.popular.body")}</p>
        </div>
        <div className="service-tile-grid">
          {quickServiceChips.map((item) => (
            <button
              className="service-tile-card"
              key={item.service}
              onClick={() =>
                handleSearch(item.service, selectedSuggestion, selectedTiming, selectedCustomDate, selectedCustomWindow)
              }
              type="button"
            >
              <span className="service-tile-card__image-wrap" aria-hidden="true">
                <img
                  alt=""
                  className="service-tile-card__image"
                  height={128}
                  src={item.imageSrc}
                  width={128}
                />
              </span>
              <strong>{i18n.t(item.label as TranslationKey)}</strong>
              <span>{i18n.t(item.description as TranslationKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.equation.title")}</h2>
          <p>{i18n.t("market.home.equation.body")}</p>
        </div>
        <div className="grid-three">
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.equation.customer.title")}</span>
            <p>{i18n.t("market.home.equation.customer.body")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.equation.business.title")}</span>
            <p>{i18n.t("market.home.equation.business.body")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.equation.crew.title")}</span>
            <p>{i18n.t("market.home.equation.crew.body")}</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>{i18n.t("market.home.faq.title")}</h2>
        </div>
        <div className="grid-three">
          {faqItems.map((item) => (
            <article className="faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
