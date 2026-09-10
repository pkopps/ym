CREATE TABLE "security_states" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "security_states_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "security_states_expiresAt_idx" ON "security_states"("expiresAt");

ALTER TABLE "payment_records" ADD COLUMN "checkoutSessionExpiredAt" TIMESTAMP(3), ADD COLUMN "checkoutSuccessPath" TEXT, ADD COLUMN "checkoutCancelPath" TEXT;
