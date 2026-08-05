# Engineer Checkpoint: Phase 1 Staging Deployment Foundation

## Branch And Commit

- Branch: `main`
- Baseline commit: `6632f218212fb235049683bb170a49b95216f11a`
- State: implemented and verified in the working tree; not yet committed.

## Completed Work

- Added fail-closed staging/production runtime modes with PostgreSQL, HTTPS, scoped CORS, strong JWT, private photo storage, Stripe environment separation, and real notification-provider requirements.
- Added staging email/SMS/push destination suppression outside explicit QA allowlists.
- Added liveness/readiness routes, graceful shutdown, request-body limits, and a production API start path.
- Added private Vercel Blob evidence storage, opaque YardMatch media delivery, actual image validation, consent-aware marketing delivery, immediate revocation enforcement, and storage cleanup when persistence fails.
- Added a safe staging seed requiring an environment-provided strong password and refusing production fixture seeding.
- Added Render/Vercel deployment configuration and documentation plus remote API/web smoke modes and a manual photo-lifecycle acceptance test.
- Patched launch-relevant dependencies, upgraded Next to 16.3.0, adopted `proxy.ts`, and kept all API, web, and mobile checks green.

## In-Progress Work

- None; local Phase 1 work is complete.

## Remaining Work

- Commit and push this slice.
- Provision Vercel web/private Blob and Render API/Postgres with the documented external secrets.
- Seed and smoke the live staging environment, including consent grant and revocation.
- Run Stripe's full test-mode lifecycle and add production media scanning/retention/deletion controls.

## Blockers

- Live deployment requires authenticated hosting accounts and vendor/QA secrets; no local blocker remains.

## Changed Workflows

- Deployed API startup is environment-explicit and fail-closed.
- Readiness includes a live PostgreSQL check and deploy shutdown drains active requests.
- Evidence photos move from validated upload to private Blob storage and consent-checked API delivery.
- Staging notifications are allowlist-only.
- Remote smoke tests reuse the existing suites against hosted URLs and a secret staging fixture password.

## Validation Results

- Full verify: ESLint 10 and TypeScript passed; API 250 passed, 1 expected PostgreSQL-only skip.
- API and Next.js production builds: passed; 43 web routes generated.
- API smoke: passed with health/readiness.
- Playwright web smoke: 15/15 passed.
- Customer, provider, crew, and legacy Expo web/iOS/Android exports: passed.
- Prisma Client 6.19.3 generation and staging configuration preflight: passed.
- Render YAML parse and diff whitespace check: passed.
- Dependency audit: 0 critical/high/low and 9 moderate Expo configuration-tool findings; npm offers only an incompatible Expo 46 downgrade.

## Known Defects

- Live staging and remote acceptance evidence are pending account/secrets provisioning.
- Free Render resources are for test use only and can sleep/expire.
- Media scanning, moderation, retention, and deletion automation remain production gates.
- Expo's native configuration chain retains nine moderate audit findings pending an upstream-compatible fix.

## Screenshot Paths

- `photo-proof-home-desktop.png`
- `photo-proof-home-mobile.png`
- `photo-history-desktop.png`
- `photo-history-mobile-after.png`

## Recommended Next Task

Commit/push Phase 1, provision the resources from `STAGING_DEPLOYMENT.md`, and archive live API/web/photo-lifecycle acceptance evidence before Phase 2.
