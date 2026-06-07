CREATE TABLE "notification_preferences" (
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reviewRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bodyPreview" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_deliveries_recipientId_createdAt_idx" ON "notification_deliveries"("recipientId", "createdAt");
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");
