"use client";

import { MarketplaceRole } from "@yardmatch/contracts";
import { landscapingToolIllustrations } from "../lib/landscapingToolIllustrations";
import { RoleLoginCard } from "./RoleLoginCard";

const roleExperienceCopy: Record<
  MarketplaceRole,
  {
    eyebrow: string;
    title: string;
    description: string;
    illustrationId: (typeof landscapingToolIllustrations)[number]["id"];
    metrics: Array<{ value: string; label: string }>;
    highlights: string[];
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
    formEyebrow: string;
    formTitle: string;
    formCopy: string;
  }
> = {
  customer: {
    eyebrow: "Customer access",
    title: "Manage bookings without the back-and-forth.",
    description:
      "Open bookings, recurring care, tracking, and support in one customer workspace.",
    illustrationId: "lawn-mower",
    metrics: [
      { value: "Live", label: "arrival tracking" },
      { value: "Weekly", label: "recurring care ready" },
      { value: "Support", label: "built into bookings" }
    ],
    highlights: [
      "Track arrival without chasing texts.",
      "Reschedule or renew recurring care fast.",
      "Keep payment, reviews, and support in one timeline."
    ],
    primaryHref: "/auth",
    primaryLabel: "Create customer account",
    secondaryHref: "/customer/listings",
    secondaryLabel: "Browse providers first",
    formEyebrow: "Customer login",
    formTitle: "Open your customer workspace",
    formCopy: "Manage properties, bookings, reviews, and recurring care."
  },
  provider: {
    eyebrow: "Business owner access",
    title: "Run routes, crew, and payouts from one place.",
    description:
      "Open today’s jobs, staffing review, payouts, and calendar pressure in one management flow.",
    illustrationId: "leaf-blower",
    metrics: [
      { value: "Route-aware", label: "dispatch planning" },
      { value: "Crew-fit", label: "staffing recommendations" },
      { value: "Ops-backed", label: "refund and dispute flow" }
    ],
    highlights: [
      "Review jobs in real morning, afternoon, and evening windows.",
      "See staffing gaps, payout holds, and calendar conflicts together.",
      "Use the assistant for fast reschedules and field updates."
    ],
    primaryHref: "/auth/provider",
    primaryLabel: "Create provider account",
    secondaryHref: "/help",
    secondaryLabel: "Talk to support",
    formEyebrow: "Provider login",
    formTitle: "Open the management board",
    formCopy: "Run bookings, crews, payouts, calendar sync, and route operations."
  },
  "crew-member": {
    eyebrow: "Crew member access",
    title: "Keep assignments and route details in one schedule.",
    description:
      "Open accepted work, directions, and schedule history without bouncing between texts and map apps.",
    illustrationId: "string-trimmer",
    metrics: [
      { value: "Live", label: "assignment schedule" },
      { value: "One tap", label: "directions access" },
      { value: "Clear", label: "reliability expectations" }
    ],
    highlights: [
      "See accepted work and directions in one place.",
      "Understand cancellation impact before backing out.",
      "Keep schedule, route context, and earnings tied to real work history."
    ],
    primaryHref: "/auth/crew",
    primaryLabel: "Create crew account",
    secondaryHref: "/crew",
    secondaryLabel: "See open work",
    formEyebrow: "Crew login",
    formTitle: "Open your crew schedule",
    formCopy: "Manage assignments, availability, directions, and future work."
  }
};

export function RoleLoginExperience({ role }: { role: MarketplaceRole }) {
  const content = roleExperienceCopy[role];
  const illustration = landscapingToolIllustrations.find((item) => item.id === content.illustrationId);

  return (
    <main className="container stack-lg">
      <section className="role-login-shell">
        <div className="role-login-shell__story">
          <span className="eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>

          <div className="role-login-shell__metrics">
            {content.metrics.map((metric) => (
              <div className="role-login-shell__metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>

          <div className="role-login-shell__feature-panel">
            {illustration ? (
              <div className="role-login-shell__art">
                <img alt={illustration.alt} src={illustration.src} />
              </div>
            ) : null}
            <ul className="role-login-shell__highlights">
              {content.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>

          <div className="cta-row">
            <a className="button" href={content.primaryHref}>
              {content.primaryLabel}
            </a>
            <a className="button-secondary" href={content.secondaryHref}>
              {content.secondaryLabel}
            </a>
          </div>
        </div>

        <div className="role-login-shell__form-column">
          <div className="role-login-shell__form-intro">
            <span className="eyebrow">{content.formEyebrow}</span>
            <h2>{content.formTitle}</h2>
            <p>{content.formCopy}</p>
          </div>
          <RoleLoginCard role={role} />
        </div>
      </section>
    </main>
  );
}
