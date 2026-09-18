"use client";

import Link from "next/link";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import type { LaunchLandingServiceKey } from "../lib/launchLandingContent";
import { LaunchLeadCaptureCard } from "./LaunchLeadCaptureCard";
import { LaunchMarketplaceProofSection } from "./LaunchMarketplaceProofSection";
import {
  launchAreaLabel,
  launchAreaShortLabel,
  launchServiceContent
} from "../lib/launchLandingContent";

export function LaunchServiceLandingPage({
  serviceKey,
  variant
}: {
  serviceKey: LaunchLandingServiceKey;
  variant: "service" | "town-service";
}) {
  const i18n = useI18n();
  const service = launchServiceContent[serviceKey];
  const serviceName = i18n.t(service.nameKey);
  const shortServiceName = i18n.t(service.shortNameKey);
  const values = {
    area: launchAreaLabel,
    service: serviceName,
    shortArea: launchAreaShortLabel,
    shortService: shortServiceName
  };
  const pageTitle = i18n.t(
    variant === "town-service" ? "launch_service.title.town_service" : "launch_service.title.service",
    values
  );
  const eyebrow = i18n.t(
    variant === "town-service" ? "launch_service.eyebrow.town_service" : "launch_service.eyebrow.service",
    values
  );
  const summary =
    variant === "town-service"
      ? i18n.t(service.metadataDescriptionKey, values)
      : i18n.t(service.serviceMetadataDescriptionKey, values);
  const preferredCategory = service.category;
  const ctaHref = addLocalePrefix(
    `/customer?service=${service.key}&area=${encodeURIComponent(launchAreaLabel)}`,
    i18n.locale
  );
  const counterpartHref = addLocalePrefix(variant === "town-service" ? service.path : service.townPath, i18n.locale);
  const counterpartLabel =
    variant === "town-service"
      ? i18n.t("launch_service.cta.general_page", values)
      : i18n.t("launch_service.cta.town_page", values);

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{pageTitle}</h1>
        <p>{summary}</p>
        <div className="cta-row">
          <Link className="button" href={ctaHref}>
            {i18n.t("launch_service.cta.book", values)}
          </Link>
          <Link className="button-secondary" href={counterpartHref}>
            {counterpartLabel}
          </Link>
        </div>
      </section>

      {variant === "town-service" ? (
        <section className="grid-two">
          <article className="card">
            <h2>{i18n.t("launch_service.local.planning_title", values)}</h2>
            <p>{i18n.t(service.localPlanningKey, values)}</p>
            <p>{i18n.t("launch_service.local.access", values)}</p>
          </article>
          <article className="card">
            <h2>{i18n.t("launch_service.local.coverage_title", values)}</h2>
            <p>{i18n.t("launch_service.local.coverage", values)}</p>
            <div className="cta-row">
              <Link href={addLocalePrefix("/barnegat-nj", i18n.locale)}>
                {i18n.t("launch_service.local.area_link", values)}
              </Link>
              <Link href={addLocalePrefix("/provider-verification", i18n.locale)}>
                {i18n.t("launch_service.local.verification_link")}
              </Link>
            </div>
          </article>
        </section>
      ) : (
        <section className="grid-two">
          <article className="card">
            <h2>{i18n.t("launch_service.section.what_for")}</h2>
            <p>{i18n.t(service.introKey, values)}</p>
            <ul className="timeline">
              {service.includeKeys.map((key) => (
                <li key={key}>
                  <strong>•</strong>
                  <span>{i18n.t(key, values)}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h2>{i18n.t("launch_service.section.best_fit")}</h2>
            <ul className="timeline">
              {service.bestForKeys.map((key) => (
                <li key={key}>
                  <strong>•</strong>
                  <span>{i18n.t(key, values)}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("launch_service.section.pricing")}</h2>
          <p>{i18n.t("launch_service.pricing.body")}</p>
          <ul className="timeline">
            {service.pricingFactorKeys.map((key) => (
              <li key={key}>
                <strong>•</strong>
                <span>{i18n.t(key, values)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>{i18n.t("launch_service.section.booking")}</h2>
          <ol className="timeline">
            <li>
              <strong>1.</strong>
              <span>{i18n.t("launch_service.booking.step.service_timing_area")}</span>
            </li>
            <li>
              <strong>2.</strong>
              <span>{i18n.t("launch_service.booking.step.recommendation")}</span>
            </li>
            <li>
              <strong>3.</strong>
              <span>{i18n.t("launch_service.booking.step.backup_list")}</span>
            </li>
            <li>
              <strong>4.</strong>
              <span>{i18n.t("launch_service.booking.step.track")}</span>
            </li>
          </ol>
        </article>
      </section>

      <LaunchMarketplaceProofSection
        description={i18n.t("launch_service.proof.body", values)}
        preferredAreaLabel={variant === "town-service" ? launchAreaLabel : undefined}
        preferredCategory={preferredCategory}
        title={i18n.t("launch_service.proof.title", values)}
      />

      <section className="grid-two">
        <LaunchLeadCaptureCard
          defaultAreaLabel={launchAreaLabel}
          defaultServiceCategory={preferredCategory}
          description={i18n.t("launch_service.lead.body", values)}
          requestSource={variant === "town-service" ? "launch-town-service-lead-form" : "launch-service-lead-form"}
          title={i18n.t("launch_service.lead.title", values)}
        />
        <article className="card">
          <h2>{i18n.t("launch_service.after_help.title")}</h2>
          <ol className="timeline">
            <li>
              <strong>1.</strong>
              <span>{i18n.t("launch_service.after_help.step.queue")}</span>
            </li>
            <li>
              <strong>2.</strong>
              <span>{i18n.t("launch_service.after_help.step.owner_response")}</span>
            </li>
            <li>
              <strong>3.</strong>
              <span>{i18n.t("launch_service.after_help.step.closed_loop")}</span>
            </li>
          </ol>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>{i18n.t("launch_service.faq.title")}</h2>
          <p>{i18n.t("launch_service.faq.body")}</p>
        </div>
        <div className="grid-two">
          {(variant === "town-service" ? [
            { questionKey: "launch_service.local.faq.coverage_question", answerKey: "launch_service.local.faq.coverage_answer" },
            { questionKey: "launch_service.local.faq.away_question", answerKey: "launch_service.local.faq.away_answer" }
          ] as const : service.faqKeys).map((item) => (
            <article className="card" key={item.questionKey}>
              <h3>{i18n.t(item.questionKey, values)}</h3>
              <p>{i18n.t(item.answerKey, values)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
