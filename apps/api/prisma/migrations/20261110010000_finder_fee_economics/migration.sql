-- Finder-fee economics policy (2026-10-finder-fee-v1): provider card on file and one fee per
-- customer-provider relationship. Existing settlement tables and the 2026-07 policy are unchanged.

-- CreateTable
CREATE TABLE "provider_billing_accounts" (
    "providerId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "defaultPaymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_billing_accounts_pkey" PRIMARY KEY ("providerId")
);

-- CreateTable
CREATE TABLE "finder_fee_charges" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "lawnSizeBandId" TEXT,
    "listFeeCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "waived" BOOLEAN NOT NULL,
    "waivedProviderId" TEXT,
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "customerConfirmedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "chargeLeaseExpiresAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finder_fee_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_billing_accounts_stripeCustomerId_key" ON "provider_billing_accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "finder_fee_charges_bookingId_key" ON "finder_fee_charges"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "finder_fee_charges_waivedProviderId_key" ON "finder_fee_charges"("waivedProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "finder_fee_charges_stripePaymentIntentId_key" ON "finder_fee_charges"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "finder_fee_charges_status_nextAttemptAt_idx" ON "finder_fee_charges"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "finder_fee_charges_providerId_status_idx" ON "finder_fee_charges"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "finder_fee_charges_customerId_providerId_key" ON "finder_fee_charges"("customerId", "providerId");

-- AddForeignKey
ALTER TABLE "provider_billing_accounts" ADD CONSTRAINT "provider_billing_accounts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_fee_charges" ADD CONSTRAINT "finder_fee_charges_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_fee_charges" ADD CONSTRAINT "finder_fee_charges_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_fee_charges" ADD CONSTRAINT "finder_fee_charges_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity rules the application also enforces.
ALTER TABLE "finder_fee_charges"
  ADD CONSTRAINT "finder_fee_charges_amounts_check" CHECK (
    "listFeeCents" >= 0 AND "feeCents" >= 0 AND "feeCents" <= "listFeeCents" AND "attemptCount" >= 0
  ),
  ADD CONSTRAINT "finder_fee_charges_waiver_check" CHECK (
    ("waived" AND "feeCents" = 0 AND "waivedProviderId" = "providerId")
    OR (NOT "waived" AND "waivedProviderId" IS NULL)
  ),
  ADD CONSTRAINT "finder_fee_charges_status_check" CHECK (
    "status" IN (
      'awaiting-customer', 'blocked-by-dispute', 'charging', 'retry-scheduled', 'failed',
      'paid', 'waived', 'void', 'covered-by-prior-policy'
    )
  ),
  ADD CONSTRAINT "finder_fee_charges_paid_check" CHECK (
    "status" <> 'paid' OR ("stripePaymentIntentId" IS NOT NULL AND "paidAt" IS NOT NULL AND "feeCents" > 0)
  );

ALTER TABLE "provider_billing_accounts"
  ADD CONSTRAINT "provider_billing_accounts_card_last4_check" CHECK ("cardLast4" IS NULL OR "cardLast4" ~ '^[0-9]{4}$');
