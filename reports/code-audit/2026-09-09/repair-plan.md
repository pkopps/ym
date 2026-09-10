# YardMatch code audit and repair plan

**Historical audit:** the 15 repairs are now implemented. See the [completion report](/Users/patrickkopps/Documents/app/reports/code-audit/2026-09-09/completion.md) for current behavior and verification. Statements below describe the original audit snapshot.

Reviewed September 8, 2026 (America/New_York). Evidence directory uses September 9 UTC.

**15 confirmed issues: 1 critical (P0), 10 high (P1), 4 medium (P2).** Each has a local executable reproduction. This is a targeted audit, not an exhaustive inventory of every defect in the repository.

Reviewed the current working tree on `main`, based on commit `159219b663a2ac6199195f832dd364e8455a2f94`, including pre-existing uncommitted changes. Focus: API authentication, booking ownership and validation, recurring plans, calendar imports, checkout reconciliation, shared domain rules, and repository persistence paths. Web authentication and mobile session structure were inspected selectively; no claim of full UI/mobile coverage.

Application code and existing work were left unchanged. Audit artifacts are the only additions.

## Verification and evidence

- `npm run typecheck`: passed.
- `npm run test:api`: 267 tests; 265 passed, 0 failed, 2 skipped because `TEST_DATABASE_URL` was not configured.
- `node --import tsx --test reports/code-audit/2026-09-09/reproduce.mjs`: **15/15 reproductions confirmed**. The assertions intentionally describe the buggy behavior, so a passing audit reproduction means the defect is present. Convert them to assertions of the desired behavior when implementing fixes; do not adopt them unchanged as regression tests.
- [Reproduction source](/Users/patrickkopps/Documents/app/reports/code-audit/2026-09-09/reproduce.mjs) and [recorded results](/Users/patrickkopps/Documents/app/reports/code-audit/2026-09-09/reproduction-results.txt).
- Fixtures use disposable in-memory repositories, synthetic identities, mocked payment/OAuth providers, and blocked external network access. The reset reproduction sets `NODE_ENV=production` inside the service/controller harness; it does not start a production deployment or bypass its configuration checks in a running service.
- PostgreSQL integration, browser smoke, native builds, deployment checks, and live vendor transactions were not run. Findings are based on application behavior; actual deployed exposure was not assessed.

## Findings

### 01 — P0: Public password reset exposes a usable reset code

**Location:** [MarketplacePlatformService.ts:643](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:643).

`requestPasswordReset` returns `resetCodePreview` and `resetUrlPreview` without checking the environment. The unauthenticated controller returns these fields directly. The reproduction requests a reset in production mode and uses the returned code to change the password and receive a session for an account without 2FA. Knowing an email is sufficient; this also applies to password-backed ops accounts without 2FA. Accounts with 2FA still require their second factor to receive a session, but their password can be changed.

**Fix:** Never return reset secrets from deployed endpoints. Deliver the code or a single-use token through the account's recovery channel. The current notification contains neither the code nor the reset link, so simply removing preview fields would break legitimate recovery. Keep development previews behind an explicit local-only policy. Return the same public envelope for known and unknown emails.

**Acceptance:** Production/staging request responses contain no recovery secrets; only a token obtained from the recovery delivery can reset the password; old sessions are revoked and 2FA remains required. Cover ops invite/reset callers as well.

### 02 — P1: Password-reset issuance and verification lack abuse limits

**Location:** [MarketplacePlatformService.ts:609](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:609), [MarketplacePlatformService.ts:966](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:966).

Requests immediately replace the previous reset code, and incorrect six-digit codes do not consume an attempt budget or trigger a lock. Eight immediate issuance requests and twelve wrong attempts are accepted before the correct code still succeeds. No corresponding API rate limiter was found. This remains a defect after closing issue 01: it permits repeated recovery invalidation, delivery abuse, and online guessing.

**Fix:** Add account and source throttles, a resend cooldown, a bounded verification budget, and atomic single-use token consumption. Store enforcement state durably so multiple API instances cannot bypass it.

**Acceptance:** Excess issuance/verification requests are rejected consistently; expiry and successful consumption invalidate the token; parallel requests cannot reset twice. Do not expose account existence through differing response shapes.

### 03 — P1: OAuth account linking ignores verified-email status

**Location:** [AuthController.ts:628](/Users/patrickkopps/Documents/app/apps/api/src/controllers/AuthController.ts:628).

`SocialAuthService` supplies `emailVerified`, but `resolveSocialIdentity` does not check it before linking an OAuth subject to an existing account by email and issuing a session. A mocked provider identity with `emailVerified: false` successfully links to the fixture's password account. Exploitation depends on the identity provider returning an unverified email; the application currently treats that case as trusted proof of ownership.

**Fix:** Require explicit verified-email proof before email-based linking. Reject missing/false verification and require authentication to the existing account when ownership cannot be established. Ensure pending signup tokens cannot carry an unverified identity into the later linking path.

**Acceptance:** False/missing verification never links to an existing account; verified identities follow the intended signup/login flow; existing 2FA protections remain enforced.

### 04 — P1: OAuth callbacks accept missing state and lack browser binding

**Location:** [AuthController.ts:170](/Users/patrickkopps/Documents/app/apps/api/src/controllers/AuthController.ts:170).

State validation only runs if a state parameter exists. Without one, the callback uses a fallback state and exchanges the authorization code. A stubbed successful exchange results in a session redirect. Even supplied state contains no per-browser nonce binding or one-time consumption, leaving the login flow exposed to login CSRF/session substitution.

**Fix:** Require state, bind it to the initiating browser/app flow, validate the provider, and consume it once. Use a secure callback handoff that also works for mobile.

**Acceptance:** Missing, mismatched, expired, cross-provider, and replayed state fail before code exchange; the intended browser/app flow succeeds.

### 05 — P1: Request body can replace authenticated booking ownership

**Location:** [MarketplacePlatformService.ts:7244](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:7244).

Booking creation constructs `{ customerId, ...payload, ... }`. The body is only cast to a TypeScript interface, so an extra JSON `customerId` overwrites the authenticated ID. The reproduction exercises the actual marketplace controller with customer A's token and stores a booking owned by customer B. Earlier address/property validation still uses customer A, producing inconsistent ownership as well as unauthorized bookings attributed to B.

**Fix:** Parse an explicit allowlist of request fields and assign actor-derived ownership after client fields. Audit other actor-plus-spread constructions for the same pattern.

**Acceptance:** Injected ownership fields are rejected or ignored; bookings always belong to the authenticated customer, including recurring-plan initial bookings.

### 06 — P1: Customer-supplied price becomes the checkout amount

**Location:** [packages/domain/src/index.ts:704](/Users/patrickkopps/Documents/app/packages/domain/src/index.ts:704), [StripeCheckoutService.ts:146](/Users/patrickkopps/Documents/app/apps/api/src/services/StripeCheckoutService.ts:146).

`BookingLifecycleService` copies `payload.totalCents` into the booking without a server quote check. Checkout uses that stored value as its charge amount. A request specifying 100 cents reaches the payment gateway at 100 cents. Neither a valid quote reference nor server-side recomputation is required.

**Fix:** Persist a server-authored, expiring quote bound to customer/property/provider/service/window and pricing version, or recompute the approved price at booking. Reject tampering and enforce positive integer currency amounts plus the existing economics policy. Preserve the agreed pricing model.

**Acceptance:** Modified amounts cannot lower the charge; expired/mismatched quotes fail; web/mobile and recurring bookings share the same pricing authority.

### 07 — P1: Booking writes bypass provider eligibility

**Location:** [MarketplacePlatformService.ts:16509](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16509), [MarketplacePlatformService.ts:6858](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:6858).

The creation availability guard checks provider existence, external blocks, and lead time, but not verification, credentials, or service eligibility. Confirmation does not add those checks. A provider marked `rejected`, with no credentials or supported categories, can receive and confirm a mowing booking. Search filtering does not protect direct API requests or stale selections.

**Fix:** Centralize provider booking eligibility and enforce it on creation and confirmation, including verification, current category-specific credentials, supported service, and geographic coverage. Preserve an explicit audited ops exception only where the product already authorizes one.

**Acceptance:** Rejected/pending providers, expired credentials, unsupported categories, and out-of-area requests fail server-side; eligible providers still work through the recommendation flow.

### 08 — P2: Booking creation accepts reversed time windows

**Location:** [packages/domain/src/index.ts:690](/Users/patrickkopps/Documents/app/packages/domain/src/index.ts:690), [MarketplacePlatformService.ts:16509](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16509).

An end time two hours before the start is persisted. Creation does not centrally require finite dates, positive duration, or a future start. This corrupts scheduling/conflict calculations and creates requests providers cannot fulfill as represented.

**Fix:** Validate date syntax, start/end ordering, future-start requirements, and allowed service duration at the write boundary. Reuse the rule for recurring generation, rescheduling, and ops interventions where applicable.

**Acceptance:** Reversed, equal, malformed, and disallowed past windows produce actionable 4xx errors and create no records; valid DST-boundary windows remain correct.

### 09 — P2: Failed first booking leaves an active recurring plan

**Location:** [MarketplacePlatformService.ts:7082](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:7082).

The service saves the active plan before creating its initial booking. If that booking fails, there is no transaction or rollback. The reproduction fails the provider's minimum lead-time check and finds an active plan with zero bookings after the request has rejected.

**Fix:** Validate first, then atomically persist the plan and initial booking. Publish notifications after the transaction commits. Reconcile existing orphan plans explicitly.

**Acceptance:** Availability, validation, and repository failures leave neither an active orphan plan nor misleading notifications. Concurrent retries yield one plan/first occurrence.

### 10 — P1: Syncing one calendar deletes other calendars' blocks

**Location:** [MarketplacePlatformService.ts:16238](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16238).

The retained-block filter excludes every block whose source is `calendar-import`, rather than only blocks from the subscription being refreshed. Importing calendars A and B leaves both subscriptions configured but only B's blocked time. Subsequent refreshes make availability depend on whichever feed synced last.

**Fix:** Replace blocks only for the current subscription, retain all other sources/subscriptions, and make concurrent per-subscription refreshes merge safely.

**Acceptance:** Two feeds plus manual blocks survive refresh in either order; refreshing or deleting A does not alter B; competing refreshes do not lose blocks.

### 11 — P1: Calendar imports allow server requests to private addresses

**Location:** [MarketplacePlatformService.ts:15783](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:15783), [MarketplacePlatformService.ts:16290](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16290).

Any authenticated provider can supply an HTTP(S) feed URL. The server passes it directly to `fetch`, without checking its destination or redirects. A mocked transport proves a loopback URL reaches the fetch boundary. This is an SSRF primitive; network reachability and accessible internal endpoints determine deployment impact. No private endpoint was contacted during the audit.

**Fix:** Enforce safe schemes and destination policy; reject loopback, link-local, private and reserved destinations for IPv4/IPv6; validate DNS resolution and every redirect, with protection against rebinding. Add response size and redirect limits in addition to the existing timeout.

**Acceptance:** Tests cover private IP forms, DNS-to-private results, public-to-private redirects, oversized bodies, and legitimate calendar hosts without making real private-network requests.

### 12 — P2: Imported calendar timezone is ignored

**Location:** [MarketplacePlatformService.ts:16371](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16371).

`DTSTART;TZID=America/New_York:20260910T090000` is interpreted in the API server's local timezone. On a UTC server it becomes 09:00Z instead of 13:00Z. Busy time shifts by four hours in this example, making the actual appointment appear bookable.

**Fix:** Use an iCalendar parser with timezone support; define the provider timezone for floating times and preserve all-day semantics.

**Acceptance:** New York winter/summer offsets, DST transitions, explicit UTC, floating values, and all-day events produce consistent blocks on servers with different timezones.

### 13 — P2: Recurring external calendar events only block once

**Location:** [MarketplacePlatformService.ts:16307](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:16307).

The parser reads each VEVENT's start/end and ignores recurrence rules. A weekly event with `COUNT=3` creates one block. Ongoing client appointments disappear from conflict checks after the initial occurrence, despite a successfully imported calendar.

**Fix:** Expand supported recurrence rules over a bounded scheduling horizon, including exceptions and overridden occurrences. Fail visibly for unsupported recurrence instead of claiming a complete successful sync.

**Acceptance:** Weekly series, COUNT/UNTIL boundaries, EXDATE/RDATE, moved occurrences, and a series starting in the past produce the expected future blocks.

### 14 — P1: Repeated checkout loses tracking for the first session

**Location:** [MarketplacePlatformService.ts:12473](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:12473), [MarketplacePlatformService.ts:12482](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:12482).

Every unpaid checkout request creates another gateway session and overwrites the existing payment's session/intent identifiers. The first session is neither reused nor expired. The reproduction starts checkout twice and delivers the first session's completion event; it is acknowledged without finding a payment, while the current payment remains pending. Multiple payable sessions also expose the customer to duplicate charges.

**Fix:** Introduce durable checkout attempts and stable idempotency keys. Reuse an active session or safely expire it before replacement; retain identifiers for every attempt. Atomically enforce one successful payment per booking and reconcile late events from prior attempts.

**Acceptance:** Double clicks, parallel requests, gateway retries/timeouts, old-session completion, and replacement-session failure retain complete payment history and cannot silently lose successful payments.

### 15 — P1: Delayed completion events resurrect refunded payments

**Location:** [MarketplacePlatformService.ts:23295](/Users/patrickkopps/Documents/app/apps/api/src/services/MarketplacePlatformService.ts:23295).

`capturePaymentRecord` returns early only for an already captured payment. A refunded payment is updated to captured and refundable if a checkout completion event arrives later. The reproduction processes a refund and then a delayed completion: payment becomes `captured` while booking remains `refunded`, and payment-received notifications are emitted.

**Fix:** Enforce legal monotonic payment transitions, retain processed event IDs, and reconcile current processor state when an event conflicts with a terminal state. Do not reverse financial outcomes merely because an older event arrives later.

**Acceptance:** Duplicate and out-of-order completion/refund/failure/dispute events preserve the correct final payment, booking, settlement, transfer, and notification state.

## Implementation sequence

| Batch | Issues | Work and completion gate |
| --- | --- | --- |
| 1. Recovery containment | 01, 02 | Close reset-secret exposure and implement actual private delivery together; add durable throttling and atomic consumption. Verify production-shaped responses, 2FA, ops recovery, and web/mobile recovery flows. |
| 2. Identity and booking authorization | 03, 04, 05, 07 | Require verified ownership in OAuth, bind callback state, parse booking payloads explicitly, and enforce provider eligibility on writes. Add negative authorization/controller tests before implementation. |
| 3. Price and payment integrity | 06, 14, 15 | Bind bookings to server-authored prices; model durable checkout attempts and legal event transitions. Add PostgreSQL constraints/transactions where needed and test parallel requests plus out-of-order events. |
| 4. Calendar safety | 11, 10, 12, 13 | Close SSRF first. Preserve per-feed blocks, then replace the limited date/recurrence parser. Test all feeds together and refresh concurrently. Re-sync affected feeds after deploying the repair. |
| 5. Scheduling consistency | 08, 09 | Share booking-window validation and make initial recurring-plan creation atomic. Audit orphan plans and invalid windows with a read-only report before choosing corrections. |

The calendar SSRF fix can ship independently as soon as it is verified; it should not wait for the full parser rewrite. These batches preserve the recommendation-first marketplace and the existing pricing/business model.

For each batch:

1. Convert the relevant audit reproduction to a regression test expecting correct behavior; add adjacent boundary/concurrency cases specified above.
2. Implement one coherent repair, including API contracts and web/mobile callers when the contract changes.
3. Run targeted tests, then `npm run test:api` and `npm run typecheck`.
4. For persistence changes, generate Prisma, inspect migrations/schema diff, validate seeds where relevant, and run the PostgreSQL integration gate against an isolated database.
5. For changed user workflows, run browser smoke and inspect desktop 1440×900/mobile 390×844. Run relevant mobile export/smoke for changed mobile clients.
6. Update the engineer milestone/status and checkpoint evidence, then independently verify the batch. Passing pre-existing tests alone is insufficient: all applicable new regression assertions must pass.

Before release, reconcile potentially affected data with read-only queries: anomalous booking prices/ownership, rejected-provider bookings, orphan recurring plans, checkout attempts missing local matches, contradictory refunded/captured records, and incomplete calendar blocks. Do not automatically rewrite financial records or ownership based only on heuristics. If this code is already deployed, separately assess reset-endpoint exposure and session recovery needs using available operational evidence.
