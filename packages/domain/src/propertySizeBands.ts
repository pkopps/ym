/**
 * The lawn-size bands the booking flow already shows customers when an automated
 * estimate is uncertain. They are defined once here so pricing questions and
 * size-tiered economics read the same boundaries.
 *
 * A band covers sizes up to and including `maxSqFtInclusive`; the last band is open-ended.
 */
export interface LawnSizeBand {
  id: "under-2000" | "2000-to-5000" | "5000-to-9000" | "over-9000";
  label: string;
  /** Value stored as the `turf_sq_ft` follow-up answer when a customer picks this band. */
  representativeSqFt: number;
  maxSqFtInclusive?: number;
}

export const LAWN_SIZE_BANDS: readonly LawnSizeBand[] = Object.freeze([
  { id: "under-2000", label: "Under 2,000 sq ft", representativeSqFt: 1800, maxSqFtInclusive: 1999 },
  { id: "2000-to-5000", label: "2,000 to 5,000 sq ft", representativeSqFt: 3500, maxSqFtInclusive: 5000 },
  { id: "5000-to-9000", label: "5,000 to 9,000 sq ft", representativeSqFt: 7000, maxSqFtInclusive: 9000 },
  { id: "over-9000", label: "Over 9,000 sq ft", representativeSqFt: 11000 }
] as const);

/** Returns undefined when no usable lawn size is on file. */
export function resolveLawnSizeBand(lawnSizeSqFt: number | undefined | null): LawnSizeBand | undefined {
  if (typeof lawnSizeSqFt !== "number" || !Number.isFinite(lawnSizeSqFt) || lawnSizeSqFt <= 0) {
    return undefined;
  }
  return (
    LAWN_SIZE_BANDS.find(
      (band) => band.maxSqFtInclusive === undefined || lawnSizeSqFt <= band.maxSqFtInclusive
    ) ?? LAWN_SIZE_BANDS[LAWN_SIZE_BANDS.length - 1]
  );
}
