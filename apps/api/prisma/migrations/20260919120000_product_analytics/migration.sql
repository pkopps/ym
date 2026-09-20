CREATE TABLE "ProductAnalyticsEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "actorId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "properties" JSONB NOT NULL,
  "exportedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProductAnalyticsEvent_environment_occurredAt_idx" ON "ProductAnalyticsEvent"("environment", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_actorId_occurredAt_idx" ON "ProductAnalyticsEvent"("actorId", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_exportedAt_nextAttemptAt_idx" ON "ProductAnalyticsEvent"("exportedAt", "nextAttemptAt");
CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewNotes" TEXT,
  "audit" JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX "PrivacyRequest_status_requestedAt_idx" ON "PrivacyRequest"("status", "requestedAt");
CREATE INDEX "PrivacyRequest_userId_requestedAt_idx" ON "PrivacyRequest"("userId", "requestedAt");

CREATE UNIQUE INDEX "PrivacyRequest_open_kind_key" ON "PrivacyRequest"("userId", "kind") WHERE "status" IN ('requested', 'in-review', 'awaiting-owner', 'retention-required');
