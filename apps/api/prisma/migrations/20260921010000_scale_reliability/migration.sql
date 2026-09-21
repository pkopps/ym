ALTER TABLE "notification_deliveries" ADD COLUMN "leaseToken" TEXT, ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
CREATE INDEX "notification_delivery_due_idx" ON "notification_deliveries"("status", "nextRetryAt", "leaseExpiresAt", "createdAt", "id");

ALTER TABLE "ProductAnalyticsEvent" ADD COLUMN "exportLeaseToken" TEXT, ADD COLUMN "exportLeaseExpiresAt" TIMESTAMP(3);
CREATE INDEX "analytics_export_due_idx" ON "ProductAnalyticsEvent"("environment", "exportedAt", "nextAttemptAt", "exportLeaseExpiresAt");
CREATE INDEX "ProductAnalyticsEvent_environment_receivedAt_idx" ON "ProductAnalyticsEvent"("environment", "receivedAt");
CREATE INDEX "provider_business_profiles_verificationStatus_userId_idx" ON "provider_business_profiles"("verificationStatus", "userId");
CREATE INDEX "provider_business_profiles_categories_idx" ON "provider_business_profiles" USING GIN ("categories");
CREATE INDEX "availability_slots_providerId_isBooked_startIso_id_idx" ON "availability_slots"("providerId", "isBooked", "startIso", "id");
CREATE INDEX "recurring_service_plans_providerId_status_idx" ON "recurring_service_plans"("providerId", "status");
CREATE INDEX "support_tickets_bookingId_idx" ON "support_tickets"("bookingId");
CREATE INDEX "provider_crew_messages_conversationId_createdAt_id_idx" ON "provider_crew_messages"("conversationId", "createdAt", "id");
CREATE INDEX "customer_provider_messages_conversationId_createdAt_id_idx" ON "customer_provider_messages"("conversationId", "createdAt", "id");
-- Prisma does not represent expression indexes; these support numeric bounding-box search on existing JSON addresses.
CREATE INDEX "user_accounts_latitude_idx" ON "user_accounts" (((address->'point'->>'latitude')::double precision));
CREATE INDEX "user_accounts_longitude_idx" ON "user_accounts" (((address->'point'->>'longitude')::double precision));
