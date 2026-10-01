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
      "Save your properties and choose the right address for each visit.",
    readTimeMinutes: 4,
    updatedAt: "2026-09-28",
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
        heading: "Check the address on your booking",
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
    title: "Get a quote for your property",
    summary:
      "See how YardMatch estimates lawn size from the address first and only asks follow-up questions when confidence is lower.",
    readTimeMinutes: 5,
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Address first, not a long form",
        body:
          "Enter your service address and choose the work you need to get started.",
        bullets: [
          "Automated measurement estimates turf, shrubs, driveway, and sidewalk work.",
          "The estimated job length helps determine available appointment times.",
          "Review the estimated price before requesting a booking."
        ]
      },
      {
        heading: "When follow-up questions appear",
        body:
          "The platform only asks a small number of clarifying questions if it needs more certainty before pricing the job.",
        bullets: [
          "A quote may be available from your property details alone.",
          "You may be asked a few questions about the property or work.",
          "Some requests need provider review before the price can be confirmed."
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
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Open support from the booking record",
        body:
          "Open the affected booking and describe the issue so support can review the right service and payment details.",
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
          "Include the payment or charge you have a question about.",
          "Check your support request for the refund decision.",
          "Submitting a refund request does not guarantee a refund."
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
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Reviews only unlock after service is complete",
        body:
          "You can review your provider after the service is complete and your review invitation is available.",
        bullets: [
          "The provider completes the booking first.",
          "Your review invitation is scheduled for 48 hours after completion.",
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
    updatedAt: "2026-09-28",
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
          "Choose an area your crew can reliably reach while staying on schedule.",
        bullets: [
          "Allow enough travel time between jobs when setting your radius.",
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
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Connect external calendars",
        body:
          "Calendar integration helps the marketplace offer only slots that fit the crew schedule.",
        bullets: [
          "Sync Apple, Google, or Outlook calendars.",
          "Use your calendar subscription link to view jobs in an external calendar.",
          "Keep your availability and busy times up to date to avoid double-booking."
        ]
      },
      {
        heading: "How job length is estimated",
        body:
          "Estimated job duration comes from the instant quote engine so larger properties reserve more time automatically.",
        bullets: [
          "Bigger yards create larger booking windows.",
          "Travel impact can be reviewed if the address changes after confirmation.",
          "Review the schedule before accepting additional work."
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
      "Check payout status and get help with refund requests or service concerns.",
    readTimeMinutes: 4,
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Payments and payouts",
        body:
          "Customer payments can be authorized up front and captured after completion to protect both sides of the marketplace.",
        bullets: [
          "Authorization confirms the customer can pay before dispatch.",
          "Customer payments are captured after the job is completed.",
          "Review disputes and refunds with the details of the affected booking."
        ]
      },
      {
        heading: "Handling service issues",
        body:
          "If a customer raises a concern, review the booking and respond through support with relevant details.",
        bullets: [
          "Review the original notes, photos, and booked address.",
          "Respond quickly when a confirmed booking address change needs review.",
          "Keep your responses and relevant photos in the support request."
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
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Set realistic work preferences",
        body:
          "Add your skills, work preferences, and travel area so businesses can find you for suitable jobs.",
        bullets: [
          "Choose the service categories you are comfortable performing on a crew.",
          "Publish a travel radius from your home base or meeting point.",
          "Mark whether you are looking for full-time, part-time, seasonal, or flexible assignments."
        ]
      },
      {
        heading: "Why equipment ownership is optional",
        body:
          "You can join a crew without owning a truck or mower. Confirm the equipment and transport arrangements with the business before accepting a job.",
        bullets: [
          "Review the skills and equipment required for each assignment.",
          "The landscaping business is responsible for the customer booking.",
          "Use your crew account to review assignments and record your work."
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
      "Check where to go, who you are meeting, and what work is assigned for the day.",
    readTimeMinutes: 4,
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Read the assignment before leaving",
        body:
          "Check the meeting point, service notes, time window, and responsible business owner or crew lead before leaving.",
        bullets: [
          "Review access notes before arriving on site.",
          "Use schedule blocks sized to the quoted duration for the property.",
          "Keep route changes visible so the full crew is aligned."
        ]
      },
      {
        heading: "Check-in and completion signals",
        body:
          "Use your assignment tools to record arrival, add work photos, and update progress. The business owner manages customer billing and completes the booking.",
        bullets: [
          "Record your arrival when you reach the job.",
          "The business owner remains the primary account for customer communications and payouts.",
          "Include the assignment details when requesting support."
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
      "Find completed assignments, review feedback, and get help with your work history.",
    readTimeMinutes: 3,
    updatedAt: "2026-09-28",
    sections: [
      {
        heading: "Customer reviews and your work history",
        body:
          "Customers review the landscaping business after a completed booking, while internal crew performance can still be tracked separately by the business owner.",
        bullets: [
          "Customer-facing reviews stay attached to the provider business profile.",
          "Find your completed assignments in your work history.",
          "Describe whether your concern is about an assignment, the business, or your account."
        ]
      },
      {
        heading: "When to contact support",
        body:
          "Contact support about unclear assignments, unsafe conditions, or account issues. Include the assignment and relevant details.",
        bullets: [
          "Use assignment-linked support when a route or meeting point is unclear.",
          "Report account access issues from the same shared help center.",
          "Contact the business responsible for your assignment with questions about your pay."
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
      "Guides for your business profile, service area, calendar, payouts, and customer support.",
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
      "Guides for joining crews, managing assignments, recording your work, and getting help.",
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
