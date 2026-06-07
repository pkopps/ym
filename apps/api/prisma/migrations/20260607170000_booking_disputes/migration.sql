ALTER TABLE "bookings"
ADD COLUMN "disputedAt" TIMESTAMP(3),
ADD COLUMN "disputeReason" TEXT,
ADD COLUMN "disputedByRole" TEXT;
