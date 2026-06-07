ALTER TABLE "bookings"
ADD COLUMN "activeExceptionType" TEXT,
ADD COLUMN "activeExceptionReportedAt" TIMESTAMP(3),
ADD COLUMN "activeExceptionNotes" TEXT;
