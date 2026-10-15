import { MarketplaceApiError } from "@yardmatch/contracts";

/**
 * The API answers 404 for launch features that are switched off (YARDMATCH_PAYMENTS_ENABLED).
 * Resolve those to undefined so the rest of a screen still loads and the feature stays hidden.
 */
export async function unlessFeatureDisabled<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.statusCode === 404) {
      return undefined;
    }
    throw error;
  }
}
