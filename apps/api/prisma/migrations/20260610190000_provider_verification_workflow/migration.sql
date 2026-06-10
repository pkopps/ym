ALTER TABLE "provider_business_profiles"
ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'pending-review',
ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN "verificationNotes" TEXT;

UPDATE "provider_business_profiles"
SET
  "verificationStatus" = 'verified',
  "verificationSubmittedAt" = COALESCE("verificationSubmittedAt", NOW()),
  "verificationReviewedAt" = COALESCE("verificationReviewedAt", NOW()),
  "verificationNotes" = COALESCE("verificationNotes", 'Existing provider approved during provider verification rollout.');
