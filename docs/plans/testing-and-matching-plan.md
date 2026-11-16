# Testing strategy and matching scale plan (Nov 2026)

**Status, Nov 16:** scale work is merged to main (PRs #29–#45, #47, #48). The bot army is being built in three PRs (harness and invariant checker, network simulation, explorer agents). Detailed scale numbers live in `reports/scale-review/2026-11-14-crew-hot-path.md`.

## Scale work: where it ended

**Small dataset** (600 providers, 20,500 bookings, 12 operations at once), p95 in ms, local:

| Operation | Before | After step 4 |
|---|---:|---:|
| crew-matches | 30,021 | 252 |
| gps-ping | 14,997 | 276 |
| search | 14,053 | 454 |
| arrival-tracking | 8,368 | 135 |
| crew-opportunities | 3,849 | 151 |

**Large dataset** (2,000 providers, 500 crew, 200,000 bookings, 12 operations at once): before the fixes the run did not finish (stopped at 40 minutes and 4–6 GB of memory). After: zero errors, 66–68 seconds, about 360 MB. Slowest operations at p95: recurring writes about 2.0–2.2 s, search 1.3 s, provider calendar 1.0 s; GPS ping 404 ms, arrival tracking 237 ms.

**Whole-table loads in `MarketplacePlatformService.ts`:** `listBookings()` 27 → 0, `listCrewMatches()` 21 → 0, `listProviders()` 13 → 5 (all five on ops screens).

**Also done:** location columns with an index for provider search, per-provider crew lock instead of one global lock, crew reconciliation moved off the crew schedule read.

**Known limits**

- At 300 operations in flight on 20 database connections the run completes, but p95 is 5–72 s, mostly time queued for a connection, and the analytics report calls failed. The connection pool and single API process are the ceiling, not the queries.
- Recurring writes issue 100–120 database statements each; about 2 s under mixed load.
- Five ops screens still load every provider; two load every payment.
- All numbers are from one laptop. Staging is still one API instance and a database on Render's free plan.

**Verdict:** enough to start bot testing and for a one-metro launch. Not yet proven for hundreds of simultaneous users on one instance.

## Bot testing: three parts

All against local or staging only, never production. Guardrails already in the repo: `@example.invalid` emails, the staging notification allowlist, Stripe test mode, and the loopback-only database check shared by the load script and the bots (`scripts/lib/local-database-guard.mts`).

### 1. Scripted bot army and invariant checker (finds bugs)

`npm run bots` (see `LOCAL_DEVELOPMENT.md`). API bots act as a property owner, a provider or a crew member by calling the HTTP API. Hundreds can run at once. They sign up, search, book, accept, staff, go on route, send GPS pings, complete, cancel and reschedule with randomized timing.

After each run `scripts/bots/check-invariants.mts` reads the database and fails if any of these is false:

- No availability slot is booked twice; no provider has overlapping jobs
- At most one finder fee per owner–provider pair, at the right tier ($75 / $110 / $150), with the first relationship waived
- No fee on a cancelled, disputed or never-completed first job
- A recurring plan charges the finder fee once, not per visit
- No job has more accepted crew than it needs; no crew member is on two jobs at once
- Live location is readable only by that booking's owner, provider and assigned crew
- Every state change produced exactly one notification per affected party

### 2. Network simulation (measures matching efficiency)

A seeded synthetic market, default shaped like Barnegat, NJ, with supply and demand density as inputs. Bots run a simulated season and the run reports:

| Measure | What it shows |
|---|---|
| Search fill rate | Share of owner searches that return at least one bookable provider |
| Dead zones | Addresses or ZIPs with no match, on a map |
| Time to acceptance | From booking request to provider accept |
| Provider utilization | Booked hours over published hours, and how evenly work spreads across providers |
| Travel per job | Miles from provider to property; route density per day |
| Crew fill rate and time | Share of jobs that reach required crew, and how long it takes |
| Recovery rate | Share of declined or no-show jobs that get a replacement |

Run it at several densities (for example 5, 15 and 40 providers) to find the supply level where fill rate holds. This tests the matching rules on invented supply and demand; it does not predict the real market.

### 3. Explorer agents (collect feedback and gaps)

Scripted bots can only check what they were told to check. For feedback, a model drives the real web UI in a browser as a persona with a goal and no instructions, then reports what got in its way.

- Personas: first-time owner, owner with two properties, new provider onboarding, provider on a busy day, crew member, someone who forgot their password
- Each run records: steps taken, dead ends, unclear labels or errors, missing confirmations or emails, places it had to guess, screens that disagree between roles, and screenshots
- Output: one findings file per run, each finding tagged bug, gap or friction, with severity and steps to repeat
- Run locally: password reset and 2FA codes are only previewable in local mode; on staging, email goes only to allowlisted addresses

### Scenario matrix (for parts 1 and 3)

| Area | Cases to cover |
|---|---|
| Sign-up and login | Each role; duplicate email; lockout after failed passwords; reset (request, expired link, reused link, wrong email, old sessions ended); 2FA; Google/Apple; expired session |
| Find provider | Inside radius; exactly at the radius edge; nobody nearby; unverified provider; expired insurance; no open slots; category mismatch; ZIP minimum |
| Accept new property and fee | Each size tier; first relationship waived; second owner charged; repeat owner not charged again; same owner adds a second property; card declined; dispute inside the window; provider declines |
| One-time vs recurring | Plan generates visits on cadence; skip one visit; reschedule one visit vs the plan; cancel plan mid-season; price held across visits |
| Races | Two owners take the same slot; two crew claim the last opening; double-tap submit; provider accepts while owner cancels |
| Crew tracking on map | Ping appears for the owner; ETA updates; hidden before "on route" and after completion; wrong actor denied; stale ping; GPS permission denied |
| Launch flags | Crew marketplace and YardMatch payouts stay unreachable with flags off |

### Build order

1. Bot harness (three personas over HTTP) and the invariant checker
2. Network simulation and its report
3. Explorer agent runner, persona briefs and findings format; first pass over all personas
4. Triage findings into issues; fix; rerun
5. Nightly scripted run against staging; three-role Playwright journey in CI
6. Two or three Maestro smoke flows for the provider app

## Open decisions

- Whether to pay for a non-free Render plan so staging can take a bot run
- Whether to raise the connection pool or add a second API instance before launch
- PRs #19 and #20 (API durability, error messages and alerting) are still open
