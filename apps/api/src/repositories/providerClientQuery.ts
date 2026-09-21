import { utcTimestamp } from "./sqlTime";
import { Prisma } from "@prisma/client";

function key(address: Prisma.Sql, customer: Prisma.Sql) {
  const fields = ["line1", "line2", "city", "state", "postalCode", "country"];
  return Prisma.sql`jsonb_build_array(${customer}, ${Prisma.join(fields.map(field =>
    Prisma.sql`lower(regexp_replace(trim(COALESCE(${address}->>${field}, '')), '\\s+', ' ', 'g'))`))})::text`;
}

/** One row per booked property; historical visits never cross the API boundary. */
export function providerClientQuery(providerId: string, nowIso: string) {
  return Prisma.sql`
    WITH history AS (
      SELECT *, ${key(Prisma.sql`"serviceAddress"`, Prisma.sql`"customerId"`)} AS property_key
      FROM bookings WHERE "providerId" = ${providerId} AND status <> 'cancelled'
    ), ranked AS (
      SELECT *,
        row_number() OVER (PARTITION BY property_key ORDER BY "scheduledStartIso", id) AS first_rank,
        row_number() OVER (PARTITION BY property_key ORDER BY "scheduledStartIso" DESC, id DESC) AS last_rank,
        row_number() OVER (PARTITION BY property_key ORDER BY (status = 'completed') DESC, "scheduledStartIso" DESC, id DESC) AS completed_rank
      FROM history
    ), summaries AS (
      SELECT property_key, max("customerId") AS "customerId", max(id) FILTER (WHERE first_rank = 1) AS id,
        (max("serviceAddress"::text) FILTER (WHERE last_rank = 1))::jsonb AS address,
        count(*) FILTER (WHERE status = 'completed')::int AS "completedVisitCount",
        max(COALESCE("completedAt", "scheduledEndIso")) FILTER (WHERE status = 'completed' AND completed_rank = 1) AS "lastCompletedAt",
        COALESCE(jsonb_agg(jsonb_build_object('bookingId', id, 'category', category, 'status', status,
          'scheduledStartIso', to_char("scheduledStartIso", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'scheduledEndIso', to_char("scheduledEndIso", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY "scheduledStartIso", id)
          FILTER (WHERE status IN ('requested', 'confirmed', 'in-progress') AND
            ("scheduledEndIso" >= ${utcTimestamp(new Date(nowIso))} OR status = 'in-progress')), '[]'::jsonb) AS "upcomingVisits"
      FROM ranked GROUP BY property_key
    ), recurring AS (
      SELECT DISTINCT ${key(Prisma.sql`"serviceAddress"`, Prisma.sql`"customerId"`)} AS property_key
      FROM recurring_service_plans WHERE "providerId" = ${providerId} AND status = 'active'
    )
    SELECT summaries.id, COALESCE(u."fullName", '—') AS "customerName", summaries.address,
      (recurring.property_key IS NOT NULL) AS recurring, "completedVisitCount", "lastCompletedAt", "upcomingVisits"
    FROM summaries LEFT JOIN user_accounts u ON u.id = summaries."customerId"
    LEFT JOIN recurring ON recurring.property_key = summaries.property_key
    ORDER BY "customerName", summaries.address->>'line1', summaries.id`;
}
