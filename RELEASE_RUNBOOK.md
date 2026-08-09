# YardMatch Test Release And Rollback Runbook

This runbook covers the shared test website/API and mobile test binaries. It does not authorize a public production release.

## Release Preconditions

- The target commit is on `main` and all required CI jobs are green: lint/typecheck/API, production builds, PostgreSQL integration, browser smoke, and all three mobile exports.
- Hosting and mobile secrets are stored only in their platform or protected GitHub environment.
- The staging database migration is backward-compatible with the currently running API. Destructive or irreversible migrations require a separately reviewed migration plan and backup.
- The on-call owner knows the last accepted web/API revision and where its 90-day acceptance artifact is stored.

## Web And API Test Release

1. Push or merge the intended commit to the branches linked to Vercel and Render.
2. Render waits for GitHub checks because `render.yaml` uses `autoDeployTrigger: checksPass`. Vercel creates its Git-connected deployment from the configured staging branch/environment.
3. Confirm Vercel has `YARDMATCH_ENV=staging`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_SITE_URL`; confirm Render has the complete `STAGING_DEPLOYMENT.md` secret set.
4. In GitHub Actions, run `Staging acceptance` for the target commit. The workflow waits for both `/api/healthz` on web and `/healthz` plus `/readyz` on API to report that exact revision.
5. The gate then runs API smoke, the complete private-photo/consent lifecycle, and hosted browser/ops checks.
6. Review and retain `staging-acceptance-<commit>-<attempt>` before declaring the revision accepted.

An accepted artifact must contain deployment health/revision JSON, API smoke logs, a private-photo lifecycle record, browser results, and any retained Playwright traces/screenshots.

## Rollback Triggers

Rollback or stop promotion when any of these occur:

- health or readiness fails after the platform's normal startup window
- web and API revisions disagree
- authentication or role isolation regresses
- booking/payment state writes fail or duplicate
- private evidence becomes publicly addressable without current consent
- migration errors, unexpected schema drift, or material error-rate growth appear

## Web Rollback

Use Vercel Instant Rollback to point the staging domain to the last accepted deployment. Verify the exact domain list before confirming. A Vercel rollback can restore older build-time environment values and disables automatic production-domain assignment until a later deployment is explicitly promoted, so record the rollback and deliberately restore normal assignment afterward.

## API Rollback

Use Render's Deploys page to roll back to the last accepted deploy artifact. Dashboard rollback disables automatic deploys as a safeguard. Verify the service health and explicitly re-enable auto-deploys only after the underlying issue is fixed.

Do not roll the API behind a database schema it cannot understand. Render code rollback does not roll back PostgreSQL data or migrations. Prefer a forward fix when the current schema is not backward-compatible, and restore a database only from an approved backup procedure.

## Verification After Rollback

1. Run the `Staging acceptance` workflow with `expected_revision` set to the restored commit.
2. Confirm web/API revisions match and the artifact is green.
3. Confirm no synthetic acceptance provider remains publicly verified and no revoked photo appears in public trust assets.
4. Record incident reason, rollback targets, operator, timestamps, evidence artifact, and the condition required to resume automatic deployment.

## Mobile Test Rollback

Installed mobile binaries cannot be remotely downgraded safely. For an internal EAS preview, check out the last accepted commit and create a new preview build. For TestFlight or Google Play internal testing, fix forward and submit a new auto-incremented store-test build; remove the defective build from tester groups/tracks when the store permits it.

If a bad binary is unsafe against the current API, keep the API backward-compatible where possible and disable access through an explicit server-side version policy before asking testers to update. YardMatch does not yet enforce a minimum mobile version, so that remains a production-launch gate.

## Evidence Record

Every release or rollback record should include:

- environment and operator
- Git commit and previous accepted commit
- Vercel deployment URL/revision
- Render deploy/revision and database migration state
- GitHub acceptance artifact name and run URL
- mobile app/platform/profile/EAS build IDs when applicable
- start/end timestamps, outcome, defects, rollback decision, and follow-up owner
