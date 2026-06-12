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
    title: "Get back to the yard work you already set in motion.",
    description:
      "Log in to manage upcoming visits, recurring care, route tracking, and support-backed booking changes without chasing texts or lead forms.",
    illustrationId: "lawn-mower",
    metrics: [
      { value: "Live", label: "arrival tracking" },
      { value: "Weekly", label: "recurring care ready" },
      { value: "Support", label: "built into bookings" }
    ],
    highlights: [
      "Track the provider as they head to the property and see a simple arrival summary from the app home screen.",
      "Reschedule, renew recurring mowing, and keep property notes attached to the booking instead of starting over.",
      "Keep payment, reviews, and support in the same customer timeline if something goes off schedule."
    ],
    primaryHref: "/auth",
    primaryLabel: "Create customer account",
    secondaryHref: "/customer/listings",
    secondaryLabel: "Browse providers first",
    formEyebrow: "Customer login",
    formTitle: "Open your customer workspace",
    formCopy: "Use your customer account to manage properties, bookings, reviews, and recurring service plans."
  },
  provider: {
    eyebrow: "Business owner access",
    title: "Run routes, clients, and crew decisions from one place.",
    description:
      "Log in to manage today’s jobs, staffing review, recurring customer work, payout visibility, and outside-calendar pressure without piecing the day together manually.",
    illustrationId: "leaf-blower",
    metrics: [
      { value: "Route-aware", label: "dispatch planning" },
      { value: "Crew-fit", label: "staffing recommendations" },
      { value: "Ops-backed", label: "refund and dispute flow" }
    ],
    highlights: [
      "Review upcoming jobs with broader morning, afternoon, and evening windows that match how landscaping schedules actually move.",
      "See outside calendar conflicts, payout holds, staffing gaps, and departure reminders without leaving the management flow.",
      "Use the provider assistant to preview plain-language reschedules and send the customer an update when you confirm the change."
    ],
    primaryHref: "/auth/provider",
    primaryLabel: "Create provider account",
    secondaryHref: "/help",
    secondaryLabel: "Talk to support",
    formEyebrow: "Provider login",
    formTitle: "Open the management board",
    formCopy: "Use your business account to run bookings, crews, payouts, calendar sync, and live route operations."
  },
  "crew-member": {
    eyebrow: "Crew member access",
    title: "Keep assignments, route details, and accountability in one schedule.",
    description:
      "Log in to review accepted work, upcoming stops, route links, and your scheduling history without bouncing between provider texts and map apps.",
    illustrationId: "string-trimmer",
    metrics: [
      { value: "Live", label: "assignment schedule" },
      { value: "One tap", label: "directions access" },
      { value: "Clear", label: "reliability expectations" }
    ],
    highlights: [
      "See accepted work, the service window, and quick directions for the next property in one place.",
      "Understand when cancellations can hurt future staffing priority before you back out of an accepted assignment.",
      "Keep your schedule, route context, and earnings visibility tied to the actual work history in the platform."
    ],
    primaryHref: "/auth/crew",
    primaryLabel: "Create crew account",
    secondaryHref: "/crew",
    secondaryLabel: "See open work",
    formEyebrow: "Crew login",
    formTitle: "Open your crew schedule",
    formCopy: "Use your crew account to manage assignments, schedules, directions, and future work opportunities."
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
