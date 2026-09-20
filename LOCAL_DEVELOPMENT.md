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
