import type { ServiceCategory } from "./types";

/** Existing quote base amounts, before labor and property-size adjustments. Not ZIP minimums. */
export const defaultServiceStartingPrices: Record<ServiceCategory, number> = {
  "lawn-mowing": 2800, "hedge-trimming": 4200, "mulch-installation": 6500,
  "seasonal-cleanup": 5200, "weed-control": 3000, "irrigation-check": 3900,
  "leaf-blowing": 2400, aeration: 3600, fertilization: 3300, "gutter-cleaning": 5200,
  "snow-shoveling": 2600, "ice-melt-salting": 2400, "snow-blowing": 3000
};
export interface ProviderServicePrice {
  postalCode: string;
  category: ServiceCategory;
  startingPriceCents: number;
}
export interface ZipServiceMinimum {
  postalCode: string;
  category: ServiceCategory;
  minimumStartingPriceCents: number;
}
export interface PricingMinimumAuditEntry {
  changedAt: string;
  changedBy: string;
  previousMinimumCents?: number;
  minimumStartingPriceCents: number;
  reason: string;
}
export interface ZipServiceMinimumRecord extends ZipServiceMinimum {
  history: PricingMinimumAuditEntry[];
}
export interface UpdateZipServiceMinimumRequest extends ZipServiceMinimum { reason: string }
export interface ProviderPricingOverview {
  postalCode: string;
  prices: Array<{
    category: ServiceCategory;
    minimumStartingPriceCents?: number;
    savedStartingPriceCents?: number;
    effectiveStartingPriceCents: number;
  }>;
}
/** Accept dollar strings without float rounding, exponents, negatives or extra decimal places. */
export function parsePriceDollars(value: string): number | undefined {
  const match = /^(\d{1,5})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 && cents <= 1_000_000 ? cents : undefined;
}
