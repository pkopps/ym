# Engineer Checkpoint: Test Deployment And Mobile Distribution

## Branch And Commit

- Branch: `main`
- Baseline commit: `536da131c664086f449dea313197ef20f3c752e0`
- State: repository-owned deployment phases are implemented and verified in the working tree; not yet committed.

## Completed Work

- Added revision-matched hosted health/readiness checks and a protected, evidence-retaining staging acceptance workflow.
- Automated the complete private before/after photo, service-history, marketing-consent, and revocation lifecycle against staging.
- Added required API/web builds, mobile release preflight, and customer/provider/crew cross-platform export jobs to CI.
- Added fail-closed dynamic mobile configs, app-specific EAS project IDs, internal preview/simulator/store-test/production profiles, and protected preview/store-test workflows.
- Corrected iOS photo permission copy, removed unused microphone access, and separated Debug versus Release APNs entitlements.
- Aligned every Expo workspace to the SDK-supported React Native/module matrix and pinned the monorepo peer graph to one `0.83.10` runtime.
- Added mobile deployment and coordinated rollback/fix-forward runbooks.

## In-Progress Work

- External host, EAS, signing, and store provisioning.

## Remaining Work

- Provision Vercel/Blob and Render/PostgreSQL; configure GitHub protected environments and secrets.
- Archive a live revision-matched staging acceptance artifact and rehearse one coordinated rollback.
- Link three EAS projects, complete first interactive signing builds, and archive internal preview install results.
- Create Apple/Google store records and distribute staging-backed internal builds.
- Add minimum-supported-mobile-version enforcement and production media scanning/retention/deletion controls.

## Blockers

- Render MCP initialization is waiting on `RENDER_API_KEY`; Vercel MCP initialization reports that authentication is required.
- Platform accounts, vendor secrets, approved QA destinations, EAS token/project IDs, Apple/Google agreements, signing credentials, and store records are external prerequisites.

## Changed Workflows

- Required CI now proves code quality, API/web production builds, PostgreSQL behavior, browser workflows, mobile configuration, and all three platform exports before deployment.
- Hosted staging acceptance waits for one exact revision and proves API, database, private media, consent, marketplace, and internal-role behavior before recording success.
- Mobile preview and store-test builds are explicit, protected, staging-backed, app-specific actions; public production submission is absent by design.
- API/web rollback is coordinated with schema compatibility; mobile incidents use server mitigation plus fix-forward builds.

## Validation Results

- Clean `npm ci`: passed.
- Full verify: Prisma generation, ESLint 10, TypeScript, mobile config, and API tests passed; 250 tests passed and 1 PostgreSQL-only test was intentionally skipped locally.
- API and Next.js production builds: passed; 43 app routes plus `/api/healthz` generated.
- API/browser smoke: passed; Playwright 15/15.
- Hosted acceptance: deployment wait passed, private photo/consent/revocation lifecycle passed, Playwright 2/2.
- Customer/provider/crew staging exports: web, iOS, and Android passed.
- Expo dependency checks: all four workspaces current; one React Native `0.83.10` runtime resolves across the monorepo.
- Strict mobile release environment, YAML, plist/entitlements, and whitespace validation: passed.
- npm production audit: 0 critical, 10 high, 6 moderate upstream Expo/Metro/Xcode toolchain advisories; no compatible remediation is currently offered.

## Known Defects

- Live remote deployment/build/store/rollback evidence is pending external provisioning.
- No server-enforced minimum supported mobile version exists yet.
- Render free resources are test-only; media scanning/moderation/retention/deletion remain production gates.
- Expo's current toolchain retains upstream audit findings; npm's proposed Expo downgrade is incompatible with the supported SDK matrix.

## Screenshot Paths

- `photo-proof-home-desktop.png`
- `photo-proof-home-mobile.png`
- `photo-history-desktop.png`
- `photo-history-mobile-after.png`

## Recommended Next Task

Provision the protected Vercel/Render staging environment, run the hosted acceptance workflow, then link the three EAS projects and perform first interactive iOS/Android signing builds.
