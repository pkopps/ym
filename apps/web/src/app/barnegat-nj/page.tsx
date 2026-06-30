import Link from "next/link";
import type { Metadata } from "next";
import { LaunchLeadCaptureCard } from "../../components/LaunchLeadCaptureCard";
import { LaunchMarketplaceProofSection } from "../../components/LaunchMarketplaceProofSection";
import {
  buildLaunchMetadata,
  launchAreaLabel,
  launchAreaShortLabel,
  launchTownPageLinks
} from "../../lib/launchLandingContent";

export const metadata: Metadata = buildLaunchMetadata({
  title: `${launchAreaLabel} Lawn Care and Landscaping`,
  description:
    `Book recommendation-first lawn care and landscaping in ${launchAreaLabel} with fast booking, limited backup options, and clearer support when jobs need follow-through.`,
  path: "/barnegat-nj"
});

const trustPoints = [
  "one recommended provider first instead of a scrolling directory",
  "limited backup options if you want more trust before confirming",
  "support, refund, and booking-expectation language tied to the actual marketplace flow"
] as const;

const localFaqs = [
  {
    question: `What services is YardMatch prioritizing first in ${launchAreaShortLabel}?`,
    answer:
      "The launch focus is the practical yard work homeowners buy most often and can understand quickly: routine mowing, yard cleanup, and closely related curb-appeal work."
  },
  {
    question: "What happens if no provider is available for my request?",
    answer:
      "The managed-marketplace model should make that clear instead of hiding it. If a launch request cannot be covered cleanly, the ops team can step in instead of letting a lead vanish."
  },
  {
    question: `Why start with ${launchAreaShortLabel} instead of a wider directory footprint?`,
    answer:
      "Dense local coverage builds better routes, faster follow-through, and better trust than spreading thin across too many towns at launch."
  }
] as const;

export default function BarnegatTownPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Local launch page</span>
        <h1>{launchAreaLabel} lawn care and landscaping</h1>
        <p>
          YardMatch is launching with a recommendation-first booking flow for homeowners who want
          reliable yard work without the usual directory browsing and callback chase.
        </p>
        <div className="cta-row">
          <Link className="button" href={`/customer?area=${encodeURIComponent(launchAreaLabel)}`}>
            Find my provider
          </Link>
          <Link className="button-secondary" href="/about">
            Why YardMatch works this way
          </Link>
        </div>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>What makes the launch flow different</h2>
          <ul className="timeline">
            {trustPoints.map((item) => (
              <li key={item}>
                <strong>•</strong>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2>What YardMatch is optimizing for</h2>
          <p>
            The goal is not to become another huge directory. The goal is to help homeowners in
            {` ${launchAreaShortLabel}`} book faster while preserving trust around who is arriving,
            what was booked, and how support works if the job goes sideways.
          </p>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>Launch-priority services in {launchAreaShortLabel}</h2>
          <p>Start with the highest-intent pages first, then expand the service footprint deliberately.</p>
        </div>
        <div className="grid-two">
          {launchTownPageLinks.map((item) => (
            <article className="card" key={item.href}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Link className="button-secondary" href={item.href}>
                View page
              </Link>
            </article>
          ))}
        </div>
      </section>

      <LaunchMarketplaceProofSection
        description={`Use real verified-provider and rating signals from the live ${launchAreaShortLabel} launch overview to understand what backs the recommendation-first flow.`}
        preferredAreaLabel={launchAreaLabel}
        title={`Current proof in ${launchAreaShortLabel}`}
      />

      <section className="grid-two">
        <LaunchLeadCaptureCard
          defaultAreaLabel={launchAreaLabel}
          description="Use this if you want YardMatch to confirm local coverage, timing, or the right launch service before you start the booking flow."
          requestSource="launch-town-page-lead-form"
          title={`Need follow-up for ${launchAreaShortLabel}?`}
        />
        <article className="card">
          <h2>Why this matters at launch</h2>
          <p>
            Early demand should not vanish into a generic inbox. The launch queue gives every
            follow-up request an owner, a response deadline, and a documented end state instead of
            leaving homeowners to wonder whether anyone saw it.
          </p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>How YardMatch is trying to earn trust locally</h2>
          <p>
            The goal is not to flood the launch with unreviewed supply. The public marketplace
            overview is intended to highlight verified providers first, then let real ratings,
            punctuality, and support follow-through build from there.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href="/provider-verification">
              See provider verification
            </Link>
          </div>
        </article>
        <article className="card">
          <h2>What happens if something goes wrong</h2>
          <p>
            YardMatch is trying to be a managed marketplace, so support, cancellation, refund, and
            booking-expectation language should already be visible before you commit.
          </p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href="/help">
              Read trust and support pages
            </Link>
          </div>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>Common launch questions</h2>
          <p>Trust assets should answer the questions that block booking.</p>
        </div>
        <div className="grid-two">
          {localFaqs.map((item) => (
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
