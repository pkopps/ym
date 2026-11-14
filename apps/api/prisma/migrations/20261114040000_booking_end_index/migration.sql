-- Crew reconciliation reads bookings that have not ended yet across providers.

-- CreateIndex
CREATE INDEX "bookings_scheduledEndIso_idx" ON "bookings"("scheduledEndIso");
