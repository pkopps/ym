import type { FinderFeeChargeRecord, FinderFeeChargeStatus } from "@yardmatch/contracts";

/** The customer-provider pair, booking, provider waiver or payment intent is already recorded. */
export class FinderFeeRelationshipConflictError extends Error {
  public constructor(message = "This customer-provider relationship already has a finder-fee record.") {
    super(message);
    this.name = "FinderFeeRelationshipConflictError";
  }
}

export interface FinderFeeChargeQuery {
  providerId?: string;
  statuses?: FinderFeeChargeStatus[];
}

export function matchesFinderFeeQuery(record: FinderFeeChargeRecord, query: FinderFeeChargeQuery): boolean {
  return (!query.providerId || record.providerId === query.providerId) &&
    (!query.statuses || query.statuses.includes(record.status));
}

/** In-memory equivalent of the table's unique constraints. */
export function findFinderFeeUniqueConflict(
  records: FinderFeeChargeRecord[],
  candidate: FinderFeeChargeRecord
): string | undefined {
  for (const record of records) {
    if (record.id === candidate.id) continue;
    if (record.customerId === candidate.customerId && record.providerId === candidate.providerId) return "customer-provider";
    if (record.bookingId === candidate.bookingId) return "booking";
    if (record.waived && candidate.waived && record.providerId === candidate.providerId) return "provider-waiver";
    if (record.stripePaymentIntentId && record.stripePaymentIntentId === candidate.stripePaymentIntentId) return "payment-intent";
  }
  return undefined;
}
