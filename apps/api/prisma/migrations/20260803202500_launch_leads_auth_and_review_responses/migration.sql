-- Persist launch-lead attribution, internal access controls, and public review
-- response workflow fields that were added to the Prisma schema after the
-- previous migration checkpoint.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "launchLeadId" TEXT;

-- AlterTable
ALTER TABLE "recurring_service_plans" ADD COLUMN "launchLeadId" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "launchLeadId" TEXT;

-- AlterTable
ALTER TABLE "user_accounts"
ADD COLUMN "accessChangeHistory" JSONB,
ADD COLUMN "accessChangeNotes" TEXT,
ADD COLUMN "accessDisabledAt" TIMESTAMP(3),
ADD COLUMN "accessDisabledBy" TEXT,
ADD COLUMN "authenticationEventHistory" JSONB,
ADD COLUMN "authenticationLockExpiresAt" TIMESTAMP(3),
ADD COLUMN "failedAuthenticationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "internalScope" TEXT,
ADD COLUMN "lastAccessChangeAt" TIMESTAMP(3),
ADD COLUMN "lastAccessChangeBy" TEXT,
ADD COLUMN "lastAccessChangeKind" TEXT,
ADD COLUMN "lastAuthenticatedAt" TIMESTAMP(3),
ADD COLUMN "lastAuthenticatedMethod" TEXT,
ADD COLUMN "lastFailedAuthenticationAt" TIMESTAMP(3),
ADD COLUMN "lastFailedAuthenticationReason" TEXT;

-- AlterTable. The temporary default safely backfills existing review rows;
-- application writes remain responsible for the value after this migration.
ALTER TABLE "provider_reviews"
ADD COLUMN "escalatedAt" TIMESTAMP(3),
ADD COLUMN "escalatedBy" TEXT,
ADD COLUMN "escalationNotes" TEXT,
ADD COLUMN "externalResponseId" TEXT,
ADD COLUMN "publicReplyBody" TEXT,
ADD COLUMN "publicResponseUrl" TEXT,
ADD COLUMN "responseChannel" TEXT,
ADD COLUMN "responseChannelMetadata" JSONB,
ADD COLUMN "responseHandledAt" TIMESTAMP(3),
ADD COLUMN "responseHandledBy" TEXT,
ADD COLUMN "responseNotes" TEXT,
ADD COLUMN "responseStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "supportTicketId" TEXT;

ALTER TABLE "provider_reviews" ALTER COLUMN "responseStatus" DROP DEFAULT;

-- CreateTable
CREATE TABLE "launch_leads" (
    "id" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "requestSource" TEXT,
    "sourceReferenceId" TEXT,
    "channelMetadata" JSONB,
    "attribution" JSONB,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "preferredContactMethod" TEXT NOT NULL,
    "areaLabel" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedOwner" TEXT,
    "firstResponseDueAt" TIMESTAMP(3) NOT NULL,
    "firstRespondedAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpDueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lossReason" TEXT,
    "outcomeSummary" TEXT,
    "convertedBookingIds" TEXT[],
    "reviewIds" TEXT[],
    "firstConvertedBookingAt" TIMESTAMP(3),
    "lastConvertedBookingAt" TIMESTAMP(3),
    "lastReviewSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launch_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "launch_leads_sourceReferenceId_key" ON "launch_leads"("sourceReferenceId");

-- CreateIndex
CREATE INDEX "launch_leads_status_createdAt_idx" ON "launch_leads"("status", "createdAt");

-- CreateIndex
CREATE INDEX "launch_leads_assignedOwner_status_idx" ON "launch_leads"("assignedOwner", "status");
