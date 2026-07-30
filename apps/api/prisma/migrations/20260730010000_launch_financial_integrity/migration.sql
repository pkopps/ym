-- Prevent duplicate processor identities and duplicate payout execution records.
CREATE UNIQUE INDEX "payment_records_checkoutSessionId_key"
ON "payment_records"("checkoutSessionId");

CREATE UNIQUE INDEX "payment_records_processorPaymentIntentId_key"
ON "payment_records"("processorPaymentIntentId");

DROP INDEX IF EXISTS "payout_disbursement_runs_previewBatchId_entryFingerprint_idx";
CREATE UNIQUE INDEX "payout_disbursement_runs_previewBatchId_entryFingerprint_key"
ON "payout_disbursement_runs"("previewBatchId", "entryFingerprint");

CREATE TABLE "provider_credentials" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "documentUrl" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByOpsUserId" TEXT,
  "reviewNotes" TEXT,
  CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_connect_accounts" (
  "providerId" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "dashboard" TEXT NOT NULL,
  "feesCollector" TEXT NOT NULL,
  "lossesCollector" TEXT NOT NULL,
  "chargePattern" TEXT NOT NULL,
  "onboardingStatus" TEXT NOT NULL,
  "transfersStatus" TEXT NOT NULL,
  "payoutsStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSyncedAt" TIMESTAMP(3),
  CONSTRAINT "provider_connect_accounts_pkey" PRIMARY KEY ("providerId")
);

CREATE TABLE "customer_provider_relationships" (
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "firstSettledBookingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_provider_relationships_pkey" PRIMARY KEY ("customerId", "providerId")
);

CREATE TABLE "booking_financial_settlements" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "customerChargeCents" INTEGER NOT NULL,
  "providerServiceGrossCents" INTEGER NOT NULL,
  "finderFeeCents" INTEGER NOT NULL,
  "completedJobFeeCents" INTEGER NOT NULL,
  "platformGrossRevenueCents" INTEGER NOT NULL,
  "actualProcessorFeeCents" INTEGER NOT NULL,
  "platformNetRevenueCents" INTEGER NOT NULL,
  "providerNetCents" INTEGER NOT NULL,
  "crewPayoutByYardMatchCents" INTEGER NOT NULL DEFAULT 0,
  "isFirstCompletedCustomerProviderJob" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_financial_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_financial_settlements_nonnegative_check" CHECK (
    "customerChargeCents" >= 0 AND
    "providerServiceGrossCents" >= 0 AND
    "finderFeeCents" >= 0 AND
    "completedJobFeeCents" >= 0 AND
    "platformGrossRevenueCents" >= 0 AND
    "actualProcessorFeeCents" >= 0 AND
    "providerNetCents" >= 0 AND
    "crewPayoutByYardMatchCents" = 0
  ),
  CONSTRAINT "booking_financial_settlements_allocation_check" CHECK (
    "customerChargeCents" = "providerNetCents" + "platformGrossRevenueCents"
  )
);

CREATE TABLE "financial_ledger_entries" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "reversalOfEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_ledger_entries_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "financial_ledger_entries_direction_check" CHECK ("direction" IN ('debit', 'credit'))
);

CREATE UNIQUE INDEX "provider_credentials_providerId_type_jurisdiction_key"
ON "provider_credentials"("providerId", "type", "jurisdiction");
CREATE INDEX "provider_credentials_status_expiresAt_idx"
ON "provider_credentials"("status", "expiresAt");

CREATE UNIQUE INDEX "provider_connect_accounts_stripeAccountId_key"
ON "provider_connect_accounts"("stripeAccountId");
CREATE INDEX "provider_connect_accounts_onboardingStatus_transfersStatus_idx"
ON "provider_connect_accounts"("onboardingStatus", "transfersStatus");

CREATE UNIQUE INDEX "customer_provider_relationships_firstSettledBookingId_key"
ON "customer_provider_relationships"("firstSettledBookingId");

CREATE UNIQUE INDEX "booking_financial_settlements_bookingId_key"
ON "booking_financial_settlements"("bookingId");
CREATE UNIQUE INDEX "booking_financial_settlements_paymentId_key"
ON "booking_financial_settlements"("paymentId");
CREATE INDEX "booking_financial_settlements_providerId_status_createdAt_idx"
ON "booking_financial_settlements"("providerId", "status", "createdAt");
CREATE INDEX "booking_financial_settlements_customerId_providerId_idx"
ON "booking_financial_settlements"("customerId", "providerId");

CREATE UNIQUE INDEX "financial_ledger_entries_idempotencyKey_key"
ON "financial_ledger_entries"("idempotencyKey");
CREATE INDEX "financial_ledger_entries_bookingId_createdAt_idx"
ON "financial_ledger_entries"("bookingId", "createdAt");
CREATE INDEX "financial_ledger_entries_account_createdAt_idx"
ON "financial_ledger_entries"("account", "createdAt");

ALTER TABLE "provider_credentials"
ADD CONSTRAINT "provider_credentials_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_connect_accounts"
ADD CONSTRAINT "provider_connect_accounts_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_provider_relationships"
ADD CONSTRAINT "customer_provider_relationships_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_provider_relationships"
ADD CONSTRAINT "customer_provider_relationships_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_financial_settlements"
ADD CONSTRAINT "booking_financial_settlements_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_financial_settlements"
ADD CONSTRAINT "booking_financial_settlements_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_ledger_entries"
ADD CONSTRAINT "financial_ledger_entries_settlementId_fkey"
FOREIGN KEY ("settlementId") REFERENCES "booking_financial_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
