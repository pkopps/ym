-- Evidence photos are served by evidence id, which lives inside the booking evidence JSON.

-- CreateIndex
CREATE INDEX "bookings_serviceEvidence_idx" ON "bookings" USING GIN ("serviceEvidence" jsonb_path_ops);
