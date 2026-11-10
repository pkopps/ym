/** Finder-fee billing records (economics policy 2026-10-finder-fee-v1). */
export type FinderFeeChargeStatus =
  /** Provider marked the job complete; waiting for customer confirmation or the dispute window to close. */
  | "awaiting-customer"
  /** The qualifying job has an open dispute or service complaint. */
  | "blocked-by-dispute"
  /** A charge attempt is in flight. */
  | "charging"
  /** The last attempt failed; another attempt is scheduled. */
  | "retry-scheduled"
  /** Automatic attempts are exhausted; ops follow-up or a new card is needed. */
  | "failed"
  | "paid"
  /** The provider's first relationship: no fee. */
  | "waived"
  /** The qualifying job was cancelled or refunded; the relationship can start again. */
  | "void"
  /** The relationship's finder fee was already recorded under the 2026-07 settlement policy. */
  | "covered-by-prior-policy";

export type FinderFeePropertySizeTierName = "typical" | "large" | "very-large";

export interface FinderFeeChargeRecord {
  id: string;
  customerId: string;
  providerId: string;
  bookingId: string;
  policyVersion: string;
  tier: FinderFeePropertySizeTierName;
  lawnSizeBandId?: string;
  listFeeCents: number;
  feeCents: number;
  waived: boolean;
  status: FinderFeeChargeStatus;
  completedAt: string;
  windowEndsAt: string;
  customerConfirmedAt?: string;
  attemptCount: number;
  nextAttemptAt?: string;
  chargeLeaseExpiresAt?: string;
  lastAttemptAt?: string;
  lastFailureReason?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderBillingAccountRecord {
  providerId: string;
  stripeCustomerId: string;
  defaultPaymentMethodId?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderBillingStatusResponse {
  billingConfigured: boolean;
  hasCardOnFile: boolean;
  card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number };
}

export interface StartProviderCardSetupRequest {
  /** App path to return to after Stripe; must start with "/". */
  returnPath?: string;
}

export interface StartProviderCardSetupResponse {
  url: string;
  setupSessionId: string;
}

export interface CompleteProviderCardSetupRequest {
  setupSessionId: string;
}

export interface ConfirmBookingCompletionRequest {
  bookingId: string;
}

export interface ConfirmBookingCompletionResponse {
  bookingId: string;
  confirmedAt: string;
}

export interface OpsFinderFeeExceptionItem {
  chargeId: string;
  bookingId: string;
  providerId: string;
  providerName?: string;
  customerId: string;
  customerName?: string;
  feeCents: number;
  tier: FinderFeePropertySizeTierName;
  status: Extract<FinderFeeChargeStatus, "retry-scheduled" | "failed" | "charging">;
  attemptCount: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastFailureReason?: string;
}
