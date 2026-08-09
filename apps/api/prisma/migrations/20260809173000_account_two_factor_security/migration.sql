-- Account-controlled two-factor authentication, short-lived verification
-- challenges, hashed remembered-device records, and auditable security events.
ALTER TABLE "user_accounts"
ADD COLUMN "twoFactorMethod" TEXT,
ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN "twoFactorChallengeId" TEXT,
ADD COLUMN "twoFactorChallengePurpose" TEXT,
ADD COLUMN "twoFactorChallengeMethod" TEXT,
ADD COLUMN "twoFactorChallengeCodeHash" TEXT,
ADD COLUMN "twoFactorChallengeExpiresAt" TIMESTAMP(3),
ADD COLUMN "twoFactorChallengeRequestedAt" TIMESTAMP(3),
ADD COLUMN "twoFactorChallengeFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "twoFactorChallengeDeviceIdHash" TEXT,
ADD COLUMN "twoFactorChallengeDeviceLabel" TEXT,
ADD COLUMN "twoFactorChallengeDevicePlatform" TEXT,
ADD COLUMN "trustedDevices" JSONB,
ADD COLUMN "securityEventHistory" JSONB;
