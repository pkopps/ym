ALTER TABLE "user_accounts"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "resetPasswordCodeHash" TEXT,
ADD COLUMN "resetPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN "resetPasswordRequestedAt" TIMESTAMP(3);
