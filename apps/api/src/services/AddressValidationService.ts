import { Address } from "@yardmatch/contracts";
import { withAbortableTimeout } from "../integrations/outboundRequestTimeout";

export type AddressValidationOutcome = {
  address: Address;
  source: "local-rules" | "google-address-validation";
  confidence: "local-only" | "validated" | "review-suggested";
  message?: string;
};

type GoogleAddressValidationResponse = {
  result?: {
    verdict?: {
      addressComplete?: boolean;
      hasUnconfirmedComponents?: boolean;
      hasInferredComponents?: boolean;
      hasReplacedComponents?: boolean;
      validationGranularity?: string;
    };
    address?: {
      postalAddress?: {
        addressLines?: string[];
        locality?: string;
        administrativeArea?: string;
        postalCode?: string;
        regionCode?: string;
      };
      formattedAddress?: string;
    };
    geocode?: {
      location?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
};

export class AddressValidationService {
  public constructor(
    private readonly googleAddressValidationApiKey?: string,
    private readonly externalRequestTimeoutMs = 5_000
  ) {}

  public async validateAddress(address: Address): Promise<AddressValidationOutcome> {
    if (!this.googleAddressValidationApiKey) {
      return {
        address,
        source: "local-rules",
        confidence: "local-only"
      };
    }
    const googleAddressValidationApiKey = this.googleAddressValidationApiKey;

    try {
      return await withAbortableTimeout(async (signal) => {
        const response = await fetch(
          `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(
            googleAddressValidationApiKey
          )}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              address: {
                regionCode: address.country || "US",
                addressLines: [address.line1, address.line2].filter(Boolean)
              },
              enableUspsCass: true
            }),
            signal
          }
        );

        if (!response.ok) {
          return {
            address,
            source: "local-rules" as const,
            confidence: "local-only" as const
          };
        }

        const payload = (await response.json()) as GoogleAddressValidationResponse;
        return this.fromGoogleValidationPayload(address, payload);
      }, {
        timeoutMs: this.externalRequestTimeoutMs,
        timeoutMessage: "Google address validation timed out."
      });
    } catch {
      return {
        address,
        source: "local-rules",
        confidence: "local-only"
      };
    }
  }

  private fromGoogleValidationPayload(
    fallbackAddress: Address,
    payload: GoogleAddressValidationResponse
  ): AddressValidationOutcome {
    const postalAddress = payload.result?.address?.postalAddress;
    const addressLines = postalAddress?.addressLines?.filter(Boolean) ?? [];
    const verdict = payload.result?.verdict;
    const location = payload.result?.geocode?.location;

    const validatedAddress: Address = {
      ...fallbackAddress,
      line1: addressLines[0] ?? fallbackAddress.line1,
      line2: addressLines[1] ?? fallbackAddress.line2,
      city: postalAddress?.locality ?? fallbackAddress.city,
      state: postalAddress?.administrativeArea ?? fallbackAddress.state,
      postalCode: postalAddress?.postalCode ?? fallbackAddress.postalCode,
      country: postalAddress?.regionCode ?? fallbackAddress.country,
      point:
        location?.latitude !== undefined && location?.longitude !== undefined
          ? {
              latitude: location.latitude,
              longitude: location.longitude
            }
          : fallbackAddress.point,
      geocodedAt:
        location?.latitude !== undefined && location?.longitude !== undefined
          ? new Date().toISOString()
          : fallbackAddress.geocodedAt,
      geocodePrecision:
        location?.latitude !== undefined && location?.longitude !== undefined
          ? "address"
          : fallbackAddress.geocodePrecision,
      geocodeProvider:
        location?.latitude !== undefined && location?.longitude !== undefined
          ? "google-address-validation"
          : fallbackAddress.geocodeProvider
    };

    const addressComplete = verdict?.addressComplete === true;
    const hasUnconfirmed = verdict?.hasUnconfirmedComponents === true;
    const hasInferred = verdict?.hasInferredComponents === true;
    const hasReplaced = verdict?.hasReplacedComponents === true;
    const confidence =
      addressComplete && !hasUnconfirmed && !hasInferred
        ? "validated"
        : hasUnconfirmed || hasInferred || hasReplaced
          ? "review-suggested"
          : "validated";

    const message =
      confidence === "validated"
        ? "Validated with Google Address Validation before matching and quoting."
        : "Google Address Validation cleaned up the address, but some details may still need review.";

    return {
      address: validatedAddress,
      source: "google-address-validation",
      confidence,
      message
    };
  }
}
