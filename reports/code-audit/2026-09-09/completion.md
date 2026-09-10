# YardMatch: 15-issue repair completion

All **15 audited issues are fixed in the working tree**, with regression coverage. Baseline: `main` at `159219b663a2ac6199195f832dd364e8455a2f94`. Changes are uncommitted; pre-existing retention work was preserved. This is implementation and local verification evidence, not a production deployment or independent sign-off.

## Repairs

| Audit issue | Implemented behavior | Regression evidence |
| --- | --- | --- |
| 01 — Recovery secrets exposed | Deployed reset responses contain no code/link; codes go directly to recovery email, outside ordinary notification previews/preferences. Unknown accounts and delivery failures receive the same public envelope. | Regression 01; delivery failure test |
| 02 — Unlimited recovery attempts | Durable account/source quotas, resend cooldown, five verification attempts, and locked single-use consumption. | Regression 02; concurrent reset test; PostgreSQL cross-instance test |
| 03 — Unverified OAuth email linking | Linking and pending signup require explicitly verified email. Disabled identities cannot receive sessions. | Regression 03; existing auth-controller suite |
| 04 — Missing/unbound OAuth state | Signed expiring state requires a browser cookie, matching provider, and one-time nonce consumption. Deployed cookie is Secure, HttpOnly, host-only, and supports Apple's form-post callback. | Regression 04; binding/replay and Apple callback tests |
| 05 — Booking ownership injection | Booking input is allowlisted; customer ownership always comes from the authenticated identity. | Regression 05 |
| 06 — Customer-controlled price | Bookings validate a signed, expiring server quote bound to customer/property/address/category and price. Clients send that token; requests without a token must match a fresh server quote. | Regression 06; web booking golden path |
| 07 — Ineligible provider bookings | Booking writes check verification, category, required credentials, and service radius. Recurring generation checks current eligibility too. | Regression 07 |
| 08 — Invalid booking windows | Creation, confirmation, availability, and rescheduling reject invalid, reversed, past, or longer-than-24-hour windows. | Regression 08; workflow suite |
| 09 — Orphan recurring plans | Plan and initial booking persist atomically; deterministic request locking makes retries reuse the same first occurrence. | Regression 09; concurrent retries; PostgreSQL forced rollback |
| 10 — Calendar feeds erase each other | Refresh replaces only blocks belonging to that subscription. Provider calendar mutations serialize across API instances. | Regression 10; PostgreSQL concurrent imports |
| 11 — Calendar SSRF | Only public HTTP(S) destinations on standard ports are allowed; all DNS results are checked, connections pin a validated address, and redirects repeat validation. Requests have timeout, byte, and redirect limits. Inline feeds are local-only. | Regression 11; transport code inspection |
| 12 — Calendar timezone errors | TZID, floating values, and all-day dates use explicit timezone handling, including daylight-saving boundaries. | Regression 12; all-day DST test |
| 13 — Missing recurrence | Bounded worker expands RRULE/RDATE, EXDATE and moved occurrences; unsupported/overcomplex feeds fail visibly instead of silently losing appointments. | Regression 13; RDATE/override/DST test |
| 14 — Lost checkout sessions | Durable attempts retain all session mappings; active sessions are reused. Concurrent/transport retries use the same Stripe idempotency key. Only expired sessions create replacement attempts. | Regression 14; concurrency, timeout, expiry and PostgreSQL tests |
| 15 — Refunded payments resurrected | Refund is terminal in both repositories and capture paths. Payment processing locks by booking and deduplicates webhook event IDs. | Regression 15; repository CAS and cross-instance PostgreSQL test |

The regression suite is [apps/api/test/audit-regressions.test.ts](/Users/patrickkopps/Documents/app/apps/api/test/audit-regressions.test.ts). Its assertions describe safe behavior. The original `reproduce.mjs` remains historical evidence of the vulnerable version and is **not** the repair verification command.

Legacy workflow fixtures now explicitly provide approved synthetic providers and signed fixture prices through a test-only helper. The audit security tests use real quote generation and public application methods directly. No production validation bypass was added.

## Verification

| Check | Result |
| --- | --- |
| `npm run test:api` | 292 tests: 289 passed, 0 failed, 3 PostgreSQL tests skipped in the default run |
| `TEST_DATABASE_URL=… npm run test:postgres --workspace @yardmatch/api` | All 3 PostgreSQL tests passed separately, including two-client concurrency and rollback |
| `node --import tsx --test apps/api/test/audit-regressions.test.ts` | 24 passed, including all 15 findings and additional edge cases |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:api:smoke` | Passed |
| `npm run test:web:smoke` | 19 passed |
| `npm run build:customer-mobile` | Expo export passed for iOS, Android and web; no simulator/native-device run |
| Prisma generate | Passed |
| Additive migration deployment on initialized baseline | Passed; 36 migrations reported up to date |
| Prisma schema diff | No difference detected |
| Prisma seed, then repeat seed | Both passed after correcting stale fixture fields |
| `git diff --check` | Passed |

The final focused regression rerun followed the calendar transport type correction. The full API suite includes the final OAuth and recovery behavior. The subsequent seed-only correction was verified through actual PostgreSQL seeding. Desktop 1440×900 and mobile 390×844 booking screenshots were inspected; the recommendation and provider-confirmation flow remains intact.

Evidence is stored in this directory's `verification/` folder. Browser images are beneath [engineer/latest](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest):

- [Requested booking, desktop](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/customer-booking-requested-desktop.png)
- [Requested booking, mobile](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/customer-booking-requested-mobile.png)
- [Listings, desktop](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/customer-booking-listings-desktop.png)
- [Listings, mobile](/Users/patrickkopps/Documents/app/reports/agent-checkpoints/engineer/latest/customer-booking-listings-mobile.png)

## Operational behavior and remaining limitation

Deploy the additive `20260909010000_security_states` migration and regenerate Prisma before running this API version. It adds durable security state and checkout attempt metadata. In-memory mode remains intended for local use; shared production enforcement requires PostgreSQL.

Recovery resend cooldown is 60 seconds, email issuance is limited to five per hour, source traffic is limited to 300 per ten minutes, and each challenge accepts at most five verification attempts. Quotes expire after 30 minutes. Existing recurring plans use their stored agreed price for later occurrences while rechecking eligibility and availability. Floating/all-day calendar values default to `America/New_York`, matching the launch area. Expansion covers yesterday through the next 366 days; sub-daily recurrence and RDATE periods are explicitly rejected.

Checkout attempts unresolved for more than 23 hours fail safely for support reconciliation rather than risk creating another charge after the idempotency window. Existing production payments whose session mappings were already overwritten need operational reconciliation; this repair prevents future loss but cannot reconstruct unknown vendor records without production access.

**Separate pre-existing blocker:** a pristine database cannot replay the repository's migration history: `20260528123000_crew_staffing_chat` sorts before `20260529011124_init` and references tables that do not yet exist. Historical migrations were not renamed or rewritten. Validation used a disposable database initialized with the existing init SQL, marked that init migration applied, and then deployed the remaining history and new migration. This is a validation baseline, not a repair to the clean-install path. Resolve historical migration ordering/baselining before relying on empty-database deployment.

Seed validation also exposed missing `serviceEvidence` and `interventions` arrays in an existing booking fixture. Those were corrected and the seed was successfully rerun twice.

Live OAuth providers, recovery email delivery, real Stripe transactions, and production migration deployment were not exercised. Vendor behavior is covered with isolated test doubles. Apple's form-post callback handling follows its [official authorization documentation](https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms).
