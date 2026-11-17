import Stripe from "stripe";
import { HttpError } from "../http";
import { createStripeClient, isStripeTimeoutError, runStripeRequest } from "../integrations/stripeRequest";

/**
 * Bills the provider business for YardMatch's own fees from a saved card. This is a
 * Stripe Customer on the platform account: it is separate from Connect payouts and from
 * YardMatch-collected customer payments, which stay behind their launch flag.
 */
export interface SavedProviderCard {
  paymentMethodId: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

export type ProviderFeeChargeOutcome =
  | { status: "succeeded"; paymentIntentId: string }
  /** Stripe gave a final answer and nothing was charged; the next attempt needs a new idempotency key. */
  | { status: "declined"; reason: string; paymentIntentId?: string }
  /** The result is unknown (timeout, network, Stripe error); retry with the same idempotency key. */
  | { status: "unknown"; reason: string };

export interface ProviderBillingGateway {
  isConfigured(): boolean;
  createCustomer(input: {
    providerId: string;
    companyName: string;
    email: string;
    phone?: string;
  }): Promise<{ customerId: string }>;
  createCardSetupSession(input: {
    providerId: string;
    customerId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; setupSessionId: string }>;
  retrieveCardSetup(input: { setupSessionId: string; customerId: string }): Promise<SavedProviderCard>;
  /** The customer's default card, or its newest card made default; undefined when none is saved. */
  findSavedCard(customerId: string): Promise<SavedProviderCard | undefined>;
  chargeProviderFee(input: {
    customerId: string;
    paymentMethodId: string;
    amountCents: number;
    currency: "usd";
    idempotencyKey: string;
    description: string;
    metadata: Record<string, string>;
  }): Promise<ProviderFeeChargeOutcome>;
}

function toSavedCard(paymentMethod: Stripe.PaymentMethod): SavedProviderCard {
  return {
    paymentMethodId: paymentMethod.id,
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    expMonth: paymentMethod.card?.exp_month,
    expYear: paymentMethod.card?.exp_year
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown billing error";
}

export class StripeProviderBillingService implements ProviderBillingGateway {
  private readonly stripe?: Stripe;

  public constructor(secretKey = process.env.STRIPE_SECRET_KEY) {
    if (secretKey?.trim()) {
      this.stripe = createStripeClient(secretKey.trim());
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new HttpError(503, "Card billing is not configured yet.");
    }
    return this.stripe;
  }

  public async createCustomer(input: {
    providerId: string;
    companyName: string;
    email: string;
    phone?: string;
  }): Promise<{ customerId: string }> {
    const customer = await runStripeRequest(
      () => this.client().customers.create(
        {
          name: input.companyName,
          email: input.email,
          phone: input.phone,
          metadata: { yardmatchProviderId: input.providerId, purpose: "provider-fee-billing" }
        },
        // A retried request returns the same Customer instead of creating a second one.
        { idempotencyKey: `provider-billing-customer:${input.providerId}` }
      ),
      "Card setup did not respond in time. Please try again."
    );
    return { customerId: customer.id };
  }

  public async createCardSetupSession(input: {
    providerId: string;
    customerId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; setupSessionId: string }> {
    const session = await runStripeRequest(
      () => this.client().checkout.sessions.create({
        mode: "setup",
        customer: input.customerId,
        currency: "usd",
        payment_method_types: ["card"],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { yardmatchProviderId: input.providerId, purpose: "provider-fee-billing" },
        setup_intent_data: {
          metadata: { yardmatchProviderId: input.providerId, purpose: "provider-fee-billing" }
        }
      }),
      "Card setup did not respond in time. Please try again."
    );
    if (!session.url) {
      throw new HttpError(502, "Card setup could not be started. Please try again.");
    }
    return { url: session.url, setupSessionId: session.id };
  }

  public async retrieveCardSetup(input: { setupSessionId: string; customerId: string }): Promise<SavedProviderCard> {
    const stripe = this.client();
    const session = await runStripeRequest(
      () => stripe.checkout.sessions.retrieve(input.setupSessionId, {
        expand: ["setup_intent.payment_method"]
      }),
      "Card setup did not respond in time. Refresh and try again."
    );
    const sessionCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (session.mode !== "setup" || sessionCustomer !== input.customerId) {
      throw new HttpError(403, "This card setup belongs to a different business.");
    }
    const setupIntent = session.setup_intent;
    if (session.status !== "complete" || !setupIntent || typeof setupIntent === "string" || setupIntent.status !== "succeeded") {
      throw new HttpError(409, "Card setup is not finished yet.");
    }
    const paymentMethod = setupIntent.payment_method;
    if (!paymentMethod || typeof paymentMethod === "string") {
      throw new HttpError(409, "Card setup did not save a card.");
    }
    await runStripeRequest(
      () => stripe.customers.update(input.customerId, {
        invoice_settings: { default_payment_method: paymentMethod.id }
      }),
      "Card setup did not respond in time. Refresh and try again."
    );
    return toSavedCard(paymentMethod);
  }

  public async findSavedCard(customerId: string): Promise<SavedProviderCard | undefined> {
    const stripe = this.client();
    const customer = await runStripeRequest(
      () => stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] }),
      "Card billing did not respond in time. Refresh and try again."
    );
    if (customer.deleted) return undefined;
    const current = customer.invoice_settings?.default_payment_method;
    if (current && typeof current !== "string" && current.type === "card") {
      return toSavedCard(current);
    }
    const cards = await runStripeRequest(
      () => stripe.customers.listPaymentMethods(customerId, { type: "card", limit: 1 }),
      "Card billing did not respond in time. Refresh and try again."
    );
    const newest = cards.data[0];
    if (!newest) return undefined;
    await runStripeRequest(
      () => stripe.customers.update(customerId, { invoice_settings: { default_payment_method: newest.id } }),
      "Card billing did not respond in time. Refresh and try again."
    );
    return toSavedCard(newest);
  }

  public async chargeProviderFee(input: {
    customerId: string;
    paymentMethodId: string;
    amountCents: number;
    currency: "usd";
    idempotencyKey: string;
    description: string;
    metadata: Record<string, string>;
  }): Promise<ProviderFeeChargeOutcome> {
    let stripe: Stripe;
    try {
      stripe = this.client();
    } catch (error) {
      return { status: "unknown", reason: errorMessage(error) };
    }
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency,
          customer: input.customerId,
          payment_method: input.paymentMethodId,
          off_session: true,
          confirm: true,
          description: input.description,
          metadata: input.metadata
        },
        { idempotencyKey: input.idempotencyKey }
      );
      if (intent.status === "succeeded") {
        return { status: "succeeded", paymentIntentId: intent.id };
      }
      if (intent.status === "processing") {
        return { status: "unknown", reason: "The card payment is still processing." };
      }
      return {
        status: "declined",
        reason: intent.status === "requires_action"
          ? "The card needs the provider to authenticate the payment."
          : `The card payment ended in status ${intent.status}.`,
        paymentIntentId: intent.id
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) {
        return {
          status: "declined",
          reason: [error.code, error.decline_code, error.message].filter(Boolean).join(": "),
          paymentIntentId: error.payment_intent?.id
        };
      }
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
        return { status: "declined", reason: `The saved card is no longer available: ${error.message}` };
      }
      return {
        status: "unknown",
        reason: isStripeTimeoutError(error) ? "Card billing timed out." : errorMessage(error)
      };
    }
  }
}
