-- Persist processor-fee reconciliation and provider-only Stripe transfer state.
-- Amounts remain immutable on the booking settlement; transfer/reversal entries
-- append to the balanced ledger instead of rewriting the original allocation.

ALTER TABLE "payment_records"
ADD COLUMN "processorChargeId" TEXT,
ADD COLUMN "actualProcessorFeeCents" INTEGER,
ADD COLUMN "processorFeeStatus" TEXT,
ADD COLUMN "processorFeeUpdatedAt" TIMESTAMP(3),
ADD COLUMN "processorFeeFailureReason" TEXT;

ALTER TABLE "payment_records"
ADD CONSTRAINT "payment_records_processor_fee_nonnegative_check"
CHECK ("actualProcessorFeeCents" IS NULL OR "actualProcessorFeeCents" >= 0);

CREATE UNIQUE INDEX "payment_records_processorChargeId_key"
ON "payment_records"("processorChargeId");

CREATE TABLE "provider_transfer_records" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "stripeTransferId" TEXT,
  "stripeTransferReversalId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "transferredAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),

  CONSTRAINT "provider_transfer_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_transfer_records_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "provider_transfer_records_status_check"
    CHECK ("status" IN ('pending', 'transferred', 'failed', 'reversed'))
);

CREATE UNIQUE INDEX "provider_transfer_records_settlementId_key"
ON "provider_transfer_records"("settlementId");
CREATE UNIQUE INDEX "provider_transfer_records_bookingId_key"
ON "provider_transfer_records"("bookingId");
CREATE UNIQUE INDEX "provider_transfer_records_stripeTransferId_key"
ON "provider_transfer_records"("stripeTransferId");
CREATE UNIQUE INDEX "provider_transfer_records_stripeTransferReversalId_key"
ON "provider_transfer_records"("stripeTransferReversalId");
CREATE UNIQUE INDEX "provider_transfer_records_idempotencyKey_key"
ON "provider_transfer_records"("idempotencyKey");
CREATE INDEX "provider_transfer_records_providerId_status_createdAt_idx"
ON "provider_transfer_records"("providerId", "status", "createdAt");
CREATE INDEX "provider_transfer_records_paymentId_idx"
ON "provider_transfer_records"("paymentId");

ALTER TABLE "provider_transfer_records"
ADD CONSTRAINT "provider_transfer_records_settlementId_fkey"
FOREIGN KEY ("settlementId") REFERENCES "booking_financial_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
