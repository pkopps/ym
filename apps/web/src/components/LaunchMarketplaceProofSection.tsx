"use client";

import {
  PublicMarketplaceCoverageArea,
  PublicMarketplaceFeaturedProvider,
  PublicMarketplaceHighlightedReview,
  PublicMarketplaceOverviewResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createWebApiClient } from "../lib/api";
import { serviceCategoryLabels } from "@yardmatch/ui";

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

function parsePreferredAreaLabel(areaLabel?: string) {
  if (!areaLabel) {
    return undefined;
  }

  const [rawCity, rawState] = areaLabel.split(",").map((value) => value?.trim()).filter(Boolean);
  return {
    city: rawCity?.toLowerCase(),
    state: rawState?.toLowerCase()
  };
}

export function LaunchMarketplaceProofSection({
  title,
  description,
  preferredCategory,
  preferredAreaLabel
}: {
  title: string;
  description: string;
  preferredCategory?: ServiceCategory;
  preferredAreaLabel?: string;
}) {
  const api = useMemo(() => createWebApiClient(), []);
  const [overview, setOverview] = useState<PublicMarketplaceOverviewResponse | undefined>();

  useEffect(() => {
    api
      .getPublicMarketplaceOverview()
      .then(setOverview)
      .catch(() => setOverview(undefined));
  }, [api]);

  const highlightedProviders = useMemo(() => {
    const providers = overview?.topRatedProviders ?? overview?.featuredProviders ?? [];
    const categoryMatches = preferredCategory
      ? providers.filter((provider) => provider.primaryCategory === preferredCategory)
      : [];
    const selected = categoryMatches.length > 0 ? categoryMatches : providers;
    return selected.slice(0, 3);
  }, [overview, preferredCategory]);

  const highlightedReviews = useMemo(() => {
    const reviews = overview?.highlightedReviews ?? [];
    const categoryMatches = preferredCategory
      ? reviews.filter((review) => review.primaryCategory === preferredCategory)
      : [];
    const selected = categoryMatches.length > 0 ? categoryMatches : reviews;
    return selected.slice(0, 2);
  }, [overview, preferredCategory]);

  const highlightedCoverageAreas = useMemo(() => {
    const areaPreference = parsePreferredAreaLabel(preferredAreaLabel);
    const areas = overview?.coverageAreas ?? [];
    const categoryMatches = preferredCategory
      ? areas.filter((area) => area.supportedCategories.includes(preferredCategory))
      : areas;
    const areaMatches = areaPreference?.city
      ? categoryMatches.filter((area) => {
          const cityMatches = area.city.toLowerCase() === areaPreference.city;
          const stateMatches = areaPreference.state
            ? area.state.toLowerCase() === areaPreference.state
            : true;
          return cityMatches && stateMatches;
        })
      : categoryMatches;
    const selected = areaPreference?.city ? areaMatches : areaMatches.length > 0 ? areaMatches : categoryMatches;
    return selected.slice(0, 3);
  }, [overview, preferredAreaLabel, preferredCategory]);

  const proofStats = [
    {
      label: "Verified providers currently surfaced",
      value: overview?.verifiedProviderCount ? String(overview.verifiedProviderCount) : "Growing"
    },
    {
      label: "Average rating across verified providers",
      value: overview?.averageRating ? `${overview.averageRating.toFixed(1)}★` : "New"
    },
    {
      label: "Active launch-service categories",
      value: overview?.activeCategoryCount ? String(overview.activeCategoryCount) : "Focused"
    }
  ] as const;

  return (
    <section className="stack-lg">
      <div className="section-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="grid-three">
        {proofStats.map((item) => (
          <article className="card" key={item.label}>
            <strong>{item.value}</strong>
            <p>{item.label}</p>
          </article>
        ))}
      </div>
      <div className="grid-two">
        <article className="card">
          <h3>Why YardMatch keeps this tight</h3>
          <p>
            The launch marketplace is trying to prioritize verified local supply, route reality,
            and operational follow-through over broad but thin directory coverage.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href="/provider-verification">
              See provider verification
            </Link>
            <Link className="button-secondary" href="/booking-expectations">
              Read booking expectations
            </Link>
          </div>
        </article>
        <article className="card">
          <h3>Current launch proof</h3>
          {highlightedProviders.length > 0 ? (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {highlightedProviders.map((provider) => (
                <article className="list-panel" key={provider.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div className="cta-row" style={{ alignItems: "center" }}>
                      <span className="market-home__provider-avatar" aria-hidden="true">
                        {getProviderInitials(provider)}
                      </span>
                      <div>
                        <strong>{provider.companyName}</strong>
                        <p>
                          {provider.city}, {provider.state}
                          {provider.primaryCategory
                            ? ` • ${serviceCategoryLabels[provider.primaryCategory]}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span>{provider.rating.toFixed(1)}★</span>
                  </div>
                  <p>
                    {provider.reviewCount} reviews
                    {provider.timelinessRating ? ` • ${provider.timelinessRating.toFixed(1)} punctuality` : ""}
                    {provider.yearsExperience ? ` • ${provider.yearsExperience}+ years experience` : ""}
                  </p>
                </article>
              ))}
              {highlightedReviews.length > 0 ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  <div>
                    <span className="eyebrow">Recent verified customer feedback</span>
                    <p>These snippets come from completed-booking reviews tied to verified providers.</p>
                  </div>
                  {highlightedReviews.map((review) => (
                    <article className="list-panel" key={review.reviewId}>
                      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{review.providerCompanyName}</strong>
                          <p>
                            {review.city}, {review.state}
                            {review.primaryCategory
                              ? ` • ${serviceCategoryLabels[review.primaryCategory]}`
                              : ""}
                          </p>
                        </div>
                        <span>{review.overallRating.toFixed(1)}★</span>
                      </div>
                      <p>"{formatHighlightedReviewText(review)}"</p>
                    </article>
                  ))}
                </div>
              ) : null}
              {highlightedCoverageAreas.length > 0 ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  <div>
                    <span className="eyebrow">Current coverage pockets</span>
                    <p>These areas already have verified supply or completed-job proof in the live marketplace overview.</p>
                  </div>
                  {highlightedCoverageAreas.map((area) => (
                    <article className="list-panel" key={`${area.city}-${area.state}`}>
                      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{formatCoverageAreaLabel(area)}</strong>
                        <span>{area.verifiedProviderCount} verified</span>
                      </div>
                      <p>
                        {area.completedBookingCount} completed jobs tracked
                        {area.recentCompletedBookingCount > 0
                          ? ` • ${area.recentCompletedBookingCount} recent completions`
                          : ""}
                      </p>
                      <p>
                        {area.supportedCategories
                          .slice(0, 3)
                          .map((category) => serviceCategoryLabels[category])
                          .join(" • ")}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p>
              Launch proof is still building. YardMatch is intentionally keeping the public supply
              set tighter while verified providers, reviews, and punctuality history grow.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
