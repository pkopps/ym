import { randomUUID } from "node:crypto";
import type { Booking, CustomerProfile, ProviderProfile } from "@yardmatch/contracts";
import { InMemoryMarketplaceRepository } from "../../src/repositories/InMemoryMarketplaceRepository";
import type { MarketplaceRepository } from "../../src/repositories/MarketplaceRepository";
import type { ProviderBillingGateway, ProviderFeeChargeOutcome, SavedProviderCard } from "../../src/services/StripeProviderBillingService";

/** A fake Stripe that, like Stripe, replays the stored result for a repeated idempotency key. */
export class FakeProviderBilling implements ProviderBillingGateway {
  public configured = true;
  public readonly chargeCalls: Array<{ idempotencyKey: string; amountCents: number; customerId: string; paymentMethodId: string }> = [];
  public readonly createdCustomers: string[] = [];
  /** Scripted results for new idempotency keys; "lost-success" charges but loses the response. */
  public readonly script: Array<"succeed" | "decline" | "lost-success" | "throw"> = [];
  public delayMs = 0;
  private readonly byKey = new Map<string, ProviderFeeChargeOutcome>();
  private intentCounter = 0;

  public isConfigured() { return this.configured; }

  public async createCustomer(input: { providerId: string }) {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    this.createdCustomers.push(input.providerId);
    return { customerId: `cus_${input.providerId.replace(/[^A-Za-z0-9]/g, "").slice(-20)}` };
  }

  public async createCardSetupSession(input: { customerId: string; successUrl: string }) {
    return { url: `https://checkout.stripe.test/setup?customer=${input.customerId}&next=${encodeURIComponent(input.successUrl)}`, setupSessionId: `cs_test_${input.customerId}` };
  }

  public async retrieveCardSetup(input: { setupSessionId: string; customerId: string }): Promise<SavedProviderCard> {
    if (input.setupSessionId !== `cs_test_${input.customerId}`) throw new Error("setup session belongs to another customer");
    return { paymentMethodId: `pm_${input.customerId}`, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  }

  /** Cards saved in Stripe outside a tracked setup session, by customer. */
  public readonly cardsSavedInStripe = new Map<string, SavedProviderCard>();

  public async findSavedCard(customerId: string): Promise<SavedProviderCard | undefined> {
    return this.cardsSavedInStripe.get(customerId);
  }

  /** PaymentIntents that actually moved money. */
  public get succeededIntentIds(): string[] {
    return [...new Set([...this.byKey.values()].flatMap(outcome => outcome.status === "succeeded" ? [outcome.paymentIntentId] : []))];
  }

  public async chargeProviderFee(input: { idempotencyKey: string; amountCents: number; customerId: string; paymentMethodId: string }): Promise<ProviderFeeChargeOutcome> {
    this.chargeCalls.push({ idempotencyKey: input.idempotencyKey, amountCents: input.amountCents, customerId: input.customerId, paymentMethodId: input.paymentMethodId });
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    const replay = this.byKey.get(input.idempotencyKey);
    if (replay) return replay;
    const step = this.script.shift() ?? "succeed";
    if (step === "throw") throw new Error("socket hang up");
    const outcome: ProviderFeeChargeOutcome = step === "decline"
      ? { status: "declined", reason: "card_declined: insufficient_funds" }
      : { status: "succeeded", paymentIntentId: `pi_test_${++this.intentCounter}` };
    this.byKey.set(input.idempotencyKey, outcome);
    if (step === "lost-success") return { status: "unknown", reason: "Card billing timed out." };
    return outcome;
  }
}

export interface FinderFeeParties {
  provider: ProviderProfile;
  customers: CustomerProfile[];
}

/** Creates an isolated provider and customers whose default property has the given lawn sizes. */
export async function seedFinderFeeParties(
  repository: MarketplaceRepository,
  lawnSizes: Array<number | undefined>,
  prefix = `ff-${randomUUID()}`
): Promise<FinderFeeParties> {
  const templates = new InMemoryMarketplaceRepository();
  const [providerTemplate] = await templates.listProviders();
  const now = new Date().toISOString();
  const provider: ProviderProfile = {
    ...providerTemplate!, id: `${prefix}-provider`, email: `${prefix}-provider@example.invalid`,
    companyName: "Finder Fee Lawn Co", credentials: [], servicePrices: [], connectAccount: undefined
  };
  await repository.createProvider(provider);
  const customers: CustomerProfile[] = [];
  for (const [index, lawnSizeSqFt] of lawnSizes.entries()) {
    const id = `${prefix}-customer-${index}`;
    const propertyId = `${id}-property`;
    const customer: CustomerProfile = {
      id, role: "customer", email: `${id}@example.invalid`, fullName: `Customer ${index}`, phone: "555-0100",
      address: providerTemplate!.address, createdAt: now, propertyNotes: "", lawnSizeSqFt: 0, defaultPropertyId: propertyId,
      properties: [{ id: propertyId, label: "Home", address: providerTemplate!.address, lawnSizeSqFt, isDefault: true, createdAt: now }]
    };
    await repository.createCustomer(customer);
    customers.push(customer);
  }
  return { provider, customers };
}

export async function createCompletedBooking(
  repository: MarketplaceRepository,
  provider: ProviderProfile,
  customer: CustomerProfile,
  completedAt: string,
  overrides: Partial<Booking> = {}
): Promise<Booking> {
  const start = new Date(Date.parse(completedAt) - 2 * 60 * 60 * 1000).toISOString();
  const booking: Booking = {
    id: `${customer.id}-booking-${randomUUID()}`,
    customerId: customer.id,
    providerId: provider.id,
    serviceAddress: customer.properties[0]!.address,
    servicePropertyId: customer.properties[0]!.id,
    category: "lawn-mowing",
    requestedAt: start,
    scheduledStartIso: start,
    scheduledEndIso: new Date(Date.parse(start) + 60 * 60 * 1000).toISOString(),
    status: "completed",
    completedAt,
    notes: "",
    totalCents: 6_000,
    serviceEvidence: [],
    interventions: [],
    addressChangeHistory: [],
    ...overrides
  };
  return repository.createBooking(booking);
}

export const hoursAfter = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
