# Engineer Checkpoint: Core Launch Workflows

## Branch And Commit

- Branch: `main`
- Baseline commit: `87724d9e1b5bd41e5c39641d9f328c6c37274658`
- State: working tree changes intentionally uncommitted

## Completed Work

- Completed provider onboarding/verification/settings and first-job confirm/decline/route/evidence/start/complete coverage.
- Completed crew fit/signup/preferences/assignment/schedule/directions/support/evidence/history/payout coverage.
- Added authenticated ops automation execution/history and expanded payout preview/manual-run visibility.
- Verified ops approval, support triage, lead creation, payout state, automation audit, and role denial.
- Fixed mobile overflow, clipped status pills, missing desktop crew directions, and invalid pseudo ICU transformations.
- Preserved and reran the recommendation-first customer booking workflow.
- Verified local Stripe test-mode hosted Checkout capture with a disposable confirmed booking and standard Stripe test card.
- Fixed hosted Checkout return URLs so Stripe receives the raw `{CHECKOUT_SESSION_ID}` macro and YardMatch can finalize the success redirect.
- Added idempotent checkout finalization when the Stripe webhook captures payment before the browser redirect returns.
- Added the authenticated crew claim handoff after public opening signup and carried the selected opening's actual service day into the signup URL.

## In-Progress Work

- None.

## Remaining Work

- Live Stripe credentials, transfer execution, and vendor callbacks require production-like accounts. Local Stripe test-mode hosted Checkout customer capture is verified.

## Blockers

- None for deterministic in-memory workflows.

## Changed Workflows

- Provider signup -> verified management -> first-job lifecycle.
- Crew recommendation -> signup -> assignment -> field work -> payout history.
- Public crew opening selection -> signup -> authenticated claim -> accepted assignment.
- Ops login -> verification/support/leads/payouts/automation with actor-stamped state.
- Spanish and pseudo routes across core workflows.
- Stripe hosted Checkout -> YardMatch success return -> captured payment confirmation.

## Validation Results

- Targeted core Playwright: 9/9 passed.
- Focused crew Playwright rerun: 1/1 passed after the selected-opening day handoff fix.
- Final `npm run test:web:smoke`: 15/15 passed in 41.1 seconds.
- `npm run typecheck`: passed.
- `npm run test:api`: 215/215 passed.
- `npm run i18n:validate`: passed, 3,438 keys.
- i18n unit tests: 4/4 passed.
- `git diff --check`: passed.
- Local Stripe hosted UI smoke: passed through hosted Checkout, webhook-first capture, YardMatch success finalization, and captured payment display. Secrets and bearer tokens were not printed.

## Known Defects

- Live payment/payout rail behavior is not verified without production-like credentials. Local Stripe test-mode hosted Checkout capture is verified.
- Next.js middleware and smooth-scroll advisories remain non-blocking.

## Screenshot Paths

- `provider-onboarding-verified-{desktop,mobile}.png`
- `provider-job-in-progress-{desktop,mobile}.png`
- `crew-assignment-accepted-{desktop,mobile}.png`
- `crew-payout-history-{desktop,mobile}.png`
- `ops-workspace-{desktop,mobile}.png`
- `i18n-spanish-ops-mobile.png`
- `i18n-pseudo-crew-{desktop,mobile}.png`
- `stripe-checkout-submit-ready.png`
- `stripe-checkout-submit-after.png`
- `stripe-ui-return-before-checkout.png`
- `stripe-ui-return-checkout-ready.png`
- `stripe-ui-return-captured-desktop.png`
- `stripe-ui-return-captured-mobile.png`

## Recommended Next Task

Implement and visually verify the payout cutover through captured customer payment, payable states, transfer failure/retry, and live arrival tracking.
