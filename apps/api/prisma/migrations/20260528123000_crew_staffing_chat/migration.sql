-- AlterTable
ALTER TABLE "crew_member_profiles"
ADD COLUMN "availableWeekdays" TEXT[],
ADD COLUMN "winterWorkEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "provider_business_profiles"
ADD COLUMN "staffingMode" TEXT NOT NULL DEFAULT 'review-first';

-- CreateTable
CREATE TABLE "crew_matches" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "crewMemberName" TEXT NOT NULL,
    "crewMemberPhone" TEXT NOT NULL,
    "categories" TEXT[],
    "availableWeekdays" TEXT[],
    "preferredSchedule" TEXT NOT NULL,
    "willingToTravelMiles" INTEGER NOT NULL,
    "hasOwnEquipment" BOOLEAN NOT NULL,
    "winterWorkEnabled" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "autoAccepted" BOOLEAN NOT NULL DEFAULT false,
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "hourlyRateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "crew_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_crew_conversations" (
    "id" TEXT NOT NULL,
    "crewMatchId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "crewMemberName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_crew_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_crew_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_crew_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crew_matches_bookingId_crewMemberId_key" ON "crew_matches"("bookingId", "crewMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_crew_conversations_crewMatchId_key" ON "provider_crew_conversations"("crewMatchId");
