-- YardMatch pilot: aggregate-only, read-only PostgreSQL / psql query.
-- Required psql variables: start_utc, end_utc, as_of_utc, environment,
-- market_zips_json (JSON array), excluded_ids_json (customer/provider test IDs).
-- UTC-naive schema timestamps: explicitly convert timezone-aware parameters.
-- Execute on an authorized replica/snapshot. No credentials or rows in report.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH p AS (
 SELECT :'start_utc'::timestamptz AT TIME ZONE 'UTC' AS start_at,
        :'end_utc'::timestamptz AT TIME ZONE 'UTC' AS end_at,
        :'as_of_utc'::timestamptz AT TIME ZONE 'UTC' AS as_of_at,
        :'environment'::text AS environment,
        :'market_zips_json'::jsonb AS zips, :'excluded_ids_json'::jsonb AS excluded
), eligible AS MATERIALIZED (
 SELECT b.* FROM bookings b CROSS JOIN p
 WHERE p.zips ? (b."serviceAddress"->>'postalCode')
 AND NOT (p.excluded ? b."customerId" OR p.excluded ? b."providerId")
 AND b."requestedAt" < p.as_of_at
), cohort AS MATERIALIZED (
 SELECT b.* FROM eligible b CROSS JOIN p
 WHERE b."requestedAt" >= p.start_at AND b."requestedAt" < p.end_at
), events AS MATERIALIZED (
 SELECT e.* FROM "ProductAnalyticsEvent" e CROSS JOIN p
 WHERE e.environment = p.environment AND e.source = 'server'
 AND e.properties->>'origin' IS DISTINCT FROM 'client'
 AND e.properties->>'role' IS DISTINCT FROM 'ops'
 AND e.properties->'internal' IS DISTINCT FROM 'true'::jsonb
 AND NOT (p.excluded ? COALESCE(e."actorId", '')
       OR p.excluded ? COALESCE(e.properties->>'customerId', '')
       OR p.excluded ? COALESCE(e.properties->>'providerId', ''))
 AND e."occurredAt" < p.as_of_at AND e."receivedAt" < p.as_of_at
 AND e.name IN ('booking_requested','booking_confirmed','booking_completed')
), matched AS MATERIALIZED (
 SELECT b.id, b.status, b."requestedAt", b."completedAt", b."scheduledEndIso",
        (b."recurringPlanId" IS NOT NULL AND b."recurringOccurrenceIndex" > 1) AS generated,
        count(e.id) FILTER (WHERE e.name = 'booking_requested') AS request_events,
        count(e.id) FILTER (WHERE e.name = 'booking_confirmed') AS confirm_events,
        count(e.id) FILTER (WHERE e.name = 'booking_completed') AS complete_events,
        min(e."occurredAt") FILTER (WHERE e.name = 'booking_confirmed') AS confirmed_at
 FROM cohort b LEFT JOIN events e ON e.properties->>'bookingId' = b.id GROUP BY b.id,
 b.status,b."requestedAt",b."completedAt",b."scheduledEndIso",b."recurringPlanId",b."recurringOccurrenceIndex"
), due AS (
 SELECT b.* FROM eligible b CROSS JOIN p
 WHERE b."scheduledEndIso" >= p.start_at AND b."scheduledEndIso" < p.end_at
 AND b."scheduledEndIso" <= p.as_of_at - interval '48 hours'
), latency AS (
 SELECT extract(epoch FROM (confirmed_at - "requestedAt"))/3600 AS hours
 FROM matched WHERE confirmed_at >= "requestedAt"
), first_jobs AS (
 SELECT "customerId", min("completedAt") AS first_at
 FROM eligible CROSS JOIN p WHERE "completedAt" < p.as_of_at GROUP BY "customerId"
), repeat_cohort AS (
 SELECT f.*, EXISTS(SELECT 1 FROM eligible b WHERE b."customerId" = f."customerId"
 AND b."completedAt" > f.first_at AND b."completedAt" <= f.first_at + interval '30 days') AS repeated
 FROM first_jobs f CROSS JOIN p WHERE first_at >= p.start_at AND first_at < p.end_at
 AND first_at + interval '30 days' <= p.as_of_at
), finance AS (
 SELECT s.currency,s.status,s."policyVersion",s."isFirstCompletedCustomerProviderJob" AS first_pair,
 count(*) AS jobs, sum(s."platformNetRevenueCents") AS platform_net_cents,
 sum(s."actualProcessorFeeCents") AS processor_fee_cents
 FROM "booking_financial_settlements" s JOIN eligible b ON b.id = s."bookingId" CROSS JOIN p
 WHERE b."completedAt" >= p.start_at AND b."completedAt" < p.end_at
 GROUP BY s.currency,s.status,s."policyVersion",s."isFirstCompletedCustomerProviderJob"
)
SELECT jsonb_build_object(
 'scope', jsonb_build_object('start_utc', :'start_utc', 'end_utc', :'end_utc',
 'as_of_utc', :'as_of_utc', 'environment', :'environment', 'market_zips', :'market_zips_json'::jsonb),
 'requested_jobs', (SELECT count(*) FROM cohort),
 'request_event_expected_jobs', (SELECT count(*) FROM matched WHERE NOT COALESCE(generated,false)),
 'generated_recurring_jobs', (SELECT count(*) FROM matched WHERE generated),
 'missing_request_events', (SELECT count(*) FROM matched WHERE NOT COALESCE(generated,false) AND request_events=0),
 'duplicate_request_jobs', (SELECT count(*) FROM matched WHERE request_events>1),
 'duplicate_confirmation_jobs', (SELECT count(*) FROM matched WHERE confirm_events>1),
 'duplicate_completion_jobs', (SELECT count(*) FROM matched WHERE complete_events>1),
 'missing_confirmation_proxy_jobs', (SELECT count(*) FROM matched WHERE status IN ('confirmed','in-progress','completed') AND confirm_events=0),
 'missing_completion_events', (SELECT count(*) FROM matched WHERE "completedAt" IS NOT NULL AND complete_events=0),
 'completion_event_without_timestamp_jobs', (SELECT count(*) FROM matched WHERE complete_events>0 AND "completedAt" IS NULL),
 'negative_confirmation_latency_jobs', (SELECT count(*) FROM matched WHERE confirmed_at < "requestedAt"),
 'unconfirmed_over_24h_jobs', (SELECT count(*) FROM matched CROSS JOIN p WHERE status='requested' AND "requestedAt" < p.as_of_at - interval '24 hours'),
 'confirmation_proxy', (SELECT jsonb_build_object('n',count(*),'p50_hours',percentile_disc(.5) WITHIN GROUP(ORDER BY hours),'p90_hours',percentile_disc(.9) WITHIN GROUP(ORDER BY hours),'max_hours',max(hours)) FROM latency),
 'immature_scheduled_jobs', (SELECT count(*) FROM eligible b CROSS JOIN p WHERE b."scheduledEndIso">=p.start_at AND b."scheduledEndIso"<p.end_at AND b."scheduledEndIso">p.as_of_at-interval '48 hours'),
 'repeat_immature_customers', (SELECT count(*) FROM first_jobs f CROSS JOIN p WHERE first_at>=p.start_at AND first_at<p.end_at AND first_at+interval '30 days'>p.as_of_at),
 'completion', (SELECT jsonb_build_object('numerator', count(*) FILTER(WHERE "completedAt" IS NOT NULL), 'denominator',count(*), 'cancelled',count(*) FILTER(WHERE status='cancelled'), 'refunded',count(*) FILTER(WHERE status='refunded'), 'open',count(*) FILTER(WHERE "completedAt" IS NULL AND status NOT IN ('cancelled','refunded'))) FROM due),
 'repeat_30d_market', (SELECT jsonb_build_object('numerator',count(*) FILTER(WHERE repeated),'denominator',count(*)) FROM repeat_cohort),
 'settlement_rows_by_status', COALESCE((SELECT jsonb_agg(to_jsonb(finance)) FROM finance),'[]'::jsonb),
 'completed_jobs_missing_settlement', (SELECT count(*) FROM eligible b CROSS JOIN p LEFT JOIN booking_financial_settlements s ON s."bookingId"=b.id WHERE b."completedAt">=p.start_at AND b."completedAt"<p.end_at AND s.id IS NULL),
 'unattributable_events_global', (SELECT count(*) FROM events e CROSS JOIN p WHERE e."occurredAt">=p.start_at AND e."occurredAt"<p.end_at AND NULLIF(e.properties->>'bookingId','') IS NULL),
 'orphan_events_global', (SELECT count(*) FROM events e CROSS JOIN p LEFT JOIN bookings b ON b.id=e.properties->>'bookingId' WHERE e."occurredAt">=p.start_at AND e."occurredAt"<p.end_at AND NULLIF(e.properties->>'bookingId','') IS NOT NULL AND b.id IS NULL)
);
ROLLBACK;
