ALTER TABLE "provider_business_profiles"
ADD COLUMN "weeklyPayoutDay" TEXT NOT NULL DEFAULT 'Thu',
ADD COLUMN "instantPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
