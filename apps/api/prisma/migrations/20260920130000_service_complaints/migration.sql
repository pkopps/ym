ALTER TABLE "payment_records" ADD COLUMN "partialRefunds" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "payment_records" SET "refundedAmountCents" = "amountCents" WHERE "status" = 'refunded';
ALTER TABLE "support_tickets" ADD COLUMN "complaint" JSONB;
ALTER TABLE "payment_records" ADD COLUMN "fullRefundAttempt" JSONB;
