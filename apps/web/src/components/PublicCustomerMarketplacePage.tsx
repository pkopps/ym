"use client";

import {
  PlaceSuggestion,
  PublicMarketplaceFeaturedProvider,
  PublicMarketplaceOverviewResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { faqItems, serviceCategoryLabels } from "@yardmatch/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { HomeServiceScroller } from "./HomeServiceScroller";
import {
  CustomerQuickServiceChip,
  CustomerTimingPreference,
  buildCustomerListingsSearchParams,
  PublicMarketplaceSearchShell
} from "./PublicMarketplaceSearchShell";
import { createWebApiClient } from "../lib/api";
import { StructuredData } from "./StructuredData";

const rotatingServices = ["lawn mowing", "cleanup", "hedge trimming", "mulch refresh"] as const;

function getProviderInitials(provider: PublicMarketplaceFeaturedProvider) {
  return provider.companyName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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
              ? `${displayRating.toFixed(1)} overall • ${provider.reviewCount} reviews`
              : `${displayTimeliness.toFixed(1)} punctuality • ${provider.reviewCount} reviews`;
          const detailLine =
            variant === "top-rated"
              ? provider.yearsExperience
                ? `${provider.yearsExperience}+ years of repeat local work`
                : "Verified local provider with active customer reviews"
              : provider.serviceRadiusMiles
                ? `${provider.serviceRadiusMiles}-mile route with strong on-time history`
                : "Verified local provider with steady arrival history";
          const availabilityLine = provider.ownerName
            ? `Owned by ${provider.ownerName} • Verified local coverage`
            : "Verified local coverage";

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
                      ? serviceCategoryLabels[provider.primaryCategory]
                      : "Landscaping business"}
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
                Find my match
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
    label: "Lawn mowing",
    service: "lawn-mowing",
    imageSrc: "/media/landscaping-tools/lawn-mower.png",
    description: "Routine weekly or biweekly cuts"
  },
  {
    label: "Mulch refresh",
    service: "mulch-installation",
    imageSrc: "/media/landscaping-tools/mulch-refresh.png",
    description: "Freshen beds and sharpen edges"
  },
  {
    label: "Gutter cleaning",
    service: "gutter-cleaning",
    imageSrc: "/media/landscaping-tools/gutter-cleaning.png",
    description: "Clear overflow before it backs up"
  },
  {
    label: "Seasonal cleanup",
    service: "seasonal-cleanup",
    imageSrc: "/media/landscaping-tools/leaf-blower.png",
    description: "Leaves, debris, and reset work"
  },
  {
    label: "Hedge trimming",
    service: "hedge-trimming",
    imageSrc: "/media/landscaping-tools/hedge-trimmer.png",
    description: "Shape shrubs and tidy lines"
  }
];

export function PublicCustomerMarketplacePage() {
  const router = useRouter();
  const api = useMemo(() => createWebApiClient(), []);
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [areaQuery, setAreaQuery] = useState("Brooklyn, NY");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>("tomorrow-morning");
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
    timing: CustomerTimingPreference
  ) {
    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion,
      selectedTiming: timing
    });

    router.push(`/customer/listings?${params.toString()}`);
  }

  function handleBrowseRecommendedProviders() {
    handleSearch(selectedService, selectedSuggestion, selectedTiming);
  }

  const topRatedProviders = overview?.topRatedProviders ?? overview?.featuredProviders ?? [];
  const mostOnTimeProviders = overview?.mostOnTimeProviders ?? overview?.featuredProviders ?? [];

  return (
    <main className="market-home">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "YardMatch",
          description:
            "Marketplace for lawn care bookings, landscaping business operations, and crew-member staffing.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://yardmatch.example/customer?query={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />

      <section className="container hero home-hero customer-public-hero">
        <div className="home-hero__content">
          <h1 className="home-hero__headline">
            <span>Tell us what needs care.</span>
            <span className="home-hero__headline-accent">
              We’ll match the best local fit for <HomeServiceScroller services={rotatingServices} />.
            </span>
          </h1>
          <PublicMarketplaceSearchShell
            areaQuery={areaQuery}
            onAreaQueryChange={setAreaQuery}
            onSearch={handleSearch}
            onSelectedServiceChange={setSelectedService}
            onSelectedSuggestionChange={setSelectedSuggestion}
            onSelectedTimingChange={setSelectedTiming}
            selectedService={selectedService}
            selectedSuggestion={selectedSuggestion}
            selectedTiming={selectedTiming}
          />
          <div className="cta-row">
            <a className="button-secondary" href="/auth/provider">
              I run a landscaping business
            </a>
            <a className="button-secondary" href="/auth/crew">
              I want crew work
            </a>
          </div>
        </div>
      </section>

      {topRatedProviders.length ? (
        <MarketplaceProviderRail
          ctaLabel="See all matches"
          description="Highly reviewed local providers customers keep choosing again."
          onCta={handleBrowseRecommendedProviders}
          providers={topRatedProviders}
          title="Top-rated providers"
          variant="top-rated"
        />
      ) : null}

      {mostOnTimeProviders.length ? (
        <MarketplaceProviderRail
          ctaLabel="See all matches"
          description="Providers with the strongest punctuality track record in the live marketplace."
          onCta={handleBrowseRecommendedProviders}
          providers={mostOnTimeProviders}
          title="Most on-time providers"
          variant="most-on-time"
        />
      ) : null}

      <section className="container stack-lg">
        <div className="section-header">
          <h2>How GreenRain works</h2>
          <p>Three quick steps. No directory rabbit hole.</p>
        </div>
        <div className="grid-three market-home__steps">
          <article className="card market-home__step">
            <strong>1. Tell us the job</strong>
            <p>Pick the service, when you want it, and where it needs to happen.</p>
          </article>
          <article className="card market-home__step">
            <strong>2. Review the best fit</strong>
            <p>See one recommended provider first, plus why they were picked.</p>
          </article>
          <article className="card market-home__step">
            <strong>3. Book and track</strong>
            <p>Hold the route window, pay in one flow, and track arrival without chasing texts.</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Popular Services</h2>
          <p>Choose the type of work first and jump straight into matching.</p>
        </div>
        <div className="service-tile-grid">
          {quickServiceChips.map((item) => (
            <button
              className="service-tile-card"
              key={item.service}
              onClick={() => handleSearch(item.service, selectedSuggestion, selectedTiming)}
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
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Built for every side of the work</h2>
          <p>One system for homeowners, businesses, and crews.</p>
        </div>
        <div className="grid-three">
          <article className="card">
            <span className="eyebrow">Customers</span>
            <p>Get matched fast, keep recurring care simple, and track the route when someone is on the way.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Business owners</span>
            <p>Run bookings, crews, payouts, and dispatch decisions in one management flow.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Crew members</span>
            <p>See assignments, directions, availability, and payout status in one place.</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Frequently asked questions</h2>
          <p>Short answers before you book.</p>
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
