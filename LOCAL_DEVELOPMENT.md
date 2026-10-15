# YardMatch Local Development

This is the practical runbook for getting YardMatch running locally and for giving agents a stable baseline.

## CodeRabbit Quality Upkeep

Patrick's standing preference: use CodeRabbit for quality upkeep on pull requests and changes going into `main`.

- Use CodeRabbit to review PRs targeting `main`, including subsequent pushes to those PR branches. Check that the latest changes have been reviewed before merging; automatic reviews can pause or skip drafts.
- Address actionable findings and record the rationale for dismissed findings. Continue running the repository's required tests and CI checks.
- For an explicitly authorized direct push to `main`, arrange a CodeRabbit review of the proposed changes before pushing. Do not assume PR auto-review covers a direct push to `main`.
- If CodeRabbit is unavailable or not connected, report that gap explicitly; do not describe the changes as CodeRabbit-reviewed.

The repository's `.coderabbit.yaml` enables reviews for PRs targeting `main`, incremental reviews on subsequent pushes, and no automatic pause after a commit count. Draft PRs remain excluded until marked ready. It includes YardMatch product and verification guidance. The configuration requires the CodeRabbit GitHub app to be installed and enabled for `pkopps/ym`; adding the file does not install the app, review the current working tree, or set required checks/branch protection. Confirm an actual review on the latest PR commit before counting the check as complete. See [CodeRabbit automatic review controls](https://docs.coderabbit.ai/configuration/auto-review).

## SEO Setup

Patrick has not selected a production domain yet. Use `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally (or the actual local web origin). Before production, replace it with the real HTTPS canonical origin and rebuild; do not use an invented placeholder domain. `GOOGLE_SITE_VERIFICATION` is an optional public Search Console meta-tag token and remains empty until supplied by the real property. See `SEO_PLAN.md` for the domain, verification, sitemap submission, and baseline checklist.

English web URLs are unprefixed, Spanish URLs use `/es`, and the language picker navigates between them. Cookies and browser preferences do not change a URL's rendered language. SEO regressions run with `npm run test:web:smoke -- tests/web/seo.spec.ts`.

## Defaults

- Web app: `http://localhost:3000`
- API: `http://localhost:4001`
- API docs: `http://localhost:4001/api/docs`
- OpenAPI JSON: `http://localhost:4001/api/docs/openapi.json`

The web and mobile clients default to `http://localhost:4001` for API calls. Keep `.env.local` aligned with that unless you intentionally run another port.

## Environment

Start from `.env.example`:

```bash
cp .env.example .env.local
```

For the fastest local frontend or smoke-test loop, leave `DATABASE_URL` unset so the API uses the in-memory repository.

For Postgres-backed development, set `DATABASE_URL`, then run:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Local API reliability defaults are `API_SLOW_REQUEST_THRESHOLD_MS=1500`, `API_RECENT_FAILURE_LIMIT=100`, and `ANALYTICS_MAX_IN_MEMORY_EVENTS=10000`. Every response exposes `X-Request-Id`; slow requests and server failures are emitted as one-line structured JSON. The authenticated ops overview groups error types and slow routes without retaining request bodies or user contact data.

Launch feature flags `YARDMATCH_PAYMENTS_ENABLED` and `YARDMATCH_CREW_MARKETPLACE_ENABLED` accept `true` or `false` and are read by both the API and the web app. When unset they are on for local development and off in staging and production (see `docs/plans/launch-scope-2026-10.md`). With payments off, the API answers `404` for checkout, refund, partial-refund, refund-override, payout and Stripe Connect routes, and the web hides provider Payments, ops payouts, customer checkout and refund-review entry points; the Stripe webhook stays reachable. With the crew marketplace off, public crew opportunity, select and claim routes return `404` and signed-out `/crew` shows a crew sign-in prompt instead of open listings. `GET /healthz` reports the active `features`.

Staging and production require `SENTRY_DSN`. Set `SENTRY_TRACES_SAMPLE_RATE` between `0` and `1` (the documented default is `0.1`), create separate alert rules for staging and production, and verify one test exception before accepting a deployment. Sentry events carry the same request ID shown in API responses and the ops dashboard. They intentionally omit request bodies, headers, query strings, cookies, and user identity.

## Seeded Accounts

Default password for seeded accounts is:

```text
YardMatch123!
```

In-memory API mode always seeds:

- Ops admin: `ops@example.com`

Postgres seed also creates:

- Ops admin: `ops@example.com`
- Customer: `jordan@example.com`
- Provider: `ariana@greenstride.example`
- Provider: `luis@terracut.example`
- Crew member: `crew@example.com`

## Run Locally

API:

```bash
npm run dev:api
```

Web:

```bash
npm run dev:web
```

Customer mobile:

```bash
npm run dev:customer-mobile
```

Provider mobile:

```bash
npm run dev:provider-mobile
```

Crew mobile:

```bash
npm run dev:crew-mobile
```

## Two-Factor And Device Security

Password-backed accounts can choose email or SMS security codes from the web account security center at `http://localhost:3000/account/security` or from the Security section in each mobile app. Local notification delivery uses the existing mock Resend/Twilio path unless real vendor credentials are configured, so setup and login challenge responses include a development-only `codePreview` for deterministic testing. Production responses never include the code.

The flow uses 10-minute single-use codes, a 60-second resend cooldown, a five-attempt lock threshold, and hashed device identifiers remembered for 30 days. A successful sign-in from an unrecognized device always creates an in-app event and queues an email warning. Removing a remembered device forces a security-code challenge on its next sign-in; revoking all sessions increments the account session version and clears every remembered device.

Real delivery uses the existing `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` and `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` configuration. Staging allowlists still apply. Social-only accounts are intentionally prevented from enabling YardMatch two-factor authentication until the OAuth callback flow has its own second-step handoff.

## Verification

Fast checks:

```bash
npm run typecheck
npm run test:api
```

API smoke only:

```bash
npm run test:api:smoke
```

Web smoke with local API and web servers managed by Playwright:

```bash
npm run test:web:smoke
```

Full local verification:

```bash
npm run verify:local
```

Lint the complete monorepo with the pinned ESLint 10 flat configuration:

```bash
npm run lint
npm run lint:fix
```

Existing violations that are too risky to rewrite during initial lint adoption are counted by file and rule in `eslint-suppressions.json`. The rules remain active, so new violations fail lint. After removing any suppressed violation, refresh the checked-in baseline with `npm run lint:prune-suppressions`; do not increase suppression counts as a routine fix.

Customer referral verification:

```bash
npm run prisma:generate
node --test --import tsx apps/api/test/customer-referrals.test.ts
npm run test:web:smoke -- tests/web/customer-referrals.spec.ts
npm run build:customer-mobile
```

Apply `20260928010000_customer_referrals` through the normal migration command before using PostgreSQL. The database suite includes a referral test covering concurrent duplicate requests, daily limits, durable ownership/consent, status joins, unique constraints, and rollback when a linked lead/referral write fails. In-memory mode supports the same form and referral workflow. No email/SMS credentials are needed: invitation buttons open the user's own email or text composer, and tests inspect those URLs without sending messages. `APP_BASE_URL` determines the invitation website; configure it for devices or staging rather than sharing a localhost link.

PostgreSQL launch-gate verification:

```bash
DATABASE_URL=postgresql://yardmatch:yardmatch@localhost:5432/yardmatch npm run prisma:deploy
DATABASE_URL=postgresql://yardmatch:yardmatch@localhost:5432/yardmatch npx prisma migrate status --schema apps/api/prisma/schema.prisma
npx prisma migrate diff --from-url postgresql://yardmatch:yardmatch@localhost:5432/yardmatch --to-schema-datamodel apps/api/prisma/schema.prisma --exit-code
TEST_DATABASE_URL=postgresql://yardmatch:yardmatch@localhost:5432/yardmatch npm run test:api:postgres
```

The GitHub Actions PostgreSQL job runs the same migration, status, drift, and repository gates against an isolated PostgreSQL 16 service. It archives the logs for 90 days as `postgres-launch-gate-<commit>` so the production-deployment checklist can point to durable evidence instead of an unrecorded local run.

## Staging And Production Startup Safety

Local development intentionally permits the in-memory repository, inline evidence images, and development auth defaults. Deployed environments use `NODE_ENV=production` plus an explicit `YARDMATCH_ENV=staging|production`. The API exits before opening a listening socket when PostgreSQL, a strong JWT, HTTPS public URLs, an exact CORS allowlist, private Blob storage, Stripe/webhook credentials, or production-shaped Resend/Twilio sender configuration is absent or malformed. Staging accepts only Stripe test keys and requires email/SMS allowlists; production accepts only live Stripe keys.

The production configuration tests include a child-process startup check, so this boundary is exercised through the real API entry point rather than only as a helper-function unit test.

Before a staging or production deployment, run `npm run verify:production-config` with `NODE_ENV=production`, the intended `YARDMATCH_ENV`, and that environment's real secrets injected. The command returns only the environment readiness status and selected repository mode; it never prints credential values. It refuses local mode so a development fallback cannot be mistaken for a passing deployment preflight.

The API exposes `/healthz` for process liveness and `/readyz` for repository readiness. It caps request bodies at 2.5 MB by default, validates decoded JPEG/PNG/WebP content and dimensions, drains active connections on `SIGTERM`, and stores deployed booking evidence in private Vercel Blob objects behind YardMatch delivery URLs. See `STAGING_DEPLOYMENT.md` for the Render/Vercel setup and remote smoke commands.

## Deployment And Mobile Release Checks

Validate all three EAS profiles, native identifiers, environment separation, and internal-track submission settings without requiring an Expo login:

```bash
npm run verify:mobile-release
```

Deployed mobile builds set `EXPO_PUBLIC_YARDMATCH_ENV=staging|production` and fail configuration when `EXPO_PUBLIC_API_BASE_URL` is absent or not HTTPS. Local builds keep the localhost fallback. Use an EAS `preview` environment for both direct internal builds and store-test binaries so TestFlight/Play internal testing cannot accidentally write production data.

The ordinary CI gate builds API/web and exports customer, provider, and crew bundles for web, iOS, and Android. After hosting is provisioned, the protected `Staging acceptance` workflow waits for revision-matched web/API health and archives the full remote gate. See `MOBILE_DEPLOYMENT.md` and `RELEASE_RUNBOOK.md` before initializing EAS or sharing test builds.

## Stripe Connect Payout Lifecycle

With `STRIPE_SECRET_KEY` configured, providers can inspect their recipient state at `GET /api/providers/connect/status` and start or resume Accounts v2 onboarding at `POST /api/providers/connect/onboarding`. The requested account uses Express dashboard access, application-owned fees and losses, and a recipient-only transfer configuration. Starting onboarding is a payout-account-sensitive action and requires a fresh provider session.

Ops payout previews become `stripe-transfer` batches only after the completed booking, captured Stripe charge, actual processing fee, immutable settlement, hold period, provider credentials, and both recipient transfer and payout capabilities pass. A fresh `ops-admin` session must create the run and explicitly execute it through `POST /api/payouts/ops/disbursement-runs/execute` with the exact confirmation value `execute-provider-transfers` and an audit note. Crew members are never transfer recipients.

Transfers use the original Stripe charge as `source_transaction`. Refund and dispute webhooks reverse any released provider transfer with stable idempotency keys, append balanced reversal ledger entries, and keep Stripe transfer/reversal ids in ops history. Without Stripe credentials, local development intentionally exposes manual preview records but cannot execute money movement.

## Smoke-Test Notes

The launch default remains Barnegat, NJ, but local smoke tests use Brooklyn, NY because the in-memory provider dataset has verified providers there with available route windows. That keeps smoke tests deterministic without requiring production seed data.


## September analytics and operations batch

See [the implementation/runbook](docs/ANALYTICS_AND_OPERATIONS.md). Run `npm run prisma:generate` and `npm run prisma:deploy` before starting a PostgreSQL API. The deployment command safely bootstraps init on a new empty database because one historical crew migration predates it; existing migration history is preserved. Do not reset an existing database to work around this ordering issue.

Enable usage analytics from the footer or mobile Help to exercise optional events. Web privacy signals take precedence. Sign in as ops and open Reports for the new dashboard or Administration for scheduler/credential/privacy review. `npm run test:api:postgres` now includes analytics durability/export retry and photo-review safety in addition to financial/security integration tests.

The September 18 Postgres CI job appeared green because `tee` masked command failures. Its archived logs contain migration errors and failed tests. It is not a passed launch gate. Explicit Bash/pipefail now protects CI and staging log pipelines; use the new PR's actual artifact, not the old green badge.

## Schedule recovery verification

See `docs/BOOKING_SCHEDULE_RECOVERY.md`. After Prisma generation and migration, run `npm --workspace @yardmatch/api exec -- node --test --import tsx test/booking-schedule.test.ts`, `npm run test:api`, and `npm run test:web:smoke -- tests/web/booking-schedule.spec.ts`. PostgreSQL integration coverage uses `TEST_DATABASE_URL`. The normal ops runner includes schedule follow-ups; use a dry run with `sweepKeys: ["booking-schedule-follow-ups"]` to inspect due counts before live execution. Local notifications use mock vendors unless the development sender configuration is explicitly supplied.


## Customer payment methods

Web and customer mobile use Stripe-hosted Checkout for individually approved payments. The app introduces Apple Pay, Google Pay, and cards first, with optional US bank-account guidance. Eligible wallets appear in Stripe's express checkout; availability depends on the customer's browser/device, wallet setup, currency, and Stripe configuration. After a completed visit, the same bank disclosure becomes a gentle returning-customer suggestion. Linking a bank account does not enroll the customer in autopay. No future-use setup, recurring charging, PayPal integration, or fee changes are part of this release.

Before enabling this in a deployed environment:

1. In the platform Stripe Dashboard, enable cards, Apple Pay/Google Pay, and US bank account (ACH Direct Debit) for USD Checkout. Keep cards enabled. The API uses dynamic payment methods, so Stripe's enabled methods and eligibility determine what actually appears.
2. Optionally create a dedicated payment-method configuration and set `STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` to its `pmc_...` ID. Without it, Checkout uses the account's default configuration. Check both sandbox and live-mode configurations separately.
3. Deliver signed `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.processing`, and `payment_intent.payment_failed` events to `/api/payments/webhook`, in addition to the existing refund and dispute events. Set the corresponding `STRIPE_WEBHOOK_SECRET`.
4. In Stripe test mode, verify a card payment, eligible-device Apple Pay/Google Pay presentation, bank verification (including microdeposit instructions when required), delayed bank success/failure, browser/app return, retry after failure, and duplicate webhook delivery. Local tests use vendor stubs and do not prove account enablement or real wallet eligibility.

An unpaid completed bank Checkout is `processing`, not paid or failed. The app suppresses another payment action, refreshes payment status, and the API refuses another checkout while processing. Only Stripe's paid result captures payment, reconciles the actual processing fee, and permits the existing completed-job settlement rules. Delayed failure closes that attempt and permits a new checkout; declined cards can still be retried inside an open Checkout. Expired and refunded attempts cannot return to processing. The `PaymentRecord.status` database field is already a string, so this status addition requires no schema migration.

Bank confirmation can take several business days. Customers with an imminent visit should use a wallet or card. The booking schedule is not automatically moved while payment is processing; ops must resolve a visit that cannot safely proceed before funds clear. Cancellation and refund requests continue through the existing support/refund-review workflow, including a bank payment that settles after cancellation. Do not treat the return URL, bank linkage, or a completed Checkout alone as proof of settled funds.

Verification: `node --import tsx --test apps/api/test/bank-payments.test.ts`, `npm run test:api`, `npm run typecheck`, `npm run i18n:validate`, `npm run build:customer-mobile`, and `npm run test:web:smoke -- tests/web/customer-payment-methods.spec.ts`.

## Service complaints and partial refunds

Customers can report missed visits, incomplete work, quality concerns, property damage, or billing problems from Help or the completed-visit refund panel. The form captures the affected area, preferred remedy, and up to two photos. Visible-quality complaints require a photo or an explanation; no-show and billing reports do not require photos. One open report per booking/problem is reused. Follow-up messages preserve the original report, and requesting human review reopens a resolved case. Damage goes to urgent human review; reporting an issue does not establish provider fault or automatically withhold unrelated earnings.

Apply `20260920130000_service_complaints` with `npm run prisma:deploy`, then regenerate the client. It adds complaint JSON to support tickets and durable refund records/cumulative amounts/full-refund recovery state to payments. Complaint photos use the existing private evidence storage and cannot be opted into public marketing. Provider/crew web capture now labels the property area and gives guidance on matching before/after angles.

Optional image assessment uses the OpenAI Responses API. Set **both** `OPENAI_API_KEY` and `SUPPORT_AI_MODEL` on the API server; use an account-accessible model supporting image inputs and structured outputs. No secret belongs in the web environment. Without both values, explicit customer consent, or a successful response, a deterministic review checklist is saved instead. Property damage and human-review requests skip AI. The model receives selected evidence, issue details, and follow-up text, with `store: false`; account names, structured addresses, financial details, and private delivery URLs are not added to the prompt. Free text and photos can still contain personal information, so the form asks customers to avoid faces and personal documents. Model outputs are internal, labeled drafts; they cannot authorize refunds, mark evidence reviewed, or change customer entitlements. This is an advisory launch integration, not a calibrated image-accuracy guarantee.

Ops can issue a **YardMatch-funded partial goodwill refund** from the support queue after reviewing evidence. The payment must be captured, the booking completed without an active dispute, and its settlement recorded. A customer complaint photo must be reviewed when present. The amount is integer cents, positive, and strictly below the remaining balance; one successful partial refund is permitted per case. Damage, unresolved full-refund reviews, and pending refunds are blocked. Provider earnings and existing transfers remain unchanged. Each successful refund appends balanced `customer-remedy-expense` / `stripe-clearing` entries; this expense is separate from the original marketplace fee settlement. Local manual payments simulate the result; this simulation is disabled in deployed environments.

Stripe delivery must include `refund.created`, `refund.updated`, and `refund.failed`, in addition to `charge.refunded` and the existing payment/dispute events. Partial refund records reserve their amount before the external call. A network failure remains `submitting`; retry the same request key and unchanged payload. Never create a different key to bypass a pending refund. `pending` is not successful. Signed events reconcile successful/failed status and record the ledger once; a partial charge event does not reverse the entire provider transfer. Uncertain submissions older than 23 hours require manual Stripe reconciliation before further attempts. This protects against blindly reusing a processor key after its retention window.

Full-refund review remains available from service complaints. If a prior partial refund exists, it refunds only the remaining payment. Pending/uncertain full refunds keep the case open and block competing partial refunds or denial. When a full refund has succeeded but provider-transfer recovery is incomplete, retry the same approval to recover the transfer. A failed full-refund attempt requires reviewing the failure, denying/closing that review, and opening a new review before a new attempt. Out-of-band Stripe refunds update the cumulative refundable balance; inspect their financial allocation separately because they do not carry a YardMatch partial-refund approval record.

Automation in this release covers intake, deduplication, evidence assessment, acknowledgments/status, refund processing, and existing support escalation. Financial decisions remain human-approved. No automatic refund allowance, provider-funded partial deduction, automatic fault finding, autonomous denial, or return-visit scheduling policy is enabled. Native apps retain their existing support flow; the new structured experience is responsive web with shared API contracts.

Verification before enabling on staging: migrate/seed an isolated database, run API and PostgreSQL regressions, run the complaint browser tests, configure test-mode refund webhooks, and exercise succeeded/pending/failed refunds plus a transfer-recovery retry. Validate photo-comparison quality on consented, human-reviewed examples before considering automated financial decisions. Live Stripe/OpenAI calls are not exercised by the local regression suite.

## Scale reliability and capacity checks

The API now queues ordinary external notifications in PostgreSQL and drains them on a one-second maintenance tick. Each process claims five jobs at a time, with a 60-second lease, at most 100 jobs or 20 seconds per sweep, and at most three attempts per job. Crashed claims become available after the lease expires; exhausted jobs remain visible in ops. Notification creation and its delivery intents commit together. Password recovery and sign-in verification retain their immediate delivery flows. Email retries carry a stable Resend idempotency key. Delivery remains at least once across a vendor-accepted/database-acknowledgement crash; SMS and push do not have a verified vendor deduplication guarantee.

Analytics exports claim batches of 500, up to 20 batches or 20 seconds per sweep, with a 30-second lease, five-second request timeout, ten attempts, and exponential retry delay. Reports aggregate the complete selected period in PostgreSQL and cache results for 15 seconds. Ops collection health shows backlog age and exhausted exports, with a warning after five minutes. Client collection returns success only after its event is persisted; admission beyond 10,000 pending events returns 503 for retry. Internal telemetry retains bounded buffering and drop accounting. Continuous new arrivals cannot indefinitely postpone acknowledgement of an already-persisted event.

Apply `20260921010000_scale_reliability` and `20260921011000_analytics_utc_defaults`, then regenerate Prisma. These add leases, query indexes, and UTC analytics defaults. Index creation may block writes on existing tables. Use a maintenance window for a populated database: drain/stop old API instances, apply migrations with `npm run prisma:deploy`, and start the updated instances. Old worker versions do not honor claims, so avoid mixing old and new workers during rollout. The schema additions are compatible with the existing data; no business history is deleted by these migrations.

Set an explicit Prisma `connection_limit` and `pool_timeout` in each server's `DATABASE_URL`. Budget the sum across every API/worker replica, leaving connections for migrations, monitoring, and administration. The local benchmark uses eight connections and 12 concurrent operations; that is a test configuration, not a production sizing prescription.

Run `TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/yardmatch_scale_test npm run test:scale` after migrating a disposable local database. The command refuses non-loopback hosts and database names without `test` or `scale`. It inserts unique synthetic rows, uses stubbed notification delivery, exercises 601 providers, 20,000 bookings, 1,000 properties, 10,000 historical analytics events, and 250 queued notifications, then removes its fixtures. It measures per-operation p95/p99, event-loop delay, memory, and database query duration. The default gate requires zero errors, all notifications drained, operation p95 below 2.5 seconds, and event-loop p99 below 500 ms. CI uses a five-second operation threshold for shared runners and archives results. Neither threshold is a customer service-level promise.

`npm run test:api:postgres` additionally checks overlapping workers, lease recovery/fencing, outbox rollback, non-UTC SQL comparisons, summary parity, and complete reporting beyond 50,000 events. The browser suite includes a 5,000-property fixture with 50-row pagination and clustered map markers. Full benchmark evidence and remaining production validation are in [the scale remediation report](reports/scale-review/2026-09-21-remediation.md).


## Public web booking journey

The public homepage selects service and area without timing. Selecting a service opens a location prompt; browser permission is requested only after “Use my location.” Manual area entry remains available. Use the seeded Brooklyn/Jersey City providers for the full local journey; no fake third recommendation is inserted where only two qualified providers exist.

Apply `20261001010000_booking_services` with `npm run prisma:deploy` and run `npm run prisma:generate` before releasing the API. The additive JSONB `Booking.services` column defaults to an empty array for existing bookings. Single-service dashboard/native and recurring flows retain their contracts. Public single-visit bundles store priced category/duration line items, sum them for the existing payment flow, and validate provider eligibility for every service. Provider/crew web work summaries include all booked services. The existing email worker delivers the durable receipt; local mode verifies the queue without sending real email.

The browser journey is `service → location → recommendations → scheduling modal → review/auth → request confirmation`. The optional directory opens from recommendations, with an OpenStreetMap service-area map, public reviews, and New York local day/time filters. Opening selection is checked again against real slots, active reservations, lead time, external calendar blocks, and combined duration. Request identifiers prevent duplicates and support recovery after a dropped response. Confirmation reloads the owned booking and offers available replacement slots subject to existing rescheduling policy. Drafts live in session storage, expire after two hours, and are tied to the signed-in customer once reviewed.

Targeted verification:

```bash
npm run typecheck
npm run i18n:validate
node --test --import tsx apps/api/test/booking-journey.test.ts
TEST_DATABASE_URL=postgresql://.../yardmatch_booking_test npm run test:api:postgres
PORT=44011 YARDMATCH_WEB_PORT=44012 YARDMATCH_NEXT_DIST_DIR=.next/booking-journey npm run test:web:smoke -- tests/web/booking-journey.spec.ts tests/web/customer-booking-golden-path.spec.ts tests/web/smoke.spec.ts
```

The optional dist directory keeps browser checks separate from a running development build. Playwright passes the chosen web port to Next. The booking browser tests capture desktop 1440×900 and mobile 390×844 evidence in `reports/agent-checkpoints/engineer/latest/booking-journey-*.png`.

## ZIP pricing setup and acceptance

Apply migration `20261001020000_provider_zip_pricing` using `npm run prisma:generate` and `npm run prisma:deploy`. It adds provider service-price storage and the ZIP/service minimum table; it inserts no pricing policy amounts. The seed remains repeatable and leaves configured policies alone.

Sign in as an ops admin, open Administration → ZIP pricing minimums, choose a ZIP and service, and save the approved amount with a reason. Provider signup and Management → Service prices then display that minimum. Native providers use Business → Work. Unconfigured pairs explicitly show that custom pricing is unavailable; existing automatic quotes continue until a policy is configured. For local fixtures only, tests create their own synthetic minimums.

Relevant APIs: public `GET /api/pricing/minimums?postalCode=08005`, provider-owned `GET/POST /api/providers/pricing`, and admin-only `GET/POST /api/ops/pricing/minimums`. POST provider pricing accepts `{ prices: [{ postalCode, category, startingPriceCents }] }` and merges the edited pairs. POST minimums accepts `{ postalCode, category, minimumStartingPriceCents, reason }`. `POST /api/quotes/instant` accepts `providerId` to obtain a provider-specific quote. Prices are positive integer cents, capped at 1,000,000 cents per starting-price entry; provider writes accept up to 100 entries per request and 1,000 stored entries per business.

Run `node --test --import tsx apps/api/test/provider-pricing.test.ts`, `npm run test:api`, `TEST_DATABASE_URL=... npm run test:api:postgres`, and `npm run test:web:smoke -- tests/web/provider-pricing.spec.ts`. Use isolated local ports and `YARDMATCH_NEXT_DIST_DIR` when another development server is running. Pricing and review screens show exact cents. API tokens are bound to provider/category/property/starting price; existing bookings and active recurring plans are never repriced by settings changes.


## Critical-path verification

See [the critical-path acceptance matrix and rollout runbook](docs/CRITICAL_PATH_ACCEPTANCE.md). Provider/ops credential review and owned availability controls are now available. Declined/withdrawn or overdue visits remain open for explicit customer recovery consent; replacements preserve the agreed price, release previous crew and require new provider confirmation. Property corrections require provider review for confirmed visits and are blocked once travel starts.
