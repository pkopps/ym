import type { CreateBookingRequest, CreateRecurringServicePlanRequest } from "@yardmatch/contracts";
import { GeoService } from "@yardmatch/domain";
import { signScopedToken } from "../../src/auth";
import type { InMemoryMarketplaceRepository } from "../../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplacePlatformService } from "../../src/services/MarketplacePlatformService";

/**
 * Legacy workflow scenarios use synthetic properties and agreed test prices. Provision
 * approved fixture supply and a server-signed price explicitly instead of relying on the
 * former missing booking guards. Security/pricing regression tests use the public methods
 * directly, without this fixture helper.
 */
async function prepare(platform: MarketplacePlatformService, repository: InMemoryMarketplaceRepository, customerId: string, payload: CreateBookingRequest): Promise<CreateBookingRequest> {
  const provider = await repository.findProviderById(payload.providerId);
  const quote = await platform.createInstantQuote({ customerId, propertyId: payload.servicePropertyId, address: payload.serviceAddress, category: payload.category });
  if (provider) {
    const submittedAt = new Date().toISOString();
    const credentials = ["business-registration", "general-liability-insurance", "workers-compensation", "pesticide-applicator-license"] as const;
    await repository.updateProvider(provider.id, {
      verificationStatus: "verified",
      categories: [...new Set([...provider.categories, payload.category])],
      ...(new GeoService().distanceMiles(provider.address, quote.address) > provider.serviceRadiusMiles ? { address: quote.address } : {}),
      credentials: credentials.map((type) => ({ id: `fixture-${provider.id}-${type}`, providerId: provider.id, type, status: "verified", jurisdiction: "NJ", submittedAt, reviewedAt: submittedAt, expiresAt: "2099-12-31T00:00:00Z" }))
    });
  }
  const addressKey = [quote.address.line1, quote.address.city, quote.address.state, quote.address.postalCode, quote.address.country]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
  return { ...payload, serviceAddress: quote.address, quoteToken: signScopedToken("yardmatch-booking-quote-v1", {
    customerId, propertyId: payload.servicePropertyId, addressKey, category: payload.category, totalCents: payload.totalCents, pricingVersion: 1
  }, 1800) };
}

export async function createWorkflowBooking(platform: MarketplacePlatformService, repository: InMemoryMarketplaceRepository, customerId: string, payload: CreateBookingRequest) {
  return platform.createBooking(customerId, await prepare(platform, repository, customerId, payload));
}

export async function createWorkflowRecurringPlan(platform: MarketplacePlatformService, repository: InMemoryMarketplaceRepository, customerId: string, payload: CreateRecurringServicePlanRequest) {
  return platform.createRecurringServicePlan(customerId, { ...await prepare(platform, repository, customerId, payload), frequency: payload.frequency });
}
