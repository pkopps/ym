-- Provider and crew coordinates as real, indexed columns. They are derived from user_accounts.address, which stays
-- the source of truth: the trigger below copies address.point into the columns on every insert and update, so no
-- writer (repository, seed, scripts) has to set them and they cannot drift from the address.

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE FUNCTION user_accounts_sync_location() RETURNS trigger AS $$
BEGIN
  NEW."latitude" := CASE WHEN jsonb_typeof(NEW."address"->'point'->'latitude') = 'number'
    THEN (NEW."address"->'point'->>'latitude')::double precision END;
  NEW."longitude" := CASE WHEN jsonb_typeof(NEW."address"->'point'->'longitude') = 'number'
    THEN (NEW."address"->'point'->>'longitude')::double precision END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_accounts_sync_location BEFORE INSERT OR UPDATE ON "user_accounts"
FOR EACH ROW EXECUTE FUNCTION user_accounts_sync_location();

-- Backfill existing rows.
UPDATE "user_accounts" SET
  "latitude" = CASE WHEN jsonb_typeof("address"->'point'->'latitude') = 'number'
    THEN ("address"->'point'->>'latitude')::double precision END,
  "longitude" = CASE WHEN jsonb_typeof("address"->'point'->'longitude') = 'number'
    THEN ("address"->'point'->>'longitude')::double precision END;

-- CreateIndex
CREATE INDEX "user_accounts_role_latitude_longitude_idx" ON "user_accounts"("role", "latitude", "longitude");
