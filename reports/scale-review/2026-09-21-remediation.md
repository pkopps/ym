# YardMatch scale remediation

Implemented September 21, 2026, on local `main`, following [the six findings in the scaling review](2026-09-20.md). Source baseline: `fad23d6`. This report records the remediation commit that contains it; use `git log -1 -- reports/scale-review/2026-09-21-remediation.md` to resolve that commit.

## Changes

1. **Durable notification workers.** Ordinary notification requests commit the in-app notice and queued delivery intents together. Atomic PostgreSQL claims use `FOR UPDATE SKIP LOCKED`, expiring leases, attempt limits, and token-fenced acknowledgements. Overlapping instances claim distinct work; abandoned queued jobs recover. Per-process sweeps cap vendor concurrency at five. Resend receives stable idempotency keys. Read requests no longer dispatch external notifications. Concurrent departure/staffing reminders reuse a deterministic notice ID, and ops health uses aggregate counts plus eight recent failures.
2. **Scoped search and profile queries.** Search selects verified providers by category and conservative geographic bounds in pages of 100, aggregates only candidate booking statistics, and fetches bounded eligible availability in batches. Ranking keeps the recommendation and two curated alternatives. Provider profiles use aggregate history. Calendar conflict checks and provider reminder polling use owner-scoped booking queries and batch related lookups.
3. **Responsive authentication.** Password hashing/verification use asynchronous scrypt, with four active derivations and a bounded 128-request waiting queue. Overload returns 503 instead of retaining unlimited work. Existing password hashes and credentials remain valid; local fixture hashes are precomputed.
4. **Short calendar transactions.** Calendar download and parsing happen before the database lock. The locked write re-reads current provider state, checks a synchronization revision, revalidates booking conflicts, and rejects stale or deleted subscriptions. Vendor delays no longer occupy a transaction connection throughout a feed download.
5. **Client map summaries and bounded rendering.** PostgreSQL returns one row per booked property with visit counts, current name, recurring status, and upcoming visits. Historical visits never cross the repository boundary. Address/unit normalization preserves separate homes. The list renders 50 properties per page; large maps cluster within the visible area, with paginated choices for shared coordinates. Search still reaches historical clients. Desktop and mobile screenshots were visually checked.
6. **Analytics throughput and completeness.** Export workers claim distinct batches, recover expired claims, and retain stable event identities across retries. Reports aggregate the entire selected period, including ordered identity-linked funnels, without the former 50,000-event cap. Collection acknowledgements wait for persistence without waiting indefinitely for later arrivals. Bounded writes, retry delay, report timeout/cache, retention batches, and backlog-age/exhaustion warnings protect capacity. Raw Date parameters and analytics defaults explicitly use UTC.

## Measured local capacity

The checked-in `npm run test:scale` gate runs 200 mixed operations at concurrency 12 and an eight-connection database limit, while draining notifications. Its fixture has 601 providers (including geographically distant providers), 20,000 bookings, 1,000 properties for one provider, 10,000 analytics events, and 250 deliveries. It uses disposable local PostgreSQL and stubbed vendors.

An initial run after the first query changes still took **18.8 seconds**: client overview indirectly called a profile method that loaded all marketplace bookings. A CPU profile identified database result parsing and booking hydration as the dominant active work. Replacing that hidden read produced a 1.7-second run. The final repeat after the acknowledgement fix produced the following result on the same local fixture (other verification also ran locally):

| Measurement | Result |
| --- | ---: |
| Mixed workload elapsed | 2,247 ms |
| Search p95 / p99 | 249 / 304 ms |
| Client summary p95 / p99 | 401 / 572 ms |
| Password verification p95 / p99 | 114 / 161 ms |
| Route-write p95 / p99 | 31 / 48 ms |
| Analytics p95 / p99 | 447 / 467 ms |
| Event-loop p99 | 32 ms |
| Query p95 / p99 | 7 / 269 ms |
| Errors / notifications delivered | 0 / 250 |
| Heap growth / process RSS | 65 / 599 MB |

These are local regression measurements, not a supported production user count. RSS includes fixture setup and the local Node/Prisma runtime; this was not a long-running leak or production-memory study. The gate is part of PostgreSQL CI and archives its output.

## Verification

Verification results and final source review are recorded in the engineer checkpoint. Local logs and screenshots are under `reports/agent-checkpoints/engineer/latest/scale-remediation/` and `scale-clients-{desktop,mobile}.png`.

- Prisma client generation, lint, monorepo typecheck, mobile release configuration, and API suite: 347 passed; 11 PostgreSQL-only tests skipped here and passed separately.
- PostgreSQL suite: 11 tests, including cross-instance financial/recovery protection, notification lease recovery and rollback, analytics multi-worker delivery of 1,201 events, summary parity over 2,002 bookings, and complete reporting over 50,015 events.
- API smoke and all 40 browser tests, including the 5,000-property map at 1440×900 and 390×844.
- Production web build, translation validation, CI log-failure propagation test, fresh database migration/bootstrap of all 41 migrations, upgrade migration/schema-diff check, and seed validation.
- Final mixed-workload gate after the collection acknowledgement fix is archived alongside the representative result above.

## Rollout and remaining production validation

Follow [the local/deployment guidance](../../LOCAL_DEVELOPMENT.md#scale-reliability-and-capacity-checks). Drain old API instances before starting new claim-aware workers; index creation can block writes and needs a maintenance window on populated databases. Both new migrations must be applied before the updated API runs.

Production topology, pool/lock wait under real traffic, sustained memory use, vendor quotas, and outage recovery must still be measured on staging before setting a supported user count. Client payloads now grow with distinct properties and upcoming visits rather than all historical visits; extremely large single-provider businesses may eventually need viewport queries. Broad, infrequent ops reports still deserve workload-specific profiling as data grows. The tested hot paths are materially improved; this is not a claim of unlimited scale.

A lease prevents overlapping active claims but cannot prove exactly-once vendor delivery after a crash between a successful external send and its database acknowledgement. Email uses vendor idempotency; SMS/push retain this residual boundary. No live notification/payment vendor calls, production load test, remote push, deployment, native simulator run, or fresh mobile export were performed. Unrelated investor artifacts remain preserved in the working tree.
