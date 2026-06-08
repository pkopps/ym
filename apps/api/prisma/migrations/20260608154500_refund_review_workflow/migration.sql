ALTER TABLE "payment_records"
ADD COLUMN "refundReviewStatus" TEXT,
ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN "refundRequestedByRole" TEXT,
ADD COLUMN "refundReviewedAt" TIMESTAMP(3),
ADD COLUMN "refundReviewedByRole" TEXT,
ADD COLUMN "refundDecisionNotes" TEXT;
