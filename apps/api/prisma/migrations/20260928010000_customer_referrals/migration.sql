CREATE TABLE "customer_referrals" (
    "id" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "friendName" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "areaLabel" TEXT,
    "consentVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_referrals_leadId_key" ON "customer_referrals"("leadId");
CREATE UNIQUE INDEX "customer_referrals_referrerCustomerId_channel_contact_key" ON "customer_referrals"("referrerCustomerId", "channel", "contact");
CREATE INDEX "customer_referrals_referrerCustomerId_createdAt_idx" ON "customer_referrals"("referrerCustomerId", "createdAt");

ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "customer_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "launch_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
