-- The ops launch leads screen reads the bookings linked to each lead.

-- CreateIndex
CREATE INDEX "bookings_launchLeadId_idx" ON "bookings"("launchLeadId");
