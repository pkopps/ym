ALTER TABLE "bookings"
ADD COLUMN "lateNoticeSentAt" TIMESTAMP(3),
ADD COLUMN "lateEtaIso" TIMESTAMP(3),
ADD COLUMN "lateReason" TEXT;
