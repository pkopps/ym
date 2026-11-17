-- Customers can say a provider may arrive earlier the same day. Defaults to false for every existing row.
ALTER TABLE "bookings" ADD COLUMN "earlyArrivalOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recurring_service_plans" ADD COLUMN "earlyArrivalOk" BOOLEAN NOT NULL DEFAULT false;
