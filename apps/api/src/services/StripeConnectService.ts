import Stripe from "stripe";
import {
  ProviderConnectAccount,
  ProviderConnectCapabilityStatus,
  ProviderProfile
} from "@yardmatch/contracts";
import { HttpError } from "../http";
import { createStripeClient, runStripeRequest } from "../integrations/stripeRequest";

export interface StripeRecipientReadiness {
  stripeAccountId: string;
  transfersStatus: ProviderConnectCapabilityStatus;
  payoutsStatus: ProviderConnectCapabilityStatus;
  onboardingStatus: ProviderConnectAccount["onboardingStatus"];
}

export interface StripeConnectGateway {
  isConfigured(): boolean;
  createRecipientAccount(provider: ProviderProfile): Promise<StripeRecipientReadiness>;
  retrieveRecipientReadiness(stripeAccountId: string): Promise<StripeRecipientReadiness>;
  createOnboardingLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string; expiresAt: string }>;
  createProviderTransfer(input: {
    stripeAccountId: string;
    bookingId: string;
    settlementId: string;
    amountCents: number;
    currency: string;
    sourceTransactionId?: string;
    idempotencyKey: string;
  }): Promise<{ transferId: string }>;
  reverseProviderTransfer(input: {
    transferId: string;
    bookingId: string;
    settlementId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ reversalId: string }>;
}

function normalizeCapabilityStatus(
  status: string | undefined
): ProviderConnectCapabilityStatus {
  if (status === "active" || status === "pending" || status === "restricted") {
    return status;
  }
  return status ? "restricted" : "not-requested";
}

export class StripeConnectService implements StripeConnectGateway {
  private readonly stripe?: Stripe;

  public constructor(secretKey = process.env.STRIPE_SECRET_KEY) {
    if (secretKey?.trim()) {
      this.stripe = createStripeClient(secretKey.trim());
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  public async createRecipientAccount(
    provider: ProviderProfile
  ): Promise<StripeRecipientReadiness> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    const account = await runStripeRequest(
      () => this.stripe!.v2.core.accounts.create({
        contact_email: provider.email,
        contact_phone: provider.phone,
        display_name: provider.companyName,
        dashboard: "express",
        defaults: {
          currency: "usd",
          locales: ["en-US"],
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application"
          },
          profile: {
            doing_business_as: provider.companyName,
            product_description: "Local lawn and property-care services booked through YardMatch."
          }
        },
        identity: {
          country: provider.address.country
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true
                }
              }
            }
          }
        },
        metadata: {
          yardmatchProviderId: provider.id
        },
        include: ["configuration.recipient", "requirements", "future_requirements"]
      }),
      "Stripe Connect did not respond in time. Refresh payout setup before trying again."
    );
    return this.mapReadiness(account);
  }

  public async retrieveRecipientReadiness(
    stripeAccountId: string
  ): Promise<StripeRecipientReadiness> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    const account = await runStripeRequest(
      () => this.stripe!.v2.core.accounts.retrieve(stripeAccountId, {
        include: ["configuration.recipient", "requirements", "future_requirements"]
      }),
      "Stripe Connect status did not respond in time. Refresh payout setup and try again."
    );
    return this.mapReadiness(account);
  }

  public async createOnboardingLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string; expiresAt: string }> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    const link = await runStripeRequest(
      () => this.stripe!.v2.core.accountLinks.create({
        account: input.stripeAccountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            collection_options: {
              fields: "eventually_due",
              future_requirements: "include"
            },
            return_url: input.returnUrl,
            refresh_url: input.refreshUrl
          }
        }
      }),
      "Stripe Connect onboarding did not respond in time. Refresh payout setup before trying again."
    );
    return { url: link.url, expiresAt: link.expires_at };
  }

  public async createProviderTransfer(input: {
    stripeAccountId: string;
    bookingId: string;
    settlementId: string;
    amountCents: number;
    currency: string;
    sourceTransactionId?: string;
    idempotencyKey: string;
  }): Promise<{ transferId: string }> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    const transfer = await runStripeRequest(
      () => this.stripe!.transfers.create(
        {
          amount: input.amountCents,
          currency: input.currency,
          destination: input.stripeAccountId,
          source_transaction: input.sourceTransactionId,
          transfer_group: `booking_${input.bookingId}`,
          metadata: {
            bookingId: input.bookingId,
            settlementId: input.settlementId,
            recipientRole: "provider"
          }
        },
        { idempotencyKey: input.idempotencyKey }
      ),
      "Stripe transfer processing did not respond in time. Refresh the payout run before retrying."
    );
    return { transferId: transfer.id };
  }

  public async reverseProviderTransfer(input: {
    transferId: string;
    bookingId: string;
    settlementId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ reversalId: string }> {
    if (!this.stripe) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    const reversal = await runStripeRequest(
      () => this.stripe!.transfers.createReversal(
        input.transferId,
        {
          amount: input.amountCents,
          metadata: {
            bookingId: input.bookingId,
            settlementId: input.settlementId,
            recipientRole: "provider"
          }
        },
        { idempotencyKey: input.idempotencyKey }
      ),
      "Stripe transfer reversal did not respond in time. Refresh the payout status before retrying."
    );
    return { reversalId: reversal.id };
  }

  private mapReadiness(account: any): StripeRecipientReadiness {
    const transfersStatus = normalizeCapabilityStatus(
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status
    );
    const payoutsStatus = normalizeCapabilityStatus(
      account.configuration?.recipient?.capabilities?.stripe_balance?.payouts?.status
    );
    const onboardingStatus: ProviderConnectAccount["onboardingStatus"] =
      transfersStatus === "active" && payoutsStatus === "active"
        ? "ready"
        : transfersStatus === "restricted" || payoutsStatus === "restricted"
          ? "restricted"
          : transfersStatus === "pending" || payoutsStatus === "pending"
            ? "in-review"
            : "requirements-due";
    return {
      stripeAccountId: account.id,
      transfersStatus,
      payoutsStatus,
      onboardingStatus
    };
  }
}
