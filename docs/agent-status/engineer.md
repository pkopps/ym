# Engineer Status

## Current checkpoint: wallet, card, and optional bank checkout

- Updated: September 20, 2026 (America/New_York).
- Branch and baseline commit: `codex/analytics-launch-readiness` at `b141eda`; implementation is uncommitted. Existing provider-client and pitch-document work was preserved.
- Completed: wallet/card-first checkout guidance on customer web and native home/visits; optional US bank disclosure; returning-customer bank suggestion after a completed visit; English/Spanish copy; explicit per-payment consent and no autopay enrollment. Hosted Checkout uses dynamic payment methods and supports an optional dedicated Stripe payment-method configuration.
- Payment safety: unpaid completed Checkout and processing intents remain processing; duplicate checkout is blocked; delayed success captures and reconciles once; delayed failure permits a new attempt; terminal attempts cannot regress to processing. Customer status refreshes while the app is active and on return. Newer payment attempts take display precedence over late updates to older attempts. Processing payments do not produce financial settlement or transfers.
- Changed workflows: confirm visit → wallet/card-first guidance → hosted Checkout with bank option → paid or processing result; completed-visit customers get a gentle bank suggestion on their next checkout. Bank linking does not save authorization for future automatic charges. Pricing and fee rules are unchanged.
- In progress: none locally.
- Remaining work / external blockers: enable and validate cards/wallets/ACH in the platform Stripe Dashboard (or dedicated `pmc_...` configuration), configure asynchronous webhook subscriptions, and run Stripe test-mode bank and real-device wallet acceptance before live launch. No live Stripe charge, bank link, or Dashboard change was made. Autopay enrollment is deferred by Patrick's explicit choice.
- Validation: monorepo `npm run typecheck` passed; `npm run i18n:validate` passed 3,930 keys; scoped ESLint passed; full `npm run test:api` passed 327 tests with six PostgreSQL integration tests skipped because `TEST_DATABASE_URL` is absent. Seven targeted bank-payment regressions passed (the seventh financial-settlement regression was added after the full suite). Browser payment/booking regressions passed 3/3, including real authenticated booking setup and stubbed Stripe outcomes. Customer Expo export passed web, iOS, and Android. Payment-related source diff whitespace check passed.
- Browser evidence: reviewed at 1440×900 and 390×844; no mobile horizontal overflow. Payment method guide, processing/no-retry state, eventual status refresh, failed-payment retry, returning-customer wording, checkout redirect, and Spanish copy were checked. A misleading generic “Done” banner during processing was removed during visual review.
- Known limits: Stripe wallet/device eligibility and ACH activation have not been exercised against a configured Stripe account. Native app was exported, not run in a simulator. Bank payments may take several business days; existing visit scheduling and support/refund review remain in force, including settlement after cancellation. The app does not automatically postpone a visit for bank settlement. No known failing local checks in this slice; unrelated Next development smooth-scroll warnings remain.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/payment-methods-desktop.png`, `reports/agent-checkpoints/engineer/latest/payment-methods-mobile.png`, and `reports/agent-checkpoints/engineer/latest/payment-processing-mobile.png`.
- Setup instructions: `LOCAL_DEVELOPMENT.md`, “Customer payment methods”; `.env.example` documents `STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION`.
- Recommended next task: Stripe sandbox acceptance with eligible Apple/Google Pay devices, bank verification including microdeposits, delayed success/failure and webhook replay; then independently review the diff before deployment. CodeRabbit/merge review was not performed in this implementation task.

Agent-reported completion is checkpoint evidence only; it does not equal independent verification by Patrick or the Project Manager.



## Current checkpoint: weather, late arrivals, and schedule recovery

- Updated: September 19, 2026 (America/New_York).
- Branch and baseline commit: `codex/analytics-launch-readiness`, `f57ca5e`; this checkpoint accompanies the scheduling implementation commit. Existing `output/` and `tmp/` contents were preserved.
- Completed: provider-reported weather holds, same-service-day late ETAs, explicit next-update deadlines, immutable update IDs and retained timing history, customer acceptance/decline of provider proposals, stale-response protection, provider calendar locking, crew reconfirmation, route reset, and preserved pricing/recurrence. Added web/provider/customer mobile controls, native notification navigation, foreground customer timing refresh, and operations schedule-follow-up sweeps with atomic duplicate suppression. Existing provider assistant rescheduling uses the proposal flow. External delivery uses complete messages with visit links rather than truncated previews.
- In progress: none for this implementation checkpoint.
- Remaining work: deploy migration/API/web/mobile, verify real staging push/email/SMS and native taps, confirm live scheduler cadence and independent monitoring; consider route-wide weather batches and owned repeated escalation after an ignored alert.
- Blockers: no local implementation blocker. Production/staging credentials, deployment and physical-device acceptance were not part of this local verification.
- Changed workflows: timing issues take precedence over payment in the primary customer card; providers must confirm a visit before sending delay updates; provider proposals leave the schedule unchanged until the customer accepts; decline keeps the visit open; accepting returns crew to provider review; normal customer reschedule policy remains unchanged. Weather reports do not infer a forecast or guarantee arrival.
- Validation results: `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, locale validation (3,877 keys), `npm run test:api` (316 passed; six database-dependent tests skipped), PostgreSQL integration (all six passed separately), clean isolated migration deployment, seed, and no schema drift. All 32 web smoke tests passed on the isolated preview; the schedule browser regression passed again against the final API after the transaction/delivery refinements. Customer and provider Expo exports passed for iOS, Android, and web. Final desktop and mobile screenshots were visually inspected; responsive tests assert no horizontal overflow at 1440×900 and 390×844.
- Checks not run: real vendor delivery, physical-device/simulator acceptance, production deployment, and CodeRabbit review. The local browser and PostgreSQL checks initially hit sandbox process restrictions, then passed with approved local process access.
- Known limits: new scheduling date/window conversion is Eastern time for launch. Morning remains 7 a.m.–noon; afternoon/evening remain four hours. Proposed windows are not reservations and acceptance can fail if capacity changes. Automatic follow-ups require the existing scheduler to run; alerts do not prove human ops has responded. Mobile exports validate bundling rather than real device delivery.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/schedule-provider-weather-{desktop,mobile}.png`, `schedule-customer-proposal-{desktop,mobile}.png`, `schedule-customer-confirmed-{desktop,mobile}.png`.
- Validation logs: `reports/agent-checkpoints/engineer/latest/scheduling/`.
- Recommended next task: follow `docs/BOOKING_SCHEDULE_RECOVERY.md` to deploy to staging, deliver a real weather/late/proposal notice to each supported channel, tap the native notification, and record the first automatic overdue follow-up from the deployed scheduler.


## Current checkpoint: analytics and launch readiness

- Updated: September 19, 2026.
- Branch: `codex/analytics-launch-readiness`; verified implementation commit `b6df8b3`; CI dependency follow-up `6f1af1f`; all six remote CI jobs passed on `2514cf8`. This final checkpoint changes documentation only.
- Completed: validated PostgreSQL analytics with identity correlation, bounded queues, consent/privacy signals, retention and optional PostHog delivery; web/mobile navigation and authored actions; ops funnel/segments/actions/performance/supply/economics reports; compact booking/signup and contextual help; jobs-first provider/crew and queue-first ops sections; payout readiness; scheduler/health probe; mobile version/pause controls; audited privacy intake and non-destructive photo inventory; database restore tooling.
- Additional reliability fixes: historical crew migration predates init; fresh deployment now bootstraps init safely without changing applied migration history. CI and staging pipelines explicitly use Bash/pipefail because old `tee` pipelines reported success despite failed commands.
- In progress: none for this implementation batch. [PR #4](https://github.com/pkopps/ym/pull/4) is pushed; [all six CI jobs passed](https://github.com/pkopps/ym/actions/runs/35480194207) on `2514cf8`. The final documentation commit triggers the usual PR checks again. CodeRabbit has no review or check suite on the verified head; its activation remains open.
- Remaining work: real PostHog/service activation, independent missed-run monitor and delivered alert, policy-approved account/photo/vendor fulfillment, staging backup/deployment rollback, distributed mobile/device acceptance, production domain/Search Console, actual CodeRabbit review.
- Blockers: Stripe Projects account preflight could not confirm the authenticated account; existing credentials were preserved. No real PostHog project, external monitor, or production activation was performed. Legal/retention policy and vendor access remain required for irreversible data fulfillment.
- Changed workflows: quote proceeds directly to recommendation; signup keeps the match in a compact disclosure; Help receives selected service/area/timing; provider/crew settings and ops reports/admin use explicit sections; payout account setup is distinguished from earnings and an actual scheduled payout; users can choose optional analytics and submit privacy requests.
- Validation: 303 API tests passed (five database-only skips), all five Postgres integration tests passed separately, all 31 browser tests passed, including an actual consenting booking reaching the API funnel and identity rotation after account expiry, three smoke/CI-pipeline tests passed, lint/typecheck and 3,844 locale keys passed, API/web builds and customer/provider/crew iOS/Android/web exports passed. Synthetic restore verified 35 tables in approximately 3.6 seconds; restored database had no schema drift and passed financial/security/analytics tests. Photo-inventory integration preserves disputed evidence and deletes nothing.
- Evidence correction: reviewed the September 18 Postgres artifact from CI run `35386638892`; it contains failed migrations/tests despite its green status. The prior checkpoint's green-job claim is not valid database launch evidence. The corrected PostgreSQL artifact in [run 35480045314](https://github.com/pkopps/ym/actions/runs/35480045314) was downloaded and reviewed: migrations applied/current, no drift, five tests passed.
- Known limits: raw Prisma `migrate dev` shadow replay retains the historical ordering limitation; use the documented reviewed SQL diff/deploy workflow until a deployed-history rebaseline is planned. Server analytics writes can be lost before asynchronous flush during a process crash; client queues are intentionally bounded. Reports warn on low samples and the 50,000-event cap. Consent means observed journeys are a subset of traffic. Mobile version enforcement cannot identify older unmarked builds. Privacy intake does not claim completed erasure/export. Real vendor ingestion, alerts, payment acceptance, store builds and production rollback remain unverified.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/product-analytics-{desktop,mobile}.png`, `payout-empty-readiness-{desktop,mobile}.png`, `customer-booking-requested-{desktop,mobile}.png`, `customer-booking-spanish-mobile.png`, `ops-workspace-{desktop,mobile}.png`, provider/crew lifecycle captures. Desktop/mobile analytics and payout screenshots were visually inspected at 1440×900 and 390×844; no overflow in the automated checks.
- Validation logs: `reports/agent-checkpoints/engineer/latest/analytics-readiness/`.
- Recommended next task: complete the account/policy activation checklist in `docs/ANALYTICS_AND_OPERATIONS.md`, starting with actual CodeRabbit review and independent monitoring/PostHog verification.

## Historical checkpoints (preserved)

## Current checkpoint: cross-task main consolidation

- Updated: September 18, 2026.
- Branch: `codex/consolidate-main-2026-09-18`; verified implementation commit: `b02c12a` (this checkpoint follows in a documentation commit).
- Completed: reconciled every local/remote feature branch and the shared working tree; preserved SEO PR #2 and cloud hardening PR #1 history; included the implemented compact header/footer/heading/card UX slice; kept newer audit fixes and payout contracts; enforced crew credentials in automatic matching and public claims; fixed the passing API smoke process hanging CI.
- In progress: main integration through [PR #3](https://github.com/pkopps/ym/pull/3). Its checks are the authoritative final CI/merge record.
- Remaining work: unfinished UX roadmap items; production domain and Search Console; real vendor acceptance; confirm CodeRabbit GitHub app activation and an actual review.
- Blockers: no code consolidation blocker. No CodeRabbit review has appeared, and no CodeRabbit tool/CLI is available in this session.
- CI follow-up: the clean browser job exposed missing compiled workspace dependencies (`@yardmatch/analytics/dist`). Added the existing TypeScript project build before starting Playwright. All three mobile exports and the API/Postgres jobs passed on `9a8bb55`; final browser/combined status remains linked from PR #3.
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

## Current checkpoint: SEO and CodeRabbit setup

- Updated: September 14, 2026 (local).
- Branch and baseline commit: `main`, `7fbfe0279c9b041d250f1c2d943b5be72cc50b83`; uncommitted.
- Completed: stable English/Spanish URLs; distinct general and Barnegat service content/metadata; reciprocal sitemap language alternates without fabricated dates; pseudo noindex headers; organic landing attribution; optional Search Console token; CodeRabbit PR configuration and upkeep note; refreshed SEO/launch docs; mobile header overflow and logo lint fixes; scoped bilingual booking-test history selectors.
- In progress: none for local implementation.
- Remaining work: select production domain, deploy/verify SEO, verify Search Console and submit sitemap, establish traffic baseline, confirm CodeRabbit GitHub app and a live review, obtain approved real local photos/testimonials.
- Blockers: production domain does not exist yet (confirmed by Patrick); live CodeRabbit activation is unverified.
- Changed workflows: URL controls page language; first-page search attribution persists through navigation; main-bound PRs and their pushes use CodeRabbit review once the app is enabled.
- Validation: lint, typecheck, 3,748-key translation validation, production web build, 289 API tests (3 PostgreSQL-dependent skips), and all 26 web tests passed, including 7 SEO tests. CodeRabbit YAML parsed and configured fields validated against the official schema subset. Diff check passed.
- Known defects: no remaining SEO test failures; organic attribution has documented referrer/ad-tag limitations. No live domain/indexing/review verification performed.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/seo/*-{1440,390}.png` (10 captures; English desktop and Spanish mobile visually inspected).
- Recommended next task: choose the production domain and follow `SEO_PLAN.md`; confirm CodeRabbit connection on the next main-bound PR.

[SEO checkpoint and verification evidence](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/seo/checkpoint.md)

## Current checkpoint: web card surfaces

- Updated: September 10, 2026 (local checkpoint).
- Branch and baseline commit: `main`, `7fbfe02`; CSS changes are uncommitted.
- Completed: replaced oversized web card and panel corners with shared 6px card / 4px inner-panel and field radii; reduced surface shadows; normalized hardcoded component radii across public, auth, customer, provider, crew, and ops surfaces.
- Scope: Patrick explicitly included the homepage for this CSS pass. Homepage copy, layout, and workflows remain unchanged. Web-only token overrides leave native styles unchanged; functional pills, round indicators, avatars, and device illustrations retain their shapes.
- In progress: none for this CSS pass.
- Remaining work: broader UX plan, including typography, content density, nested containers, and navigation. UX-19 is only partially complete.
- Blockers: none.
- Changed workflows: none; presentation only.
- Validation: `npm run typecheck` passed; before/after Chromium capture on seven public/auth routes at 1440×900 and 390×844 (14 captures per phase) completed without page errors or horizontal overflow; representative desktop/mobile screenshots visually inspected. Sampled computed card radii changed from 16–28px to 4–6px (intentional zero-radius nested search surfaces remain).
- Checks not run: API suite, full web smoke, production build, native exports, live vendor checks. No business logic or native code changed; responsive browser verification was used for this CSS-only change.
- Known defects: pre-existing long headings, nested card structure, and navigation crowding remain outside this pass. Authenticated operational workflows were not re-exercised.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/card-surfaces/{before,after}-{home,listings,signup,provider,crew,help,spanish-home}-{desktop,mobile}.png`.
- Recommended next task: compact app-page headings and mobile navigation from UX-01/02, with broader homepage redesign still deferred.

[Card styling evidence](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/card-surfaces/checkpoint.md)

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

Agent-reported completion is checkpoint evidence only. It does not equal independent verification by the Project Manager or Patrick.

## Current Goal

Make YardMatch's one-time provider finder fee a clear, operational repeat-customer promise: keep working to return a good-standing customer to the proven provider without a second finder fee or separate retention charge.

## Agent Role

Engineer

## Branch And Commit

- Branch: `main`
- Baseline commit: `159219b`
- State: implemented and locally verified in the working tree; changes are not committed.

## Last Updated

2026-08-25 EDT

## Completed Since Previous Checkpoint

- Added a provider marketing section that explains what the one-time $30 finder fee includes: post-service review collection, category-aware book-again/recurring prompts, and verified prior-provider preference.
- Made the pricing boundary explicit: no second finder fee and no separate retention fee, while the published $6.99 completed-job fee still applies to future completed work.
- Added a backend-authored provider retention program summary with acquired, eligible, returned, awaiting-settlement, and paused customer relationships.
- Exposed the retention summary in the authenticated provider web management board and provider mobile dashboard.
- Added relationship good-standing rules that pause automatic continuity after any dispute, refund/reversed settlement, review below four stars, unresolved service-quality case, or active field exception.
- Changed retention-driven provider search to reconstruct finder-fee and good-standing eligibility from server-side booking, settlement, review, and support history instead of trusting client-supplied loyalty counts.
- Kept customer search recommendation-first: the proven provider receives a soft loyalty preference only when eligible, while current service fit, availability, price, route health, and curated alternatives are still ranked fresh.
- Updated customer retention opportunities so ineligible prior relationships trigger a fresh recommendation instead of sending a prior-provider preference.
- Added English and Spanish copy, API regressions, README behavior notes, and roadmap status.

## Currently In Progress

- No implementation remains for this milestone.

## Remaining Work

- Use launch-volume data to refine service-specific retention timing, packages, and recovery rules.
- Add broader outbound book-again delivery beyond the current review-invite and in-product retention surfaces when notification cadence is approved.
- Validate the relationship summary against staging Postgres and real Stripe settlements.

## Blockers

- `TEST_DATABASE_URL` was not configured, so the two Postgres-only integration tests remained skipped.
- Live Stripe settlement and notification delivery credentials are intentionally unavailable in local development.

## Routes Or Workflows Changed

- First completed paid customer/provider job -> immutable settlement -> one-time finder fee recorded -> relationship becomes eligible for YardMatch retention work.
- Customer retention prompt -> API verifies source booking, same property, finder-fee history, reviews, disputes, refunds, support, and field exceptions -> eligible prior provider receives a soft loyalty preference or search falls back to a fresh recommendation.
- Provider web/mobile dashboard -> repeat-customer promise -> relationship counts and recent status/reason visibility.
- Public provider page -> finder-fee pricing -> included retention work -> good-standing guardrails -> exact future completed-job fee disclosure.

## Validation Results

- `npm run typecheck`: passed across the monorepo.
- `npm run lint`: passed with zero warnings.
- `npm run i18n:validate`: passed 3,659 keys across English, Spanish, and pseudo locales.
- Targeted retention tests: 10/10 passed.
- `npm run test:api`: 265 passed; 2 Postgres-only tests skipped because `TEST_DATABASE_URL` was not configured.
- `npm run test:web:smoke`: 19/19 passed.
- `npm run build:provider-mobile`: Expo web, iOS, and Android export passed.
- In-app browser acceptance passed on the provider marketing page at 1440x900 and 390x844, and on the authenticated provider retention card at 390x844. The marketing pass found and fixed a mobile horizontal-overflow defect; final page width matched the 390px viewport.

## Screenshot Paths

- `reports/agent-checkpoints/engineer/latest/provider-retention-marketing-desktop.png`
- `reports/agent-checkpoints/engineer/latest/provider-retention-marketing-mobile.png`
- `reports/agent-checkpoints/engineer/latest/provider-retention-operations-mobile.png`

## Known Defects

- Local seeded providers have no paid customer relationship history, so their retention card correctly starts at zero until a completed settlement records the finder fee.
- The customer reminders remain category-timed in-product opportunities; broader email/SMS book-again automation is still a follow-up.
- Relationship eligibility is deliberately conservative: any filed dispute or sub-four-star review pauses automatic prior-provider preference rather than silently restoring it.

## Recommended Next Task

Add an ops recovery workflow for paused customer/provider relationships so support can document when a resolved quality issue should become eligible for continuity again without weakening the default trust guardrails.
