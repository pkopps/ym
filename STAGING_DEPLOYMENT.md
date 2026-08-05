# YardMatch Staging Deployment

Phase 1 prepares one persistent test environment: the Next.js website on Vercel, the API and PostgreSQL on Render, and private evidence photos in Vercel Blob. It does not publish mobile binaries or use production payment credentials.

## Architecture

- Vercel hosts `apps/web` as a Next.js project.
- Render runs the API from the repository root using `render.yaml` and applies Prisma migrations before each deploy.
- Render Postgres is the only staging repository. The API will refuse an in-memory fallback.
- Vercel Blob stores evidence photos with `private` access. The API is the only component holding the Blob read/write token and proxies private and consented marketing images.
- Stripe must stay in test mode. Resend and Twilio can be real staging integrations, but delivery is suppressed unless the destination is explicitly allowlisted.

## 1. Create The Vercel Web Project And Blob Store

1. Import this repository into Vercel and select `apps/web` as the project Root Directory. Keep source-file access outside that directory enabled so workspace packages remain available.
2. Create a private Blob store and connect it to the web project. Copy its `BLOB_READ_WRITE_TOKEN` into the Render API secrets; do not expose it as a `NEXT_PUBLIC_*` value.
3. Set the Vercel Preview and staging/Production environment values:
   - `NEXT_PUBLIC_API_BASE_URL=https://yardmatch-staging-api.onrender.com`
   - `NEXT_PUBLIC_SITE_URL=<the canonical Vercel staging URL>`
   - `NEXT_PUBLIC_DEFAULT_SERVICE_AREA_LABEL=Barnegat, NJ`
4. Record the canonical Vercel staging URL. Render requires it as `APP_BASE_URL` and as an exact CORS origin.

Vercel creates Preview deployments from non-production branches. Use one stable staging branch or a Vercel custom environment for the shared QA site; do not point arbitrary previews at the persistent staging database unless test data isolation is acceptable.

## 2. Create The Render Blueprint

Create a Render Blueprint from the repository-root `render.yaml`. It provisions the staging API and PostgreSQL 16 in Virginia, runs configuration preflight, migration deployment, and the idempotent staging seed during the build, checks `/readyz`, and gives the process time to drain after `SIGTERM`.

Supply every `sync: false` value during initial Blueprint creation:

- `APP_BASE_URL`: exact canonical Vercel staging URL, without a trailing slash
- `API_BASE_URL`: exact public Render API URL, without a trailing slash
- `CORS_ALLOWED_ORIGINS`: the exact Vercel staging origin; optionally add a tightly scoped preview pattern such as `https://*.vercel.app`
- `BLOB_READ_WRITE_TOKEN`: private Blob read/write credential
- `STRIPE_SECRET_KEY`: `sk_test_...` or restricted `rk_test_...`
- `STRIPE_WEBHOOK_SECRET`: signing secret for the staging Render webhook endpoint
- Resend sender values: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`
- Twilio sender values: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `STAGING_NOTIFICATION_ALLOWED_EMAILS`: comma-separated QA mailboxes
- `STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS`: comma-separated QA numbers in E.164 format
- `YARDMATCH_STAGING_SEED_PASSWORD`: password-manager-generated fixture password, at least 16 characters and not derived from the product name

Add `STAGING_NOTIFICATION_ALLOWED_PUSH_TOKENS` manually when staging mobile builds register approved QA devices. If it is absent, staging push delivery is safely suppressed.

The checked-in Blueprint uses free service/database plans for the first test environment. Render's pre-deploy command and interactive shell are paid-service features, so this free Blueprint runs its fail-closed preflight, migration, and safe idempotent fixture seed in the build command. Move the migration into `preDeployCommand` when upgrading the API service. Review current platform limits before depending on the free environment for scheduled demos or sustained QA.

## 3. Seed Test Accounts Safely

The fixture seed is permanently disabled when `YARDMATCH_ENV=production`. In staging it refuses the known local password and requires a strong secret of at least 16 characters:

```bash
YARDMATCH_ENV=staging YARDMATCH_STAGING_SEED_PASSWORD='<secret-from-password-manager>' npm run prisma:seed
```

The free Blueprint runs this seed after migrations on each staging build. It is idempotent and refreshes fixture-account passwords to the configured secret. Store that value in the team's password manager and use the same value as `YARDMATCH_SMOKE_OPS_PASSWORD` when running remote browser smoke tests. The seed never prints the password.

## 4. Verify The Live Test Environment

API health and configuration:

```bash
curl https://yardmatch-staging-api.onrender.com/healthz
curl https://yardmatch-staging-api.onrender.com/readyz
```

Remote API smoke:

```bash
API_BASE_URL=https://yardmatch-staging-api.onrender.com npm run test:staging:api
```

Remote website smoke:

```bash
PLAYWRIGHT_BASE_URL=https://<vercel-staging-host> \
API_BASE_URL=https://yardmatch-staging-api.onrender.com \
YARDMATCH_SMOKE_OPS_EMAIL=ops@example.com \
YARDMATCH_SMOKE_OPS_PASSWORD='<staging-seed-secret>' \
npm run test:staging:web
```

Also verify one photo lifecycle: customer upload, provider visibility, provider after-photo upload, completed service-history pairing, consent grant, homepage display, consent revocation, and homepage removal. Blob objects must remain private even when the API exposes a consent-checked marketing URL.

## Safety Boundaries

- Never use live Stripe keys in staging.
- Never put server credentials into Vercel `NEXT_PUBLIC_*` variables.
- Keep staging notification allowlists narrow. Non-allowlisted email, SMS, and push destinations are recorded as suppressed and are not sent externally.
- Do not use fixture seeding in production.
- A failed `/readyz` response must keep a new API revision out of service.
