# YardMatch Local Development

This is the practical runbook for getting YardMatch running locally and for giving agents a stable baseline.

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
npm run prisma:migrate
npm run prisma:seed
```

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

## Production Startup Safety

Local development intentionally permits the in-memory repository and development auth defaults. `NODE_ENV=production` is fail-closed: the API exits before opening a listening socket when PostgreSQL, strong JWT configuration, HTTPS public URLs, live-shaped Stripe/webhook credentials, or production-shaped Resend/Twilio sender configuration is absent or malformed.

The production configuration tests include a child-process startup check, so this boundary is exercised through the real API entry point rather than only as a helper-function unit test.

Before a staging or production deployment, run `NODE_ENV=production npm run verify:production-config` with that environment's real secrets injected. The command returns only the readiness status and selected repository mode; it never prints credential values. It fails when `NODE_ENV` is not production so a development fallback cannot be mistaken for a passing deployment preflight.

## Stripe Connect Payout Lifecycle

With `STRIPE_SECRET_KEY` configured, providers can inspect their recipient state at `GET /api/providers/connect/status` and start or resume Accounts v2 onboarding at `POST /api/providers/connect/onboarding`. The requested account uses Express dashboard access, application-owned fees and losses, and a recipient-only transfer configuration. Starting onboarding is a payout-account-sensitive action and requires a fresh provider session.

Ops payout previews become `stripe-transfer` batches only after the completed booking, captured Stripe charge, actual processing fee, immutable settlement, hold period, provider credentials, and both recipient transfer and payout capabilities pass. A fresh `ops-admin` session must create the run and explicitly execute it through `POST /api/payouts/ops/disbursement-runs/execute` with the exact confirmation value `execute-provider-transfers` and an audit note. Crew members are never transfer recipients.

Transfers use the original Stripe charge as `source_transaction`. Refund and dispute webhooks reverse any released provider transfer with stable idempotency keys, append balanced reversal ledger entries, and keep Stripe transfer/reversal ids in ops history. Without Stripe credentials, local development intentionally exposes manual preview records but cannot execute money movement.

## Smoke-Test Notes

The launch default remains Barnegat, NJ, but local smoke tests use Brooklyn, NY because the in-memory provider dataset has verified providers there with available route windows. That keeps smoke tests deterministic without requiring production seed data.
