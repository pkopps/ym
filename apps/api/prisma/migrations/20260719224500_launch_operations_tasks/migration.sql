CREATE TABLE "launch_operations_tasks" (
  "id" TEXT NOT NULL,
  "recommendationFingerprint" TEXT NOT NULL,
  "recommendationKey" TEXT NOT NULL,
  "pocketKey" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "dueAtIso" TIMESTAMP(3) NOT NULL,
  "relatedScenarioKeys" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByOpsUserId" TEXT NOT NULL,
  "createdByOpsEmail" TEXT NOT NULL,
  "assignedToOpsUserId" TEXT,
  "assignedToOpsEmail" TEXT,
  "operatorNotes" TEXT,
  "completionNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedByOpsUserId" TEXT,

  CONSTRAINT "launch_operations_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "launch_operations_tasks_recommendationFingerprint_key"
  ON "launch_operations_tasks"("recommendationFingerprint");

CREATE INDEX "launch_operations_tasks_status_priority_idx"
  ON "launch_operations_tasks"("status", "priority");

CREATE INDEX "launch_operations_tasks_pocketKey_recommendationKey_idx"
  ON "launch_operations_tasks"("pocketKey", "recommendationKey");
