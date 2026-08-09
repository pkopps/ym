"use client";

import Link from "next/link";
import {
  PlaceSuggestion,
  PublicMarketplaceHighlightedReview,
  PublicMarketplaceOverviewResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { faqItems } from "@yardmatch/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

function formatHighlightedReviewText(review: PublicMarketplaceHighlightedReview, maxLength = 160) {
  const normalized = review.reviewText.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

const [launchCity = "Barnegat", launchState = "NJ"] = launchAreaLabel.split(",").map((value) => value.trim());

function isInLaunchArea(city: string, state: string) {
  return city.trim().toLowerCase() === launchCity.toLowerCase() && state.trim().toLowerCase() === launchState.toLowerCase();
}

const quickServiceChips: CustomerQuickServiceChip[] = [
  {
    label: "market.home.quick.lawn_mowing.label",
    service: "lawn-mowing",
    imageSrc: "/media/landscaping-tools/lawn-mower.png",
    description: "market.home.quick.lawn_mowing.description"
  },
  {
    label: "market.home.quick.seasonal_cleanup.label",
    service: "seasonal-cleanup",
    imageSrc: "/media/landscaping-tools/leaf-blower.png",
    description: "market.home.quick.seasonal_cleanup.description"
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

  const launchProviders = useMemo(
    () =>
      (overview?.featuredProviders ?? []).filter((provider) =>
        isInLaunchArea(provider.city, provider.state)
      ),
    [overview]
  );
  const launchCoverageArea = useMemo(
    () => overview?.coverageAreas.find((area) => isInLaunchArea(area.city, area.state)),
    [overview]
  );
  const highlightedReviews = useMemo(() => {
    const reviews = (overview?.highlightedReviews ?? []).filter((review) =>
      isInLaunchArea(review.city, review.state)
    );
    const categoryMatches = reviews.filter((review) => review.primaryCategory === selectedService);
    return (categoryMatches.length > 0 ? categoryMatches : reviews).slice(0, 2);
  }, [overview, selectedService]);
  const beforeAfterProjects = useMemo(() => {
    const projects = (overview?.beforeAfterProjects ?? []).filter((project) =>
      isInLaunchArea(project.city, project.state)
    );
    const categoryMatches = projects.filter((project) => project.category === selectedService);
    return (categoryMatches.length > 0 ? categoryMatches : projects).slice(0, 3);
  }, [overview, selectedService]);
  const averageLaunchRating = launchProviders.length
    ? launchProviders.reduce((total, provider) => total + provider.rating, 0) / launchProviders.length
    : undefined;
  const hasLaunchProof = launchProviders.length > 0 || Boolean(launchCoverageArea?.verifiedProviderCount);
  const proofStats = [
    {
      labelKey: "market.home.proof.verified_providers.label",
      value: String(launchCoverageArea?.verifiedProviderCount ?? launchProviders.length)
    },
    {
      labelKey: "market.home.proof.average_rating.label",
      value: averageLaunchRating ? `${averageLaunchRating.toFixed(1)}★` : i18n.t("common.state.new")
    },
    {
      labelKey: "market.home.proof.active_categories.label",
      value: launchCoverageArea?.supportedCategories.length
        ? String(launchCoverageArea.supportedCategories.length)
        : i18n.t("market.home.proof.active_categories.value")
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
            <span>{i18n.t("market.home.trust.reviewed_before_launch")}</span>
            <span>{i18n.t("common.state.request_first")}</span>
            <span>{i18n.t("common.state.pay_after_confirmation")}</span>
          </div>
        </div>
      </section>

      <section className="container stack-lg market-home__expansion">
        <div className="section-header">
          <h2>{i18n.t("market.home.expansion.title")}</h2>
          <p>{i18n.t("market.home.expansion.body")}</p>
        </div>
        <div className="grid-three">
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.expansion.now.eyebrow")}</span>
            <h3>{launchAreaLabel}</h3>
            <p>{i18n.t("market.home.expansion.now.body")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.expansion.next.eyebrow")}</span>
            <h3>{i18n.t("market.home.expansion.next.title")}</h3>
            <p>{i18n.t("market.home.expansion.next.body")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{i18n.t("market.home.expansion.your_town.eyebrow")}</span>
            <h3>{i18n.t("market.home.expansion.your_town.title")}</h3>
            <p>{i18n.t("market.home.expansion.your_town.body")}</p>
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <a className="button-secondary" href="#coverage-request">
                {i18n.t("market.home.expansion.your_town.cta")}
              </a>
            </div>
          </article>
        </div>
      </section>

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
        {hasLaunchProof ? (
          <div className="grid-three">
            {proofStats.map((item) => (
              <article className="card" key={item.labelKey}>
                <strong>{item.value}</strong>
                <p>{i18n.t(item.labelKey)}</p>
              </article>
            ))}
          </div>
        ) : (
          <article className="card market-home__launch-empty">
            <span className="eyebrow">{launchAreaLabel}</span>
            <h3>{i18n.t("market.home.proof.opening.title")}</h3>
            <p>{i18n.t("market.home.proof.opening.body")}</p>
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <a className="button-secondary" href="#coverage-request">
                {i18n.t("market.home.proof.opening.cta")}
              </a>
            </div>
          </article>
        )}
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
        {beforeAfterProjects.length > 0 ? (
          <article className="card">
            <h3>{i18n.t("market.home.proof.before_after.title")}</h3>
            <p>{i18n.t("market.home.proof.before_after.body")}</p>
            <div className="marketing-project-grid">
              {beforeAfterProjects.map((project) => (
                <article className="marketing-project" key={project.bookingId}>
                  <div className="marketing-project__images">
                    <figure>
                      <img alt={i18n.t("market.home.proof.before_after.before_alt")} src={project.beforeImageDataUrl} />
                      <figcaption>{i18n.t("customer_history.photos.before")}</figcaption>
                    </figure>
                    <figure>
                      <img alt={i18n.t("market.home.proof.before_after.after_alt")} src={project.afterImageDataUrl} />
                      <figcaption>{i18n.t("customer_history.photos.after")}</figcaption>
                    </figure>
                  </div>
                  <div className="marketing-project__copy">
                    <strong>{project.providerCompanyName}</strong>
                    <p>
                      {i18n.t(serviceCategoryLabelKeys[project.category])} • {project.city}, {project.state}
                    </p>
                    <small>{i18n.t("market.home.proof.before_after.consent_note")}</small>
                  </div>
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

      <section className="container stack-lg" id="coverage-request">
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
