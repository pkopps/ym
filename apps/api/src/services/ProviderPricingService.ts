import {
  defaultServiceStartingPrices, type ProviderPricingOverview, type ProviderProfile,
  type ProviderServicePrice, type ServiceCategory, type UpdateZipServiceMinimumRequest,
  type ZipServiceMinimumRecord
} from "@yardmatch/contracts";
import { HttpError } from "../http";
import type { MarketplaceRepository } from "../repositories/MarketplaceRepository";

export function normalizePricingZip(value: unknown): string {
  if (typeof value !== "string" || !/^\d{5}(?:-\d{4})?$/.test(value.trim())) {
    throw new HttpError(400, "Enter a five-digit US ZIP code.");
  }
  return value.trim().slice(0, 5);
}
function category(value: unknown): asserts value is ServiceCategory {
  if (typeof value !== "string" || !Object.hasOwn(defaultServiceStartingPrices, value)) {
    throw new HttpError(400, "Choose a supported service.");
  }
}
function amount(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > 1_000_000) {
    throw new HttpError(400, "Enter a price between $0.01 and $10,000.00, in whole cents.");
  }
}

export class ProviderPricingService {
  constructor(private readonly repository: MarketplaceRepository) {}

  public async minimums(postalCode: string) {
    return this.repository.listZipServiceMinimums(normalizePricingZip(postalCode));
  }

  public async setMinimum(actorId: string, input: UpdateZipServiceMinimumRequest): Promise<ZipServiceMinimumRecord> {
    const actor = await this.repository.findOpsUserById(actorId);
    if (actor?.internalScope !== "admin") throw new HttpError(403, "Only ops admins can set ZIP minimums.");
    const postalCode = normalizePricingZip(input?.postalCode);
    category(input?.category);
    amount(input.minimumStartingPriceCents);
    if (typeof input.reason !== "string" || input.reason.trim().length < 5 || input.reason.trim().length > 500) {
      throw new HttpError(400, "Add a reason between 5 and 500 characters.");
    }
    return this.repository.withLock(`pricing-zip:${postalCode}`, async repository => {
      const previous = (await repository.listZipServiceMinimums(postalCode)).find(row => row.category === input.category);
      return repository.saveZipServiceMinimum({ postalCode, category: input.category,
        minimumStartingPriceCents: input.minimumStartingPriceCents,
        history: [...(previous?.history ?? []), { changedAt: new Date().toISOString(), changedBy: actorId,
          previousMinimumCents: previous?.minimumStartingPriceCents,
          minimumStartingPriceCents: input.minimumStartingPriceCents, reason: input.reason.trim() }] });
    });
  }

  public async validatePrices(categories: ServiceCategory[], prices: ProviderServicePrice[]): Promise<ProviderServicePrice[]> {
    if (!Array.isArray(prices) || prices.length < 1 || prices.length > 100) throw new HttpError(400, "Choose 1 to 100 service prices.");
    const seen = new Set<string>();
    const normalized = prices.map(row => {
      const postalCode = normalizePricingZip(row?.postalCode);
      category(row?.category);
      amount(row.startingPriceCents);
      if (!categories.includes(row.category)) throw new HttpError(400, "You can only price services your business provides.");
      const key = `${postalCode}:${row.category}`;
      if (seen.has(key)) throw new HttpError(400, "Each service and ZIP may appear only once.");
      seen.add(key);
      return { postalCode, category: row.category, startingPriceCents: row.startingPriceCents };
    });
    const minimums = (await Promise.all([...new Set(normalized.map(row => row.postalCode))].map(zip => this.minimums(zip)))).flat();
    for (const row of normalized) {
      const minimum = minimums.find(item => item.postalCode === row.postalCode && item.category === row.category);
      if (!minimum) throw new HttpError(409, `Pricing is not available for ${row.category} in ZIP ${row.postalCode} yet.`);
      if (row.startingPriceCents < minimum.minimumStartingPriceCents) {
        throw new HttpError(400, `The starting price for ${row.category} in ZIP ${row.postalCode} must be at least $${(minimum.minimumStartingPriceCents / 100).toFixed(2)}.`);
      }
    }
    return normalized;
  }

  public async overview(providerId: string, zip: string): Promise<ProviderPricingOverview> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) throw new HttpError(404, "Provider not found.");
    const postalCode = normalizePricingZip(zip);
    const minimums = await this.minimums(postalCode);
    return { postalCode, prices: provider.categories.map(category => {
      const savedStartingPriceCents = provider.servicePrices?.find(row => row.postalCode === postalCode && row.category === category)?.startingPriceCents;
      const minimumStartingPriceCents = minimums.find(row => row.category === category)?.minimumStartingPriceCents;
      return { category, savedStartingPriceCents, minimumStartingPriceCents,
        effectiveStartingPriceCents: Math.max(savedStartingPriceCents ?? defaultServiceStartingPrices[category], minimumStartingPriceCents ?? 0) };
    }) };
  }

  public async save(providerId: string, prices: ProviderServicePrice[]): Promise<ProviderPricingOverview> {
    // Lock the provider so simultaneous edits in different ZIPs cannot overwrite one another.
    return this.repository.withLock(`provider-pricing:${providerId}`, async repository => {
      const provider = await repository.findProviderById(providerId);
      if (!provider) throw new HttpError(404, "Provider not found.");
      const scoped = new ProviderPricingService(repository);
      const normalized = await scoped.validatePrices(provider.categories, prices);
      const retained = (provider.servicePrices ?? []).filter(row => !normalized.some(next => next.postalCode === row.postalCode && next.category === row.category));
      if (retained.length + normalized.length > 1000) throw new HttpError(400, "Your business can save up to 1,000 service prices.");
      await repository.updateProvider(providerId, { servicePrices: [...retained, ...normalized] });
      return scoped.overview(providerId, normalized[0].postalCode);
    });
  }

  public async startingPrice(postalCode: string, service: ServiceCategory, providerId?: string): Promise<number> {
    category(service);
    const zip = normalizePricingZip(postalCode);
    let provider: ProviderProfile | undefined;
    if (providerId) {
      provider = await this.repository.findProviderById(providerId);
      if (!provider || !provider.categories.includes(service)) throw new HttpError(400, "This provider does not offer the selected service.");
    }
    const minimum = (await this.minimums(zip)).find(row => row.category === service)?.minimumStartingPriceCents ?? 0;
    const saved = provider?.servicePrices?.find(row => row.postalCode === zip && row.category === service)?.startingPriceCents;
    return Math.max(saved ?? defaultServiceStartingPrices[service], minimum);
  }
}
