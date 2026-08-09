import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { Address, Booking, CustomerProfile } from "@yardmatch/contracts";
import { HttpError } from "../http";
import { createStripeClient, runStripeRequest } from "../integrations/stripeRequest";

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

export interface StripeWebhookEvent {
  type: string;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  disputeId?: string;
  disputedAmountCents?: number;
  disputeReason?: string;
  paid?: boolean;
  failureReason?: string;
}

export interface StripeChargeFinancials {
  chargeId: string;
  actualProcessorFeeCents: number;
}

export interface CreateStripeRefundInput {
  paymentIntentId: string;
  amountCents: number;
  reason: string;
  bookingId: string;
  paymentId: string;
}

export interface CreatedStripeRefund {
  refundId: string;
  status: string;
}

export interface PaymentCheckoutGateway {
  isConfigured(): boolean;
  createCheckoutSession(
    input: CreateStripeCheckoutSessionInput
  ): Promise<CreatedStripeCheckoutSession>;
  verifyCheckoutSession(checkoutSessionId: string): Promise<VerifiedStripeCheckoutSession>;
  retrieveChargeFinancials(paymentIntentId: string): Promise<StripeChargeFinancials>;
  parseWebhookEvent(rawBody: string, signature: string): Promise<StripeWebhookEvent>;
  createRefund(input: CreateStripeRefundInput): Promise<CreatedStripeRefund>;
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

function createIntegrationIdentifier(): string {
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join("");
  return `yardmatch_${suffix}`;
}

export function buildReturnUrl(baseUrl: string, path: string, includeSessionPlaceholder: boolean) {
  const target = new URL(path, baseUrl);
  if (includeSessionPlaceholder) {
    target.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  return target.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

export class StripeCheckoutService implements PaymentCheckoutGateway {
  private readonly stripe?: Stripe;
  private readonly webhookSecret?: string;

  public constructor(
    secretKey = process.env.STRIPE_SECRET_KEY,
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  ) {
    if (secretKey) {
      this.stripe = createStripeClient(secretKey);
    }
    this.webhookSecret = webhookSecret;
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

    const session = await runStripeRequest(
      () => this.stripe!.checkout.sessions.create({
        mode: "payment",
        integration_identifier: createIntegrationIdentifier(),
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
      }),
      "Stripe checkout did not respond in time. Refresh the booking before trying again."
    );

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

    const session = await runStripeRequest(
      () => this.stripe!.checkout.sessions.retrieve(checkoutSessionId),
      "Stripe checkout status did not respond in time. Refresh the booking and try again."
    );
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

  public async retrieveChargeFinancials(
    paymentIntentId: string
  ): Promise<StripeChargeFinancials> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe is not configured yet.");
    }

    const charge = await runStripeRequest(async () => {
      const intent = await this.stripe!.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"]
      });
      if (!intent.latest_charge) {
        throw new HttpError(409, "Stripe has not created a charge for this payment yet.");
      }
      const charge =
        typeof intent.latest_charge === "string"
          ? await this.stripe!.charges.retrieve(intent.latest_charge, {
              expand: ["balance_transaction"]
            })
          : intent.latest_charge;
      return charge;
    }, "Stripe payment details did not respond in time. Refresh the booking and try again.");
    const balanceTransaction = charge.balance_transaction;
    if (!balanceTransaction || typeof balanceTransaction === "string") {
      throw new HttpError(502, "Stripe did not return the charge balance transaction.");
    }
    if (!Number.isInteger(balanceTransaction.fee) || balanceTransaction.fee < 0) {
      throw new HttpError(502, "Stripe returned an invalid processing fee.");
    }
    return {
      chargeId: charge.id,
      actualProcessorFeeCents: balanceTransaction.fee
    };
  }

  public async parseWebhookEvent(rawBody: string, signature: string): Promise<StripeWebhookEvent> {
    if (!this.stripe || !this.webhookSecret) {
      throw new HttpError(503, "Stripe webhook signing secret is not configured yet.");
    }

    if (!signature) {
      throw new HttpError(400, "Stripe-Signature header is required.");
    }

    const event = await this.stripe.webhooks.constructEventAsync(rawBody, signature, this.webhookSecret);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object;
      return {
        type: event.type,
        checkoutSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        paid: session.payment_status === "paid",
        failureReason:
          event.type === "checkout.session.expired" ? "Stripe checkout expired." : undefined
      };
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      return {
        type: event.type,
        paymentIntentId: intent.id,
        failureReason: intent.last_payment_error?.message ?? "Stripe payment failed."
      };
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      return {
        type: event.type,
        paymentIntentId:
          typeof charge.payment_intent === "string" ? charge.payment_intent : undefined
      };
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      return {
        type: event.type,
        disputeId: dispute.id,
        disputedAmountCents: dispute.amount,
        disputeReason: dispute.reason,
        paymentIntentId:
          typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id
      };
    }

    return {
      type: event.type
    };
  }

  public async createRefund(input: CreateStripeRefundInput): Promise<CreatedStripeRefund> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe is not configured yet.");
    }

    const refund = await runStripeRequest(
      () => this.stripe!.refunds.create({
        payment_intent: input.paymentIntentId,
        amount: input.amountCents,
        reason: "requested_by_customer",
        metadata: {
          bookingId: input.bookingId,
          paymentId: input.paymentId,
          refundReason: input.reason
        }
      }),
      "Stripe refund processing did not respond in time. Refresh the payment before trying again."
    );

    return {
      refundId: refund.id,
      status: refund.status ?? "unknown"
    };
  }
}
