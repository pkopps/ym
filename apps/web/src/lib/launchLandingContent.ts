import type { Metadata } from "next";
import { buildSiteUrl, launchAreaLabel } from "./site";

export type LaunchLandingServiceKey = "lawn-mowing" | "yard-cleanup";
export { launchAreaLabel };

type LandingFaq = {
  question: string;
  answer: string;
};

type LaunchLandingServiceContent = {
  key: LaunchLandingServiceKey;
  name: string;
  shortName: string;
  path: string;
  townPath: string;
  title: string;
  description: string;
  intro: string;
  includes: string[];
  bestFor: string[];
  pricingFactors: string[];
  faqs: LandingFaq[];
};

export const launchAreaShortLabel = launchAreaLabel.replace(", NJ", "");

export const launchServiceContent: Record<LaunchLandingServiceKey, LaunchLandingServiceContent> = {
  "lawn-mowing": {
    key: "lawn-mowing",
    name: "Lawn mowing",
    shortName: "mowing",
    path: "/services/lawn-mowing",
    townPath: "/barnegat-nj/lawn-mowing",
    title: `Lawn Mowing in ${launchAreaLabel}`,
    description:
      `Book recurring or one-time lawn mowing in ${launchAreaLabel} with a recommendation-first booking flow and vetted local providers.`,
    intro:
      "YardMatch helps homeowners book routine cuts without bouncing between directories, quote forms, and callback chains.",
    includes: [
      "routine mowing for weekly or biweekly upkeep",
      "basic edging and cleanup notes before the visit",
      "one recommended provider first, with a short backup list if needed"
    ],
    bestFor: [
      "homeowners who want recurring mowing without comparison shopping",
      "seasonal residents who need reliable upkeep between visits",
      "busy families who want a faster booking flow and clearer follow-through"
    ],
    pricingFactors: [
      "property size and cut complexity",
      "recurring versus one-time cadence",
      "site access, slope, and trimming requirements"
    ],
    faqs: [
      {
        question: `How often should homeowners schedule lawn mowing in ${launchAreaLabel}?`,
        answer:
          "Most launch customers will fall into weekly or biweekly service depending on growth rate, weather, and the look they want to maintain."
      },
      {
        question: "Can I book one visit first and decide on recurring service later?",
        answer:
          "Yes. The recommendation-first flow still works for one-time visits, and repeat-service nudges can come after a completed job."
      },
      {
        question: "What if I want to compare another provider before booking?",
        answer:
          "YardMatch keeps a limited backup path available so you can reveal a short list of other qualified providers without turning the whole experience into a directory."
      }
    ]
  },
  "yard-cleanup": {
    key: "yard-cleanup",
    name: "Yard cleanup",
    shortName: "cleanup",
    path: "/services/yard-cleanup",
    townPath: "/barnegat-nj/yard-cleanup",
    title: `Yard Cleanup in ${launchAreaLabel}`,
    description:
      `Book yard cleanup in ${launchAreaLabel} for leaves, debris, seasonal reset work, and curb-appeal prep through YardMatch.`,
    intro:
      "Use YardMatch when the job is bigger than a quick mow and you want a cleaner handoff around scope, timing, and follow-through.",
    includes: [
      "leaf, debris, and overgrowth cleanup support",
      "seasonal reset jobs before listing, hosting, or regular maintenance",
      "recommendation-first booking with clear support if scope questions come up"
    ],
    bestFor: [
      "seasonal cleanups before or after heavier growth periods",
      "homeowners preparing for guests, listings, or a fresh maintenance cadence",
      "properties that need more reset work than a standard mow visit"
    ],
    pricingFactors: [
      "volume of leaves, debris, and haul-away work",
      "property size and access",
      "whether the cleanup includes trimming, bed reset, or follow-up mowing"
    ],
    faqs: [
      {
        question: "What is included in a yard cleanup service?",
        answer:
          "That depends on the job, but launch cleanup requests usually center on leaves, debris, overgrowth, curb-edge reset, and getting the property back to a maintainable baseline."
      },
      {
        question: `When should homeowners book cleanup work in ${launchAreaLabel}?`,
        answer:
          "The best timing depends on weather, season, and property condition, but cleanup tends to convert well when homeowners want a visible reset before regular maintenance starts."
      },
      {
        question: "What if the property needs a more custom scope?",
        answer:
          "YardMatch can still route the request, but the pricing and recommendation flow should stay honest about when manual review or clearer scope confirmation is needed."
      }
    ]
  }
};

export const launchTownPageLinks = [
  {
    href: launchServiceContent["lawn-mowing"].townPath,
    title: `Lawn mowing in ${launchAreaShortLabel}`,
    body: "Book recurring or one-time cuts with a recommendation-first flow."
  },
  {
    href: launchServiceContent["yard-cleanup"].townPath,
    title: `Yard cleanup in ${launchAreaShortLabel}`,
    body: "Reset overgrown, leafy, or messy yards before the next season or service cadence."
  },
  {
    href: launchServiceContent["lawn-mowing"].path,
    title: "General lawn-mowing page",
    body: "Use the service page when you want the broader booking explanation beyond the Barnegat-specific launch story."
  },
  {
    href: launchServiceContent["yard-cleanup"].path,
    title: "General yard-cleanup page",
    body: "Use the service page when the question is scope, pricing factors, or what cleanup usually includes."
  }
] as const;

export function buildLaunchMetadata({
  title,
  description,
  path
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: buildSiteUrl(path)
    },
    openGraph: {
      title: `${title} | YardMatch`,
      description,
      url: buildSiteUrl(path)
    }
  };
}
