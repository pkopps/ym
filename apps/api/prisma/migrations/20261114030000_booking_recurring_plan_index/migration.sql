-- Recurring plan creation, cancellation, summaries and next-visit generation read one plan's bookings.

-- CreateIndex
CREATE INDEX "bookings_recurringPlanId_idx" ON "bookings"("recurringPlanId");
