# Analytics and launch-readiness implementation

Authorized September 19, 2026: implement the full recommended analytics, customer journey, payout clarity, workspaces, operations, release-readiness, and backlog cleanup scope. Preserve recommendation-first booking, server quote validation, provider economics, access controls, and approved disclosures.

## Work queue

- [x] Durable, validated analytics ingestion with identity, deduplication, retention, and optional PostHog delivery.
- [x] Web navigation/actions and mobile screen/actions; privacy controls and environment separation.
- [x] Authenticated funnel, drop-off, source/area/device/language, supply activation, and economics reporting with measurement-health indicators.
- [x] Booking/signup continuity, compact progress and request summary, contextual no-coverage inquiry.
- [x] Honest provider payout readiness and actionable empty states.
- [x] Task-focused provider, crew, and ops navigation/workspaces.
- [x] Scheduled operations and overdue-run health probe. Live independent monitor and delivered-alert verification remain blocked on account configuration.
- [x] Minimum supported mobile versions and recoverable release controls; physical-device/store rollout remains external.
- [x] Local backup/restore rehearsal, audited privacy intake, and photo review inventory. Irreversible erasure/vendor fulfillment remains policy-gated.
- [x] Reconciled roadmap/checklist and documented superseded UX observations; CodeRabbit configuration exists, but actual activation/review remains unverified.
- [x] Local regression suites, browser checks at 1440x900 and 390x844, production builds, and all three mobile exports. All six [remote CI jobs passed](https://github.com/pkopps/ym/actions/runs/35480194207) on `2514cf8`; actual CodeRabbit review is still unverified.

## External activation dependencies

Verify available account access before activation: PostHog project, staging Vercel/Render/Postgres/private media, Stripe test credentials and provider accounts, approved sender identities, EAS/app-store accounts, CodeRabbit GitHub installation. Never record secrets in this file. Real deployment, payment, delivery, restore, store distribution, and legal approval evidence must remain explicitly pending until actually obtained.

## Baseline

`main` at `63202bc`; feature branch `codex/analytics-launch-readiness`. Previous CI and consolidation evidence: PR #3. Existing analytics uses a per-process 10,000-event buffer; web emits presence heartbeats but no route views; client events accept arbitrary payloads; mobile actor labels are shared constants. Existing UX plan contains unfinished customer journey/workspace items.


## UX reconciliation

Engineering implements the selected UX-03–06, UX-07–09, and UX-14 direction from the September 10 plan. That report describes the old state; keep it as historical audit evidence. Expanded workspace sections preserve existing tools and controls. Full golden-path, provider/crew lifecycle, ops action, Spanish/pseudo, and viewport checks cover the changed workflows. Independent UX acceptance is still separate from this engineering checkpoint; other UX-plan issues are not silently marked complete.

## CI evidence correction

Reviewed artifact `postgres-launch-gate-3c35343bfb7078059be94eae67093608fee2f50e` from run `35386638892`: migration failure, non-empty schema diff, and three failed integration tests despite the green job. Do not use that run as database launch approval. Empty-database bootstrap and explicit Bash/pipefail are now fixed and verified locally; corrected remote evidence now replaces the old badge: [run 35480045314](https://github.com/pkopps/ym/actions/runs/35480045314), PostgreSQL job passed, artifact downloaded and all four logs reviewed (migrations current, no drift, five tests passed).
