CREATE INDEX IF NOT EXISTS "bookings_customerId_scheduledStartIso_id_idx"
ON "bookings"("customerId", "scheduledStartIso", "id");

CREATE INDEX IF NOT EXISTS "bookings_providerId_scheduledStartIso_id_idx"
ON "bookings"("providerId", "scheduledStartIso", "id");

CREATE INDEX IF NOT EXISTS "payment_records_bookingId_updatedAt_id_idx"
ON "payment_records"("bookingId", "updatedAt", "id");
