ALTER TABLE "bookings"
ADD COLUMN "interventions" JSONB NOT NULL DEFAULT '[]';
