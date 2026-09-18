# Engineer Checkpoint: Provider Finder-Fee Retention Promise

## Current checkpoint: cross-task main consolidation

- Updated: September 18, 2026.
- Branch: `codex/consolidate-main-2026-09-18`; verified implementation commit: `b02c12a` (this checkpoint follows in a documentation commit).
- Completed: reconciled every local/remote feature branch and the shared working tree; preserved SEO PR #2 and cloud hardening PR #1 history; included the implemented compact header/footer/heading/card UX slice; kept newer audit fixes and payout contracts; enforced crew credentials in automatic matching and public claims; fixed the passing API smoke process hanging CI.
- In progress: main integration through [PR #3](https://github.com/pkopps/ym/pull/3). Its checks are the authoritative final CI/merge record.
- Remaining work: unfinished UX roadmap items; production domain and Search Console; real vendor acceptance; confirm CodeRabbit GitHub app activation and an actual review.
- Blockers: no code consolidation blocker. No CodeRabbit review has appeared, and no CodeRabbit tool/CLI is available in this session.
- Changed workflows: automatic crew acceptance requires current credential readiness; otherwise matches and notifications require review. Smoke runs start Node directly and await server shutdown; CI verifies both successful and failed startup release their ports.
- Validation: lint, typecheck, 3,748 locale keys, API build, web production build, 291 API tests (3 database-only skips), all 26 browser tests, four targeted crew coverage regressions, and two smoke lifecycle tests passed. Eight route/viewport checks returned 200 without horizontal page overflow at 1440x900 and 390x844. Desktop homepage and mobile service screenshots were visually inspected. The consolidated PR's Postgres migration/drift/integration job also passed before this documentation commit; final full CI is linked above.
- Known defects: broader UX work remains as documented in its task; mobile compact navigation intentionally scrolls horizontally. The first local browser attempt hit a stale Next dev process; restarting it produced a clean full pass. A screenshot probe initially used nonexistent `/listings`; the corrected `/customer/listings` route passed.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/consolidation/{home,services-lawn-mowing,es-barnegat-nj-lawn-mowing,customer-listings}-{1440,390}.png`; readable viewport captures: `viewport-1440.png`, `viewport-390.png`.
- Recommended next task: activate/verify CodeRabbit on a main-bound PR and continue the prioritized UX backlog after choosing the production domain.

### Consolidation accounting

- SEO: `6b9f0f3`, merged through `6910d37`.
- Shared UX and SEO working-tree checkpoint: `d0256aa`; pre-consolidation backup is at `/private/tmp/yardmatch-main-consolidation-backup-20260918/`.
- Older cloud branch: `146efb5`, reconciled through `5b0d98e`; retain the new credential gates and adapt old test fixtures to current booking protections. Historical cloud status text does not overwrite newer checkpoints.
- API smoke teardown and credential regression reconciliation: `b02c12a`.
- Account security, launch hardening, property photos, honest Barnegat, skeleton loading, retention, and the 15-issue audit were already ancestors of main `7fbfe02`.
- “Share iOS app before launch” contained guidance only. The unfinished UX plan and launch/vendor setup are backlog, not missing commits.

## Historical checkpoints (preserved)

## Current checkpoint: 15-issue audit repairs

- Updated: September 9, 2026.
- Branch: `main`; baseline commit: `159219b663a2ac6199195f832dd364e8455a2f94`.
- State: implemented and verified locally; uncommitted. Existing retention work is preserved.
- Completed: all 15 audited recovery, OAuth, booking, recurring, calendar, and checkout/refund issues; durable security state and checkout metadata migration; web/mobile quote propagation; regression coverage; stale database seed fixture correction.
- In progress: none for the 15 repairs.
- Remaining work: deploy the additive migration with the API release, verify real vendor configuration in staging, and separately resolve historical clean-install migration ordering.
- Blockers / known defects: pristine database migration replay fails because the crew-staffing migration precedes init. Existing history was preserved; initialized-baseline migration deployment and schema comparison passed. No unresolved failure remains in the 15 repair regressions.
- Changed workflows: recovery codes are private with resend/guess limits; OAuth needs browser-bound one-time state; bookings validate server quotes, eligibility and time windows; recurring creation is atomic; calendar imports preserve all feeds and expand dates safely; checkout retries preserve attempts and refunds remain terminal.
- Validation: API 289 passed, 3 database tests skipped in default suite and all 3 passed separately; audit regressions 24 passed; web smoke 19 passed; API smoke, lint, typecheck, Prisma generate, initialized-baseline migrations, schema diff and two seed runs passed; customer-mobile Expo export passed for iOS/Android/web. No native simulator or live vendor/production tests ran.
- Screenshots: `reports/agent-checkpoints/engineer/latest/customer-booking-requested-desktop.png` (1440×900), `customer-booking-requested-mobile.png` (390×844), and the matching listings screenshots. Requested desktop/mobile screens were visually inspected.
- Recommended next task: resolve the historical migration bootstrap order with a reviewed baseline procedure, then run staged vendor acceptance before release.

[Repair mapping, evidence and operational notes](/Users/patrickkopps/Documents/app/reports/code-audit/2026-09-09/completion.md).

Agent-reported completion is checkpoint evidence, not independent verification by Patrick or the Project Manager.

## Prior retention checkpoint (preserved)

## Branch And Commit

- Branch: `main`
- Baseline commit: `159219b`
- State: implemented and locally verified in the working tree; changes are not committed.

## Completed Work

- Added clear provider marketing that the $30 finder fee is charged once and includes YardMatch's ongoing review, book-again, recurring-service, and qualified prior-provider preference work.
- Preserved the published $6.99 completed-job fee disclosure so “no additional retention cost” cannot be mistaken for fee-free future jobs.
- Added provider web/mobile retention summaries with acquired, active, returned, awaiting, and paused relationships.
- Enforced server-side continuity eligibility from settlements, reviews, disputes, refunds, support cases, and field exceptions.
- Prevented stale or fabricated client loyalty context from changing recommendation ranking.
- Preserved fresh recommendation ranking and curated alternatives.
- Updated customer retention behavior, contracts, tests, locales, README, and roadmap.

## In-Progress Work

- No implementation remains for this milestone.

## Remaining Work

- Add approved outbound book-again cadence beyond current review invites and in-product prompts.
- Add an ops recovery path for restoring a paused relationship after documented service recovery.
- Validate with staging Postgres, Stripe settlements, and real notification delivery.

## Blockers

- `TEST_DATABASE_URL` was unavailable, so two Postgres-only tests were skipped.
- Live Stripe and notification credentials are not present locally.

## Changed Workflows

- First paid completion -> one-time finder fee -> automatic retention eligibility.
- Repeat search -> server good-standing check -> soft prior-provider preference or fresh recommendation.
- Provider web/mobile -> relationship-level retention status and fee-policy explanation.
- Public provider page -> included retention work and exact guardrails before signup.

## Validation Results

- Typecheck passed.
- ESLint passed with zero warnings.
- Locale validation passed for 3,659 English, Spanish, and pseudo-locale keys.
- Targeted retention tests: 10/10 passed.
- API tests: 265 passed, 2 Postgres-only tests skipped.
- Web smoke: 19/19 passed.
- Provider mobile Expo export passed for web, iOS, and Android.
- Browser acceptance passed at 1440x900 and 390x844; a discovered mobile overflow was fixed and reverified.

## Known Defects

- Seeded local provider summaries start at zero because no paid customer relationship settlement exists yet.
- Book-again prompts are in-product; broader outbound retention notifications remain future work.
- Paused relationships do not yet have an ops-authored recovery action.

## Screenshot Paths

- `provider-retention-marketing-desktop.png`
- `provider-retention-marketing-mobile.png`
- `provider-retention-operations-mobile.png`

## Recommended Next Task

Build the audited ops recovery workflow for paused retention relationships.
