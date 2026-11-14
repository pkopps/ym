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

## Final, after step 4 (recurring plans and per-booking crew match loads), November 14, 2026

Three runs on the same machine and dataset; the table shows the median p95 of the three (range in brackets). All runs: zero errors, 250 notifications delivered.

| Operation | Baseline p95 ms | Final p95 ms |
| --- | ---: | ---: |
| crew-matches | 30,021 | 252 (184 to 898) |
| gps-ping | 14,997 | 276 (214 to 405) |
| search | 14,053 | 454 (352 to 659) |
| analytics | 9,444 | 654 (475 to 1,115) |
| arrival-tracking | 8,368 | 135 (121 to 172) |
| clients | 6,515 | 843 (709 to 934) |
| route-write | 4,532 | 61 (51 to 66) |
| password | 4,180 | 76 (76 to 102) |
| crew-opportunities | 3,849 | 151 (124 to 156) |

| Measure | Baseline | Final (median) |
| --- | ---: | ---: |
| Run time | 237 s | 6.7 s |
| Event-loop p99 | 2,751 ms | 31 ms |
| Query p99 | 1,772 ms | 71 ms |
| RSS | 1,148 MB | 264 MB |

The scale smoke does not exercise recurring plans, rescheduling, or a booking that is short of crew, so step 4 and the slow path of reconciliation are covered by the parity tests, not by these numbers.

### Whole-table loads still in `MarketplacePlatformService`

After step 4: `listBookings()` 22 call sites (was 27), `listCrewMatches()` 6 (was 18 at the start of step 4), `listProviders()` 11 (was 12).

- Crew staffing when a booking needs crew: `reconcileCrewMatchesRecord`, `reviewCrewMatchRecord` (accept), `claimPublicCrewOpportunityRecord`, `buildProviderStaffingSummaries`. Crew eligibility looks at every accepted job a crew member has across providers, so these need a query for the candidate crew members' matches and those bookings.
- Provider screens: `getProviderCalendarOverview`, `getProviderPayoutLedger`, `getCrewPayoutLedger`, `listProviderAssistantCandidates`, `buildProviderRetentionProgramSummary`, `bookingRecoveryOptionsRecord`, `getEvidencePhoto`.
- Public: `getPublicMarketplaceOverview`, `buildCalendarFeedByToken` (finds the provider by scanning every provider's calendar token).
- Ops screens and sweeps: `listProviderVerificationQueue`, `reviewProviderVerification`, `processProviderOnboardingAutomation`, `listOpsSupportTickets`, `escalateStaleOpsSupportTickets`, `listOpsLaunchLeads`, `listCustomerRetentionOpportunities`, `getOpsPayoutPreview`, `getOpsFinancialExceptionSummary`, `getObservabilityOverview`, `processBookingScheduleFollowUps`.

## Reconciliation off the crew schedule read, November 14, 2026

`getCrewMatchesForCrew` no longer reconciles. Two runs: crew-matches p95 76 and 83 ms (median 252 ms before), run time 4.8 and 5.1 s, zero errors.

Reconciliation now runs after the writes that change staffing, so its cost when a booking needs crew matters. Timed on the same dataset with one unstaffed booking, five runs each:

| Reconcile one provider | Before | After |
| --- | ---: | ---: |
| Provider with about 50 bookings | 1,800 to 2,480 ms | 89 to 103 ms |
| Provider with 10,000 bookings | not measured | 1,011 to 1,080 ms |

Before, a pass loaded every booking and every crew match. It now loads the provider's own bookings plus any provider's bookings that have not ended (or ended in the last two days), and the matches on those. A provider's whole booking history is still loaded, because crew familiarity counts past jobs with that provider; that is the 10,000-booking row.

Whole-table loads left in `MarketplacePlatformService`: `listBookings()` 21, `listCrewMatches()` 5, `listProviders()` 11.

## Remaining whole-table loads and a 200,000-booking run, November 14, 2026

PRs #35 to #45 took the remaining whole-table loads off the provider, crew, customer and most ops paths, and added a larger dataset to the scale smoke.

### Whole-table loads in `MarketplacePlatformService`

| Load | At the start of this round | Now |
| --- | ---: | ---: |
| `listBookings()` | 22 | 0 |
| `listCrewMatches()` | 5 | 0 |
| `listPayments()` | 13 | 2 |
| `listProviders()` | 11 | 5 |

Still whole-table: every payment in the ops payout preview and the ops financial exception summary; every provider in the ops verification queue, the onboarding sweep, the payout preview, launch leads and the observability overview. All are ops screens.

### The larger run

`SCALE_LARGE=1 npm run test:scale`: 2,000 providers, 500 crew members, 200,000 past bookings plus 500 upcoming and 200 seeded plan visits, one crew match per booking, 20 database connections. Twenty kinds of operation: the nine from the default run, three recurring writes (start a weekly plan, complete a plan visit so the next is generated, reschedule a plan visit), and eight screens that used to load whole tables. The screens run 20 times each and the rest 100 times each, 1,360 operations in all.

There is no before column. On main before these PRs the run did not finish: an attempt with a 120-second connection-pool timeout crashed when operations could not get a connection, and an attempt with the timeout off was stopped 40 minutes in, with no recurring write completed and the process using 4 to 6 GB. A later run on main with #36 to #42 merged was stopped after 12 minutes at 10 GB; the ops payout preview was loading every completed booking and looking up a settlement for each.

Final code (main with #43 to #45 and the analytics query change), same laptop as above, three runs at 12 operations in flight (`SCALE_CONCURRENCY=12`). Median p95 of the three, range in brackets. All runs: zero errors, 66 to 68 seconds, event-loop p99 168 to 220 ms, RSS 347 to 374 MB, query p99 65 to 111 ms.

| Operation | p95 ms |
| --- | ---: |
| next-visit (complete a plan visit, generate the next) | 2,173 (2,126 to 2,176) |
| reschedule (plan visit) | 2,030 (2,028 to 2,035) |
| plan-create (quote and start a weekly plan) | 1,937 (1,903 to 1,969) |
| search | 1,325 (1,258 to 1,562) |
| provider-calendar | 999 (706 to 1,093) |
| clients | 982 (893 to 1,049) |
| public-overview | 809 (794 to 1,039) |
| staffing-overview | 761 (736 to 920) |
| analytics | 667 (526 to 1,142) |
| ops-payout-preview | 629 (618 to 745) |
| ops-verification-queue | 542 (495 to 649) |
| gps-ping | 404 (357 to 424) |
| crew-opportunities | 390 (348 to 415) |
| crew-matches | 339 (337 to 363) |
| crew-payouts | 292 (263 to 361) |
| provider-payouts | 277 (238 to 286) |
| calendar-feed | 252 (192 to 339) |
| arrival-tracking | 237 (180 to 264) |
| password | 149 (137 to 155) |
| route-write | 77 (73 to 79) |

At 300 operations in flight on the same 20 connections the run also completes (103 seconds, 628 MB, measured before the analytics query change), but its latencies, 5 to 72 seconds at p95, are mostly time queued for a connection, and all 100 analytics report calls failed to start a transaction in time. Those numbers describe an overloaded pool, not the operations.

### Found along the way

- **Analytics report.** Two `count(DISTINCT "providerId")` subqueries over bookings took about 2 seconds each on 200,000 rows because DISTINCT sorts the ids as text. Grouping returns the same counts in under 100 ms. The report's p95 went from 6,629 ms to 667 ms.
- **Recurring writes are the slowest operations**, about 2 seconds each on this dataset against 0.5 to 1 second on the default one. They no longer load whole tables; the cost is many small queries plus crew reconciliation after the write. Not profiled yet.
- **The analytics report drops its cache when it fails**, so under an overloaded pool every caller retries the expensive queries. Not changed.
- **The analytics events query** (a materialized CTE over the report window) is now the slowest single statement, 1.7 to 2.0 seconds on 10,000 events under load. It is cached for 15 seconds. Not changed.
- **The first version of the recurring workload shared one provider across the three writes of a turn**, so they queued on that provider's locks and reported 3 to 5 seconds. Each kind now writes to its own provider.
- **`listProviders` has no ORDER BY.** A query written to match "the order of `listProviders`" failed CI on main once the planner chose a different scan (#42). New provider queries state their own order.
