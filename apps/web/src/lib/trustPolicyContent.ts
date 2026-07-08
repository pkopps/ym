export type TrustPolicyPageId =
  | "support"
  | "cancellation-policy"
  | "refund-policy"
  | "booking-expectations"
  | "provider-verification"
  | "privacy-policy"
  | "terms-of-service"
  | "provider-standards";

export type TrustPolicySurface = "home" | "help" | "provider" | "footer";

export interface TrustPolicySection {
  heading: string;
  body: string;
  bullets: string[];
}

export interface TrustPolicyPageContent {
  id: TrustPolicyPageId;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  ctaLabel: string;
  surfaces: TrustPolicySurface[];
  sections: TrustPolicySection[];
}

export const trustPolicyPages: TrustPolicyPageContent[] = [
  {
    id: "support",
    href: "/support",
    eyebrow: "Support",
    title: "How support works during launch",
    description:
      "Understand how YardMatch handles pre-booking questions, logged-in support tickets, billing follow-up, and service-quality issues during launch.",
    summary:
      "Reach YardMatch by email first for pre-booking help, and use logged-in support tickets for live booking, billing, or account issues.",
    ctaLabel: "Read support details",
    surfaces: ["home", "help", "footer"],
    sections: [
      {
        heading: "Before you book",
        body:
          "Use Contact us when you need coverage confirmation, launch pricing context, service recommendations, or help deciding whether YardMatch is the right fit before a booking exists.",
        bullets: [
          "Email is the default contact path during launch.",
          "Phone or text follow-up can still be used when you request it.",
          "Pre-booking questions should land in the owned ops queue instead of disappearing into a generic inbox."
        ]
      },
      {
        heading: "After you book",
        body:
          "Once you have an account and a real booking, the logged-in support path is the right place for scheduling, billing, account, or service-quality help.",
        bullets: [
          "Support tickets are tied to the authenticated requester.",
          "Billing issues can open refund-review workflows when the booking and payment state allow it.",
          "Ops can see booking context, evidence, intervention history, and ticket timelines together."
        ]
      },
      {
        heading: "Escalation expectations",
        body:
          "YardMatch is a managed marketplace, so support is expected to stay involved when something goes sideways instead of forcing the customer to start over with a provider alone.",
        bullets: [
          "Disputes and refund reviews are documented in the ops queue.",
          "Evidence-backed cases follow explicit review guardrails instead of ad hoc judgment only.",
          "Support language on the public site should match actual ops behavior."
        ]
      }
    ]
  },
  {
    id: "cancellation-policy",
    href: "/cancellation-policy",
    eyebrow: "Cancellation policy",
    title: "Cancellation and reschedule expectations",
    description:
      "Learn how YardMatch handles customer cancellations, reschedules, provider delays, and low-supply schedule changes during launch.",
    summary:
      "Customers can cancel or reschedule future bookings when the booking state still allows it, and provider-side changes should be communicated clearly instead of silently drifting.",
    ctaLabel: "Read cancellation policy",
    surfaces: ["home", "help", "footer"],
    sections: [
      {
        heading: "Customer changes",
        body:
          "Customers should be able to cancel or reschedule future requested bookings while the booking is still operationally safe to change.",
        bullets: [
          "Requested bookings can be cancelled from the customer flow.",
          "Future bookings can be rescheduled when the provider window remains available.",
          "Address changes are allowed only while the booking state and route conditions still permit them."
        ]
      },
      {
        heading: "Provider or ops changes",
        body:
          "When the business owner or ops needs to move a booking, the change should be visible, justified, and communicated instead of being treated like silent back-office churn.",
        bullets: [
          "Provider and ops reschedules should leave an intervention trail.",
          "Late updates and exception handling should notify the customer when the flow supports it.",
          "Recurring plans should cancel future requested visits cleanly when the plan is ended."
        ]
      },
      {
        heading: "Launch reality",
        body:
          "During launch, coverage is intentionally narrow and local, so weather, route density, and supply constraints may still force occasional schedule changes.",
        bullets: [
          "Dense local coverage is preferred over overpromising broad availability.",
          "Low-supply days should be handled with clear follow-up, not ambiguous silence.",
          "The public promise should stay aligned with what ops can actually fulfill."
        ]
      }
    ]
  },
  {
    id: "refund-policy",
    href: "/refund-policy",
    eyebrow: "Refunds",
    title: "Refund review and service-quality policy",
    description:
      "See how refund requests, disputes, evidence review, and payout holds work in the YardMatch managed marketplace flow.",
    summary:
      "Refunds are reviewed through an internal support path rather than treated as an instant automatic reversal for every completed job.",
    ctaLabel: "Read refund policy",
    surfaces: ["home", "help", "footer"],
    sections: [
      {
        heading: "How refund requests work",
        body:
          "Refunds are reviewed in context instead of being treated like an immediate one-click reversal after every completed job.",
        bullets: [
          "Customers can request a refund review from completed paid bookings.",
          "A billing support ticket is created automatically when that review path opens.",
          "Ops can approve or deny the refund review after checking the booking context."
        ]
      },
      {
        heading: "Evidence and dispute handling",
        body:
          "When a case includes submitted evidence, ops should review that material before choosing a direction, and the final decision should match the reviewed signal.",
        bullets: [
          "Support evidence can include before and after photos, notes, and checklists.",
          "High-stakes resolutions should not bypass reviewed evidence.",
          "Mixed or inconclusive evidence requires a more specific manual rationale."
        ]
      },
      {
        heading: "What this means operationally",
        body:
          "Because this is a managed marketplace, payment and payout state can be held while service-quality or billing issues are being resolved.",
        bullets: [
          "Refund-review and dispute cases can place payouts on hold.",
          "Disputed bookings freeze settlement until support resolves the case.",
          "When Stripe is configured, approved refunds are expected to sync back to the processor path as well."
        ]
      }
    ]
  },
  {
    id: "booking-expectations",
    href: "/booking-expectations",
    eyebrow: "Booking expectations",
    title: "What to expect when you book",
    description:
      "Understand the recommendation-first booking flow, limited backup options, arrival expectations, and what YardMatch manages after a booking is requested.",
    summary:
      "YardMatch is designed to recommend one best-fit provider first, with a limited backup path for trust, not an open-ended directory experience.",
    ctaLabel: "Read booking expectations",
    surfaces: ["home", "help", "footer"],
    sections: [
      {
        heading: "How booking works",
        body:
          "The core customer flow is recommendation-first: choose the service, timing, and property, then confirm the best-fit provider quickly unless you need a small backup list for trust.",
        bullets: [
          "Open-ended provider browsing is not the default launch flow.",
          "Alternative providers are meant to stay curated and limited.",
          "Pricing and booking context should feel managed rather than chaotic."
        ]
      },
      {
        heading: "What happens after request",
        body:
          "A booking request should move into a managed follow-through flow instead of leaving the customer unsure about who is arriving or what the next step is.",
        bullets: [
          "Providers confirm bookings before route and work-start actions continue.",
          "Arrival tracking should reflect the provider route status, not expose individual crew location unnecessarily.",
          "Recurring plans should keep future visits intentional instead of feeling like accidental repeat orders."
        ]
      },
      {
        heading: "If the job goes sideways",
        body:
          "Support, disputes, and refund reviews are part of the product promise, not an afterthought bolted on after booking.",
        bullets: [
          "Customers should have a clear support path if timing, quality, or billing becomes a problem.",
          "Ops can intervene, document decisions, and reconcile financial consequences when needed.",
          "Trust comes from both the recommendation and what happens after the booking is placed."
        ]
      }
    ]
  },
  {
    id: "provider-verification",
    href: "/provider-verification",
    eyebrow: "Verification",
    title: "How YardMatch reviews providers before launch demand is shown",
    description:
      "Understand the launch-era verification expectations behind the recommendation-first marketplace, including what is reviewed before a landscaping business is surfaced publicly.",
    summary:
      "YardMatch aims to show only verified providers in the public marketplace overview, so launch trust is based on screening and operational fit instead of directory sprawl alone.",
    ctaLabel: "Read verification details",
    surfaces: ["home", "help", "footer", "provider"],
    sections: [
      {
        heading: "Why verification exists",
        body:
          "A recommendation-first marketplace only works if the customer can trust that the providers being surfaced are real businesses with enough operational readiness to fulfill the work.",
        bullets: [
          "Public marketplace overview routes are intended to show verified providers only.",
          "Verification is part of the trust layer, not an optional cosmetic badge.",
          "The point is to reduce false confidence from thin profiles or unreviewed supply."
        ]
      },
      {
        heading: "What YardMatch is checking at launch",
        body:
          "The exact checklist can evolve, but the launch posture is to review whether a provider looks operationally ready for the service area, booking flow, and support expectations being promised publicly.",
        bullets: [
          "Service area, category fit, and route reality should match what the provider is listing.",
          "Calendar and availability controls should not expose impossible booking windows.",
          "Support, review, payout, and dispute expectations should be acceptable before public launch demand is routed to that business."
        ]
      },
      {
        heading: "Why this matters to customers",
        body:
          "Verification does not guarantee a perfect job, but it does mean YardMatch is trying to filter public demand through a narrower, more accountable set of providers than a generic listing directory would.",
        bullets: [
          "Customers still get support, refund-review, and dispute paths if something goes wrong.",
          "Verification works together with review, punctuality, and follow-through data over time.",
          "As real local performance data grows, trust should be based on both screening and operating history."
        ]
      }
    ]
  },
  {
    id: "privacy-policy",
    href: "/privacy-policy",
    eyebrow: "Privacy",
    title: "Privacy and data-use basics",
    description:
      "See what launch-era customer, provider, and crew data YardMatch uses to operate bookings, staffing, payouts, support, and analytics.",
    summary:
      "YardMatch uses customer, provider, and crew information to run marketplace operations, but the public flow should avoid collecting more personal data than launch operations actually need.",
    ctaLabel: "Read privacy basics",
    surfaces: ["help", "footer"],
    sections: [
      {
        heading: "What the product needs to function",
        body:
          "The marketplace needs identity, property, scheduling, payment, support, and notification data to run the core booking and fulfillment flow responsibly.",
        bullets: [
          "Customer contact, address, and property details support booking, routing, and service delivery.",
          "Provider and crew identity details support staffing, payouts, notifications, and accountability.",
          "Billing and refund state is stored so payments, payout holds, and support resolution can be reconciled."
        ]
      },
      {
        heading: "What YardMatch tries to avoid",
        body:
          "The launch product should stay disciplined about collecting data only when it supports a real marketplace need instead of hoarding information for vague future ideas.",
        bullets: [
          "Public attribution is privacy-safe and avoids logging raw personal URLs.",
          "Anonymous location lookup stays session-scoped unless there is a stronger product reason to save it.",
          "Customer-visible arrival tracking should reflect provider route status without exposing individual crew location unnecessarily."
        ]
      },
      {
        heading: "Operational realities",
        body:
          "Some marketplace data is retained because support, disputes, evidence review, and payouts require an audit trail after the booking is placed.",
        bullets: [
          "Support tickets, evidence, and financial-exception workflows may require stored history.",
          "Launch leads are tracked so follow-up and conversion handling do not disappear into ad hoc inboxes.",
          "Policy language should stay aligned with the actual product behavior and stored operational records."
        ]
      }
    ]
  },
  {
    id: "terms-of-service",
    href: "/terms-of-service",
    eyebrow: "Terms",
    title: "Launch terms and marketplace expectations",
    description:
      "Understand the launch-era ground rules for using YardMatch, including managed booking expectations, support boundaries, and route-window realities.",
    summary:
      "The marketplace is meant to reduce friction without pretending every job is guaranteed, every route window is perfect, or every support issue resolves instantly.",
    ctaLabel: "Read terms",
    surfaces: ["help", "footer"],
    sections: [
      {
        heading: "Managed marketplace posture",
        body:
          "YardMatch is not a generic lead directory. The product is designed to recommend a best-fit provider, manage the booking flow, and stay involved when support or payment issues appear.",
        bullets: [
          "Recommendation-first booking is the intended default experience.",
          "Limited backup options exist for trust, not for open-ended comparison shopping.",
          "Support, billing, and dispute handling are part of the marketplace promise."
        ]
      },
      {
        heading: "Service and schedule realities",
        body:
          "Coverage, timing, route windows, weather, and labor supply can all affect how quickly a job can be fulfilled, especially during a narrow launch radius.",
        bullets: [
          "Route windows are operational commitments, not minute-by-minute guarantees.",
          "Cancellations, delays, and reschedules should be handled transparently rather than silently.",
          "The launch area should stay dense and manageable instead of overpromising thin regional coverage."
        ]
      },
      {
        heading: "Accountability and support",
        body:
          "Using the marketplace means the customer, provider, crew, and ops flows all need enough documentation and identity context to resolve problems responsibly.",
        bullets: [
          "Logged-in support paths should be used for live booking, billing, or account issues.",
          "Evidence and intervention history may matter when disputes or refund reviews are raised.",
          "The public explanation of terms should match what ops can actually support in practice."
        ]
      }
    ]
  },
  {
    id: "provider-standards",
    href: "/provider-standards",
    eyebrow: "Provider standards",
    title: "Provider standards and launch expectations",
    description:
      "See the service-quality, verification, support, and communication expectations YardMatch intends to hold landscaping businesses to during launch.",
    summary:
      "Providers are expected to confirm work they can actually fulfill, communicate clearly, respect route commitments, and participate in support or refund review when a job goes sideways.",
    ctaLabel: "Read provider standards",
    surfaces: ["provider", "help", "footer"],
    sections: [
      {
        heading: "Before taking work",
        body:
          "A provider should only expose capacity the business can realistically service and should keep its marketplace profile, calendar, and service area aligned with field reality.",
        bullets: [
          "Verification should happen before a provider is shown publicly.",
          "Service radius and availability settings should reflect real operating capacity.",
          "Growth should not come from accepting work that crews, routes, or pricing cannot support."
        ]
      },
      {
        heading: "During service delivery",
        body:
          "YardMatch expects providers to treat route windows, communications, and documentation seriously because those behaviors shape trust more than marketing copy does.",
        bullets: [
          "Bookings should be confirmed before route and work-start actions continue.",
          "Before and after evidence, notes, or checklists may be required by the live ops flow.",
          "Late updates, exceptions, and reschedules should be communicated instead of hidden."
        ]
      },
      {
        heading: "After the job",
        body:
          "Reviews, disputes, billing questions, and support escalations are part of provider quality, not something outside the marketplace relationship.",
        bullets: [
          "Providers should participate in service-quality and refund-review follow-up when needed.",
          "Dispute evidence and support actions can affect payouts until the case is resolved.",
          "Long-term marketplace trust depends on fulfillment quality, not only on lead volume."
        ]
      }
    ]
  }
];

export const trustPolicyPageById = Object.fromEntries(
  trustPolicyPages.map((page) => [page.id, page])
) as Record<TrustPolicyPageId, TrustPolicyPageContent>;
