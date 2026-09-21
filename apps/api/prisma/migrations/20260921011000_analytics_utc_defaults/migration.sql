-- Prisma DateTime columns store UTC without a timezone. Keep database defaults
-- consistent even when the database or migration session uses another timezone.
ALTER TABLE "ProductAnalyticsEvent"
  ALTER COLUMN "receivedAt" SET DEFAULT (now() AT TIME ZONE 'UTC'),
  ALTER COLUMN "nextAttemptAt" SET DEFAULT (now() AT TIME ZONE 'UTC');
