import { utcTimestamp } from "../repositories/sqlTime";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ProductAnalyticsReport } from "@yardmatch/contracts";

const stages = ["page_viewed", "quote_evaluated", "provider_search_performed", "recommendation_presented",
  "booking_requested", "booking_confirmed", "payment_captured", "booking_completed"];
const dimensions = Prisma.sql`(VALUES ('source'), ('platform'), ('locale'), ('category'), ('area'))`;
type ReportTotals = Pick<ProductAnalyticsReport, "events" | "counts" | "segments" | "actions" | "performance"> & {
  reached: number[];
  cohortSegments: ProductAnalyticsReport["funnel"]["segments"];
  reasons: Record<string, number>;
  returningCustomers: number;
  lastEventAt?: string;
};

/** Aggregate the entire requested period inside PostgreSQL; never transfer raw event history. */
export async function readAnalyticsReport(prisma: PrismaClient, environment: string, since: Date) {
  const progress = stages.map((name, index) => {
    const names = index === 0 ? ["page_viewed", "screen_viewed"] : index === 1
      ? ["quote_evaluated", "instant_quote_generated", "instant_quote_needs_follow_up"] : [name];
    return Prisma.sql`${Prisma.raw(`stage${index}`)} AS (
      SELECT e.person, min(e."occurredAt") AS at FROM resolved e
      ${index ? Prisma.sql`JOIN ${Prisma.raw(`stage${index - 1}`)} previous ON previous.person = e.person AND e."occurredAt" >= previous.at` : Prisma.empty}
      WHERE e.name IN (${Prisma.join(names)}) ${index ? Prisma.sql`AND e.trusted` : Prisma.empty} GROUP BY e.person
    )`;
  });
  const [row] = await prisma.$queryRaw<Array<{ report: ReportTotals }>>`
    WITH events AS MATERIALIZED (
      SELECT *, properties->>'origin' IS DISTINCT FROM 'client' AS trusted
      FROM "ProductAnalyticsEvent" WHERE environment = ${environment} AND "occurredAt" >= ${utcTimestamp(since)}
        AND name <> 'session_heartbeat' AND properties->>'role' IS DISTINCT FROM 'ops'
        AND properties->'internal' IS DISTINCT FROM 'true'::jsonb
    ), anonymous_owners AS (
      SELECT DISTINCT ON (properties->>'anonymousId') properties->>'anonymousId' AS anonymous_id, "actorId" AS owner
      FROM events WHERE name = 'journey_identified' AND "actorId" IS NOT NULL AND NULLIF(properties->>'anonymousId', '') IS NOT NULL
      ORDER BY properties->>'anonymousId', "occurredAt" DESC, id DESC
    ), booking_owners AS (
      SELECT DISTINCT ON (properties->>'bookingId') properties->>'bookingId' AS booking_id, "actorId" AS owner
      FROM events WHERE name = 'booking_requested' AND trusted AND "actorId" IS NOT NULL AND NULLIF(properties->>'bookingId', '') IS NOT NULL
      ORDER BY properties->>'bookingId', "occurredAt" DESC, id DESC
    ), resolved AS MATERIALIZED (
      SELECT e.*, COALESCE(CASE WHEN trusted THEN NULLIF(e.properties->>'customerId', '') END,
        CASE WHEN trusted THEN booking.owner END,
        CASE WHEN e."actorId" IS NOT NULL AND e."actorId" <> 'anonymous' THEN COALESCE(actor.owner, e."actorId") END,
        anonymous.owner, e.properties->>'anonymousId', e.id) AS person
      FROM events e LEFT JOIN anonymous_owners anonymous ON anonymous.anonymous_id = e.properties->>'anonymousId'
      LEFT JOIN booking_owners booking ON booking.booking_id = e.properties->>'bookingId'
      LEFT JOIN booking_owners actor ON actor.booking_id = e."actorId"
    ), ${Prisma.join(progress)},
    event_counts AS (
      SELECT name, count(*) AS events, count(DISTINCT COALESCE("actorId", properties->>'anonymousId', id)) AS people FROM events GROUP BY name
    ), segment_counts AS (
      SELECT dimension, COALESCE(properties->>dimension, 'unknown') AS value, count(*) AS total
      FROM events CROSS JOIN ${dimensions} d(dimension) GROUP BY dimension, value
    ), segment_groups AS (
      SELECT dimension, jsonb_object_agg(value, total) AS totals FROM segment_counts GROUP BY dimension
    ), action_counts AS (
      SELECT COALESCE(properties->>'action', 'unknown') || CASE WHEN COALESCE(properties->>'destination', '') = '' THEN '' ELSE ': ' || (properties->>'destination') END AS action,
        count(*) AS total FROM events WHERE name = 'action_clicked' GROUP BY action
    ), metrics AS (
      SELECT properties->>'metric' AS metric, count(*) AS samples,
        percentile_disc(0.75) WITHIN GROUP (ORDER BY (properties->>'value')::double precision) AS p75
      FROM events WHERE name = 'web_vital' AND jsonb_typeof(properties->'metric') = 'string' AND jsonb_typeof(properties->'value') = 'number' GROUP BY metric
    ), outcomes AS (
      SELECT person, bool_or(name = 'booking_requested' AND trusted) AS requested,
        bool_or(name = 'booking_completed' AND trusted) AS completed,
        count(DISTINCT COALESCE(properties->>'bookingId', id)) FILTER (WHERE name = 'booking_completed' AND trusted) AS completed_jobs
      FROM resolved GROUP BY person
    ), entries AS (
      SELECT DISTINCT ON (person) person, properties FROM resolved WHERE name IN ('page_viewed', 'screen_viewed') ORDER BY person, "occurredAt", id
    ), dimension_history AS (
      SELECT person, dimension, "occurredAt", id,
        COALESCE(properties->>dimension, CASE WHEN dimension = 'category' THEN properties->>'serviceCategory' END) AS value
      FROM resolved CROSS JOIN ${dimensions} d(dimension)
    ), first_dimensions AS (
      SELECT DISTINCT ON (person, dimension) person, dimension, value FROM dimension_history WHERE value IS NOT NULL ORDER BY person, dimension, "occurredAt", id
    ), cohorts AS (
      SELECT d.dimension || ':' || COALESCE(entries.properties->>d.dimension, first_dimensions.value, 'unknown') AS segment,
        count(*) AS visitors, count(*) FILTER (WHERE requested) AS requested, count(*) FILTER (WHERE completed) AS completed
      FROM entries JOIN outcomes USING (person) CROSS JOIN ${dimensions} d(dimension)
      LEFT JOIN first_dimensions ON first_dimensions.person = entries.person AND first_dimensions.dimension = d.dimension GROUP BY segment
    ), reasons AS (
      SELECT COALESCE(properties->>'reason', name) AS reason, count(*) AS total FROM events
      WHERE name IN ('provider_search_no_results', 'provider_search_no_open_windows', 'payment_failed', 'booking_declined_by_provider', 'journey_feedback', 'form_validation_failed') GROUP BY reason
    )
    SELECT jsonb_build_object(
      'events', (SELECT count(*) FROM events),
      'lastEventAt', (SELECT to_char(max("occurredAt"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM events),
      'counts', COALESCE((SELECT jsonb_object_agg(name, jsonb_build_object('events', events, 'people', people)) FROM event_counts), '{}'::jsonb),
      'segments', COALESCE((SELECT jsonb_object_agg(dimension, totals) FROM segment_groups), '{}'::jsonb),
      'actions', COALESCE((SELECT jsonb_object_agg(action, total) FROM action_counts), '{}'::jsonb),
      'performance', COALESCE((SELECT jsonb_object_agg(metric, jsonb_build_object('samples', samples, 'p75', p75)) FROM metrics), '{}'::jsonb),
      'reached', jsonb_build_array(${Prisma.join(stages.map((_, index) => Prisma.sql`(SELECT count(*) FROM ${Prisma.raw(`stage${index}`)})`))}),
      'cohortSegments', COALESCE((SELECT jsonb_object_agg(segment, jsonb_build_object('visitors', visitors, 'requested', requested, 'completed', completed)) FROM cohorts), '{}'::jsonb),
      'reasons', COALESCE((SELECT jsonb_object_agg(reason, total) FROM reasons), '{}'::jsonb),
      'returningCustomers', (SELECT count(*) FROM outcomes WHERE completed_jobs > 1)
    ) AS report`;
  const totals = row.report;
  const lowSample = totals.reached[0] < 30;
  return { events: totals.events, counts: totals.counts, segments: { platform: {}, locale: {}, source: {}, category: {}, area: {}, ...totals.segments },
    actions: totals.actions, performance: totals.performance, lastEventAt: totals.lastEventAt ?? undefined,
    lowSample, truncated: false, funnel: {
      steps: stages.map((name, index) => ({ name, people: totals.reached[index],
        previousStepPeople: totals.reached[index ? index - 1 : 0],
        conversionRate: index && totals.reached[index - 1] ? totals.reached[index] / totals.reached[index - 1] : null })),
      segments: totals.cohortSegments, reasons: totals.reasons, returningCustomers: totals.returningCustomers, lowSample
    } };
}
