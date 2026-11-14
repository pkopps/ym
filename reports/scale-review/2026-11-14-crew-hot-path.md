# Crew and GPS hot-path scale numbers

Local runs of `npm run test:scale` on one laptop (PostgreSQL 16 on loopback, Node 22, 12 concurrent operations, 8 database connections). Dataset: 601 providers, 20,500 bookings, 200 crew members, 20,500 crew matches, 10,000 analytics events, 250 queued notifications. Numbers are for comparing before and after on the same machine. They are not a service-level promise.

## Baseline (before step 1), November 14, 2026

`SCALE_CREW_WORKLOAD=1`, 360 operations, 40 per kind. Zero errors. Elapsed 237 s.

| Operation | p95 ms | p99 ms |
| --- | ---: | ---: |
| crew-matches (`getCrewMatchesForCrew`) | 30,021 | 32,513 |
| gps-ping (`updateBookingRouteLocation`) | 14,997 | 15,938 |
| search | 14,053 | 16,046 |
| analytics | 9,444 | 11,186 |
| arrival-tracking (`getBookingArrivalTracking`) | 8,368 | 8,739 |
| clients | 6,515 | 6,730 |
| route-write | 4,532 | 4,691 |
| password | 4,180 | 5,024 |
| crew-opportunities (`listCrewOpportunities`) | 3,849 | 6,410 |

Query p95 438 ms, p99 1,772 ms across 4,836 queries. Event-loop p99 2,751 ms. RSS 1,148 MB.

The crew operations slow everything else down: with the crew workload off, the same dataset gives search p95 1,112 ms, clients 1,318 ms, analytics 1,697 ms, event-loop p99 15 ms, RSS 217 MB.

The event-loop stall comes from `buildCrewDayLoadMap`, which looks up a booking for every match by scanning the full booking list (20,500 x 20,500) inside `reconcileCrewMatches`, on every `getCrewMatchesForCrew` read.

## After step 1 (scoped hot-path queries), November 14, 2026

Same machine and dataset, 360 operations. Zero errors. Elapsed 8.6 s (was 237 s). The crew workload is now part of the default run.

| Operation | p95 ms before | p95 ms after |
| --- | ---: | ---: |
| crew-matches | 30,021 | 1,714 |
| gps-ping | 14,997 | 489 |
| search | 14,053 | 765 |
| analytics | 9,444 | 817 |
| arrival-tracking | 8,368 | 348 |
| clients | 6,515 | 968 |
| route-write | 4,532 | 54 |
| password | 4,180 | 88 |
| crew-opportunities | 3,849 | 213 |

Query p95 22 ms, p99 498 ms across 4,492 queries. Event-loop p99 30 ms. RSS 269 MB.

`crew-matches` is still the slowest operation: every read takes the global `crew-staffing` lock and checks whether any upcoming booking needs crew. In this dataset none does, so the check is three scoped queries. When a booking does need crew, reconciliation still loads providers, crew, bookings, matches and customers in full.

## After step 2 (location columns and index), November 14, 2026

Provider search filters on `user_accounts.latitude` and `longitude` with an index on `(role, latitude, longitude)` instead of casting the address JSON for every row. One run: search p95 435 ms (765 ms in the step 1 run), query p99 78 ms (was 498 ms). Run-to-run noise on this machine is large (crew-matches p95 was 222 ms in this run and 1,714 ms in the step 1 run with no crew change), and with 601 providers the table is small enough that the planner may not need the index, so treat the search change as directional.

## After step 3 (per-provider crew lock), November 14, 2026

The scale dataset has no booking short of crew, so a crew schedule read now takes no staffing lock at all (before: the global `crew-staffing` lock on every read). One run: crew-matches p95 311 ms, gps-ping 390 ms, search 564 ms, clients 1,092 ms, query p99 94 ms, zero errors. The difference from the step 2 run is within run-to-run noise; what this step changes is contention between providers when bookings do need crew, which this dataset does not exercise. `crew-hot-path.integration.test.ts` covers that case directly: staffing provider B completes while provider A's lock is held.
