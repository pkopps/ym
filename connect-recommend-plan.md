# Recommended Connect integration

## A. Account configuration

Accounts API: `/v2/core/accounts`

Legacy account `type`: not used

Dashboard: `express`

Fee collection: application

Negative balance liability: application

YardMatch owns checkout and defers provider settlement until service completion and the hold window. Each provider business is therefore an Accounts v2 recipient with Express access; the platform owns processing fees, disputes, refunds, transfer recovery, and unresolved negative-balance risk.

Each connected account needs the recipient configuration (`configuration.recipient`) with `stripe_transfers` on `stripe_balance` requested, so the account can receive transfers from the platform. Marketplace connected accounts should NOT request merchant configuration or `card_payments` capability—this is unnecessary and causes longer onboarding.

## B. Charge pattern: separate charges and transfers

The customer charge is created on YardMatch at checkout and no transfer occurs until the job is complete, paid, outside the hold period, and free of refund/dispute holds. YardMatch then transfers the immutable provider settlement to one provider account; no crew member is a Stripe recipient.

## C. Provider onboarding flow

Onboarding method: Stripe-hosted Accounts v2 account links initially, with embedded components as the provider UI matures.

The provider signs up, submits YardMatch business/insurance credentials, receives a recipient account, follows the authenticated onboarding link, and returns to YardMatch. Capability status is re-synced throughout the account lifecycle; live transfers remain disabled until both recipient transfers and payouts are active and YardMatch credentials are current.

## D. Payments dashboard access for providers

Providers receive lightweight Express access for payout visibility and remediation. YardMatch should add authenticated Express login links when the provider management UI exposes dashboard access.

## E. Embedded components

Recommended [Connect embedded components](https://docs.stripe.com/connect/supported-embedded-components):

- `account_onboarding`
- `notification_banner` (required for ongoing requirement changes)
- `account_management`
- `payments`
- `payouts`
- payout reconciliation reporting

With separate charges and transfers, YardMatch remains responsible for platform-side refund, dispute, reversal, and reconciliation operations.

## F. Webhook integration

Use verified, idempotent webhooks as the source of truth for payment, account-requirement, capability, refund, dispute, and transfer state.

## G. Onboarding status gating

Before enabling provider transfers, retrieve the Accounts v2 record and require:

- `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status === 'active'`
- `configuration.recipient.capabilities.stripe_balance.payouts.status === 'active'`

Do not use v1 `charges_enabled` or `payouts_enabled` flags.

## H. Fee structure

- Platform fee model: $30 on the first completed paid customer/provider relationship plus $6.99 on each completed paid job.
- Collection mechanism: transfer less than the customer charge; do not use `application_fee_amount` with separate charges and transfers.
- `applicationFeeIncludes`: `platform_fee_only`. This label records that published platform fees are the gross revenue amount and Stripe processing cost is absorbed from YardMatch margin.

```text
Customer pays booked service price
        │
        ▼
YardMatch platform charge
        ├── retains $6.99 job fee
        ├── retains $30 finder fee on first completed relationship only
        ├── pays actual Stripe processing cost
        └── transfers remainder to provider after completion/hold gates
                         │
                         └── provider independently pays and insures its crew
```

The $6.99 repeat-job fee is vulnerable to processing-fee and support-cost compression. Pricing varies by method and region; validate against [Stripe pricing](https://stripe.com/pricing) and monitor Stripe's Connect margin report before changing fees.

## I. SaaS monetization

Not applicable at launch. YardMatch is a managed marketplace, not SaaS enabling providers to own independent customer checkout.

## J. Implementation plan

1. Persist Accounts v2 recipient state and authenticated onboarding links.
2. Gate provider visibility and crew engagement on YardMatch credential policy.
3. Capture customer Checkout payments on the platform without an immediate transfer.
4. Create one versioned settlement and balanced ledger after completion plus capture.
5. Release an idempotent provider-only transfer after hold, credential, capability, refund, and dispute gates pass.
6. Reverse provider transfers during eligible refunds and explicitly recover disputed transfers.
7. Reconcile Stripe balance-transaction fees and transfer outcomes into the ledger.

## K. Risk and liability

- Negative balance liability owner: YardMatch.
- Risk controls owner: YardMatch, using Stripe Radar plus marketplace-specific controls.

Platform-owned liability allows connected-account balances to go negative when a transfer reversal is needed, but it also means fraud and unrecovered disputes can directly cost YardMatch. Refunds should request transfer reversal where applicable; disputes require an explicit recovery workflow and alerting for unrecovered amounts.

## L. Why this fits YardMatch

- YardMatch owns recommendation, booking, checkout, customer support, and release timing.
- One provider business receives each booking settlement.
- Provider-funded flat fees preserve a simple customer price and match the active cost model.
- Provider-responsible crew compensation avoids payroll and multi-recipient settlement exposure.

## M. Open questions

- Marketplace counsel must approve merchant-of-record and provider/crew contract language.
- Actual Stripe pricing and Connect account costs must be confirmed in the live account.
- Finance must define the source-of-truth balance transaction used to replace the initial zero processor-fee placeholder in settlement records.
- Ops needs an approved reversal and unrecovered-dispute runbook before transfers are enabled.
