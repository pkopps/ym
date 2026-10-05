"""Optional PostgreSQL integration check using a disposable synthetic Docker DB.
Run: python test_sql.py (requires Docker and postgres:17-alpine).
No ports, host mounts, real credentials or production connections are used.
"""
import json
from pathlib import Path
import subprocess
import time


def run(*args, input=None):
    return subprocess.check_output(args, input=input, text=True, stderr=subprocess.STDOUT)


def main():
    container = run('docker','run','--rm','-d','--network','none',
                    '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine').strip()
    try:
        for _ in range(60):
            try:
                run('docker','exec',container,'pg_isready','-U','postgres')
                break
            except subprocess.CalledProcessError:
                time.sleep(.5)
        else:
            raise RuntimeError('Synthetic PostgreSQL did not become ready')
        fixture = '''
CREATE TABLE bookings (
 id text PRIMARY KEY, "customerId" text, "providerId" text,
 "serviceAddress" jsonb, "requestedAt" timestamp, "scheduledEndIso" timestamp,
 "completedAt" timestamp, status text, "recurringPlanId" text, "recurringOccurrenceIndex" int
);
CREATE TABLE "ProductAnalyticsEvent" (
 id text PRIMARY KEY, name text, "actorId" text, "occurredAt" timestamp,
 "receivedAt" timestamp, environment text, source text, properties jsonb
);
CREATE TABLE booking_financial_settlements (
 id text PRIMARY KEY, "bookingId" text UNIQUE, currency text, status text,
 "policyVersion" text, "isFirstCompletedCustomerProviderJob" boolean,
 "platformNetRevenueCents" int, "actualProcessorFeeCents" int
);
INSERT INTO bookings SELECT 'synthetic-'||n, 'customer-'||n,'provider',
 '{"postalCode":"00000"}', '2026-09-01 12:00', '2026-09-02 12:00',
 CASE WHEN n=1 THEN timestamp '2026-09-02 12:00' END,
 CASE WHEN n=1 THEN 'completed' ELSE 'requested' END,
 CASE WHEN n=4 THEN 'plan' END, CASE WHEN n=4 THEN 2 END
FROM generate_series(1,4) n;
INSERT INTO "ProductAnalyticsEvent" VALUES
 ('e1','booking_requested',NULL,'2026-09-01 12:00','2026-09-01 12:00','synthetic','server','{"bookingId":"synthetic-1"}'),
 ('e2','booking_requested',NULL,'2026-09-01 12:00','2026-09-01 12:00','synthetic','server','{"bookingId":"synthetic-2"}'),
 ('e3','booking_requested',NULL,'2026-09-01 12:00','2026-09-01 12:00','synthetic','server','{"bookingId":"synthetic-2"}'),
 ('e4','booking_confirmed',NULL,'2026-09-01 13:00','2026-09-01 13:00','synthetic','server','{"bookingId":"synthetic-1"}'),
 ('e5','booking_confirmed',NULL,'2026-09-01 16:00','2026-09-01 16:00','synthetic','server','{"bookingId":"synthetic-2"}'),
 ('e6','booking_requested',NULL,'2026-09-01 12:00','2026-09-01 12:00','synthetic','client','{"bookingId":"synthetic-3","origin":"client"}'),
 ('e7','booking_requested',NULL,'2026-09-01 12:00','2026-09-01 12:00','synthetic','server','{"bookingId":"missing-synthetic"}');
'''
        run('docker','exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1',input=fixture)
        query = Path(__file__).with_name('reconcile.sql').read_text()
        params = dict(start_utc='2026-09-01T00:00:00Z', end_utc='2026-09-08T00:00:00Z',
                      as_of_utc='2026-10-05T00:00:00Z',environment='synthetic',
                      market_zips_json='["00000"]',excluded_ids_json='[]')
        def execute(overrides=None):
            args = ['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
            for k,v in (params | (overrides or {})).items(): args.extend(['-v',f'{k}={v}'])
            return json.loads(run(*args,input=query))
        result = execute()
        for key,expected in dict(requested_jobs=4,request_event_expected_jobs=3,
            generated_recurring_jobs=1,missing_request_events=1,duplicate_request_jobs=1,
            missing_completion_events=1,orphan_events_global=1,completed_jobs_missing_settlement=1,
            immature_scheduled_jobs=0,repeat_immature_customers=0).items():
            assert result[key] == expected, (key,result[key],expected)
        assert result['confirmation_proxy'] == dict(n=2,p50_hours=1,p90_hours=4,max_hours=4)
        assert result['completion']['numerator'] == 1 and result['completion']['denominator'] == 4
        assert result['repeat_30d_market'] == dict(numerator=0,denominator=1)
        assert execute({'market_zips_json':'[]'})['requested_jobs'] == 0
        assert execute({'excluded_ids_json':'["provider"]'})['requested_jobs'] == 0
        assert execute({'environment':'other'})['missing_request_events'] == 3
        assert execute({'end_utc':'2026-09-01T12:00:00Z'})['requested_jobs'] == 0
        print('PASS: PostgreSQL synthetic reconciliation, latency, completion, repeat maturity, empty market, account exclusions, environment isolation and half-open boundary')
    finally:
        run('docker','stop',container)

if __name__ == '__main__': main()
