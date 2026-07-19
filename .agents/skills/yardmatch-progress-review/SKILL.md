---
name: yardmatch-progress-review
description: Review YardMatch UX and engineering progress across Git branches or worktrees, run the application, capture browser screenshots, and produce an evidence-backed project-management report without implementing changes.
---

# YardMatch Progress Review

Use this skill when acting as the YardMatch Project Manager. The goal is to review progress, gather evidence, produce a dated report, and assign next work. Do not implement fixes.

## Hard Boundary

Only write generated review artifacts under `reports/progress/`. Do not edit application source, tests, package files, roadmap docs, status templates, checkpoints, or configuration while performing a review.

Never merge, rebase, reset, delete, cherry-pick, discard uncommitted changes, rewrite history, or upgrade dependencies. If a review requires permissions, credentials, dependency installation, or production access, report `UNABLE TO VERIFY`.

## Repository Context To Read First

Read these files before reviewing work:

- `AGENTS.md`
- `README.md`
- `ROADMAP.md`
- `LOCAL_DEVELOPMENT.md`
- `package.json`
- `playwright.config.ts`
- `docs/agent-status/ux-designer.md`
- `docs/agent-status/engineer.md`

YardMatch is a recommendation-first managed marketplace. Reviews should protect the product direction: customers choose service, timing, and property, then YardMatch recommends the best provider, with only limited curated alternatives.

## Discovered Commands

Use the root workspace commands that exist in this repository:

- API dev server: `npm run dev:api`
- Web dev server: `npm run dev:web`
- Customer mobile dev server: `npm run dev:customer-mobile`
- Provider mobile dev server: `npm run dev:provider-mobile`
- Crew mobile dev server: `npm run dev:crew-mobile`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- API tests: `npm run test:api`
- API smoke: `npm run test:api:smoke`
- Web smoke: `npm run test:web:smoke`
- Full smoke: `npm run test:smoke`
- Local verification: `npm run verify:local`
- Web build: `npm run build:web`
- API build: `npm run build:api`
- Mobile exports: `npm run build:customer-mobile`, `npm run build:provider-mobile`, `npm run build:crew-mobile`

Playwright is already configured at `playwright.config.ts` and the web smoke suite lives in `tests/web`. Reuse this setup. Do not add a second Playwright configuration or create screenshot-only tests for the review.

If Playwright browser binaries are unavailable, do not install them without permission. Report the browser review as `UNABLE TO VERIFY` and state the likely command: `npx playwright install chromium`.

## Review Workflow

1. Create a review directory named `reports/progress/YYYY-MM-DD-HHMM/`.
2. Inspect `git worktree list`, `git status --short`, `git branch --all --verbose`, and recent commits.
3. Identify the base branch. Prefer the branch named in the worker status files or the local `main` branch when no other base is specified. Do not fetch, switch branches, or mutate worktrees unless Patrick explicitly asks.
4. Read both worker status files. Treat them as reported evidence, not proof of completion.
5. For each relevant branch or worktree, inspect status and compare against the base with non-mutating commands such as `git diff --stat base...HEAD`, `git diff --name-only base...HEAD`, and focused `git diff base...HEAD -- path`.
6. Map changed files to affected routes, workflows, API behavior, mobile surfaces, and tests.
7. Run the smallest useful automated checks for the changed work. Prefer `npm run typecheck`, `npm run test:api`, and `npm run test:web:smoke` for broad web/API review. Add `npm run lint`, builds, API smoke, or mobile exports when the changed surface warrants it.
8. Start YardMatch with the documented commands when browser review is needed: `npm run dev:api` and `npm run dev:web`. The web smoke command can also manage both servers through Playwright.
9. Inspect each materially changed user-facing route in a real browser at approximately 1440x900 and 390x844.
10. Exercise the primary interaction for each changed workflow, including selected, empty, loading, error, and confirmation states when applicable.
11. Check browser console errors and runtime failures.
12. Capture only useful screenshots. Use descriptive names such as `desktop-customer-listings-recommendation.png` or `mobile-provider-payments-error-state.png`.
13. Save screenshots and the final report inside the same dated `reports/progress/YYYY-MM-DD-HHMM/` directory.
14. Embed each important screenshot directly in `review.md` with Markdown image syntax using the absolute local filesystem path to the screenshot. Codex Desktop requires absolute image paths to render local files, so use syntax such as `![Desktop listings recommendation](/Users/patrickkopps/Documents/app/reports/progress/YYYY-MM-DD-HHMM/desktop-customer-listings-recommendation.png)`. Do not add long standalone screenshot path bullets before the images.

## Verification Labels

Use these labels exactly:

- `VERIFIED IN BROWSER`
- `VERIFIED BY AUTOMATED CHECK`
- `VERIFIED FROM DIFF`
- `REPORTED BY AGENT — NOT INDEPENDENTLY VERIFIED`
- `UNABLE TO VERIFY`

Use `REPORTED BY AGENT — NOT INDEPENDENTLY VERIFIED` only for claims taken from worker status docs or messages that you did not confirm yourself. Use `UNABLE TO VERIFY` for blocked checks, unavailable browser tooling, missing credentials, failed startup, missing branches, or any evidence you could not gather.

## Product-Quality Review Standard

Evaluate whether:

- The purpose of each screen is obvious from context and navigation.
- Pages avoid massive explanatory titles.
- Cards use only slightly rounded corners.
- Layouts feel intentionally designed rather than AI-generated.
- Text resembles realistic production marketplace content.
- Elements, sections, and containers follow a logical structure.
- Each screen has one clear purpose.
- Primary actions are obvious.
- Information appears only when useful.
- Navigation is predictable.
- Desktop and mobile layouts maintain proper hierarchy.
- Search, matching, provider profiles, pricing, and booking form a coherent flow.
- Components follow the existing design system and brand tokens.
- Empty, loading, error, selected, and confirmation states work where applicable.
- YardMatch feels calm, polished, uncluttered, and credible.

## Required Report

Write `reports/progress/YYYY-MM-DD-HHMM/review.md` with this structure:

# YardMatch Progress Review

## Executive summary

Assign Green, Yellow, or Red status to:

- UX design
- Engineering
- Integrated product quality

## What changed

Explain meaningful completed work in product language, not merely filenames.

## Screenshot walkthrough

For each important screenshot, include:

- Embedded image with an absolute local filesystem path, for example `![Desktop homepage](/Users/patrickkopps/Documents/app/reports/progress/YYYY-MM-DD-HHMM/desktop-home.png)`
- Route or workflow
- Agent or branch responsible
- Commit reviewed
- What changed
- What works well
- What requires adjustment
- Verification label

## UX and product findings

Rank findings as:

- Blocking
- High priority
- Medium priority
- Polish

## Engineering findings

Include:

- Functional defects
- Runtime or console errors
- Regressions
- Test/build results
- Incomplete implementations
- Integration issues

## Decisions Patrick needs to make

Include only decisions that truly require product-owner input.

## Recommended next assignments

Create separate, copy-paste-ready assignments for:

- UX Designer
- Engineer

## Verification gaps

Clearly state everything that could not be independently verified.
