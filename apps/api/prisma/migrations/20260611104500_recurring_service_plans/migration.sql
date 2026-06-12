ALTER TABLE "bookings"
ADD COLUMN "recurringPlanId" TEXT,
ADD COLUMN "recurringOccurrenceIndex" INTEGER;

CREATE TABLE "recurring_service_plans" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "serviceAddress" JSONB NOT NULL,
  "servicePropertyId" TEXT,
  "category" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "anchorScheduledStartIso" TIMESTAMP(3) NOT NULL,
  "anchorScheduledEndIso" TIMESTAMP(3) NOT NULL,
  "lastGeneratedBookingId" TEXT,
  "lastGeneratedAt" TIMESTAMP(3),
  "lastSchedulingAttemptAt" TIMESTAMP(3),
  "lastSchedulingError" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,

  CONSTRAINT "recurring_service_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_service_plans_customerId_requestedAt_idx"
ON "recurring_service_plans"("customerId", "requestedAt");
