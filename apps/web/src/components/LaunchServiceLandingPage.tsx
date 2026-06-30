import Link from "next/link";
import { ServiceCategory } from "@yardmatch/contracts";
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
  const service = launchServiceContent[serviceKey];
  const pageTitle =
    variant === "town-service" ? `${service.name} in ${launchAreaLabel}` : `${service.name} Services`;
  const eyebrow =
    variant === "town-service"
      ? `${launchAreaShortLabel} launch service`
      : "Launch service";
  const summary =
    variant === "town-service"
      ? service.description
      : `${service.name} through YardMatch keeps the launch booking flow recommendation-first while still giving homeowners a limited backup option if they want more trust before confirming.`;
  const preferredCategory: ServiceCategory =
    serviceKey === "yard-cleanup" ? "seasonal-cleanup" : serviceKey;
  const ctaHref = `/customer?service=${service.key}&area=${encodeURIComponent(launchAreaLabel)}`;
  const counterpartHref = variant === "town-service" ? service.path : service.townPath;
  const counterpartLabel =
    variant === "town-service"
      ? `View the general ${service.name.toLowerCase()} page`
      : `See this service in ${launchAreaShortLabel}`;

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{pageTitle}</h1>
        <p>{summary}</p>
        <div className="cta-row">
          <Link className="button" href={ctaHref}>
            Book {service.shortName} near {launchAreaShortLabel}
          </Link>
          <Link className="button-secondary" href={counterpartHref}>
            {counterpartLabel}
          </Link>
        </div>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>What this page is for</h2>
          <p>{service.intro}</p>
          <ul className="timeline">
            {service.includes.map((item) => (
              <li key={item}>
                <strong>•</strong>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Best fit for launch</h2>
          <ul className="timeline">
            {service.bestFor.map((item) => (
              <li key={item}>
                <strong>•</strong>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>What affects pricing</h2>
          <p>
            YardMatch keeps customer-facing pricing under the managed marketplace while still
            respecting provider economics.
          </p>
          <ul className="timeline">
            {service.pricingFactors.map((item) => (
              <li key={item}>
                <strong>•</strong>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>How booking works</h2>
          <ol className="timeline">
            <li>
              <strong>1.</strong>
              <span>Tell YardMatch the service, timing, and area.</span>
            </li>
            <li>
              <strong>2.</strong>
              <span>YardMatch recommends the best provider first.</span>
            </li>
            <li>
              <strong>3.</strong>
              <span>Book quickly or reveal a short backup list if you want another option.</span>
            </li>
            <li>
              <strong>4.</strong>
              <span>Track the job, support, and follow-through in one place.</span>
            </li>
          </ol>
        </article>
      </section>

      <LaunchMarketplaceProofSection
        description={`Show live verified-provider proof for ${service.shortName.toLowerCase()} instead of relying on generic marketplace claims alone.`}
        preferredAreaLabel={variant === "town-service" ? launchAreaLabel : undefined}
        preferredCategory={preferredCategory}
        title={`Launch proof for ${service.shortName.toLowerCase()}`}
      />

      <section className="grid-two">
        <LaunchLeadCaptureCard
          defaultAreaLabel={launchAreaLabel}
          defaultServiceCategory={preferredCategory}
          description={`If you want YardMatch to confirm launch coverage, timing, or fit for ${service.shortName.toLowerCase()}, request a follow-up instead of guessing from a generic form.`}
          requestSource={variant === "town-service" ? "launch-town-service-lead-form" : "launch-service-lead-form"}
          title={`Need help with ${service.shortName.toLowerCase()}?`}
        />
        <article className="card">
          <h2>What happens after you ask for help</h2>
          <ol className="timeline">
            <li>
              <strong>1.</strong>
              <span>YardMatch routes the request into the launch follow-up queue with its source and landing-page context attached.</span>
            </li>
            <li>
              <strong>2.</strong>
              <span>An owner picks it up, responds inside the launch response window, and sets the next follow-up instead of letting it disappear.</span>
            </li>
            <li>
              <strong>3.</strong>
              <span>The inquiry stays open until it books cleanly or closes with a documented reason.</span>
            </li>
          </ol>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>Questions homeowners ask before booking</h2>
          <p>Trust-building content should remove friction, not add fluff.</p>
        </div>
        <div className="grid-two">
          {service.faqs.map((item) => (
            <article className="card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
