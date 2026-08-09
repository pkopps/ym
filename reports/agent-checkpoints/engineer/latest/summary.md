# Engineer Checkpoint: Timeout Resilience And Recovery Messages

## Branch And Commit

- Branch: `codex/account-security`
- Baseline commit: `ecadb4eba37ebd0ce53bf040e3a7cc62d4ea81c2`
- State: implemented and verified on top of the account-security baseline.

## Completed Work

- Added abortable 30-second shared API deadlines across web and all three mobile apps, plus 10-second place-search deadlines.
- Added visible English/Spanish retry guidance to public, signup, and saved-property address searches.
- Added 5-15 second deadlines to Google, OAuth, notification, calendar, Blob, and inbound-relay calls.
- Set Stripe requests to 10 seconds with one retry and mapped timeout failures to workflow-specific HTTP 504 guidance.
- Added a 12-second provider GPS-fix deadline with an estimated-route fallback message.
- Added deterministic API and Playwright regressions for stalled calls and user-visible timeout recovery.

## In-Progress Work

- Repository work is complete. Live vendor and physical-device acceptance remain external follow-up.

## Remaining Work

- Fault-inject configured staging vendors and confirm production error payloads and retry behavior.
- Exercise provider GPS timeout/recovery on a physical device.
- Revisit deadline values only with measured production latency data.

## Blockers

- Live acceptance requires vendor credentials, approved destinations, and a physical provider device.

## Changed Workflows

- Web/mobile API request -> bounded wait -> abort -> retry guidance -> loading state clears.
- Address lookup -> fast Google deadline -> local YardMatch fallback or visible manual-entry guidance.
- External vendor call -> bounded provider attempt -> retryable record, stored calendar health, OAuth redirect error, relay 504, or user-facing API 504.
- Provider live route -> bounded initial GPS fix -> estimated timing plus location-services guidance.

## Validation Results

- Full local verification passed: Prisma generation, lint, typecheck, mobile release configuration, API tests, API smoke, and web smoke.
- Timeout regressions: 5/5 passed.
- API suite: 261 tests, 259 passed, 2 expected PostgreSQL-only skips, 0 failed.
- TypeScript and zero-warning ESLint passed.
- Locale validation passed 3,581 English/Spanish/pseudo keys.
- Playwright web smoke: 17/17 passed, including stalled search recovery.
- Customer/provider/crew Expo exports passed for web, iOS, and Android.
- Desktop 1440x900 and mobile 390x844 screenshots show the timeout message without horizontal overflow.

## Known Defects

- Real vendor timeouts remain unverified without staging credentials.
- Physical-device degraded-GPS acceptance remains outstanding.

## Screenshot Paths

- `timeout-search-desktop.png`
- `timeout-search-mobile.png`

## Recommended Next Task

Run staging vendor fault injection and a physical-device GPS degradation check before tuning any deadline.
