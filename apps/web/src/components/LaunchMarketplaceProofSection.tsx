"use client";

import {
  PublicMarketplaceCoverageArea,
  PublicMarketplaceFeaturedProvider,
  PublicMarketplaceHighlightedReview,
  PublicMarketplaceOverviewResponse,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createWebApiClient } from "../lib/api";

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
  const i18n = useI18n();
  const api = useMemo(() => createWebApiClient(), []);
  const [overview, setOverview] = useState<PublicMarketplaceOverviewResponse | undefined>();

  useEffect(() => {
    api
      .getPublicMarketplaceOverview()
      .then(setOverview)
      .catch(() => setOverview(undefined));
  }, [api]);

  const highlightedProviders = useMemo(() => {
    const areaPreference = parsePreferredAreaLabel(preferredAreaLabel);
    const providers = overview?.topRatedProviders ?? overview?.featuredProviders ?? [];
    const areaMatches = areaPreference?.city
      ? providers.filter((provider) => {
          const cityMatches = provider.city.toLowerCase() === areaPreference.city;
          const stateMatches = areaPreference.state
            ? provider.state.toLowerCase() === areaPreference.state
            : true;
          return cityMatches && stateMatches;
        })
      : providers;
    const categoryMatches = preferredCategory
      ? areaMatches.filter((provider) => provider.primaryCategory === preferredCategory)
      : [];
    const selected = categoryMatches.length > 0 ? categoryMatches : areaMatches;
    return selected.slice(0, 3);
  }, [overview, preferredAreaLabel, preferredCategory]);

  const highlightedReviews = useMemo(() => {
    const areaPreference = parsePreferredAreaLabel(preferredAreaLabel);
    const reviews = (overview?.highlightedReviews ?? []).filter((review) => {
      if (!areaPreference?.city) {
        return true;
      }
      const cityMatches = review.city.toLowerCase() === areaPreference.city;
      const stateMatches = areaPreference.state
        ? review.state.toLowerCase() === areaPreference.state
        : true;
      return cityMatches && stateMatches;
    });
    const categoryMatches = preferredCategory
      ? reviews.filter((review) => review.primaryCategory === preferredCategory)
      : [];
    const selected = categoryMatches.length > 0 ? categoryMatches : reviews;
    return selected.slice(0, 2);
  }, [overview, preferredAreaLabel, preferredCategory]);

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

  const localCoverageArea = highlightedCoverageAreas[0];
  const averageRating = highlightedProviders.length
    ? highlightedProviders.reduce((total, provider) => total + provider.rating, 0) / highlightedProviders.length
    : undefined;
  const hasLocalProof =
    highlightedProviders.length > 0 ||
    highlightedReviews.length > 0 ||
    Boolean(localCoverageArea?.verifiedProviderCount);
  const proofStats = hasLocalProof ? [
    {
      label: i18n.t("launch_proof.stat.verified_providers.label"),
      value: i18n.formatNumber(localCoverageArea?.verifiedProviderCount ?? highlightedProviders.length)
    },
    {
      label: i18n.t("launch_proof.stat.average_rating.label"),
      value: averageRating ? `${i18n.formatNumber(averageRating, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}★` : i18n.t("common.state.new")
    },
    {
      label: i18n.t("launch_proof.stat.active_categories.label"),
      value: localCoverageArea?.supportedCategories.length
        ? i18n.formatNumber(localCoverageArea.supportedCategories.length)
        : i18n.t("common.state.focused")
    }
  ] as const : [
    {
      label: i18n.t("launch_proof.opening.market_label"),
      value: preferredAreaLabel ?? i18n.t("common.state.focused")
    },
    {
      label: i18n.t("launch_proof.opening.supply_label"),
      value: i18n.t("launch_proof.opening.supply_value")
    },
    {
      label: i18n.t("launch_proof.opening.expansion_label"),
      value: i18n.t("launch_proof.opening.expansion_value")
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
          <h3>{i18n.t("launch_proof.tight.title")}</h3>
          <p>{i18n.t("launch_proof.tight.body")}</p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href={addLocalePrefix("/provider-verification", i18n.locale)}>
              {i18n.t("launch_proof.tight.provider_verification_cta")}
            </Link>
            <Link className="button-secondary" href={addLocalePrefix("/booking-expectations", i18n.locale)}>
              {i18n.t("launch_proof.tight.booking_expectations_cta")}
            </Link>
          </div>
        </article>
        <article className="card">
          <h3>{i18n.t("launch_proof.current.title")}</h3>
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
                            ? ` • ${i18n.t(serviceCategoryToI18nKey(provider.primaryCategory))}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span>{i18n.formatNumber(provider.rating, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}★</span>
                  </div>
                  <p>
                    {i18n.t("launch_proof.provider.reviews", { count: provider.reviewCount })}
                    {provider.timelinessRating
                      ? ` • ${i18n.t("launch_proof.provider.punctuality", {
                          rating: provider.timelinessRating
                        })}`
                      : ""}
                    {provider.yearsExperience
                      ? ` • ${i18n.t("launch_proof.provider.experience", { years: provider.yearsExperience })}`
                      : ""}
                  </p>
                </article>
              ))}
              {highlightedReviews.length > 0 ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  <div>
                    <span className="eyebrow">{i18n.t("launch_proof.feedback.title")}</span>
                    <p>{i18n.t("launch_proof.feedback.body")}</p>
                  </div>
                  {highlightedReviews.map((review) => (
                    <article className="list-panel" key={review.reviewId}>
                      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{review.providerCompanyName}</strong>
                          <p>
                            {review.city}, {review.state}
                            {review.primaryCategory
                              ? ` • ${i18n.t(serviceCategoryToI18nKey(review.primaryCategory))}`
                              : ""}
                          </p>
                        </div>
                        <span>{i18n.formatNumber(review.overallRating, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}★</span>
                      </div>
                      <p>"{formatHighlightedReviewText(review)}"</p>
                    </article>
                  ))}
                </div>
              ) : null}
              {highlightedCoverageAreas.length > 0 ? (
                <div className="stack-lg" style={{ paddingBottom: 0 }}>
                  <div>
                    <span className="eyebrow">{i18n.t("launch_proof.coverage.title")}</span>
                    <p>{i18n.t("launch_proof.coverage.body")}</p>
                  </div>
                  {highlightedCoverageAreas.map((area) => (
                    <article className="list-panel" key={`${area.city}-${area.state}`}>
                      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{formatCoverageAreaLabel(area)}</strong>
                        <span>{i18n.t("launch_proof.coverage.verified", { count: area.verifiedProviderCount })}</span>
                      </div>
                      <p>
                        {i18n.t("launch_proof.coverage.completed", { count: area.completedBookingCount })}
                        {area.recentCompletedBookingCount > 0
                          ? ` • ${i18n.t("launch_proof.coverage.recent", {
                              count: area.recentCompletedBookingCount
                            })}`
                          : ""}
                      </p>
                      <p>
                        {area.supportedCategories
                          .slice(0, 3)
                          .map((category) => i18n.t(serviceCategoryToI18nKey(category)))
                          .join(" • ")}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p>{i18n.t("launch_proof.empty")}</p>
          )}
        </article>
      </div>
    </section>
  );
}
