-- AlterTable
ALTER TABLE "bookings"
ADD COLUMN "onRouteConfirmedAt" TIMESTAMP(3),
ADD COLUMN "onRouteConfirmedByCrewMemberId" TEXT;

-- CreateTable
CREATE TABLE "customer_provider_conversations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_provider_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_provider_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_provider_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_provider_conversations_bookingId_key"
ON "customer_provider_conversations"("bookingId");
