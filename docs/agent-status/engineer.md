# Engineer Status

Agent-reported completion is checkpoint evidence only. It does not equal independent verification by the Project Manager or Patrick.

## Current Goal

Finish the repository-owned test-deployment roadmap after Phase 1: revision-matched hosted acceptance, customer/provider/crew mobile test distribution, CI release gates, and rollback documentation. Isolate the remaining work to external provisioning, credentials, store accounts, and live evidence.

## Agent Role

Engineer

## Branch And Commit

- Branch: `main`
- Baseline commit: `536da131c664086f449dea313197ef20f3c752e0` (`feat: prepare phase one staging deployment`)
- State: remaining deployment phases are implemented and verified in the working tree; not yet committed.

## Last Updated

2026-08-09 EDT

## Completed Since Previous Checkpoint

- Added a fail-closed web `/api/healthz` route and a hosted deployment waiter that rejects insecure URLs, web/API origin mixups, non-staging or non-PostgreSQL targets, and revision drift before acceptance begins.
- Added an automated staging photo lifecycle that creates isolated synthetic users and a booking, proves customer-private before-photo access, provider before/after capture, customer service-history pairing, explicit marketing consent, privacy-safe public delivery, and immediate revocation.
- Added a protected GitHub `staging` workflow that waits for the exact web/API revision, runs API, photo, ops-role, and browser acceptance, and retains secret-safe evidence for 90 days.
- Expanded required CI to build API/web, verify mobile release configuration, export customer/provider/crew web/iOS/Android bundles, and retain per-app export metadata.
- Added dynamic customer/provider/crew app configuration, distinct EAS project IDs, fail-closed staging/production API URLs, internal preview and simulator profiles, store-test and production profiles, and separate staging display names.
- Added protected manual GitHub workflows for Expo internal previews and store-test builds. Android store tests remain draft on the internal track; iOS builds can process into TestFlight; no workflow enables a public production release.
- Corrected native iOS evidence-photo permission declarations, removed unused microphone permission requests, and made APNs entitlements resolve to development for Debug and production for Release.
- Aligned all Expo workspaces and the monorepo peer graph to React Native `0.83.10` plus SDK-supported module patches. `npm ci` now reproduces one React Native runtime across every Expo package.
- Made Prisma Client generation an explicit prerequisite of `npm run verify`, preventing clean-checkout lint failures caused by missing generated types.
- Added `MOBILE_DEPLOYMENT.md` and `RELEASE_RUNBOOK.md`, including first interactive credential setup, protected-environment configuration, acceptance evidence, coordinated Vercel/Render rollback, database compatibility, and mobile fix-forward guidance.

## Currently In Progress

- External resource provisioning and live evidence collection are ready to begin but require authenticated platform accounts and credentials.

## Remaining Work

- Provision the Vercel web/private Blob and Render API/PostgreSQL resources and configure the protected GitHub `staging` environment.
- Run the safe seed plus revision-matched hosted acceptance and archive the first `staging-acceptance-<commit>-<attempt>` artifact.
- Create/link three EAS projects, configure EAS preview/production variables, and complete the first interactive iOS/Android signing build for each app.
- Create App Store Connect and Google Play records, complete agreements/metadata, configure submission credentials, and distribute staging-backed builds through internal TestFlight/Google Play testing.
- Rehearse one coordinated staging rollback and record the accepted Vercel/Render revisions, database migration state, acceptance artifact, and mobile build IDs.
- Add a server-side minimum-supported-mobile-version policy before production; finish production media scanning, moderation, retention, and deletion automation.

## Blockers

- The installed Render connector cannot initialize until `RENDER_API_KEY` is available, and the installed Vercel connector currently reports that authentication is required.
- Live staging requires Vercel, Render, Blob, Stripe test, Resend, Twilio, and approved QA-destination secrets.
- Cloud mobile builds require an Expo access token, three EAS project IDs, and one interactive signing setup per app/platform.
- Store testing requires Apple Developer/App Store Connect and Google Play Console access, completed agreements, app records, and submission credentials.

## Routes Or Workflows Changed

- Git push -> required CI builds/tests/exports -> Git-connected Vercel/Render deploy -> protected revision-matched staging acceptance -> retained evidence.
- Hosted acceptance -> API/web health and revision -> API smoke -> private before/after lifecycle and consent revocation -> recommendation-first homepage and ops role gate.
- Mobile config -> explicit YardMatch environment and HTTPS API -> app-specific EAS project -> internal preview or store-test build -> protected manual workflow.
- iOS signing -> Debug APNs development entitlement -> Release APNs production entitlement; camera/photo permissions remain explicit and microphone access is not requested.
- Failed mobile binary -> server/API mitigation and compatible fix-forward build; web/API rollback does not pretend to downgrade an installed mobile binary.

## Validation Results

- `npm ci`: passed from the lockfile.
- `npm run verify`: passed Prisma generation, zero-warning ESLint 10, TypeScript, mobile release validation, and 251 API tests (250 passed, 1 expected PostgreSQL-only skip).
- `npm run build:api`: passed.
- `npm run build:web`: passed on Next.js 16.3.0; 43 application routes plus `/api/healthz` were generated.
- `npm run test:smoke`: API smoke passed and Playwright web smoke passed 15/15.
- Local hosted staging checks: deployment wait passed, full private-photo/consent/revocation lifecycle passed, and hosted Playwright acceptance passed 2/2.
- Customer, provider, and crew Expo exports: web, iOS, and Android passed with staging configuration after the final dependency alignment.
- `npx expo install --check`: passed for legacy, customer, provider, and crew workspaces.
- Strict mobile environment preflight with HTTPS staging URL and UUID-shaped project IDs: passed.
- GitHub workflow/Render YAML parsing and all changed iOS plist/entitlement validation: passed.
- Production dependency audit: 0 critical, 10 high, and 6 moderate advisories remain in the Expo/Metro/Xcode build chain. npm offers an incompatible Expo SDK downgrade; no breaking forced fix was applied.

## Screenshot Paths

- `reports/agent-checkpoints/engineer/latest/photo-proof-home-desktop.png`
- `reports/agent-checkpoints/engineer/latest/photo-proof-home-mobile.png`
- `reports/agent-checkpoints/engineer/latest/photo-history-desktop.png`
- `reports/agent-checkpoints/engineer/latest/photo-history-mobile-after.png`

## Known Defects

- This task could not provision the live hosts: the Render MCP is missing `RENDER_API_KEY`, and the Vercel MCP requires authentication.
- No live Vercel/Render deployment, EAS build, store-test artifact, or rollback rehearsal evidence exists until external resources and credentials are configured.
- Mobile binaries do not yet have a server-enforced minimum supported version.
- Render free resources can sleep/expire and are suitable only for the first test environment.
- Media validation and private storage are implemented, but malware scanning, moderation, retention, and deletion automation remain production gates.
- Expo SDK 55's current Metro/Xcode toolchain retains upstream npm advisories without a compatible audit remediation. The affected chain is used to build apps; the unsafe proposed SDK downgrade was rejected.

## Recommended Next Task

Provision Vercel/Render and the protected `staging` environment from `STAGING_DEPLOYMENT.md`, run the hosted acceptance workflow, then link the three EAS projects and perform the first interactive signing builds from `MOBILE_DEPLOYMENT.md`.
