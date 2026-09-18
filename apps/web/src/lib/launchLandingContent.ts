import type { ServiceCategory } from "@yardmatch/contracts";
import type { TranslationKey } from "@yardmatch/i18n";
import { launchAreaLabel } from "./site";

export type LaunchLandingServiceKey = "lawn-mowing" | "yard-cleanup";
export { launchAreaLabel };

type LandingFaq = {
  questionKey: TranslationKey;
  answerKey: TranslationKey;
};

type LaunchLandingServiceContent = {
  key: LaunchLandingServiceKey;
  category: ServiceCategory;
  nameKey: TranslationKey;
  shortNameKey: TranslationKey;
  path: string;
  townPath: string;
  metadataTitleKey: TranslationKey;
  metadataDescriptionKey: TranslationKey;
  serviceMetadataTitleKey: TranslationKey;
  serviceMetadataDescriptionKey: TranslationKey;
  localPlanningKey: TranslationKey;
  introKey: TranslationKey;
  includeKeys: TranslationKey[];
  bestForKeys: TranslationKey[];
  pricingFactorKeys: TranslationKey[];
  faqKeys: LandingFaq[];
};

export const launchAreaShortLabel = launchAreaLabel.replace(", NJ", "");

export const launchServiceContent: Record<LaunchLandingServiceKey, LaunchLandingServiceContent> = {
  "lawn-mowing": {
    key: "lawn-mowing",
    category: "lawn-mowing",
    nameKey: "launch_service.lawn_mowing.name",
    shortNameKey: "launch_service.lawn_mowing.short_name",
    path: "/services/lawn-mowing",
    townPath: "/barnegat-nj/lawn-mowing",
    metadataTitleKey: "launch_service.lawn_mowing.metadata.title",
    metadataDescriptionKey: "launch_service.lawn_mowing.metadata.description",
    serviceMetadataTitleKey: "launch_service.lawn_mowing.general_metadata.title",
    serviceMetadataDescriptionKey: "launch_service.lawn_mowing.general_metadata.description",
    localPlanningKey: "launch_service.lawn_mowing.local_planning",
    introKey: "launch_service.lawn_mowing.intro",
    includeKeys: [
      "launch_service.lawn_mowing.includes.routine",
      "launch_service.lawn_mowing.includes.edging",
      "launch_service.lawn_mowing.includes.recommendation"
    ],
    bestForKeys: [
      "launch_service.lawn_mowing.best_for.recurring",
      "launch_service.lawn_mowing.best_for.seasonal",
      "launch_service.lawn_mowing.best_for.busy"
    ],
    pricingFactorKeys: [
      "launch_service.lawn_mowing.pricing.property_size",
      "launch_service.lawn_mowing.pricing.cadence",
      "launch_service.lawn_mowing.pricing.access"
    ],
    faqKeys: [
      {
        questionKey: "launch_service.lawn_mowing.faq.frequency.question",
        answerKey: "launch_service.lawn_mowing.faq.frequency.answer"
      },
      {
        questionKey: "launch_service.lawn_mowing.faq.one_visit.question",
        answerKey: "launch_service.lawn_mowing.faq.one_visit.answer"
      },
      {
        questionKey: "launch_service.lawn_mowing.faq.compare.question",
        answerKey: "launch_service.lawn_mowing.faq.compare.answer"
      }
    ]
  },
  "yard-cleanup": {
    key: "yard-cleanup",
    category: "seasonal-cleanup",
    nameKey: "launch_service.yard_cleanup.name",
    shortNameKey: "launch_service.yard_cleanup.short_name",
    path: "/services/yard-cleanup",
    townPath: "/barnegat-nj/yard-cleanup",
    metadataTitleKey: "launch_service.yard_cleanup.metadata.title",
    metadataDescriptionKey: "launch_service.yard_cleanup.metadata.description",
    serviceMetadataTitleKey: "launch_service.yard_cleanup.general_metadata.title",
    serviceMetadataDescriptionKey: "launch_service.yard_cleanup.general_metadata.description",
    localPlanningKey: "launch_service.yard_cleanup.local_planning",
    introKey: "launch_service.yard_cleanup.intro",
    includeKeys: [
      "launch_service.yard_cleanup.includes.debris",
      "launch_service.yard_cleanup.includes.seasonal",
      "launch_service.yard_cleanup.includes.recommendation"
    ],
    bestForKeys: [
      "launch_service.yard_cleanup.best_for.seasonal",
      "launch_service.yard_cleanup.best_for.prep",
      "launch_service.yard_cleanup.best_for.reset"
    ],
    pricingFactorKeys: [
      "launch_service.yard_cleanup.pricing.volume",
      "launch_service.yard_cleanup.pricing.access",
      "launch_service.yard_cleanup.pricing.scope"
    ],
    faqKeys: [
      {
        questionKey: "launch_service.yard_cleanup.faq.included.question",
        answerKey: "launch_service.yard_cleanup.faq.included.answer"
      },
      {
        questionKey: "launch_service.yard_cleanup.faq.timing.question",
        answerKey: "launch_service.yard_cleanup.faq.timing.answer"
      },
      {
        questionKey: "launch_service.yard_cleanup.faq.custom.question",
        answerKey: "launch_service.yard_cleanup.faq.custom.answer"
      }
    ]
  }
};
