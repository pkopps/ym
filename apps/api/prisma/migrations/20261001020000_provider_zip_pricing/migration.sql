ALTER TABLE "provider_business_profiles" ADD COLUMN "servicePrices" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "zip_service_minimums" (
  "postalCode" TEXT NOT NULL CHECK ("postalCode" ~ '^[0-9]{5}$'),
  "category" TEXT NOT NULL,
  "minimumStartingPriceCents" INTEGER NOT NULL CHECK ("minimumStartingPriceCents" > 0 AND "minimumStartingPriceCents" <= 1000000),
  "history" JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "zip_service_minimums_pkey" PRIMARY KEY ("postalCode", "category")
);
