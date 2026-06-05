import Stripe from "stripe";
import { Address, Booking, CustomerProfile } from "@yardmatch/contracts";
import { HttpError } from "../http";

export interface CreateStripeCheckoutSessionInput {
  booking: Booking;
  customer: CustomerProfile;
  appBaseUrl: string;
  successPath: string;
  cancelPath: string;
}

export interface CreatedStripeCheckoutSession {
  checkoutSessionId: string;
  checkoutUrl: string;
  paymentIntentId?: string;
}

export interface VerifiedStripeCheckoutSession {
  checkoutSessionId: string;
  paymentIntentId?: string;
  paid: boolean;
  failureReason?: string;
}

export interface PaymentCheckoutGateway {
  isConfigured(): boolean;
  createCheckoutSession(
    input: CreateStripeCheckoutSessionInput
  ): Promise<CreatedStripeCheckoutSession>;
  verifyCheckoutSession(checkoutSessionId: string): Promise<VerifiedStripeCheckoutSession>;
}

function prettifyCategory(category: string): string {
  return category
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildServiceAddress(address: Address): string {
  return [address.line1, address.city, address.state, address.postalCode].filter(Boolean).join(", ");
}

function buildReturnUrl(baseUrl: string, path: string, includeSessionPlaceholder: boolean) {
  const target = new URL(path, baseUrl);
  if (includeSessionPlaceholder) {
    target.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  return target.toString();
}

export class StripeCheckoutService implements PaymentCheckoutGateway {
  private readonly stripe?: Stripe;

  public constructor(secretKey = process.env.STRIPE_SECRET_KEY) {
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  public async createCheckoutSession(
    input: CreateStripeCheckoutSessionInput
  ): Promise<CreatedStripeCheckoutSession> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe is not configured yet.");
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      success_url: buildReturnUrl(input.appBaseUrl, input.successPath, true),
      cancel_url: buildReturnUrl(input.appBaseUrl, input.cancelPath, false),
      client_reference_id: input.booking.id,
      customer_email: input.customer.email,
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: true
      },
      metadata: {
        bookingId: input.booking.id,
        customerId: input.customer.id,
        providerId: input.booking.providerId
      },
      payment_intent_data: {
        metadata: {
          bookingId: input.booking.id,
          customerId: input.customer.id,
          providerId: input.booking.providerId
        }
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.booking.totalCents,
            product_data: {
              name: `${prettifyCategory(input.booking.category)} service`,
              description: `YardMatch booking at ${buildServiceAddress(input.booking.serviceAddress)}`
            }
          }
        }
      ]
    });

    if (!session.url) {
      throw new HttpError(502, "Stripe did not return a checkout URL.");
    }

    return {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : undefined
    };
  }

  public async verifyCheckoutSession(
    checkoutSessionId: string
  ): Promise<VerifiedStripeCheckoutSession> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe is not configured yet.");
    }

    const session = await this.stripe.checkout.sessions.retrieve(checkoutSessionId);
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : undefined;

    return {
      checkoutSessionId: session.id,
      paymentIntentId,
      paid: session.payment_status === "paid",
      failureReason:
        session.payment_status === "unpaid" ? "Stripe checkout has not been completed yet." : undefined
    };
  }
}
