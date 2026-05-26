export type HelpAudience = "customer" | "provider" | "crew-member";

export interface HelpArticleSection {
  heading: string;
  body: string;
  bullets: string[];
}

export interface HelpArticle {
  id: string;
  audience: HelpAudience;
  slug: string;
  title: string;
  summary: string;
  readTimeMinutes: number;
  updatedAt: string;
  sections: HelpArticleSection[];
}

export interface HelpCollection {
  audience: HelpAudience;
  title: string;
  description: string;
  quickLinks: string[];
  articles: HelpArticle[];
}

const customerArticles: HelpArticle[] = [
  {
    id: "customer-booking-addresses",
    audience: "customer",
    slug: "booking-and-address-management",
    title: "Book services without re-entering every property",
    summary:
      "Learn how saved properties, default addresses, and booking address snapshots work together.",
    readTimeMinutes: 4,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Save multiple properties",
        body:
          "Customers can keep several homes or managed properties on file so repeat bookings stay fast.",
        bullets: [
          "Set one property as the default for future bookings.",
          "Choose a different property during checkout whenever needed.",
          "Keep rental homes, family homes, and primary residences in one account."
        ]
      },
      {
        heading: "Why bookings store their own address snapshot",
        body:
          "A booking keeps the exact service address that was chosen at checkout so later preference changes do not rewrite history.",
        bullets: [
          "Changing your default property does not alter existing bookings.",
          "Support teams can always see the originally booked location.",
          "Providers are routed against the booked service address, not your current default."
        ]
      }
    ]
  },
  {
    id: "customer-instant-quote",
    audience: "customer",
    slug: "instant-quotes-and-follow-up-questions",
    title: "Understand instant quotes and confidence-based follow-up questions",
    summary:
      "See how YardMatch estimates lawn size from the address first and only asks follow-up questions when confidence is lower.",
    readTimeMinutes: 5,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Address first, not a long form",
        body:
          "The quoting flow starts with the service address and requested service so customers can move quickly.",
        bullets: [
          "Automated measurement estimates turf, shrubs, driveway, and sidewalk work.",
          "Estimated duration is passed into scheduling so time windows fit the job size.",
          "Quotes stay lightweight even for first-time customers."
        ]
      },
      {
        heading: "When follow-up questions appear",
        body:
          "The platform only asks a small number of clarifying questions if it needs more certainty before pricing the job.",
        bullets: [
          "High confidence returns an immediate quote.",
          "Medium confidence asks one or two lightweight questions.",
          "Lower confidence can route the request for provider review before final confirmation."
        ]
      }
    ]
  },
  {
    id: "customer-billing-refunds",
    audience: "customer",
    slug: "billing-refunds-and-service-quality",
    title: "Get help with billing, refunds, or service quality concerns",
    summary:
      "Open a support request tied to a booking so billing, no-show, and quality issues can be resolved faster.",
    readTimeMinutes: 4,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Open support from the booking record",
        body:
          "Support requests should stay connected to the booking and payment record so customers do not need to repeat context.",
        bullets: [
          "Report billing discrepancies directly from the affected booking.",
          "Flag provider no-shows and request rebooking help.",
          "Share service quality issues and requested resolution in one place."
        ]
      },
      {
        heading: "Refund reviews",
        body:
          "Refunds can be reviewed when the job was not completed correctly, the crew never arrived, or there was another eligible issue.",
        bullets: [
          "Payment authorization and capture events give support a full timeline.",
          "Refund outcomes are logged against the original transaction.",
          "Operational telemetry can track refund rates by issue type."
        ]
      }
    ]
  },
  {
    id: "customer-review-timing",
    audience: "customer",
    slug: "post-service-reviews",
    title: "When a review becomes available after service",
    summary:
      "Understand why reviews are tied to completed bookings and delayed by a short invite window.",
    readTimeMinutes: 3,
    updatedAt: "2026-04-29",
    sections: [
      {
        heading: "Reviews only unlock after service is complete",
        body:
          "Customers should only be able to review a landscaper after the booked service has actually been provided.",
        bullets: [
          "The provider completes the booking first.",
          "The system schedules a booking-specific review invite for 48 hours later.",
          "Only the customer attached to that booking can use the invite."
        ]
      },
      {
        heading: "Why the delay matters",
        body:
          "A short delay gives the customer time to notice quality issues while still keeping feedback close to the service date.",
        bullets: [
          "The invite can be delivered by email and in-app notification.",
          "One review is allowed per booking.",
          "Provider profiles cannot be reviewed by random visitors."
        ]
      }
    ]
  }
];

const providerArticles: HelpArticle[] = [
  {
    id: "provider-profile-and-service-area",
    audience: "provider",
    slug: "set-up-profile-and-service-area",
    title: "Set up your profile, services, and service area",
    summary:
      "Organize your marketplace profile so customers only see services and jobs you can actually fulfill.",
    readTimeMinutes: 4,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Choose the right services",
        body:
          "Providers can advertise lawn care, landscaping, seasonal cleanup, and winter service categories from one profile.",
        bullets: [
          "Turn on only the categories your crew actively performs.",
          "Offer seasonal options like snow shoveling, salting, and snow blowing during winter months.",
          "Keep specialties aligned with what customers can select in checkout."
        ]
      },
      {
        heading: "Define a realistic service radius",
        body:
          "Distance-aware matching should reflect where your crew can reliably travel and still stay on schedule.",
        bullets: [
          "Keep your radius tight enough to protect route density.",
          "Out-of-radius address changes can be blocked automatically.",
          "Search ranking can factor both proximity and availability."
        ]
      }
    ]
  },
  {
    id: "provider-scheduling-and-calendar",
    audience: "provider",
    slug: "calendar-sync-and-job-duration",
    title: "Manage calendar sync, availability, and job duration",
    summary:
      "See how instant quote duration estimates, synced calendars, and booking windows work together.",
    readTimeMinutes: 5,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Connect external calendars",
        body:
          "Calendar integration helps the marketplace offer only slots that fit the crew schedule.",
        bullets: [
          "Sync Apple, Google, or Outlook calendars.",
          "Expose a provider ICS feed for lightweight external scheduling tools.",
          "Reduce double-booking by using the same availability logic everywhere."
        ]
      },
      {
        heading: "How job length is estimated",
        body:
          "Estimated job duration comes from the instant quote engine so larger properties reserve more time automatically.",
        bullets: [
          "Bigger yards create larger booking windows.",
          "Travel impact can be reviewed if the address changes after confirmation.",
          "Tablet and desktop views can show denser schedule management layouts."
        ]
      }
    ]
  },
  {
    id: "provider-payouts-and-disputes",
    audience: "provider",
    slug: "payouts-refunds-and-disputes",
    title: "Understand payouts, disputes, and support escalations",
    summary:
      "Learn how payout timing, refund reviews, and service quality escalations should be handled.",
    readTimeMinutes: 4,
    updatedAt: "2026-04-23",
    sections: [
      {
        heading: "Payment and payout flow",
        body:
          "Customer payments can be authorized up front and captured after completion to protect both sides of the marketplace.",
        bullets: [
          "Authorization confirms the customer can pay before dispatch.",
          "Capture should happen only after the job status is complete.",
          "Disputes and refunds should remain tied to the booking record."
        ]
      },
      {
        heading: "Handling service issues",
        body:
          "If a customer raises a concern, the provider help flow should make next steps obvious and traceable.",
        bullets: [
          "Review the original notes, photos, and booked address.",
          "Respond quickly when a confirmed booking address change needs review.",
          "Use support tickets and event logs to preserve the audit trail."
        ]
      }
    ]
  }
];

const crewMemberArticles: HelpArticle[] = [
  {
    id: "crew-member-joining-crews",
    audience: "crew-member",
    slug: "joining-crews-and-setting-availability",
    title: "Join landscaping crews without managing the whole business",
    summary:
      "Learn how crew members can publish their skills, travel limits, and work preferences without owning trucks or heavy equipment.",
    readTimeMinutes: 4,
    updatedAt: "2026-05-07",
    sections: [
      {
        heading: "Set realistic work preferences",
        body:
          "Crew profiles should make it easy for landscaping businesses to understand where you can work and what jobs you are prepared to handle.",
        bullets: [
          "Choose the service categories you are comfortable performing on a crew.",
          "Publish a travel radius from your home base or meeting point.",
          "Mark whether you are looking for full-time, part-time, seasonal, or flexible assignments."
        ]
      },
      {
        heading: "Why equipment ownership is optional",
        body:
          "The crew-member role is designed for skilled workers who can contribute to jobs even if the business owner provides the truck, mower, trailer, and route plan.",
        bullets: [
          "Providers can recruit for field labor without assuming every worker runs an independent company.",
          "Customers still book the business, not the individual laborer.",
          "Assignments can stay attached to the business account while crew members get their own operational app."
        ]
      }
    ]
  },
  {
    id: "crew-member-day-of-job",
    audience: "crew-member",
    slug: "day-of-job-and-check-in",
    title: "Understand assigned jobs, check-in expectations, and route handoff",
    summary:
      "See how the crew-member app can focus on where to go, who you are meeting, and what work is assigned that day.",
    readTimeMinutes: 4,
    updatedAt: "2026-05-07",
    sections: [
      {
        heading: "Read the assignment before leaving",
        body:
          "Assignments should show the meeting point, service notes, time window, and business owner or crew lead responsible for the job.",
        bullets: [
          "Review access notes before arriving on site.",
          "Use schedule blocks sized to the quoted duration for the property.",
          "Keep route changes visible so the full crew is aligned."
        ]
      },
      {
        heading: "Check-in and completion signals",
        body:
          "Crew tools should help workers confirm they are on the job without exposing customer billing or back-office controls that belong to the business owner.",
        bullets: [
          "Check-in can confirm arrival for internal operations.",
          "The business owner remains the primary account for customer communications and payouts.",
          "Support issues can still be escalated with booking context attached."
        ]
      }
    ]
  },
  {
    id: "crew-member-support-and-pay",
    audience: "crew-member",
    slug: "support-ratings-and-work-history",
    title: "Get help with assignments, ratings, and work history",
    summary:
      "Understand what crew members should see about feedback, support, and historical completed jobs.",
    readTimeMinutes: 3,
    updatedAt: "2026-05-07",
    sections: [
      {
        heading: "Feedback should stay fair and contextual",
        body:
          "Customers review the landscaping business after a completed booking, while internal crew performance can still be tracked separately by the business owner.",
        bullets: [
          "Customer-facing reviews stay attached to the provider business profile.",
          "Crew members can still keep internal completion history and dependability signals.",
          "Support notes should distinguish customer disputes from internal staffing issues."
        ]
      },
      {
        heading: "When to contact support",
        body:
          "The crew-member help flow should make it easy to flag assignment confusion, unsafe conditions, or account issues without mixing in owner-only billing controls.",
        bullets: [
          "Use assignment-linked support when a route or meeting point is unclear.",
          "Report account access issues from the same shared help center.",
          "Keep crew support content separate from provider payout documentation."
        ]
      }
    ]
  }
];

export const helpCollections: Record<HelpAudience, HelpCollection> = {
  customer: {
    audience: "customer",
    title: "Customer help",
    description:
      "Guides for booking services, understanding instant quotes, managing saved properties, and resolving payment or service issues.",
    quickLinks: [
      "Booking and address management",
      "Instant quotes and follow-up questions",
      "Billing, refunds, and service quality",
      "Post-service reviews"
    ],
    articles: customerArticles
  },
  provider: {
    audience: "provider",
    title: "Provider help",
    description:
      "Guides for profile setup, service radius management, calendar sync, payouts, disputes, and operational workflows.",
    quickLinks: [
      "Profile and service area",
      "Calendar sync and job duration",
      "Payouts, refunds, and disputes"
    ],
    articles: providerArticles
  },
  "crew-member": {
    audience: "crew-member",
    title: "Crew member help",
    description:
      "Guides for joining landscaping crews, managing daily assignments, understanding check-in expectations, and getting help without business-owner clutter.",
    quickLinks: [
      "Joining crews and setting availability",
      "Day-of-job and check-in",
      "Support, ratings, and work history"
    ],
    articles: crewMemberArticles
  }
};

export const helpAudienceLabels: Record<HelpAudience, string> = {
  customer: "Customers",
  provider: "Providers",
  "crew-member": "Crew members"
};

export function getHelpCollection(audience: HelpAudience): HelpCollection {
  return helpCollections[audience];
}

export function getAllHelpArticles(): HelpArticle[] {
  return [
    ...helpCollections.customer.articles,
    ...helpCollections.provider.articles,
    ...helpCollections["crew-member"].articles
  ];
}
