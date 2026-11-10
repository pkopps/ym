import { randomUUID } from "node:crypto";
import type {
  Booking,
  ConfirmBookingCompletionResponse,
  FinderFeeChargeRecord,
  FinderFeeChargeStatus,
  OpsFinderFeeExceptionItem,
  ProviderBillingStatusResponse,
  StartProviderCardSetupResponse
} from "@yardmatch/contracts";
import {
  ACTIVE_FINDER_FEE_ECONOMICS_POLICY,
  DEFAULT_FINDER_FEE_DISPUTE_WINDOW_HOURS,
  YARDMATCH_ECONOMICS_POLICY_VERSION,
  calculateFinderFee,
  evaluateFinderFeeTrigger,
  resolveFinderFeeWindowEnd,
  type FinderFeeEconomicsPolicy
} from "@yardmatch/domain";
import { HttpError } from "../http";
import { FinderFeeRelationshipConflictError } from "../repositories/finderFeeRecords";
import type { MarketplaceRepository } from "../repositories/MarketplaceRepository";
import type { ProviderBillingGateway, ProviderFeeChargeOutcome } from "./StripeProviderBillingService";

export const FINDER_FEE_DISPUTE_WINDOW_ENV_KEY = "FINDER_FEE_DISPUTE_WINDOW_HOURS";
/** Declined attempts before the charge waits for ops or a new card. */
export const FINDER_FEE_MAX_DECLINED_ATTEMPTS = 5;
const DECLINE_RETRY_HOURS = [1, 6, 24, 48];
const UNKNOWN_OUTCOME_RETRY_MINUTES = 15;
const CHARGE_LEASE_MINUTES = 5;
const HOUR_MS = 60 * 60 * 1000;

const OPEN_STATUSES: FinderFeeChargeStatus[] = ["awaiting-customer", "blocked-by-dispute", "retry-scheduled", "charging"];
const EXCEPTION_STATUSES: FinderFeeChargeStatus[] = ["retry-scheduled", "failed", "charging"];

/**
 * Reads the customer dispute window from configuration. Product default: 72 hours.
 * Invalid values throw so a deployed API fails closed instead of billing on a wrong window.
 */
export function resolveFinderFeeDisputeWindowHours(
  environment: Record<string, string | undefined> = process.env
): number {
  const configured = environment[FINDER_FEE_DISPUTE_WINDOW_ENV_KEY]?.trim();
  if (!configured) return DEFAULT_FINDER_FEE_DISPUTE_WINDOW_HOURS;
  const hours = Number(configured);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    throw new Error(`${FINDER_FEE_DISPUTE_WINDOW_ENV_KEY} must be a whole number of hours from 1 to 720.`);
  }
  return hours;
}

export interface FinderFeeServiceOptions {
  disputeWindowHours?: number;
  appBaseUrl?: string;
  policy?: FinderFeeEconomicsPolicy;
}

export interface FinderFeeProcessingResult {
  examined: number;
  paid: number;
  waived: number;
  declined: number;
  unknown: number;
}

type ChargeClaim = {
  charge: FinderFeeChargeRecord;
  stripeCustomerId: string;
  paymentMethodId: string;
  idempotencyKey: string;
};

const addMs = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

/** Stable per attempt: retrying an attempt whose result is unknown reuses the same key. */
export function finderFeeIdempotencyKey(chargeId: string, attemptCount: number): string {
  return `finder-fee:${chargeId}:attempt:${attemptCount + 1}`;
}

/**
 * Bills the one-time finder fee for each new customer-provider relationship.
 *
 * Safety model:
 * - Postgres holds one row per customer-provider pair (unique), one waiver per provider
 *   (unique), and one payment intent per row. All writes for a provider run under one
 *   advisory lock, so concurrent completions or workers never create a second fee.
 * - A charge attempt is claimed with a short lease before Stripe is called, and its
 *   idempotency key only changes after Stripe gives a final decline.
 */
export class FinderFeeService {
  private readonly disputeWindowHours: number;
  private readonly appBaseUrl: string;
  private readonly policy: FinderFeeEconomicsPolicy;

  public constructor(
    private readonly repository: MarketplaceRepository,
    private readonly billing: ProviderBillingGateway,
    options: FinderFeeServiceOptions = {}
  ) {
    this.disputeWindowHours = options.disputeWindowHours ?? resolveFinderFeeDisputeWindowHours();
    this.appBaseUrl = (options.appBaseUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    this.policy = options.policy ?? { ...ACTIVE_FINDER_FEE_ECONOMICS_POLICY, customerDisputeWindowHours: this.disputeWindowHours };
  }

  private lock<T>(providerId: string, work: (repository: MarketplaceRepository) => Promise<T>): Promise<T> {
    return this.repository.withLock(`finder-fee:provider:${providerId}`, work);
  }

  /**
   * Called when a provider (or ops on their behalf) marks a job complete. Starts the
   * relationship's finder-fee record if this is the pair's first qualifying job.
   */
  public async recordCompletion(booking: Booking): Promise<FinderFeeChargeRecord | undefined> {
    if (booking.status !== "completed" || !booking.completedAt) return undefined;
    try {
      return await this.lock(booking.providerId, repository => this.recordCompletionLocked(repository, booking));
    } catch (error) {
      if (error instanceof FinderFeeRelationshipConflictError) {
        // Another writer recorded the relationship first; the constraint kept it to one fee.
        return this.repository.findFinderFeeChargeByRelationship(booking.customerId, booking.providerId);
      }
      throw error;
    }
  }

  private async recordCompletionLocked(repository: MarketplaceRepository, booking: Booking) {
    const existing = await repository.findFinderFeeChargeByRelationship(booking.customerId, booking.providerId);
    if (existing && existing.status !== "void") return existing;

    const providerBookings = await repository.listScopedBookings({ providerId: booking.providerId });
    const evidence = await repository.getRetentionEvidence(providerBookings.map(row => row.id));
    const pairSettled = evidence.settlements.some(row => row.customerId === booking.customerId);
    const providerHasSettlements = evidence.settlements.length > 0;
    const otherRelationships = (await repository.listFinderFeeCharges({ providerId: booking.providerId }))
      .filter(row => row.status !== "void" && row.id !== existing?.id);

    const now = new Date().toISOString();
    const windowEndsAt = resolveFinderFeeWindowEnd(booking.completedAt!, this.disputeWindowHours);
    const base = {
      customerId: booking.customerId,
      providerId: booking.providerId,
      bookingId: booking.id,
      completedAt: booking.completedAt!,
      windowEndsAt,
      customerConfirmedAt: undefined,
      attemptCount: 0,
      chargeLeaseExpiresAt: undefined,
      lastAttemptAt: undefined,
      lastFailureReason: undefined,
      stripePaymentIntentId: undefined,
      paidAt: undefined,
      updatedAt: now
    };

    let fields: Omit<FinderFeeChargeRecord, "id" | "createdAt">;
    if (pairSettled) {
      // The relationship's fee was already recorded through a YardMatch-collected payment.
      fields = {
        ...base,
        policyVersion: YARDMATCH_ECONOMICS_POLICY_VERSION,
        tier: "typical",
        lawnSizeBandId: undefined,
        listFeeCents: 0,
        feeCents: 0,
        waived: false,
        status: "covered-by-prior-policy",
        nextAttemptAt: undefined
      };
    } else {
      const lawnSizeSqFt = await this.resolveLawnSize(repository, booking);
      const fee = calculateFinderFee({
        lawnSizeSqFt,
        isProvidersFirstRelationship: !providerHasSettlements && otherRelationships.length === 0,
        policy: this.policy
      });
      fields = {
        ...base,
        policyVersion: fee.policyVersion,
        tier: fee.tier,
        lawnSizeBandId: fee.lawnSizeBandId,
        listFeeCents: fee.listFeeCents,
        feeCents: fee.feeCents,
        waived: fee.waived,
        status: "awaiting-customer",
        nextAttemptAt: windowEndsAt
      };
    }

    if (existing) {
      return (await repository.updateFinderFeeCharge(existing.id, fields))!;
    }
    return repository.createFinderFeeCharge({ ...fields, id: randomUUID(), createdAt: now });
  }

  private async resolveLawnSize(repository: MarketplaceRepository, booking: Booking): Promise<number | undefined> {
    const customer = await repository.findCustomerById(booking.customerId);
    const property = customer?.properties.find(row => row.id === booking.servicePropertyId) ??
      customer?.properties.find(row => row.isDefault);
    const sizes = [property?.lawnSizeSqFt, customer?.lawnSizeSqFt];
    return sizes.find((size): size is number => typeof size === "number" && size > 0);
  }

  /** The customer confirms the provider's completion, which makes the fee billable before the window closes. */
  public async confirmCompletion(customerId: string, bookingId: unknown): Promise<ConfirmBookingCompletionResponse> {
    if (typeof bookingId !== "string" || !bookingId.trim()) throw new HttpError(400, "Choose a booking to confirm.");
    const booking = await this.repository.findBookingById(bookingId.trim());
    if (!booking || booking.customerId !== customerId) throw new HttpError(404, "Booking not found");
    if (booking.status === "disputed" || booking.disputedAt) {
      throw new HttpError(409, "This visit has an open dispute. Support will follow up with you.");
    }
    if (booking.status !== "completed" || !booking.completedAt) {
      throw new HttpError(409, "You can confirm a visit after the provider marks it complete.");
    }
    const charge = await this.recordCompletion(booking);
    const confirmedAt = new Date().toISOString();
    if (!charge || charge.bookingId !== booking.id) {
      return { bookingId: booking.id, confirmedAt };
    }
    return this.lock(booking.providerId, async repository => {
      const current = await repository.findFinderFeeChargeById(charge.id);
      if (!current || current.bookingId !== booking.id) return { bookingId: booking.id, confirmedAt };
      if (current.customerConfirmedAt) return { bookingId: booking.id, confirmedAt: current.customerConfirmedAt };
      await repository.updateFinderFeeCharge(current.id, {
        customerConfirmedAt: confirmedAt,
        ...(current.status === "awaiting-customer" ? { nextAttemptAt: confirmedAt } : {}),
        updatedAt: confirmedAt
      });
      return { bookingId: booking.id, confirmedAt };
    });
  }

  /** Advances every open charge whose state could have changed. Safe to run on many API instances. */
  public async processDue(nowIso = new Date().toISOString()): Promise<FinderFeeProcessingResult> {
    const result: FinderFeeProcessingResult = { examined: 0, paid: 0, waived: 0, declined: 0, unknown: 0 };
    const now = Date.parse(nowIso);
    const candidates = (await this.repository.listFinderFeeCharges({ statuses: OPEN_STATUSES })).filter(row =>
      row.status === "blocked-by-dispute" ||
      (row.status === "charging" ? Date.parse(row.chargeLeaseExpiresAt ?? nowIso) <= now : Date.parse(row.nextAttemptAt ?? nowIso) <= now));
    for (const candidate of candidates) {
      result.examined++;
      const outcome = await this.advance(candidate.id, candidate.providerId, nowIso);
      if (outcome === "paid") result.paid++;
      else if (outcome === "waived") result.waived++;
      else if (outcome === "declined") result.declined++;
      else if (outcome === "unknown") result.unknown++;
    }
    return result;
  }

  public async advance(chargeId: string, providerId: string, nowIso = new Date().toISOString()) {
    const claim = await this.lock(providerId, repository => this.evaluateAndClaim(repository, chargeId, nowIso));
    if (!claim || typeof claim === "string") return claim;

    let outcome: ProviderFeeChargeOutcome;
    try {
      outcome = await this.billing.chargeProviderFee({
        customerId: claim.stripeCustomerId,
        paymentMethodId: claim.paymentMethodId,
        amountCents: claim.charge.feeCents,
        currency: "usd",
        idempotencyKey: claim.idempotencyKey,
        description: "YardMatch finder fee",
        metadata: {
          yardmatchFinderFeeChargeId: claim.charge.id,
          yardmatchProviderId: claim.charge.providerId,
          yardmatchBookingId: claim.charge.bookingId,
          policyVersion: claim.charge.policyVersion,
          tier: claim.charge.tier
        }
      });
    } catch (error) {
      outcome = { status: "unknown", reason: error instanceof Error ? error.message : "Unknown billing error" };
    }
    return this.lock(providerId, repository => this.recordOutcome(repository, claim, outcome, nowIso));
  }

  private async evaluateAndClaim(
    repository: MarketplaceRepository,
    chargeId: string,
    nowIso: string
  ): Promise<ChargeClaim | "waived" | "declined" | "unknown" | undefined> {
    const charge = await repository.findFinderFeeChargeById(chargeId);
    if (!charge || !OPEN_STATUSES.includes(charge.status)) return undefined;
    const now = Date.parse(nowIso);
    if (charge.status === "charging" && Date.parse(charge.chargeLeaseExpiresAt ?? nowIso) > now) return undefined;
    if (charge.status === "retry-scheduled" && Date.parse(charge.nextAttemptAt ?? nowIso) > now) return undefined;

    const booking = await repository.findBookingById(charge.bookingId);
    if (!booking || booking.status === "cancelled" || booking.status === "refunded") {
      // The job that started the relationship did not stand, so the relationship has not started.
      await repository.updateFinderFeeCharge(charge.id, {
        status: "void", waived: false, feeCents: 0, nextAttemptAt: undefined, chargeLeaseExpiresAt: undefined, updatedAt: nowIso
      });
      return undefined;
    }

    const evidence = await repository.getRetentionEvidence([booking.id]);
    const disputeOpen = booking.status === "disputed" || Boolean(booking.disputedAt) ||
      evidence.tickets.some(ticket => Boolean(ticket.complaint) && ticket.status !== "resolved");
    const state = evaluateFinderFeeTrigger({
      windowEndsAt: charge.windowEndsAt,
      customerConfirmedAt: charge.customerConfirmedAt,
      disputeOpen,
      now: nowIso
    });

    if (state === "blocked-by-dispute") {
      if (charge.status !== "blocked-by-dispute") {
        await repository.updateFinderFeeCharge(charge.id, { status: "blocked-by-dispute", chargeLeaseExpiresAt: undefined, updatedAt: nowIso });
      }
      return undefined;
    }
    if (state === "awaiting-customer") {
      if (charge.status !== "awaiting-customer") {
        await repository.updateFinderFeeCharge(charge.id, { status: "awaiting-customer", nextAttemptAt: charge.windowEndsAt, updatedAt: nowIso });
      }
      return undefined;
    }
    if (charge.waived || charge.feeCents === 0) {
      await repository.updateFinderFeeCharge(charge.id, { status: "waived", nextAttemptAt: undefined, updatedAt: nowIso });
      return "waived";
    }

    const account = await repository.findProviderBillingAccount(charge.providerId);
    if (!account?.defaultPaymentMethodId) {
      await this.saveDecline(repository, charge, "No card on file for this business.", nowIso);
      return "declined";
    }
    if (!this.billing.isConfigured()) {
      await this.saveUnknown(repository, charge, "Card billing is not configured.", nowIso);
      return "unknown";
    }

    const claimed = await repository.updateFinderFeeCharge(charge.id, {
      status: "charging",
      chargeLeaseExpiresAt: addMs(nowIso, CHARGE_LEASE_MINUTES * 60 * 1000),
      lastAttemptAt: nowIso,
      updatedAt: nowIso
    });
    return {
      charge: claimed!,
      stripeCustomerId: account.stripeCustomerId,
      paymentMethodId: account.defaultPaymentMethodId,
      idempotencyKey: finderFeeIdempotencyKey(charge.id, charge.attemptCount)
    };
  }

  private async recordOutcome(
    repository: MarketplaceRepository,
    claim: ChargeClaim,
    outcome: ProviderFeeChargeOutcome,
    nowIso: string
  ): Promise<"paid" | "declined" | "unknown" | undefined> {
    const current = await repository.findFinderFeeChargeById(claim.charge.id);
    // Another worker already finished this attempt (for example after a lease expiry).
    if (!current || current.status !== "charging" || current.attemptCount !== claim.charge.attemptCount) return undefined;
    if (outcome.status === "succeeded") {
      await repository.updateFinderFeeCharge(current.id, {
        status: "paid",
        stripePaymentIntentId: outcome.paymentIntentId,
        paidAt: nowIso,
        nextAttemptAt: undefined,
        chargeLeaseExpiresAt: undefined,
        lastFailureReason: undefined,
        updatedAt: nowIso
      });
      return "paid";
    }
    if (outcome.status === "declined") {
      await this.saveDecline(repository, current, outcome.reason, nowIso);
      return "declined";
    }
    await this.saveUnknown(repository, current, outcome.reason, nowIso);
    return "unknown";
  }

  private async saveDecline(repository: MarketplaceRepository, charge: FinderFeeChargeRecord, reason: string, nowIso: string) {
    const attemptCount = charge.attemptCount + 1;
    const exhausted = attemptCount >= FINDER_FEE_MAX_DECLINED_ATTEMPTS;
    const delayHours = DECLINE_RETRY_HOURS[Math.min(attemptCount - 1, DECLINE_RETRY_HOURS.length - 1)];
    await repository.updateFinderFeeCharge(charge.id, {
      status: exhausted ? "failed" : "retry-scheduled",
      attemptCount,
      lastAttemptAt: nowIso,
      lastFailureReason: reason.slice(0, 500),
      nextAttemptAt: exhausted ? undefined : addMs(nowIso, delayHours * HOUR_MS),
      chargeLeaseExpiresAt: undefined,
      updatedAt: nowIso
    });
  }

  private async saveUnknown(repository: MarketplaceRepository, charge: FinderFeeChargeRecord, reason: string, nowIso: string) {
    // The attempt count is unchanged, so the next try reuses this attempt's idempotency key.
    await repository.updateFinderFeeCharge(charge.id, {
      status: "retry-scheduled",
      lastAttemptAt: nowIso,
      lastFailureReason: reason.slice(0, 500),
      nextAttemptAt: addMs(nowIso, UNKNOWN_OUTCOME_RETRY_MINUTES * 60 * 1000),
      chargeLeaseExpiresAt: undefined,
      updatedAt: nowIso
    });
  }

  /** Failed, retrying and stuck charges for the ops financial exception view. */
  public async listExceptions(nowIso = new Date().toISOString()): Promise<OpsFinderFeeExceptionItem[]> {
    const rows = (await this.repository.listFinderFeeCharges({ statuses: EXCEPTION_STATUSES }))
      .filter(row => row.status !== "charging" || Date.parse(row.chargeLeaseExpiresAt ?? nowIso) <= Date.parse(nowIso));
    const [customers, providers] = await Promise.all([
      this.repository.listCustomers([...new Set(rows.map(row => row.customerId))]),
      Promise.all([...new Set(rows.map(row => row.providerId))].map(id => this.repository.findProviderById(id)))
    ]);
    const customerNames = new Map(customers.map(row => [row.id, row.fullName]));
    const providerNames = new Map(providers.filter(Boolean).map(row => [row!.id, row!.companyName]));
    return rows
      .map(row => ({
        chargeId: row.id,
        bookingId: row.bookingId,
        providerId: row.providerId,
        providerName: providerNames.get(row.providerId),
        customerId: row.customerId,
        customerName: customerNames.get(row.customerId),
        feeCents: row.feeCents,
        tier: row.tier,
        status: row.status as OpsFinderFeeExceptionItem["status"],
        attemptCount: row.attemptCount,
        lastAttemptAt: row.lastAttemptAt,
        nextAttemptAt: row.nextAttemptAt,
        lastFailureReason: row.lastFailureReason
      }))
      .sort((left, right) => (right.lastAttemptAt ?? "").localeCompare(left.lastAttemptAt ?? ""));
  }

  public async billingStatus(providerId: string): Promise<ProviderBillingStatusResponse> {
    const account = await this.repository.findProviderBillingAccount(providerId);
    return {
      billingConfigured: this.billing.isConfigured(),
      hasCardOnFile: Boolean(account?.defaultPaymentMethodId),
      ...(account?.defaultPaymentMethodId
        ? { card: { brand: account.cardBrand, last4: account.cardLast4, expMonth: account.cardExpMonth, expYear: account.cardExpYear } }
        : {})
    };
  }

  public async startCardSetup(providerId: string, returnPath: unknown): Promise<StartProviderCardSetupResponse> {
    const path = returnPath === undefined ? "/provider/management" : returnPath;
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.length > 200) {
      throw new HttpError(400, "Choose a valid return page.");
    }
    if (!this.billing.isConfigured()) throw new HttpError(503, "Card billing is not configured yet.");
    const account = await this.repository.withLock(`provider-billing:${providerId}`, async repository => {
      const existing = await repository.findProviderBillingAccount(providerId);
      if (existing) return existing;
      const provider = await repository.findProviderById(providerId);
      if (!provider) throw new HttpError(404, "Provider not found.");
      const { customerId } = await this.billing.createCustomer({
        providerId, companyName: provider.companyName, email: provider.email, phone: provider.phone
      });
      const now = new Date().toISOString();
      return repository.upsertProviderBillingAccount({ providerId, stripeCustomerId: customerId, createdAt: now, updatedAt: now });
    });
    const separator = path.includes("?") ? "&" : "?";
    return this.billing.createCardSetupSession({
      providerId,
      customerId: account.stripeCustomerId,
      successUrl: `${this.appBaseUrl}${path}${separator}billing=card-saved&setup_session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.appBaseUrl}${path}${separator}billing=card-cancelled`
    });
  }

  public async completeCardSetup(providerId: string, setupSessionId: unknown): Promise<ProviderBillingStatusResponse> {
    if (typeof setupSessionId !== "string" || !/^[A-Za-z0-9_]{1,255}$/.test(setupSessionId)) {
      throw new HttpError(400, "Card setup reference is invalid.");
    }
    const account = await this.repository.findProviderBillingAccount(providerId);
    if (!account) throw new HttpError(409, "Start card setup first.");
    const card = await this.billing.retrieveCardSetup({ setupSessionId, customerId: account.stripeCustomerId });
    const now = new Date().toISOString();
    await this.lock(providerId, async repository => {
      await repository.upsertProviderBillingAccount({
        ...account,
        defaultPaymentMethodId: card.paymentMethodId,
        cardBrand: card.brand,
        cardLast4: card.last4,
        cardExpMonth: card.expMonth,
        cardExpYear: card.expYear,
        updatedAt: now
      });
      // A new card gives every waiting or failed charge another attempt now.
      for (const charge of await repository.listFinderFeeCharges({ providerId, statuses: ["retry-scheduled", "failed"] })) {
        await repository.updateFinderFeeCharge(charge.id, { status: "retry-scheduled", nextAttemptAt: now, updatedAt: now });
      }
    });
    return this.billingStatus(providerId);
  }
}
