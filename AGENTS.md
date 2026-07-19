# YardMatch Agent Instructions

YardMatch is a managed marketplace for lawn and property care. Preserve the recommendation-first customer experience: customers choose service, timing, and property, then YardMatch recommends the best provider. Do not turn the customer flow into an open provider directory unless the task explicitly asks for it.

## Product Guardrails

- Keep backup provider choices limited, curated, and trust-building.
- Protect provider economics and launch reliability over raw choice volume.
- Internal ops tools must stay authenticated, role-aware, and auditable.
- Launch defaults point to Barnegat, NJ, but smoke tests can use seeded Brooklyn/Jersey City data for reliable local provider matches.
- Follow the roadmap direction in `ROADMAP.md`; keep completed behavior and local setup in `README.md` or `LOCAL_DEVELOPMENT.md`.

## Autonomous Goal Mode

When the user creates or asks for a larger YardMatch goal, work in batches instead of stopping after tiny sub-tasks. Audit the relevant docs and code, make a plan, implement across the affected surfaces, add or update tests, run verification, fix failures, and continue to the next related gap until the goal is genuinely handled.

Make conservative product and engineering decisions from this file, `ROADMAP.md`, `LOCAL_DEVELOPMENT.md`, and existing repo patterns. Prefer finishing coherent launch-readiness slices over asking for permission between obvious next steps.

Ask the user only when:

- a product decision would change the business model, customer promise, pricing posture, or marketplace philosophy
- secrets, vendor credentials, accounts, or production access are required
- destructive git/filesystem actions are needed
- the same blocker remains after real attempts and cannot be worked around safely

For launch-readiness goals, prioritize reliability and tests first, then ops/support/payment safety, customer booking-flow trust, provider verification/onboarding, and finally docs/runbook cleanup.

## Repo Map

- API monolith: `apps/api`
- Web app: `apps/web`
- Customer mobile app: `apps/customer-mobile`
- Provider mobile app: `apps/provider-mobile`
- Crew mobile app: `apps/crew-mobile`
- Shared contracts/client: `packages/contracts`
- Shared domain rules: `packages/domain`
- Brand CSS/tokens: `packages/branding`

## Local Defaults

- Web: `http://localhost:3000`
- API: `http://localhost:4001`
- API docs: `http://localhost:4001/api/docs`
- In-memory API mode is valid for frontend and smoke-test work when `DATABASE_URL` is unset.
- Postgres mode is used when `DATABASE_URL` is set; run Prisma generate, migrate, and seed first.

## Useful Commands

- Install: `npm install`
- API dev: `npm run dev:api`
- Web dev: `npm run dev:web`
- Typecheck: `npm run typecheck`
- API tests: `npm run test:api`
- API smoke: `npm run test:api:smoke`
- Web smoke: `npm run test:web:smoke`
- Full smoke: `npm run test:smoke`
- Local verification: `npm run verify:local`
- Prisma generate: `npm run prisma:generate`
- Prisma migrate: `npm run prisma:migrate`
- Prisma seed: `npm run prisma:seed`

## Verification Expectations

- Business logic/API changes need targeted API tests and `npm run test:api`.
- Auth, payments, payouts, disputes, ops, provider verification, notifications, and launch-lead changes require regression coverage.
- Prisma/repository changes need generated Prisma client, migration/diff awareness, seed validation when relevant, and API tests.
- Web UI changes need `npm run typecheck`; run `npm run test:web:smoke` or a browser screenshot pass when the surface is user-facing.
- Mobile changes should run the relevant Expo export or simulator smoke when practical.
- Report exactly what verification ran and any checks that could not run.

## UX Designer and Engineer Progress Contract

The UX Designer and Engineer must update their respective status files before completing meaningful milestones:

- UX Designer: `docs/agent-status/ux-designer.md`
- Engineer: `docs/agent-status/engineer.md`

Agent-reported completion is checkpoint evidence only; it does not equal independent verification by the Project Manager or Patrick.

For user-facing work, run the relevant app in a browser and check it at approximately:

- Desktop: 1440x900
- Mobile: 390x844

Store latest checkpoint evidence beneath:

- UX Designer: `reports/agent-checkpoints/ux-designer/latest/`
- Engineer: `reports/agent-checkpoints/engineer/latest/`

Each worker checkpoint must include:

- Branch and commit
- Completed work
- In-progress work
- Remaining work
- Blockers
- Changed workflows
- Validation results
- Known defects
- Screenshot paths
- Recommended next task

## Design Direction

YardMatch should feel calm, local, trustworthy, and operationally polished. Avoid generic SaaS or AI-looking UI. Use existing web/mobile patterns and shared brand tokens before adding new visual systems.
