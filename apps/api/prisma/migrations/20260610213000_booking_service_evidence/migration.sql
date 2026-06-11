ALTER TABLE "bookings"
ADD COLUMN "serviceEvidence" JSONB NOT NULL DEFAULT '[]';
