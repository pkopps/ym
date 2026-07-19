import type { I18nInstance, TranslationKey } from "@yardmatch/i18n";

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
  keyPrefix: string;
  surfaces: TrustPolicySurface[];
  sectionBulletCounts: readonly number[];
}

export interface LocalizedTrustPolicyPageContent {
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
    keyPrefix: "trust_policy.support",
    surfaces: ["home", "help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "cancellation-policy",
    href: "/cancellation-policy",
    keyPrefix: "trust_policy.cancellation_policy",
    surfaces: ["home", "help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "refund-policy",
    href: "/refund-policy",
    keyPrefix: "trust_policy.refund_policy",
    surfaces: ["home", "help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "booking-expectations",
    href: "/booking-expectations",
    keyPrefix: "trust_policy.booking_expectations",
    surfaces: ["home", "help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "provider-verification",
    href: "/provider-verification",
    keyPrefix: "trust_policy.provider_verification",
    surfaces: ["home", "help", "footer", "provider"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "privacy-policy",
    href: "/privacy-policy",
    keyPrefix: "trust_policy.privacy_policy",
    surfaces: ["help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "terms-of-service",
    href: "/terms-of-service",
    keyPrefix: "trust_policy.terms_of_service",
    surfaces: ["help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  },
  {
    id: "provider-standards",
    href: "/provider-standards",
    keyPrefix: "trust_policy.provider_standards",
    surfaces: ["provider", "help", "footer"],
    sectionBulletCounts: [3, 3, 3]
  }
];

export function getTrustPolicyPageKey(page: TrustPolicyPageContent, suffix: string): TranslationKey {
  return `${page.keyPrefix}.${suffix}` as TranslationKey;
}

export function localizeTrustPolicyPage(
  i18n: I18nInstance,
  page: TrustPolicyPageContent
): LocalizedTrustPolicyPageContent {
  return {
    id: page.id,
    href: page.href,
    eyebrow: i18n.t(getTrustPolicyPageKey(page, "eyebrow")),
    title: i18n.t(getTrustPolicyPageKey(page, "title")),
    description: i18n.t(getTrustPolicyPageKey(page, "description")),
    summary: i18n.t(getTrustPolicyPageKey(page, "summary")),
    ctaLabel: i18n.t(getTrustPolicyPageKey(page, "cta")),
    surfaces: page.surfaces,
    sections: page.sectionBulletCounts.map((bulletCount, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const sectionPrefix = `section.${sectionNumber}`;

      return {
        heading: i18n.t(getTrustPolicyPageKey(page, `${sectionPrefix}.heading`)),
        body: i18n.t(getTrustPolicyPageKey(page, `${sectionPrefix}.body`)),
        bullets: Array.from({ length: bulletCount }, (_, bulletIndex) =>
          i18n.t(getTrustPolicyPageKey(page, `${sectionPrefix}.bullet.${bulletIndex + 1}`))
        )
      };
    })
  };
}

export const trustPolicyPageById = Object.fromEntries(
  trustPolicyPages.map((page) => [page.id, page])
) as Record<TrustPolicyPageId, TrustPolicyPageContent>;
