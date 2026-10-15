# Engineer Status

## Current checkpoint: provider and crew activation with booking continuity

- Updated: October 5, 2026 (UTC).
- Branch and commit: `codex/critical-path-activation`, implementation commit `814afe7`, based on clean `464e939`.
- Completed: provider credential submission/rejection/resubmission and authenticated ops review; owned availability publishing; native credential and Connect handoff/resume; truthful anonymous crew interest, retained signup sessions after failed claims, retry/concurrency/capacity gates, native claims; persisted customer-consented decline/withdrawal/deadline recovery, equivalent replacement and fee-free cancellation; recurring visit/plan consent; wrong-property review; route/work/checkout gates, crew reconfirmation and party notifications.
- In progress: none for implementation; draft PR publication follows this checkpoint.
- Remaining: live sandbox Connect and email/SMS acceptance, native device/browser-return checks and normal launch review. Native property corrections use the web dashboard/support; no native correction form added.
- Smoke follow-up (October 14, 2026): 22 web smoke failures on main came from tests acting on server HTML before React hydrated (controlled selects reset, login forms fell through to a native GET), not from booking-journey or pricing regressions. Specs now use `tests/web/fixtures.ts`, which waits for hydration after `goto`/`reload`; `loginUi` waits for the redirect; helper API URLs honor `YARDMATCH_API_PORT`. `npm run test:web:smoke` passed 51/51 twice.
- Merge follow-up: schedule CI exposed millisecond drift from separate fixture clock reads. Fixture windows/proposals now use one reference time; all 13 schedule tests passed five repeated runs (65 cases), with scoped lint passing. The production duration guard remains unchanged.
- Merge follow-up: browser CI exposed a signup navigation/hydration race in the new stale-opening test. It now awaits the selected-opening heading and explicitly checks successful registration; both recovery scenarios passed five repetitions (10/10), with scoped lint passing.
- Merge follow-up: CI exposed a seeded-provider assumption in the new opening persistence test. The fixture now creates/cleans its own provider; all 15 PostgreSQL tests and the mixed-workload scale gate passed against a newly migrated, unseeded database. Lint and typecheck passed.
- Blockers: none for local implementation. No live vendor/device credentials were used. The other chat's reported uncommitted workspace was not retrievable; clean main was preserved and missing recovery implemented here.
- Changed workflows: providers submit references before ops approval and can publish future openings; crew selection is interest until authorized assignment; failed downstream claims enter the successfully created account; provider-caused recovery remains open until customer consent and cannot silently reprice, move a plan or bypass work/payment gates.
- Validation: 385 API tests passed, 15 database-only cases skipped in the ordinary suite; all 15 PostgreSQL tests passed separately. Fresh additive migrations, repeat seed and zero schema drift passed. Lint, typecheck, API/web builds, all three iOS/Android/web Expo exports, locale validation and mobile release configuration passed. All 51 browser scenarios have passing evidence: full run 49/51, then all eight scenarios in the two map specs passed using deterministic tile fixtures; schedule browser rerun also passed after party notification changes. Desktop 1440×900 and mobile 390×844 screenshots/overflow checks passed and activation/recovery captures were visually inspected.
- Experience map: refreshed and validated/built; 44 web routes, 15 mobile screens, 21 states, 94 connections, zero broken connections and 15 explicitly pending screenshots. Added recovery/approval captures and actual acceptance evidence; external Connect return stays code-inferred.
- Known defects/limits: external imagery delivery unavailable during the cloud run; local map rendering uses fixture tiles and does not establish live imagery acceptance. Gateway tests do not establish real money movement or vendor onboarding. Legacy price/scope differences and generated recurring siblings require support; crew assignment locking is conservative and global for launch.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/provider-onboarding-verified-{desktop,mobile}.png` and `booking-replacement-consent-{desktop,mobile}.png`. Command summaries and final logs are in `reports/agent-checkpoints/engineer/latest/critical-path/`.
- Recommended next task: review draft PR and run sandbox/staging plus signed-device acceptance using the [critical-path matrix and rollout runbook](../CRITICAL_PATH_ACCEPTANCE.md). No production deployment, real money movement or agreement acceptance occurred.


## Current checkpoint: service-first public booking journey

- Updated: September 30, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; uncommitted alongside preserved pre-existing edits.
- Completed: service → location → up to three recommended providers → scheduling dialog → review/auth → persisted request confirmation and rescheduling. Optional directory has a list, actual opening filters, public reviews and approximate service-area map. Multiple services are priced and stored as one visit, with all services visible in customer/provider/crew web work summaries.
- Reliability: quote/address/unit binding, provider eligibility per service, duration/availability checks, provider-scoped locks, duplicate request protection, dropped-response recovery, owned booking lookup and a durable email receipt. Provider confirmation still precedes payment.
- In progress: none for this implementation.
- Remaining: normal migration/API/web rollout and live email verification; native scheduling parity is outside this web change.
- Blockers: none for local implementation.
- Changed workflows: timing is selected after discovery; guests review before authentication; additional services use chips; the confirmation offers rescheduling.
- Validation: Prisma generate, fresh migration, seed and zero schema drift; 361 API tests passed and all 13 PostgreSQL tests passed separately; typecheck and 4,094-key locale validation passed. Lint passed; 14 targeted browser tests passed. Full browser suite: 46/47 passed, then the remaining provider-onboarding test passed after two stale copy assertions were corrected. All 47 scenarios have passing evidence.
- Known defects/limits: no unresolved flow defect found; email queue tested without real delivery, no live payment, production build/deployment or native device/export run. Local supply may produce fewer than three eligible recommendations.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/booking-journey-{recommendations,directory,modal,review,confirmation}-{desktop,mobile}.png`, visually inspected at 1440×900 and 390×844. [Full checkpoint and logs](../../reports/agent-checkpoints/engineer/latest/booking-journey/checkpoint.md).
- Recommended next task: staging acceptance with real email delivery and provider approval.

## Current checkpoint: concise mobile web homepage

- Updated: September 30, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted alongside pre-existing workspace edits.
- Completed: removed the Barnegat-only proof block and explanatory sections from the public homepage, shortened the footer, made homepage metadata location-neutral, and stopped pre-filling Barnegat on the Help form unless a visitor arrives with an area. English and Spanish copy now focuses on the service search, popular services, and a help action. Refreshed the homepage screenshot in the local experience map.
- In progress: none for this cleanup.
- Remaining: no native customer dashboard change was needed; its captured Home screen has no Barnegat or launch-status copy. Barnegat remains the editable default in the public search input.
- Blockers: none for the requested work.
- Changed workflows: visitors still search for providers through the recommendation path, and the Help page remains available for availability questions. Homepage proof and the embedded lead form were removed from the homepage; the contact form remains on Help.
- Validation: `npm run typecheck`, `npm run i18n:validate`, and the web production build passed. All 11 smoke and booking-path browser cases passed, including English/Spanish mobile flow and 390px overflow checks. Desktop and mobile homepage screenshots were visually inspected. Scoped ESLint and whitespace checks passed. Repository-wide lint stopped on pre-existing unused ESLint suppressions; the first browser run could not launch Chromium in the sandbox, then passed with browser permission. The experience-map refresh, validation, and build passed: 42 web routes, 15 mobile screens, 13 states, 83 connections, zero broken connections, and seven pending screenshots.
- Known defects: none observed in the changed homepage. The seven pending experience-map screenshots are existing provider/crew placeholders.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/honest-launch-home-desktop.png` and `honest-launch-home-mobile.png`; refreshed map capture: `apps/experience-map/public/captures/full/web.png`.
- Recommended next task: review the concise homepage in the local viewer and continue the customer booking path assessment.

## Current checkpoint: homepage recommendations and optional directory

- Updated: September 30, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted alongside pre-existing workspace edits.
- Completed: homepage search now leads to up to three visible ranked provider matches. A clear button above the cards opens the full eligible local business directory for the same service, area, and timing, with 12 results per page and a return path to top matches. The selected provider and rank carry into customer signup. The API reports total eligible matches while default customer web/mobile search remains capped at three. The experience map now has screenshot cards and verified connections for top matches and the directory.
- In progress: none for this path.
- Remaining: the seeded Brooklyn market currently has two eligible providers, so live UI evidence shows two matches; the API regression verifies pagination beyond three using more than 200 synthetic providers. Native customer booking retains its existing curated flow. Provider native screens remain deferred at Patrick's request.
- Blockers: none for local work.
- Changed workflows: public visitors can browse all eligible businesses after the recommended top matches. Search ranking, verification, coverage, provider economics, and customer signup handoff are preserved. Directory pages do not add recommendation impressions to analytics.
- Validation: `npm run test:api` passed (356 passed, 12 PostgreSQL tests skipped); `npm run lint`, `npm run typecheck`, and `npm run i18n:validate` passed; all seven `tests/web/smoke.spec.ts` cases and all three `tests/web/customer-booking-golden-path.spec.ts` cases passed. The new path test checked reload, browser Back, provider rank handoff, and no horizontal overflow at 390×844. Desktop and mobile screenshots were visually inspected. `npm run experience-map:refresh -- --no-capture`, `npm run experience-map:validate`, and `npm run build:experience-map` passed: 42 web routes, 15 app screens, 13 workflow states, 98 connections, zero broken connections; seven previously pending native/provider state screenshots remain. The live viewer at 127.0.0.1:4173 shows both new screenshot cards and their connections.
- Known defects: no defect observed in this path. The optional directory currently includes only providers eligible for the selected service and address; it is not a sitewide catalog.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/customer-top-matches-desktop.png`, `customer-top-matches-mobile.png`, `customer-directory-desktop.png`, and `customer-directory-mobile.png`; graph thumbnails are in `apps/experience-map/public/captures/thumbnails/`.
- Recommended next task: review this customer path in the local viewer and assess the signup-to-booking handoff with a real three-provider market when that supply exists.

## Current checkpoint: local YardMatch experience map

- Updated: September 29, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted.
- Completed: added a separate local React Flow/ELK viewer with screenshot cards, zoom/pan, search, area/type/evidence filters, collapsible areas, downstream path highlighting, action details, and large previews. The inventory discovers 42 web routes and 15 mobile auth/tab screens, adds 11 workflow states, and validates 92 action connections. It currently has 61 screen/state screenshots, including all web routes and all five customer iPhone auth/tab screens. Crew auth, Today, and Schedule have iPhone captures. The provider iPhone auth image was captured before that app was deferred; its four tabs remain placeholders. Removed the temporary public preview-host setting from Next.js.
- In progress: none; Patrick asked to stop native capture and build the graph from existing screenshots.
- Remaining: provider iPhone tabs, crew Availability and Account, and provider completion state still need screenshots. The nodes and paths remain visible as labeled placeholders. Provider iPhone capture is deferred at Patrick's request.
- Blockers: none for the local graph. The crew simulator crashed while opening Availability because `Intl.PluralRules` was missing; a polyfill was added to customer and crew app entry points, but the crew rebuild was interrupted when capture was paused. No further native capture was run.
- Changed workflows: no customer, booking, payment, or ops workflow changed. Customer and crew native entry points now load English/Spanish plural-rules support for screens that previously crashed in the simulator. The local graph distinguishes test-verified paths from code-inferred paths and does not invent cross-app navigation.
- Validation: web capture produced 42 thumbnails; the customer iPhone release build and five-screen Maestro flow completed; crew auth/Today/Schedule screenshots were visually checked and a crash-screen capture was removed. `npm run experience-map:refresh -- --no-capture` reported 42 web routes, 15 mobile screens, 11 states, 92 connections, zero broken connections, and seven pending screenshots. `npm run build:experience-map`, scoped ESLint, `npm run typecheck`, the customer quote Playwright test, and desktop/mobile viewer checks passed. The viewer was checked at 1440×900 and 390×844 for cards, image loading, search, filters, collapse, path highlighting, details, preview modal, and horizontal overflow. The full capture command and crew rebuilt binary were not rerun after Patrick paused capture.
- Known defects: crew Availability and Account lack valid native captures; the provider completion state has no matching capture. The initial full-map overview makes cards small at fit-to-view; the viewer starts centered on Home and supports zoom and area filtering.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/experience-map-desktop.png` and `experience-map-mobile.png`; tracked map thumbnails are in `apps/experience-map/public/captures/thumbnails/`.
- Recommended next task: review the local map, then capture the remaining crew screens and revisit the provider iPhone app when Patrick is ready.

## Current checkpoint: production-facing website and app copy

- Updated: September 28, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted.
- Completed: audited public web and shared customer/provider/crew copy; rewrote internal launch, implementation, and strategy language in English and Spanish; rewrote shared help articles as user instructions; removed fallback expansion statistics, launch-queue explanation, policy-page rationale, and speculative partner deals. Preserved existing booking, availability, verification, pricing, and support behavior. Homepage expansion removal and related cleanup were already present when applying the component edits and were preserved.
- In progress: none.
- Remaining: none for this copy cleanup.
- Blockers: none.
- Changed workflows: no booking or payment logic changes; public pages now explain service availability and next actions; unavailable partnerships show an empty state instead of hypothetical offers.
- Validation: `npm run typecheck` and `npm run i18n:validate` passed (3996 keys); scoped ESLint and whitespace checks passed; `npm run test:web:smoke -- tests/web/smoke.spec.ts tests/web/seo.spec.ts` passed all 14 tests using the existing local servers with `YARDMATCH_SMOKE_START_SERVERS=0`. Browser audit checked 16 public routes in English/Spanish at 1440×900 and 390×844 (64 route/viewport checks), with HTTP 200, no horizontal overflow, and no flagged internal copy. All three mobile apps exported for iOS, Android, and web via `npm run build:mobile`. The first sandbox browser-suite attempt could not reach the existing servers; the approved outside-sandbox run passed. API tests and native simulator checks were not run for this content-only change.
- Known defects: none observed in scope. Shared help articles remain English-only under the existing help package; localized UI and policy copy is updated in both supported languages.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/production-copy/{home,barnegat-nj,provider-partnerships,refund-policy,help}-{desktop,mobile}.png`. Home desktop/mobile, local service desktop, and partnerships mobile visually inspected. Browser results: `production-copy/browser-checks.json`.
- Recommended next task: independent review of the updated local site and apps.

## Current checkpoint: public geographic launch copy cleanup

- Updated: September 28, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted.
- Completed: removed the homepage expansion section and its unused translation keys; replaced first-market, launch-area, and town-by-town language across public homepage, footer, provider, local service, coverage, and related trust copy in English and Spanish. Updated the existing homepage smoke expectation.
- In progress: none.
- Remaining: none for this request.
- Blockers: none.
- Changed workflows: public messaging describes services and checking current availability; Barnegat remains the default search location and existing coverage/recommendation rules still apply.
- Validation: typecheck passed; translation validation passed for 4,014 keys; both English/Spanish public marketplace smoke tests passed. Seven public routes returned HTTP 200 and passed old-copy and horizontal-overflow checks at 1440×900 and 390×844: /, /es, /barnegat-nj, /barnegat-nj/lawn-mowing, /services/lawn-mowing, /provider, /provider-verification. Homepage desktop/mobile screenshots visually inspected. Scoped whitespace check passed. Full API and browser suites were not run for this copy-only change.
- Known defects: none observed in scope.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/coverage-copy/desktop.png` and `reports/agent-checkpoints/engineer/latest/coverage-copy/mobile.png`.
- Recommended next task: review the updated public copy locally.

## Current checkpoint: homepage search alignment and badge cleanup

- Updated: September 28, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`; changes uncommitted.
- Completed: aligned the Where input with Need and When by moving Use my location into the label row; preserved an explicit accessible input label; removed the launch eyebrow and all three requested hero trust badges and their unused CSS.
- In progress: none.
- Remaining: none for these five comments.
- Blockers: none.
- Changed workflows: location action appears above the input beside Where; search and location handlers are unchanged.
- Validation: `npm run typecheck` passed; Playwright browser check passed at 1440×900 and 390×844; input tops align within 0.4px on desktop, requested badges absent, no horizontal overflow; both screenshots visually inspected. Scoped whitespace check passed. Full test suites were not run for this presentation-only change. Initial sandbox browser launch failed; the approved outside-sandbox run passed. Repository-wide whitespace check reports pre-existing investor PDF whitespace.
- Known defects: none observed in scope.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/home-search/desktop.png`, `reports/agent-checkpoints/engineer/latest/home-search/mobile.png`.
- Recommended next task: review the updated homepage locally.

## Current checkpoint: customer referral forms and data plumbing

- Updated: September 28, 2026 (America/New_York).
- Branch and source commit: `main`, `0987164427f50e3879570f83cb2bd6c8d2eb55a1`. Changes are uncommitted.
- Completed: customer web/mobile referral forms for email and US phone; authenticated ownership and versioned contact permission; atomic referral/ops-lead persistence; normalized-contact deduplication; concurrency-safe rolling daily limit; private customer history; canonical phone matching into booking attribution; localized English/Spanish UI and prepared personal email/SMS invitations; API/migration/setup documentation and regressions.
- In progress: none for this scope.
- Remaining: migrate staging before API release; verify native composer handoff on physical devices; separately select and implement reward qualification, budget reservations, fulfillment, provider referrals, and experiment attribution.
- Blockers: none locally. No deployment performed.
- Changed workflows: Account → Refer a friend saves consented contact details and creates an ops lead, then opens a prepared invitation in the customer's own email/text app. History follows coarse ops/booking progress. Saving/opening never claims message delivery or reward eligibility. Provider pricing and recommendation order remain unchanged.
- Validation: Prisma generation, typecheck, lint, 4,026 translation keys, nine targeted referral API tests; full API suite 356 passed and 12 PostgreSQL tests skipped in that invocation; all 12 PostgreSQL tests passed separately; all 42 browser tests passed; all 42 migrations applied to a fresh disposable PostgreSQL database, migration status/schema drift/seed passed; customer Expo export passed for iOS, Android, and web; scoped whitespace check passed.
- Known defects/limits: no unresolved defect in scope. No live email/SMS delivery, physical-device test, deployment, production web build, or separate API smoke run. Existing manual privacy fulfillment must cover both referral and lead records. Rewards and automated invitations are not implemented.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/referrals-desktop.png` (1440×900 viewport) and `referrals-mobile.png` (390×844 viewport), visually inspected with no horizontal overflow. [Checkpoint and logs](../../reports/agent-checkpoints/engineer/latest/referrals/checkpoint.md).
- Recommended next task: stage the migration/API/web/customer-mobile release and verify device composer handoff before selecting incentive terms and building reward fulfillment.

Agent-reported completion is checkpoint evidence, not independent release acceptance. Existing investor-artifact edits are preserved.

## Current checkpoint: scale remediation

- Updated: September 21, 2026 (America/New_York).
- Branch and source commit: `main`, `691df2d367a8d7fb3837dc7cf83295e7422feade`. This status/evidence is recorded in a following documentation commit.
- Completed: all six scale-review findings; durable notification/export leases and bounded workers, asynchronous password work, scoped search/provider/history queries, calendar synchronization outside transactions, property summaries and clustered/paginated client maps, full-period analytics aggregation, UTC-safe SQL/defaults, and a repeatable CI capacity gate. See [the remediation report](../../reports/scale-review/2026-09-21-remediation.md).
- In progress: none for this implementation scope.
- Remaining: capacity acceptance on the intended staging topology, sustained memory/pool/lock measurement, and live vendor outage/quota validation before advertising a supported user count.
- Blockers: no local implementation blocker. Production topology/vendor access was not part of local verification; no push or deployment performed.
- Changed workflows: ordinary notifications enqueue atomically and send asynchronously; stale calendar results reject safely; client lists paginate 50 rows and maps cluster; analytics acknowledges durable events and warns on old/exhausted export backlog. Recommendation-first ranking and curated alternatives remain in place.
- Validation: `npm run verify` passed (Prisma generation, lint, typecheck, mobile release configuration, 347 API tests; 11 database tests skipped here). `npm run test:api:postgres` passed all 11. API smoke and all 40 browser tests passed. Production web build, 3992-key translation validation, CI log-failure propagation, fresh/upgrade migrations (41), migration status/schema diff, and seed passed.
- Capacity: final mixed workload passed with 200 operations at concurrency 12, 601 providers, 20,000 bookings, 1,000 properties, 10,000 analytics events, and 250 stubbed notifications. Zero errors; search p95 249 ms, clients 401 ms, password 114 ms, route writes 31 ms, analytics 447 ms; event-loop p99 32 ms. These are local measurements, not production capacity claims.
- Known defects/limits: SMS/push retain an at-least-once boundary if a process crashes after vendor acceptance but before database acknowledgement. Huge property populations and broad infrequent ops reports still require workload-specific profiling. No live vendor test, production benchmark, native simulator, or fresh Expo export was run.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/scale-clients-desktop.png` (1440×900) and `scale-clients-mobile.png` (390×844), visually inspected. Checkpoint, capacity JSON, and logs: `reports/agent-checkpoints/engineer/latest/scale-remediation/`.
- Recommended next task: follow the documented maintenance-window migration sequence and run staging capacity acceptance against the intended production topology.
- All previously unmerged branches remain integrated into main. Investor artifacts and their newer working copies are preserved separately. Agent-reported evidence does not replace independent release acceptance.

## Previous checkpoint: main consolidation and scaling review

- Updated: September 20, 2026 (America/New_York).
- Branch and commit: `main`, merged source baseline `4d5b2dd3be3fc2e067f975f65872c4ca3ccadae5`; this checkpoint is recorded in a subsequent documentation commit.
- Completed: fetched branch audit; conflict-free integration of all outstanding branch commits into local main; preserved pre-existing and concurrent investor edits; code-based scale review and controlled notification/password probes. See [review and evidence](../../reports/scale-review/2026-09-20.md).
- In progress: none for the review/merge scope. Scale remediation has not been implemented.
- Remaining: notification worker claims/recovery, asynchronous bounded password verification, scoped/batched provider-search queries, shorter calendar transactions, client-map summaries, analytics throughput, and production-shaped load testing.
- Blockers: no blocker to local consolidation. Production capacity and vendor behavior remain unmeasured. Main has not been pushed or deployed.
- Changed workflows: source history consolidated into main; no new product behavior added by this review.
- Validation: `npm run verify` passed (339 API tests, seven PostgreSQL skips); `npm run test:smoke` passed API smoke and 39 browser tests; fresh isolated PostgreSQL migration/bootstrap, all 39 migration statuses, schema-drift check, seed, and seven integration tests passed.
- Known defects: two overlapping retry workers sent one notification twice in a stubbed PostgreSQL probe; queued delivery was not recovered by the retry sweep. Full-table queries, blocking password hashing, and other growth bottlenecks are detailed in the review. No production load test, real vendor acceptance, simulator run, or fresh Expo export was performed.
- Screenshots: `reports/agent-checkpoints/engineer/latest/provider-clients-desktop.png` (1440×900) and `provider-clients-mobile.png` (390×844), visually inspected; complaint/refund screenshots also regenerated by browser tests. Logs/probes: `reports/agent-checkpoints/engineer/latest/scale-review/`.
- Recommended next task: repair notification claim/recovery and add overlapping-worker/crash regression tests, then remove synchronous password work and bound search queries.
- Agent-reported evidence only; independent release acceptance remains separate.

## Current checkpoint: service complaints and partial refunds

- Updated: September 20, 2026 (America/New_York).
- Branch and commit: `codex/analytics-launch-readiness`, `3327f50`; this implementation is uncommitted. Pre-existing provider-client, branding, and pitch-document work was preserved.
- Completed: responsive customer complaint form with booking ownership, issue/task/remedy selection, two validated photos or no-photo explanation, duplicate suppression, follow-up history, and human-review/reopening path. Customer complaint photos use private booking evidence and remain excluded from marketing consent. Provider and crew web capture includes property-area labels and matched-angle guidance.
- Completed support automation: deterministic triage/checklist and update targets; damage bypasses AI and receives the urgent support escalation profile; optional consented OpenAI Responses image assessment with structured output validation, no money tools, internal-only notes, and failure fallback. Customer status refreshes while Help is visible.
- Completed payment work: ops-approved YardMatch-funded partial goodwill refunds, one successful refund per case, integer-cent/remaining-balance and evidence guards, durable reservations, stable Stripe keys, pending/uncertain/failed reconciliation, immutable approver identity, balanced expense entries, and in-app customer status notifications. Provider earnings/transfers are unchanged. Full refund after a partial refund uses only the remaining balance; submitted full refunds cannot be denied or followed by another partial refund until reconciled. A pending charge refund does not declare the booking refunded.
- Changed workflows: Help leads with the complaint form; the completed-visit refund panel links to it. Ops compares customer/provider evidence, reads advisory assessments, approves goodwill amounts, and can open the existing full-refund review from service complaints. Model results cannot approve refunds or satisfy human evidence review.
- In-progress work: none for this local first-release slice.
- Remaining work: deploy migration/API/web, configure `OPENAI_API_KEY` plus a compatible `SUPPORT_AI_MODEL` if AI assistance is desired, enable signed refund events in Stripe test mode, and run staging acceptance. Calibrate image assessments on consented cases before financial automation. Automatic allowances, provider-funded partial deductions/appeals, automatic return-visit scheduling, and native complaint-form parity remain future policy/product work.
- Blockers: no local implementation blocker. Live Stripe/OpenAI acceptance requires configured credentials and staging; no production deployment was performed.
- Validation: Prisma generation passed. The documented `npm run prisma:deploy` bootstrap applied all migrations to a fresh disposable PostgreSQL 16 database; seed passed; `prisma migrate diff --exit-code` reported no difference. `npm run typecheck`, `npm run lint`, and locale validation passed (3,985 keys). Removed an obsolete lint suppression after correcting support-loading hook dependencies.
- API validation: `npm run test:api` passed 339 tests; seven database-dependent tests were skipped in that invocation and all seven passed separately with `npm run test:api:postgres`. New regressions cover ownership, photo exceptions, duplicate/reopened reports, consent, invalid AI output, balanced partial refunds, concurrent/retried requests, failed/pending refunds, webhook ordering, remaining-balance full refunds, full-refund uncertainty, and photo marketing exclusion. PostgreSQL test covers concurrent API instances, durable reservations, ledger deduplication, and rollback.
- Browser validation: `npm run test:web:smoke` ran 39 tests: 38 passed, and the new refund test exposed currency formatting that omitted cents. Exact-cent formatting was corrected; both tests in `tests/web/service-complaints.spec.ts` then passed (including the formerly failing test). Existing customer/provider/crew/ops flows passed in the full run. The complaint test uses real local authenticated APIs; the ops refund display test uses an explicitly mocked payment response, while money-state behavior is covered by API/PostgreSQL tests. Screens were checked at 1440×900 and 390×844 with no horizontal overflow; final screenshots were visually inspected.
- Known defects: no unresolved defect found in this slice's checks. AI accuracy has not been calibrated; live vendor calls and real fund movement were not tested. Out-of-band Stripe refunds update cumulative balances but require separate financial-allocation review. Standard marketplace fee snapshots exclude goodwill expense; the dedicated ledger expense account is the source for that cost.
- Initial environment issues: sandbox restrictions blocked local listeners/Chromium; approved local execution succeeded. Direct Prisma deploy on an empty database hit the repository's known historical migration order; the documented bootstrap workflow passed on a fresh database. Initial browser test login path and PostgreSQL test cleanup model were corrected. Unrelated pre-existing PDF whitespace was excluded from the code diff check.
- Screenshot paths: `complaint-form-desktop.png`, `complaint-form-mobile.png`, `complaint-review-desktop.png`, `complaint-review-mobile.png`, `partial-refund-desktop.png`, and `partial-refund-mobile.png`, all beside this report. Images contain disposable test data; the one-pixel photo is an upload fixture, not evidence of image-analysis accuracy.
- Recommended next task: independent staging acceptance of consented photo comparison and test-mode partial/full refunds, including pending/failure delivery and provider-transfer recovery. Then set an explicit financial automation policy.

Agent-reported completion is checkpoint evidence only; it does not equal independent verification by Patrick or the Project Manager.


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


## Previous checkpoint: provider client map

- Updated: September 20, 2026 (America/New_York).
- Branch and baseline commit: `codex/analytics-launch-readiness`, `b141eda838ec7bd29fafa23a4cb8f9f7fa3fd740`; implementation is uncommitted in the shared working tree.
- Completed work: authenticated provider web Clients navigation and `/provider/clients`; responsive searchable list and interactive map; active recurring/one-time filters; next-7/30-day filters; current and historical booked properties; selected-property visit details and directions; shared-location chooser; missing-coordinate, tile-failure, loading, empty, retry, and signed-out states; English/Spanish copy; private API response and robots/noindex protection.
- In-progress work: none for this local implementation.
- Remaining work: independent staging acceptance with real provider accounts, stored property geocodes, and external tile connectivity before launch.
- Blockers: none for local delivery; staging credentials/deployment were not part of this task. Six existing PostgreSQL-dependent tests skipped because `TEST_DATABASE_URL` was not configured.
- Changed workflows: providers open Clients from navigation or Jobs; select a property in the list or map; inspect upcoming/completed visits; open directions. Server identity controls the entire client inventory and caller-supplied provider IDs cannot expand it. Non-cancelled bookings are grouped by customer and booked address including unit; unrelated saved properties and private contact/access notes are excluded. Active service plans determine recurrence. Past clients remain visible.
- Validation results: targeted API suite 38/38 passed; full API suite 321 passed, 6 skipped; full web smoke suite 36/36 passed; new provider-client browser suite passed again 4/4 after final screenshot timing improvements; `npm run typecheck`, `npm run lint`, `npm run i18n:validate` (3,921 keys), `npm run build:web`, final browser-test-file lint, and scoped diff whitespace checks passed. Screenshots visually reviewed at 1440×900 and 390×844; English/Spanish responsive checks assert no horizontal overflow. Tests cover isolation, pagination beyond 200 bookings, deduplication, separate units/customers, active/cancelled recurrence, historical clients, filter/pin synchronization, co-located pins, unavailable coordinates/tiles, errors/retry, anonymous access, and session removal.
- Verification limitations: no live staging/production deployment, PostgreSQL integration, native app export/simulator, or CodeRabbit review ran. No schema/repository or native app code changed. Initial sandbox server binding failed; authorized local-server checks subsequently passed. The final focused run logged a Next development-server cancelled-stream message during navigation; all tests and the production build passed.
- Known limits: map tiles require network access; the list and pins remain available during a tile outage. Coordinates come from booked addresses; city/postal-code precision is marked approximate. This screen covers YardMatch-booked properties, not external-calendar clients. Native provider app changes, route optimization, and unassigned nearby-opportunity overlays are outside this screen's implementation. No known unresolved failure in this milestone's checks.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/provider-clients-desktop.png` and `reports/agent-checkpoints/engineer/latest/provider-clients-mobile.png`. Screenshots use explicitly mocked Barnegat test fixtures with real map tiles; a separate browser test exercises real authenticated API bookings.
- Recommended next task: independently accept this feature on staging with two distinct provider accounts, real geocoded bookings, and active/cancelled recurring plans, then verify map access on desktop and a mobile browser.

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

## Home Search Timing Checkpoint — 2026-09-30 EDT

- Branch and commit: `main` at `0987164`; changes remain in the working tree.
- Completed work: Hid the When selector, backup windows, and custom date controls on the home page while leaving the shared timing controls available on listings. Home search and popular-service links now carry service and area without a preselected `when` parameter.
- In-progress work: None for this request.
- Remaining work: A dedicated appointment-time step later in booking remains a future product change; listings currently offers timing through Edit service, time, or area and uses its existing initial search window.
- Blockers: None.
- Changed workflows: Home service and area search → listings recommendation → timing may be changed on listings before continuing.
- Validation results: `npm run typecheck` passed; targeted `npm run test:web:smoke -- tests/web/smoke.spec.ts -g 'home search defers timing|public marketplace loads'` passed (2 tests); 1440x900 and 390x844 home screenshots reviewed, with no mobile horizontal overflow.
- Known defects: The listings page still initializes to tomorrow morning when the home URL omits timing. This is existing behavior and should be revisited with a dedicated appointment-time step.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/honest-launch-home-desktop.png`, `reports/agent-checkpoints/engineer/latest/honest-launch-home-mobile.png`.
- Recommended next task: Design a post-recommendation time-selection step that updates availability and booking intent after the customer has seen their match.

## Provider ZIP pricing checkpoint

- Updated: September 30, 2026 (EDT).
- Branch and commit: `codex/provider-zip-pricing`; parent commit `6e85529`, initial implementation baseline `0987164`. The initial backend and pricing panels are already on main; this checkpoint accompanies the remaining UI, booking integration, tests and documentation. Published through a pull request for CodeRabbit review before main integration.
- Completed work: configurable minimum starting amounts per service and five-digit US ZIP; authenticated provider prices during web/native signup and later settings; offered-service validation and minimum enforcement; admin-only minimum editor and persisted previous/new amount, actor, time and reason; provider/property-specific quotes with existing job-size adjustments; stale-quote and provider-swap rejection; explicit customer review when a selected provider changes the total; exact-cents display in pricing, quote review and confirmation; English/Spanish copy; migration and setup documentation.
- In-progress work: none for local implementation.
- Remaining work: approve actual minimum dollar amounts per ZIP/service, deploy the additive migration with the application release, configure those amounts through Ops, and independently accept the feature in staging. No production pricing amounts were invented or seeded.
- Blockers: no local implementation blocker. Production price activation awaits business-defined minimums. CodeRabbit review is unavailable in this session; these changes are not CodeRabbit-reviewed.
- Changed workflows: signup → choose services and starting amounts where a ZIP policy exists; provider web Management → Service prices and native Business → Work → Service prices; Ops → Administration → ZIP pricing minimums; customer quotes → provider starting amount plus existing labor/area adjustments → explicit total review → booking. Existing bookings and active recurring plans keep agreed totals.
- Policy behavior: unconfigured ZIP/service pairs keep the legacy automatic quote calculation and disallow custom saved rates. Minimum increases affect new quotes, clamping effective starting amounts without rewriting providers’ saved preferences. US ZIP+4 inputs normalize to five digits. API writes validate integer cents and service ownership; public minimum reads omit audit details.
- Validation results: `npm run typecheck`, `npm run lint`, and `npm run i18n:validate` passed (4,118 locale keys). Seven targeted pricing API tests passed. Full `npm run test:api`: 368 passed, 14 PostgreSQL-only cases skipped; all 14 passed separately with `TEST_DATABASE_URL` against an isolated PostgreSQL instance. Prisma generation, clean migration deployment, two seed runs and zero schema drift passed. Provider and customer Expo exports passed for iOS, Android and web. Six targeted browser scenarios passed across booking journey, provider onboarding, provider pricing, and ops minimum management. Five passed in the final combined run; the ops test then passed separately after its select locator was corrected to use the accessible combobox role.
- Browser verification: signup, provider settings and ops minimums captured at 1440×900 and 390×844 with no horizontal overflow. Representative desktop and phone captures visually inspected. First browser attempt reused stale local servers; final verification used independent API/web ports and a separate generated Next directory, which was removed afterwards. A test initially expected two decimal digits while currency display rounded them; all affected pricing/review totals now show exact cents. Generated Next files briefly entered lint scope; final lint ran after cleanup.
- Checks not run: full web smoke suite, native device/simulator UI acceptance, production deploy/vendor acceptance, CodeRabbit review. Relevant browser regressions and native exports were run instead of unrelated end-to-end suites. The isolated PostgreSQL server was stopped after verification; existing development servers were preserved.
- Known defects: no outstanding defect found in this slice. The pre-existing automatic size/labor estimate remains heuristic; these changes preserve that calculation.
- Screenshot paths: `reports/agent-checkpoints/engineer/latest/zip-pricing-{signup,settings,ops}-{desktop,mobile}.png`.
- Validation logs: `reports/agent-checkpoints/engineer/latest/zip-pricing/`.
- Recommended next task: define the approved ZIP/service minimum matrix, then use the audited admin editor to activate it in staging and independently verify a provider quote and booking.

Agent-reported completion is checkpoint evidence, not independent acceptance by Patrick or the Project Manager.
