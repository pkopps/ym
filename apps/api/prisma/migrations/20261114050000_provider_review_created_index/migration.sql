-- The public overview reads the newest reviews across verified providers.

-- CreateIndex
CREATE INDEX "provider_reviews_createdAt_idx" ON "provider_reviews"("createdAt");
