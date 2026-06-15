-- Remove leftover indexes and defaults that are no longer declared in the Prisma schema.

-- DropIndex
DROP INDEX IF EXISTS "payment_records_checkoutSessionId_key";

-- DropIndex
DROP INDEX IF EXISTS "recurring_service_plans_customerId_requestedAt_idx";

-- AlterTable
ALTER TABLE "bookings"
ALTER COLUMN "serviceEvidence" DROP DEFAULT,
ALTER COLUMN "interventions" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_records"
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "processor" DROP DEFAULT,
ALTER COLUMN "createdAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_tickets"
ALTER COLUMN "updatedAt" DROP DEFAULT;
