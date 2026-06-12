ALTER TABLE "crew_member_profiles"
ADD COLUMN "cancellationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCancellationAt" TIMESTAMP(3);

ALTER TABLE "crew_matches"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3);
