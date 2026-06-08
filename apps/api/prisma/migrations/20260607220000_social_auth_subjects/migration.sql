ALTER TABLE "user_accounts"
ADD COLUMN "googleSubject" TEXT,
ADD COLUMN "appleSubject" TEXT;

CREATE UNIQUE INDEX "user_accounts_googleSubject_key" ON "user_accounts"("googleSubject");
CREATE UNIQUE INDEX "user_accounts_appleSubject_key" ON "user_accounts"("appleSubject");
