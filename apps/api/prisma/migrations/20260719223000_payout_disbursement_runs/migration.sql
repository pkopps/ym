CREATE TABLE "payout_disbursement_runs" (
  "id" TEXT NOT NULL,
  "previewBatchId" TEXT NOT NULL,
  "entryFingerprint" TEXT NOT NULL,
  "runDateIso" TIMESTAMP(3) NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "railMode" TEXT NOT NULL,
  "actionStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "recipientCount" INTEGER NOT NULL,
  "bookingCount" INTEGER NOT NULL,
  "entryCount" INTEGER NOT NULL,
  "recipientIds" TEXT[] NOT NULL,
  "entryIds" TEXT[] NOT NULL,
  "entries" JSONB NOT NULL,
  "blockerReasons" TEXT[] NOT NULL,
  "manualActionLabel" TEXT NOT NULL,
  "auditInstructions" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByOpsUserId" TEXT NOT NULL,
  "createdByOpsEmail" TEXT NOT NULL,
  "operatorNotes" TEXT,
  "reconciliationReference" TEXT,
  "reconciliationNotes" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "reconciledByOpsUserId" TEXT,

  CONSTRAINT "payout_disbursement_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payout_disbursement_runs_previewBatchId_entryFingerprint_idx"
  ON "payout_disbursement_runs"("previewBatchId", "entryFingerprint");
