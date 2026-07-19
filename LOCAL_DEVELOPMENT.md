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

## Smoke-Test Notes

The launch default remains Barnegat, NJ, but local smoke tests use Brooklyn, NY because the in-memory provider dataset has verified providers there with available route windows. That keeps smoke tests deterministic without requiring production seed data.
