ALTER TABLE "bookings"
ADD COLUMN "routeLivePoint" JSONB,
ADD COLUMN "routeLiveUpdatedAt" TIMESTAMP(3),
ADD COLUMN "routeLiveSource" TEXT,
ADD COLUMN "routeLiveSpeedMph" DOUBLE PRECISION,
ADD COLUMN "routeLiveAccuracyMeters" DOUBLE PRECISION;
