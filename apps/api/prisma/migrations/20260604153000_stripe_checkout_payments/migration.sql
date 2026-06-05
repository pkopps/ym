ALTER TABLE "payment_records"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN "processor" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "checkoutSessionId" TEXT,
ADD COLUMN "checkoutSessionUrl" TEXT,
ADD COLUMN "processorPaymentIntentId" TEXT,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "payment_records_checkoutSessionId_key"
ON "payment_records"("checkoutSessionId");
