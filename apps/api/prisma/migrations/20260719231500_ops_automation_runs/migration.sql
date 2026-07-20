CREATE TABLE "ops_automation_runs" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "asOfIso" TIMESTAMP(3) NOT NULL,
  "dryRun" BOOLEAN NOT NULL,
  "requestedSweepKeys" TEXT[] NOT NULL,
  "requestedSweepCount" INTEGER NOT NULL,
  "completedSweepCount" INTEGER NOT NULL,
  "failedSweepCount" INTEGER NOT NULL,
  "sentNotificationCount" INTEGER NOT NULL,
  "alreadySentCount" INTEGER NOT NULL,
  "skippedCount" INTEGER NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "createdByOpsUserId" TEXT NOT NULL,
  "createdByOpsEmail" TEXT NOT NULL,

  CONSTRAINT "ops_automation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_automation_runs_runId_key" ON "ops_automation_runs"("runId");
CREATE INDEX "ops_automation_runs_createdAt_idx" ON "ops_automation_runs"("createdAt");
CREATE INDEX "ops_automation_runs_dryRun_createdAt_idx" ON "ops_automation_runs"("dryRun", "createdAt");
