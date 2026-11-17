-- Indexes for the scoped crew and GPS hot-path queries: upcoming bookings by status, and one crew member's matches.

-- CreateIndex
CREATE INDEX "bookings_status_scheduledStartIso_idx" ON "bookings"("status", "scheduledStartIso");

-- CreateIndex
CREATE INDEX "crew_matches_crewMemberId_createdAt_idx" ON "crew_matches"("crewMemberId", "createdAt");
