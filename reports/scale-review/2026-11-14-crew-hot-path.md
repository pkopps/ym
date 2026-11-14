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
