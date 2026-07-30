import {
  ProviderCredential,
  ProviderCredentialReadiness,
  ProviderCredentialRequirement,
  ProviderProfile
} from "@yardmatch/contracts";

const BASE_REQUIREMENTS: ProviderCredentialRequirement[] = [
  {
    type: "business-registration",
    label: "Business registration",
    reason: "Confirms that the provider business is identifiable and registered for contracting.",
    jurisdiction: "NJ",
    legalReviewRequired: true
  },
  {
    type: "general-liability-insurance",
    label: "General liability insurance",
    reason: "Protects the customer, provider, and marketplace from common property-service claims.",
    jurisdiction: "NJ",
    legalReviewRequired: true
  }
];

const PESTICIDE_CATEGORIES = new Set<ProviderProfile["categories"][number]>([
  "fertilization",
  "weed-control"
]);

export function getProviderCredentialRequirements(
  provider: Pick<ProviderProfile, "categories">
): ProviderCredentialRequirement[] {
  const requirements = [...BASE_REQUIREMENTS];
  if (provider.categories.some((category) => PESTICIDE_CATEGORIES.has(category))) {
    requirements.push({
      type: "pesticide-applicator-license",
      label: "Pesticide applicator credential",
      reason:
        "Fertilization and weed-control work can involve regulated pesticide application; launch requires credential and counsel review before matching this category.",
      jurisdiction: "NJ",
      legalReviewRequired: true
    });
  }
  return requirements;
}

export function evaluateProviderCredentialReadiness(
  provider: Pick<ProviderProfile, "categories">,
  credentials: ProviderCredential[],
  now = new Date()
): ProviderCredentialReadiness {
  const requirements = getProviderCredentialRequirements(provider);
  const missingTypes: ProviderCredential["type"][] = [];
  const expiredTypes: ProviderCredential["type"][] = [];
  const pendingTypes: ProviderCredential["type"][] = [];

  for (const requirement of requirements) {
    const credential = credentials.find(
      (candidate) =>
        candidate.type === requirement.type &&
        candidate.jurisdiction.toUpperCase() === requirement.jurisdiction
    );
    if (!credential) {
      missingTypes.push(requirement.type);
      continue;
    }
    if (
      credential.status === "expired" ||
      (credential.expiresAt && Date.parse(credential.expiresAt) <= now.getTime())
    ) {
      expiredTypes.push(requirement.type);
      continue;
    }
    if (credential.status !== "verified") {
      pendingTypes.push(requirement.type);
    }
  }

  const workersComp = credentials.find(
    (credential) =>
      credential.type === "workers-compensation" &&
      credential.jurisdiction.toUpperCase() === "NJ" &&
      credential.status === "verified" &&
      (!credential.expiresAt || Date.parse(credential.expiresAt) > now.getTime())
  );
  const ready = missingTypes.length === 0 && expiredTypes.length === 0 && pendingTypes.length === 0;
  const warnings = [
    ...missingTypes.map((type) => `Missing required credential: ${type}.`),
    ...expiredTypes.map((type) => `Expired required credential: ${type}.`),
    ...pendingTypes.map((type) => `Credential still needs ops review: ${type}.`)
  ];
  if (!workersComp) {
    warnings.push(
      "Crew engagement is blocked until verified workers-compensation coverage or a counsel-approved exemption is recorded."
    );
  }

  return {
    ready,
    missingTypes,
    expiredTypes,
    pendingTypes,
    requirements,
    crewEngagementAllowed: Boolean(workersComp),
    warnings
  };
}
