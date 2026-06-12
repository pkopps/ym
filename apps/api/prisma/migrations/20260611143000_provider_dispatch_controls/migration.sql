ALTER TABLE "provider_business_profiles"
ADD COLUMN "crewReviewLeadHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "departureReminderLeadMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "routeLeaderMode" TEXT NOT NULL DEFAULT 'provider-only';
