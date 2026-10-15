# Split `MarketplacePlatformService`

Status: planned, not started. Run in Claude Code, one chunk per PR, with tests green before and after each chunk.

## Why

`apps/api/src/services/MarketplacePlatformService.ts` is ~24,400 lines with 576 methods (185 public), and `apps/api/test/marketplace-platform.test.ts` is ~15,800 lines. Domain logic for auth, bookings, payments, crew, support, reviews, notifications and calendars sits in one class, with methods for each domain scattered across the file (calendar methods span lines ~16k–23k, auth ~600–23k). That makes changes risky for people and for agents, which can't hold the file in context.

## Approach: facade first, behavior unchanged

The repo already has the target pattern: `ProviderPricingService`, `ServiceComplaintService`, `CustomerReferralService` and `PartialRefundService` are small classes taking `MarketplaceRepository` (plus what they need) in the constructor.

For each chunk:

1. Create `apps/api/src/services/<Domain>Service.ts` (or a folder if it grows past ~1,500 lines).
2. Move the domain's public methods and the private helpers **only** they use. Helpers used by several domains move to a shared module (`services/platform/` helpers) instead of being duplicated.
3. Keep every existing public method on `MarketplacePlatformService` as a one-line delegate. Controllers, routes and tests don't change in the same PR.
4. Construct the new service inside `MarketplacePlatformService`'s constructor with the same dependencies, so wiring and test setup stay the same.
5. Move that domain's tests out of `marketplace-platform.test.ts` into `<domain>.test.ts` in a follow-up commit in the same PR, without changing assertions.

Pure moves only: no renames, no logic fixes, no new features. Note anything worth fixing in the PR description instead.

Once every domain is out, a final PR points controllers at the domain services directly and deletes the delegates.

## Order (lowest coupling and risk first)

| # | Chunk | Approx. public methods | Notes |
|---|---|---|---|
| 1 | Provider calendar feeds and imports | ~9 | Self-contained; uses `calendarParser` and the feed loader. Good first run to prove the pattern. |
| 2 | Launch operations tasks | ~5 | Ops-only, few dependencies. |
| 3 | Reviews and review responses, review invites | ~10 | Inbound GBP/shared-inbox responders included. |
| 4 | Launch leads and inbound lead intake | ~6 | Keep `CustomerReferralService` separate; it already exists. |
| 5 | Notifications, preferences, push devices, notification ops health | ~10 | `NotificationDeliveryService` already exists; this moves orchestration around it. |
| 6 | Auth security: 2FA, trusted devices, sessions, password reset, auth identity lock state | ~25–29 | Security-sensitive. Run auth controller and authorization tests plus a manual login, 2FA and reset pass. |
| 7 | Ops accounts and access governance | ~7 | Depends on chunk 6 helpers. |
| 8 | Crew: preferences, matches, opportunities, conversations, payout ledger reads | ~11 | Keep the rule that YardMatch never creates a crew transfer. |
| 9 | Support tickets, disputes, interventions, financial exception summary | ~11 | Evidence-before-resolution guards must stay intact. |
| 10 | Payments, refunds, payouts, Stripe webhooks, settlement | ~14 | Highest risk. Requires `test:api`, the bank-payments and economics tests, and the Postgres integration tests. |
| 11 | Booking lifecycle, scheduling, routes, quotes, recurring plans, plus provider profiles, properties and search | ~70 | The core. Probably 3–4 PRs (e.g. provider profiles and search, properties, booking lifecycle, routes). Do last, once shared helpers have settled. |
| 12 | Point controllers at domain services, remove delegates | — | Mechanical. |

## Verification per chunk

Run from the repo root:

- `npm run typecheck`
- `npm run lint`
- `npm run test:api`
- `npm run test:api:smoke`
- Chunks 6, 9, 10 and 11 also run `npm run test:api:postgres` (needs `DATABASE_URL`) and `npm run test:smoke`.

Before opening each PR, also check:

- Test count is unchanged between before and after (a moved test must still run).
- `git diff --stat` shows the main service shrinking by roughly the size of the new file. A big net increase means code was duplicated, not moved.

## Prompt for Claude Code

> Do chunk N of `docs/refactor/marketplace-platform-service-split.md`. Pure move with delegates, no behavior changes. Run the listed checks before and after, report test counts, and open a PR.
