# YardMatch

YardMatch is a triple marketplace for homeowners and property managers who need lawn care, landscaping businesses that run customer-facing operations, and crew members who can join those businesses without running their own company.

Scale safeguards include database-backed notification/export claims, asynchronous bounded password work, scoped search and provider queries, property summaries, and clustered client maps. Run the repeatable mixed-workload gate with `npm run test:scale`; see [setup, worker limits, and rollout guidance](LOCAL_DEVELOPMENT.md#scale-reliability-and-capacity-checks) and [measured results](reports/scale-review/2026-09-21-remediation.md).

## Public web booking

Choose a service on the homepage, then use device location or enter an area. Search presents up to three eligible providers vertically, with the first highlighted and factual trust hints. “View more providers” opens the paginated directory with day/time filters and an approximate service-area map. Only actual qualified matches and available openings are shown; areas with fewer than three matches show the available supply.

An opening launches the scheduling dialog: switch or add services offered by that provider, choose a day/time of day, confirm the service address, and answer any property questions needed for a price. The full review page displays each service and the total. Guests sign in or create an account here; the draft survives that handoff and refreshes for two hours in the same tab. Confirmation creates one request, queues an email receipt, and offers real rescheduling. Providers confirm before payment. Interrupted responses recover by request identifier without creating a second booking.

Apply the booking-services migration before deploying this API; see [local verification and rollout](LOCAL_DEVELOPMENT.md#public-web-booking-journey).

## Stack choice

- `React Native + Expo` powers three separate mobile apps: one for customers, one for landscaping business owners, and one for crew members.
- `Next.js` powers mobile web and desktop web so marketing and marketplace pages can stay SEO friendly.
- `A single TypeScript API app` acts as the monolith and exposes one shared contract layer used by every client.
- `Shared packages` centralize branding, domain logic, API contracts, UI copy, and analytics logging.

This keeps the codebase maintainable while still leaving room to add native Swift/Kotlin modules later only when a platform-specific requirement proves necessary.

## Monorepo layout

```text
apps/
  api/      monolith API
  customer-mobile Expo React Native app for customers
  provider-mobile Expo React Native app for landscaping business owners
  crew-mobile     Expo React Native app for crew members
  web/      Next.js web app for SEO, desktop, and mobile web
packages/
  analytics shared analytics/data engineering event logging
  branding  shared CSS variables and token mirrors
  contracts shared API types and client
  domain    reusable marketplace/business logic
  help-center shared customer/provider/crew-member documentation content
  observability shared telemetry events, env config, and heartbeat helpers
  ui        shared content models and display copy
```

## Central branding

The canonical brand stylesheet lives at `packages/branding/src/brand.css`.

- Web imports the CSS directly.
- Mobile uses the mirrored TypeScript tokens from `packages/branding/src/tokens.ts`.

## API docs

- Built-in docs UI: `GET /api/docs`
- Machine-readable spec: `GET /api/docs/openapi.json`
- The docs page is served directly by the monolith so other developers can inspect routes and example payloads without extra tooling.

## Local development

- Canonical local web URL: `http://localhost:3000`
- Canonical local API URL: `http://localhost:4001`
- Practical local setup and smoke-test runbook: [LOCAL_DEVELOPMENT.md](/Users/patrickkopps/Documents/app/LOCAL_DEVELOPMENT.md)
- Agent/project working rules: [AGENTS.md](/Users/patrickkopps/Documents/app/AGENTS.md)

## Product roadmap

- Active roadmap and backlog: [ROADMAP.md](/Users/patrickkopps/Documents/app/ROADMAP.md)
- Cost sheet and future P&L starter: [COSTS.md](/Users/patrickkopps/Documents/app/COSTS.md)

## Customer referrals

Signed-in customers can use **Account → Refer a friend** at `/customer/referrals`, or the **Refer a friend** section of Account in the customer mobile app. The English/Spanish form saves a friend's name, email or US phone number, optional town, and explicit permission to share contact details for YardMatch follow-up. It then prepares an email or text in the customer's own messaging app, with selectable invitation text as a fallback. Saving a referral or opening a composer does not mark a message sent; YardMatch does not automatically deliver invitations or issue rewards.

`GET/POST /api/customer/referrals` derive ownership from the authenticated customer. PostgreSQL stores referral ownership, normalized contact, consent version/time, and a linked ops launch lead atomically. Retries return the same referral; concurrent requests enforce a maximum of ten new contacts per rolling 24 hours. Customer history shows the latest 100 owned referrals and coarse follow-up/booking progress, excluding ops notes and booking/payment details. Ops sees the referrer and permission evidence in the existing lead queue. Matching email or canonically normalized US phone links subsequent customer bookings through the existing attribution flow; unrelated customers cannot attach a referral by supplying its internal lead ID.

Deploy migration `20260928010000_customer_referrals` before releasing the API. Referral rewards, provider referral incentives, automatic invitation delivery, and proof of message delivery remain future work. Referral and linked lead records must be included when ops reviews data-access/deletion requests under the existing manual privacy workflow; deleting a referrer account cascades its referral rows, while the separate ops lead remains subject to that workflow.

## Backend hardening status

- Local email/password auth is now wired with bearer-token sessions through:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Password-backed customer, provider, crew, and ops accounts can now opt into two-factor authentication with either email or text-message codes. The shared account security center is available at `/account/security`, and the three mobile apps expose the same controls from their Security support section.
- Two-factor and device-security routes now include:
  - `GET /api/auth/security`
  - `POST /api/auth/security/two-factor/setup`
  - `POST /api/auth/security/two-factor/confirm`
  - `POST /api/auth/security/two-factor/disable`
  - `POST /api/auth/two-factor/verify`
  - `POST /api/auth/two-factor/resend`
  - `POST /api/auth/security/devices/revoke`
  - `POST /api/auth/security/sessions/revoke`
- Security codes expire after 10 minutes, resend requests are throttled, and five failed password or login-code attempts temporarily lock the account. Remembered devices use hashed per-install identifiers and expire after 30 days.
- New-device sign-ins create an in-app security event and force an email warning even when ordinary account-email notifications are disabled. Users can inspect recent security activity, remove individual remembered devices, or revoke every session and remembered device.
- Social-only accounts cannot enable YardMatch two-factor authentication yet; accounts with a linked social provider and a password must use email/password when YardMatch two-factor authentication is enabled so the second step cannot be bypassed.
- Google and Apple social auth now use real OAuth start/callback flows plus:
  - `POST /api/auth/social/complete`
- All three mobile apps now finish both password signup and social-first signup natively in-app instead of bouncing first-time users to the web.
- Web sessions now:
  - persist across refreshes
  - synchronize across browser tabs
  - clear automatically if a tab receives a `401` for an expired or replaced session
- To turn Google and Apple auth on locally, set:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `APPLE_CLIENT_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
  - `APP_BASE_URL` (for example `http://localhost:3000`)
- To tune public web launch SEO and geography defaults locally, set:
  - `NEXT_PUBLIC_SITE_URL` (for example `http://localhost:3000`)
  - `GOOGLE_SITE_VERIFICATION` (optional public Search Console verification token; leave empty until a real property exists)
  - `NEXT_PUBLIC_DEFAULT_SERVICE_AREA_LABEL` (defaults to `Barnegat, NJ`)
- To turn Google Address Validation enrichment on locally, set:
  - `GOOGLE_ADDRESS_VALIDATION_API_KEY`
- When configured, Google Address Validation can enrich:
  - customer/provider signup addresses
  - customer properties
  - quote inputs
  - provider search inputs
  - direct booking and booking-address update inputs
- Protected customer/provider routes now derive identity from the bearer token instead of trusting caller-supplied IDs.
- Provider payout-setting changes now require a recently refreshed session, so weekly payout timing and instant-payout toggles have a stronger re-auth gate than ordinary provider control updates.
- `GET /api/auth/me` now returns a backend-authored `sensitiveActionPolicy` showing the shared fresh-session window, whether the current bearer session is fresh enough, the currently enforced provider payout-settings guard, and contract-ready future guards for provider bank-account, provider payout-account, and customer payment-method changes.
- The API keeps the current route families, but ownership is enforced for:
  - customer properties
  - customer bookings and booking address changes
  - provider settings
  - provider-side booking completion
  - post-service reviews
  - support tickets
- Mobile push-notification plumbing now supports:
  - device registration through `POST /api/notifications/devices`
  - Expo push-token delivery attempts
  - retry metadata on failed push sends
- Notification delivery can also use real vendor integrations when configured:
  - Resend for transactional email
  - Twilio for SMS
- The internal ops dashboard now includes notification delivery health:
  - `GET /api/notifications/ops/health`
  - `POST /api/notifications/ops/retry-due`
  - `POST /api/notifications/ops/escalate`
  - overdue retries, exhausted failures, and noisy providers are surfaced there
  - the health response now includes a backend-authored delivery policy showing the active push/email/SMS providers, missing Resend/Twilio configuration, Expo push strategy, retry support, and whether external ops alert targets are configured
  - critical/warning delivery health can now be escalated to configured external ops contacts
- To turn device push on in development builds, set:
  - `EXPO_PUBLIC_EXPO_PROJECT_ID` in the mobile apps
  - push credentials for the Expo project / native app IDs
- To turn real email/SMS delivery on locally, set:
  - `RESEND_API_KEY`
  - `NOTIFICATION_EMAIL_FROM`
  - `INBOUND_LEAD_WEBHOOK_SECRET`
  - `INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- To turn external ops delivery alerts on locally, set one or both:
  - `NOTIFICATION_ALERT_EMAILS` as a comma-separated list
  - `NOTIFICATION_ALERT_SMS_NUMBERS` as a comma-separated list
- Prisma/Postgres scaffolding is in place under [`apps/api/prisma`](</Users/patrickkopps/Documents/app/apps/api/prisma>).
- The committed migration chain now includes launch leads, internal authentication/access audit state, public review-response fields, versioned booking settlements, and balanced financial ledger constraints. After `npm run prisma:deploy`, verify local schema parity with Prisma migrate diff and run the repository gate with `TEST_DATABASE_URL=... npm run test:api`.
- CI applies the complete migration chain to an isolated PostgreSQL 16 database, verifies migration status, rejects schema drift that is not represented by a migration, runs the repository integration suite, and retains the resulting logs for 90 days as a `postgres-launch-gate-<commit>` artifact.
- If `DATABASE_URL` is present, the API selects the Prisma-backed repository at runtime.
- If `DATABASE_URL` is absent, the monolith falls back to the in-memory repository so frontend work can still run locally without a database.
- `NODE_ENV=production` plus `YARDMATCH_ENV=staging|production` disables development fallbacks. The API exits before listening unless it has PostgreSQL, a strong JWT, HTTPS app/API URLs, an exact CORS allowlist, private Blob photo storage, environment-appropriate Stripe credentials, and production-shaped Resend/Twilio sender configuration. Staging additionally suppresses destinations outside explicit notification allowlists.
- Deployment environments can run `npm run verify:production-config` as a secret-safe preflight; it reports only environment readiness and repository mode, and refuses to pass in local mode. `/healthz` reports liveness and `/readyz` verifies PostgreSQL readiness for deployment health checks.
- The Render Blueprint, Vercel setup, private-photo architecture, safe staging seed, revision-matched hosted acceptance workflow, and remote smoke commands are documented in `STAGING_DEPLOYMENT.md`.
- CI now builds the API and website and exports customer/provider/crew bundles for web, iOS, and Android before Git-connected hosting can deploy. A protected manual staging gate archives health, API, browser, private-photo, consent, and revocation evidence for 90 days.
- EAS internal preview and store-test profiles/workflows are documented in `MOBILE_DEPLOYMENT.md`; coordinated web/API/mobile rollback and evidence handling are documented in `RELEASE_RUNBOOK.md`.
- Local development now has a dedicated seeded ops login instead of relying on provider fallback:
  - in-memory mode seeds `ops@example.com` with password `YardMatch123!` as an `ops-admin` account
  - `npm run prisma:seed` also seeds the same `ops@example.com` admin account into Prisma/Postgres
  - `npm --workspace @yardmatch/api run ops:create-user -- --email ops@example.com --name "Casey Ops" --password "StrongPass123" --phone "555-0990" [--scope admin|operations]` can create or rotate a real ops login without exposing public signup
- The authenticated ops dashboard can now also manage internal staff logins directly:
  - general ops tooling still works for `ops` staff accounts, but internal account-management routes are now limited to `ops-admin`
  - `GET /api/ops/accounts` lists current ops accounts plus scope, session-version, password/reset metadata, accumulated access-change history, last successful sign-in activity, failed-sign-in state, and any temporary login lock shown in the dashboard
  - `POST /api/ops/accounts` creates a new internal ops login without exposing public signup, defaults new accounts to operations staff scope, and can prepare the normal password-reset flow immediately so onboarding does not depend on manually sharing a password
  - `POST /api/ops/accounts/update` updates staff name, phone, and admin-vs-staff scope details
  - `POST /api/ops/accounts/rotate-sessions` forces another ops user to sign in again everywhere and can replace their password at the same time
  - `POST /api/ops/accounts/password-reset/request` prepares a reset/invite link for another ops account through the same password-reset workflow used elsewhere
  - `POST /api/ops/accounts/access` now deactivates or reactivates another ops account, can explicitly clear a temporary auth lock with an audit note, blocks disabled users from future login, invalidates their active sessions, and appends a durable access-change history entry instead of only overwriting the latest note
  - repeated failed ops password attempts now trigger a temporary internal login lock, successful password recovery clears that lock plus the accumulated failed-attempt state, and each ops account now keeps a durable authentication-event history covering sign-ins, failures, temporary lock triggers, reset requests/completions, session rotations, and explicit lock clears
  - the live ops overview now also surfaces internal access health, including active admin/staff counts, disabled-account count, temporary lock count, pending reset invites, never-signed-in and dormant-account counts, backend-authored internal access alerts for temporary locks / repeated failures / disabled-account login attempts, a backend-authored admin-and-operations access governance policy, recent access changes, recent internal auth events, recent internal sign-ins, and recent failed internal sign-ins so staff-access drift and suspicious login activity are visible without opening each account record
- Real customer card payments are now prepared through Stripe hosted Checkout.
- Stripe webhook reconciliation now covers checkout completion, checkout expiry, payment-intent failures, refunds, and disputes so Stripe-originated payment state changes flow back into booking, support, settlement, and payout records.
- Captured Stripe payments reconcile the actual processor fee and charge id from the charge balance transaction before an immutable settlement becomes transfer-ready. A failed or not-yet-available fee lookup holds the provider payout instead of substituting an estimate.
- Disputed bookings now freeze settlement until support resolves them:
  - customers cannot continue Stripe Checkout or legacy payment authorization while the booking is disputed
  - captured disputed bookings now hold provider settlements instead of settling normally
  - if ops resolves a completed disputed booking in the provider's favor, the booking now returns to `completed` instead of reopening as active work
- Provider payout ledgers now read from immutable, versioned settlements, captured customer payments, credential readiness, refund state, and dispute holds. The legacy crew-payout route returns no wage entries or monetary balances; it remains temporarily contract-compatible while exposing assignment, attendance, performance, and provider-responsibility guidance for crew work history.
- Crew match responses now include backend-authored availability constraints and assignment forecasts covering available/unavailable weekdays, travel radius, schedule preference, equipment and winter-work limits, active accepted load, route-leader load, upcoming accepted work, pending provider review, next scheduled provider/category/status, workload band, warnings, and guidance.
- Providers can choose a weekly payout day and whether instant payouts are enabled, and the payments dashboard shows their Stripe Connect recipient status plus an onboarding action. YardMatch requests an Accounts v2 recipient with Express dashboard access, application-owned fees/losses, and only the Stripe transfers capability; crew compensation remains the provider's responsibility.
- The ops payout preview includes a backend-authored provider-only payout policy covering hold periods, weekly grouping, instant-payout thresholds, credential and Connect capability requirements, hold reasons, transfer readiness, and explicit zero crew-transfer exposure. Without Stripe credentials local development stays on an auditable manual-preview rail.
- Ops can create idempotent disbursement run records at `/api/payouts/ops/disbursement-runs`. A freshly re-authenticated ops admin can execute a scheduled, eligible Stripe run at `/api/payouts/ops/disbursement-runs/execute`; the API revalidates every provider, capability, credential, booking, payment, settlement, and exact net amount immediately before creating a provider-only transfer tied to the originating charge.
- Every successful provider transfer is persisted once with its Stripe id and a balanced provider-payable/Stripe-clearing ledger movement. Approved refunds and Stripe refund/dispute webhooks reverse an already-released provider transfer idempotently before the refund or dispute workflow proceeds, and payout history retains both transfer and reversal references.
- Instant quotes and the public marketplace overview now include a backend-authored launch pricing policy covering the hybrid managed-marketplace model, first-service launch offer framing, launch service categories, customer pricing principles, provider economics principles, and provider-facing explanation. The quote math still returns stable `estimatedPriceCents`; the policy explains how launch incentives should be handled without silently compressing provider payouts. Public provider and signup pages disclose the active provider-funded fees before account creation: a one-time `$30` fee after the first completed customer/provider job and `$6.99` per completed job, with YardMatch absorbing processor cost and provider businesses remaining responsible for crew compensation.
- Refunds now flow through an internal review path instead of an instant customer-side reversal:
  - customers can request a refund review from completed paid bookings
  - a billing support ticket is created automatically
  - ops can approve or deny the review from the internal queue
  - the provider settlement moves to `on-hold` while the refund review is open
  - when the original payment used Stripe Checkout and Stripe is configured, ops approval now triggers the live Stripe refund before the booking and payout ledger move to the refunded state
- The ops financial-exception board now lists payout holds directly, including both refund-review holds and dispute-driven settlement holds, instead of only surfacing a hold count.
- The ops support queue now builds a structured ticket timeline from ticket lifecycle changes, refund review events, booking interventions, and evidence reviews so financial and service decisions are easier to audit without reading raw descriptions.
- The ops support queue now steers completed disputed bookings toward "keep complete" actions when reviewed evidence supports the provider, instead of suggesting a return to the active schedule.
- Completed paid disputes now block generic cancellation resolution until a refund review is open or approved, so captured customer payment, provider payout holds, and customer-favoring dispute outcomes cannot drift apart.
- When a dispute, service-quality case, or refund review includes submitted booking evidence, ops must review at least one evidence item before resolving the ticket, and the final resolution must match the direction supported by the reviewed evidence. If the reviewed evidence is mixed or inconclusive, ops now must add a specific manual rationale before closing the case.
- Manual ops booking interventions can still add notes or reschedule freely, but disputed outcome changes now must link the related support ticket, follow the same reviewed-evidence direction guard, and use a specific intervention note when the evidence is mixed or inconclusive.
- The ops support queue now consumes a backend-authored resolution policy payload, so evidence-review locks, blocked resolution directions, and detailed-rationale requirements come from the same source of truth the API enforces instead of being re-derived separately in the browser.
- The ops support queue now also includes backend-authored customer update drafts for active field issues, cancellations, refund approvals or denials, and dispute/service-resolution follow-up, so the same queue that recommends a decision also gives ops a copy-ready customer message for the likely next step.
- The ops support queue now also includes backend-authored provider coordination templates for active field exceptions and service-quality cases, so support can ask the provider for continuation timing, access requirements, evidence, or outcome follow-up without improvising the provider-side message during launch incidents.
- The ops support queue now also includes structured exception-handling scripts for weather or route delays, no-shows, not-ready customers, access blockers, and incomplete service. These scripts pair customer-safe copy, provider instructions, ops checklists, escalation triggers, and stable recommended action keys without changing booking, ticket, or payment machine fields.
- Ops can now run `POST /api/support/ops/tickets/escalate-stale` to process unresolved support tickets against backend-owned SLA thresholds. Active field exceptions escalate after two hours without an update, disputed bookings and open refund reviews after four hours, billing and service-quality tickets after eight hours, and account/general tickets after twenty-four hours; the sweep sends idempotent support notifications to ops users without changing stable ticket ids, booking ids, issue types, or statuses.
- Ops can now run `POST /api/observability/ops-automation/run-due` as a single backend automation pass for provider onboarding actions, stale support ticket SLA escalations, launch-operations due-task notifications, and launch-operations overdue-task escalations. The runner accepts stable sweep keys, a shared `asOfIso`, and `dryRun`, persists an audited run record with the ops actor, then returns the run id, each nested sweep response, and aggregate sent/already-sent/skipped counts so a scheduler or ops workspace can call backend-owned rules without reimplementing them. Ops can retrieve the run history through `GET /api/observability/ops-automation/runs`.
- The public web SEO layer now uses a configurable `NEXT_PUBLIC_SITE_URL`, keeps the sitemap focused on launch-facing public pages, disallows auth/internal flows in `robots.txt`, and defaults the public customer search experience to `Barnegat, NJ` unless a different launch area label is configured.
- English and Spanish public URLs render consistently regardless of cookies/browser language. Sitemap language alternates match page metadata, and modification dates are omitted until real content revision dates exist. General service pages and Barnegat service pages have distinct metadata and content. Pseudo QA routes return a noindex header. Production domain selection and Search Console activation remain pending; see `SEO_PLAN.md`.
- First-page attribution distinguishes recognized organic search referrals from generic referrals, preserves explicit campaign medium tags, and recognizes common paid click IDs without storing them. The existing lead/booking attribution flow retains that landing context across navigation.
- The duplicate public `/customer` experience now points search engines back to the homepage canonical, and parameter-driven `/customer/listings` result pages are marked `noindex` until dedicated town/service landing pages exist.
- The first launch-facing landing pages are now live for `/barnegat-nj`, `/services/lawn-mowing`, `/services/yard-cleanup`, `/barnegat-nj/lawn-mowing`, and `/barnegat-nj/yard-cleanup`, and the public footer now points at real launch pages instead of placeholder routes that did not exist yet.
- The public web now captures privacy-safe first-touch attribution from `utm_*` tags, external referrers, and launch landing paths, then carries that context into search, booking, recurring-plan, review, and general web analytics events so launch channels can be traced through the marketplace funnel without logging raw personal URLs.
- Public launch pages, the homepage, and the Help center now include an email-first Contact us path, and ops can also log phone, GBP, referral, social, mail, and customer-service help requests into the same launch-lead queue with an owner, a first-response SLA timestamp, next-follow-up scheduling, and converted/closed-lost outcomes. No-booking customer `general` or `account` support tickets now auto-create a linked follow-up lead too, so those help requests do not rely on manual ops re-entry.
- There is now a shared-secret inbound launch-lead endpoint for automated non-website sources like direct email forwarding, GBP message relays, or referral processors, and it deduplicates retries by `sourceReferenceId` so external forwarders can safely resend the same lead.
- Direct email forwarders also have a specialized `/api/launch/inbound/email` payload shape now, so sender/subject/body relays do not need to construct the full lead schema themselves before landing in the queue. That intake path now accepts both the typed JSON payload and common `application/x-www-form-urlencoded` relay fields like `from`, `reply_to`, `message-id`, `in-reply-to`, `text`, and `html`, so lightweight inbox forwarders can post real email traffic without an extra normalization service first. It can infer likely service, launch area, callback/text number, and preferred follow-up mode from the relayed message while preserving structured intake notes for ops confirmation, and it can also derive retry-safe deduplication from inbound email `messageId` metadata while carrying reply-to and thread metadata through to the ops queue.
- Google Business Profile forwarders now also have a specialized `/api/launch/inbound/google-business-profile` payload shape, and the lead model now supports `platform-message` follow-up for channel-managed threads so GBP inquiries can land in the queue even before ops has a direct phone or email for the customer.
- Referral forwarders now have a specialized `/api/launch/inbound/referral` payload shape too, and that path can fall back to the referrer as the follow-up contact when the referred customer’s direct email or phone is not available yet.
- Review-response automation now also has a specialized `/api/providers/reviews/response/inbound` payload shape, protected by its own shared secret, so a shared inbox or GBP helper can confirm that a public reply was actually posted with a channel plus a traceable external reply id or link even when no interactive ops browser session is involved.
- That review-response intake now also has source-specific forwarder shapes for `/api/providers/reviews/response/inbound/shared-inbox` and `/api/providers/reviews/response/inbound/google-business-profile`, and posted replies now preserve structured channel metadata like mailbox name, GBP location, message/thread ids, thread URLs, and intake notes so ops can trace what external automation actually did instead of only seeing a flat reply id.
- GBP thread details, referral fallback-contact details, and inbound-intake notes now persist as structured launch-lead channel metadata instead of only being buried in freeform notes, so the ops queue can show the source thread, referrer context, and message-derived watchouts directly.
- Website-created launch leads now persist a privacy-safe lead id in the browser, and manually entered email-first or phone-first leads can also auto-link later when the same customer books with matching contact identity. That means self-serve bookings, recurring visits, and review generation can now flow back into the ops lead queue as real conversion activity instead of disconnected records.
- When a booking existed before the lead was captured, the ops launch-lead queue now surfaces likely booking matches and lets ops attach the booking explicitly, including recurring-plan linkage for future follow-on visits.
- The ops launch-lead queue now also returns backend-authored next-step guidance plus grouped copy-ready drafts for customer follow-up, provider availability outreach, curated backup coverage, first-booking pilot readiness, and referral-source follow-up. The current set covers first-response email/text/callbacks, customer-service help follow-up, quote/timing follow-up, booking confirmations, completed-job review requests, closed-lost closeout replies, provider availability checks, provider backup checks, first-booking provider readiness checks, referral-source handoff notes, and referral asks so the team is not rewriting launch responses from scratch at each lead stage.
- The ops overview now also includes launch-lead backlog metrics such as open leads, overdue first responses, overdue follow-ups, converted/closed-lost counts, and source-channel rollups so the team can see queue pressure without opening every lead card.
- The ops overview now also surfaces review-request workflow counts, including review invites created, sent, opened, completed, expired, and the completion rate from invite to submitted review, and it now includes a backend-authored public review-response queue with urgency labels, support-aware watchouts, copy-ready public replies, persisted posted/skipped state, channel-aware posting audit fields for GBP/shared-inbox/manual replies, and an explicit support-escalation path that can open or link a service-quality follow-up from a negative review so review collection can turn into an actual response habit instead of a dead-end metric.
- The ops overview now also includes inbound automation health for launch leads and public review replies, with source-level status for direct inbox, GBP, referral, and reply-forwarder channels, recent automated activity, and stale-channel alerts so the team can tell whether external forwarders are actually feeding the launch queue and review workflow.
- Those inbound automation alerts can now also be escalated to the configured external ops contacts from the dashboard, using the same `NOTIFICATION_ALERT_EMAILS` / `NOTIFICATION_ALERT_SMS_NUMBERS` plumbing as notification-delivery escalation, so a dead inbox or GBP relay does not depend on someone actively watching the UI.
- The internal ops surfaces are no longer anonymously callable from the web app. The ops dashboard, support ops queue, launch-lead ops queue, provider verification queue, payout preview, notification ops tools, and review-response actions now require an authenticated `ops` session in the browser, and internal ops access no longer falls back to provider/business-owner accounts.
- The customer dashboard now also includes the first real retention loop: backend-authored “book again” and “start recurring mowing” nudges based on completed jobs, active recurring plans, and already-queued future work. Those nudges now follow category-aware timing too, including recent-completion mowing prompts, 30-day seasonal-cleanup follow-up, 60-day hedge-trimming reminders, spring mulch-refresh reminders, spring fertilization return reminders, fall leaf-return, aeration, and gutter-prep reminders, winter snow/ice readiness reminders, and a broader 90-day rebook fallback. The mowing flow now also distinguishes between weekly and every-2-weeks plans based on recent booking history. After the one-time customer/provider finder fee is recorded, retention-driven search can softly prefer the proven provider only while the relationship stays in good standing: no dispute, refund, review below four stars, unresolved service-quality case, or active field exception. The server reconstructs this eligibility from booking history instead of trusting client-supplied loyalty fields, and still rechecks current service fit, availability, price, and route health. Provider web and mobile dashboards show acquired, retention-active, returned, and paused customer relationships, with the explicit policy that YardMatch's follow-up work adds no separate retention fee or second finder fee while the published completed-job fee still applies. Ops can also see nudge views, clicks, acceptance rate, strategy-level performance, actual repeat-service conversions by retention source and provider, plus backend-authored retention insights that flag low-volume caveats, leading strategies, weak click-to-booking handoffs, and provider-led repeat booking patterns in the observability dashboard.
- The ops overview now includes a backend-authored launch operations policy for coverage limits, low-supply recovery, weather and delay handling, no-shows, service-quality issues, completed-job disputes, provider go-live pressure, evidence standards, intervention rules, escalation triggers, and live pressure warnings. It also includes ZIP-level coverage pocket pressure summaries and coverage action recommendations built from verified provider supply, active/completed bookings, active field exceptions, open service-quality tickets, and supported service categories. Ops can now create or reuse auditable launch-operations task records from those live recommendations through `/api/observability/launch-operations/tasks`, update assignment, status, operator notes, and completion notes through `/api/observability/launch-operations/tasks/update`, run an idempotent due-task notification sweep through `/api/observability/launch-operations/tasks/notify-due`, escalate overdue tasks through `/api/observability/launch-operations/tasks/escalate-overdue` using priority-based thresholds, or include both launch task sweeps in the broader `/api/observability/ops-automation/run-due` runner with persisted run history available at `/api/observability/ops-automation/runs`. The dashboard can still render its playbook, but the launch rules and next operational actions now come from the API contract instead of only static checklist text.
- The provider verification queue now includes backend-authored launch-fit guidance, warnings, and a concrete checklist for profile completeness, service scope, launch-area fit, experience signal, operational readiness, service-quality expectations, and intervention readiness, and approvals that go against a `manual-review` or `reject` recommendation now require a detailed override note instead of a generic go-live click-through.
- Provider verification guidance now also evaluates incident history from YardMatch bookings, including disputes, refunds, and active field exceptions, so ops must document the recovery story before approving a provider whose prior operational history could weaken launch reliability.
- Provider verification queue/profile responses now also include a backend-authored onboarding automation plan. It translates checklist state into provider-owned profile fixes, dispatch-setting fixes, ops review readiness, narrow launch pilot eligibility, first-booking monitoring, and incident-recovery documentation, and now exposes stable automation actions with owners, priorities, due timestamps, route targets, blocking step keys, and notification copy so ops/provider workflow tools do not need to infer launch onboarding state from prose. Ops can process due actions through `POST /api/providers/verification/onboarding-automation/sweep`, which idempotently sends provider or ops notifications and reports sent, already-sent, blocked, completed, dry-run, and not-due outcomes. When a rejected provider materially fixes profile or dispatch blockers, the API automatically moves the business back into pending review and notifies ops users to revisit the launch-fit queue.
- Provider profile responses now also include backend-authored business controls that document owner-only team access, provider-managed profile/dispatch/payout controls, ops-managed visibility controls, fresh re-auth requirements for payout-sensitive changes, launch guardrails, and active warnings.
- The provider management board now also shows that same verification checklist in provider-friendly language, plus concrete next steps. Providers can update company name, bio, experience, and service categories directly in the dashboard, and rejected businesses are automatically moved back into `pending-review` when they make meaningful verification-related profile or dispatch-setting changes.
- The public site includes dedicated trust pages for support expectations, cancellations, refund reviews, and booking expectations. The concise homepage links to Help and refunds; the Help center and sitemap link to the full policy set.
- Privacy basics, terms, and provider standards pages are published. The compact footer links to privacy and terms; Help, the sitemap, and provider pages link to the additional guidance.
- The homepage presents a short service and location search, two popular services, and a help link without market-specific proof or launch-status copy. Barnegat remains the editable default search location; the dedicated Barnegat and service pages scope public proof to the named market before showing provider counts, ratings, reviews, or completed-work evidence. Customers outside active coverage can ask for help checking availability. Public search results show the top three ranked matches, then offer an optional paginated directory for the same service, area, and timing. Paid placement is dormant: it contributes zero ranking points, produces no match reason or badge, and cannot be enabled through provider settings.
- Customer-facing provider search, provider-profile, and review payloads now use reduced marketplace-safe contracts: they exclude phone, email, owner identity, street address, exact provider coordinates, customer and booking identifiers from public reviews, verification notes, payout/connect state, and other account-only fields. Customer-provider chat remains tied to a real booking and unlocks only once the route is active; the API rejects phone numbers, email addresses, links, social handles, and off-platform contact instructions in chat, booking notes, delay/exception/dispute updates, public reviews/replies, and provider marketplace copy. Unsafe legacy shared text is masked on read, blocked attempts are recorded without the attempted contact value, and web/mobile chat explains the protected-communication policy before sending.
- Customers can attach up to six labeled pre-service property photos to a requested or confirmed visit from web or mobile. The assigned provider can review those photos before arrival, while provider/crew arrival proof remains a separate lifecycle requirement. Providers and crews can attach completion photos, and customer service history presents the resulting before-and-after record. Photo sets stay private by default; public-use permission is revocable, and public proof only includes completed work from verified providers without customer names or street addresses. The concise homepage currently does not display the gallery.
- To turn the real checkout path on locally, set:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `APP_BASE_URL` (for Stripe success/cancel redirects, for example `http://localhost:3000`)
- To test external inbound automation locally, set:
  - `INBOUND_LEAD_WEBHOOK_SECRET`
  - `INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET`
  - `OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES` as a comma-separated list like `direct-email-lead,google-business-profile-lead,shared-inbox-review-response` when you want the ops dashboard to flag channels that should be live even before the first payload arrives
  - `NOTIFICATION_ALERT_EMAILS` or `NOTIFICATION_ALERT_SMS_NUMBERS` if you also want stale inbound-forwarder alerts to page external ops contacts

### Database setup commands

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

### Verification commands

```bash
npm run lint
npm run typecheck
npm run test:api
npm run test:api:smoke
npm run test:web:smoke
```

`npm run verify` runs lint, typecheck, and the full API suite. The ESLint 10 setup uses a root flat config with TypeScript-aware source checks, React Hooks rules, and Next.js Core Web Vitals rules; initial legacy debt is counted in `eslint-suppressions.json` so new violations cannot expand it unnoticed.

### Current backend test coverage

- auth register/login/current-user flow
- booking completion and delayed review eligibility
- duplicate review rejection
- booking address-change policy
- provider-route authorization
- support-ticket attribution to the authenticated requester

## Core marketplace capabilities scaffolded

- Geolocation and address handling for customers and providers
- Registration flows for all three marketplace roles
- Shared Google and Apple auth-start routes for all three signup flows
- Separate customer, provider, and crew-member mobile app shells with role-specific navigation
- One shared website with role-aware login entry points
- Scheduling, calendar feeds, and availability planning
- Provider calendar subscription actions for Apple Calendar, Google Calendar, and raw iCal feeds
- Payments, refunds, and service-quality issue workflows
- Structured provider reviews with overall, timeliness, and attention-to-detail ratings plus free text
- Customer support intake
- Shared help-center content for customer, provider, and crew-member documentation across web and mobile
- Analytics event logging for funnel and operational analysis
- SEO metadata, robots, sitemap, and semantic marketing pages
- Multiple saved customer properties with a default/primary address model and cached geocode reuse for matching authenticated quote, booking, recurring-plan, and booking-address-change inputs
- Booking address snapshots plus post-booking address-change workflows
- Instant quote scaffolding with automated property-size estimation and confidence-based follow-up questions, including driveway and sidewalk measurement prompts for winter hardscape services when address heuristics need confirmation
- Optional Google Address Validation enrichment for quote/search/property/signup flows when configured
- Place search now returns structured confidence and match-reason metadata so clients can distinguish Google-verified suggestions from best local fallback guesses; the local fallback dataset includes Barnegat/Ocean County launch pockets such as Barnegat, Manahawkin, Waretown, Forked River, Toms River, and Long Beach Township
- Recommendation-first public search no longer silently auto-selects weaker local fallback area guesses; low-confidence matches now require clearer customer confirmation

## Competitive positioning

### What YardMatch is not

YardMatch is not intended to become:

- a lead-generation marketplace
- a directory-first booking flow
- a quote-collection platform
- a promoted-listings platform

Customers should not need to spend meaningful time browsing dozens of landscapers, collecting multiple quotes, or comparison-shopping large profile catalogs before they can book basic recurring property care.

### What YardMatch is

YardMatch is a managed marketplace focused on matching homeowners with the best available provider for their property, service request, timing, and quality expectations.

Core philosophy:

> Tell us what you need. We'll handle the rest.

The matching algorithm is a core product feature and a long-term competitive advantage, not just a sorting layer on top of listings.

### Customer matchmaking model

For common services such as:

- lawn mowing
- recurring lawn maintenance
- leaf cleanup
- mulch refresh
- basic trimming

the primary experience should be recommendation-first:

1. Determine service requirements.
2. Generate a customer-facing price.
3. Recommend the best provider.
4. Allow immediate booking.

The customer should usually see:

- one recommended provider
- why that provider was selected
- immediate booking controls
- an optional path to browse all eligible local providers after the top matches on public web

The platform should avoid making the customer do unnecessary marketplace work when GreenRain/YardMatch can make the recommendation confidently.

### Preferred launch model

GreenRain/YardMatch should launch with:

- one recommended provider
- a clear explanation of why that provider was chosen
- immediate booking controls
- a clear path to the top matches and, on public web, an optional full directory

This keeps the recommendation first and leaves broader browsing to customers who choose it.

In practical terms, the launch posture should be:

1. Customer tells us what they need.
2. The marketplace recommends the best provider.
3. The customer can confirm that recommendation quickly.
4. The customer can compare the top matches, then open the full local directory on public web if desired.

This keeps friction low while still preserving homeowner trust.

Current baseline shipped:

- public listings show up to three ranked matches immediately and offer an optional paginated directory
- customer web dashboard and customer mobile booking retain one recommended provider first with curated alternatives behind an explicit reveal
- customer booking surfaces now use a cleaner confirmation posture around the primary match:
  - `Book now` for the recommendation
  - `Show me another provider` for the limited fallback path
- recommendation sessions now support analytics for:
  - recommendation views
  - alternative-provider reveals
  - accepted first-choice recommendations
  - swapped bookings onto another qualified provider
  - session-based funnel rates so repeated booking attempts in one recommendation session do not overstate conversion
- recommendation cards now surface a baseline trust layer instead of only generic ranking reasons:
  - reliability summaries that explain trust beyond raw star ratings alone
  - operational follow-through signals from real marketplace behavior, like steady confirm-vs-decline history and late-update frequency
  - a clearer `why GreenRain picked this provider` explanation tied to fit, trust, route availability, and local familiarity
  - service-fit summaries that distinguish complete versus partial category coverage for multi-service requests
  - provider-economics summaries that compare estimated provider net against category or service-mix, duration, and route payout floors before ops scales a thin route
  - neighborhood familiarity
  - completed YardMatch job count
  - availability-confidence messaging around the suggested route window
- alternative providers now use a curated framing layer instead of generic backup-card language:
  - `Highest rated`
  - `Closest route`
  - `Local specialist`
- weaker fallback area guesses no longer get silently auto-selected in the public recommendation flow; customers are prompted to choose a suggested area when search confidence is not strong enough

The recommendation remains the primary public web path. Dashboard and mobile alternatives remain a secondary trust feature. Good examples include:

- `Best match`
- `Highest rated`

## Provider assistant

The provider assistant is meant to reduce dispatch friction, not just restate schedule data.

Current baseline includes:

- lifecycle commands like confirm, start route with on-my-way ETA/tracking copy, arrival update, start work, complete, late update, and exception reporting
- staffing commands like accept best crew, accept/deny crew, assign route leader, message named crew, message the route leader, and message all accepted crew
- dispatch reasoning commands like:
  - `How does tomorrow look?`
  - `What needs attention tomorrow?`
  - `What should I move tomorrow?`
  - `Do I need more crew tomorrow?`

That last class matters because the assistant now moves beyond descriptive route summaries and can recommend a specific appointment/window adjustment when a day looks pressured.
It can also tell the provider when existing pending crew matches should be reviewed first versus when the booking still needs fresh sourcing.
When tomorrow has no meaningfully lighter same-day window left, it can now fall back to the next real cleaner route opening on a later day.
When multiple later openings exist, it ranks them by route pressure instead of blindly taking the first slot, and it can return a staffing-first recommendation when a large job's crew gap is the real dispatch issue.
Crew-gap recommendations now also return a structured multi-booking staffing plan so providers and ops can see which competing jobs need sourcing, which ones should review pending matches first, when accepted crew coverage is full but a route leader still needs assignment, and which machine-readable booking fields stayed stable.
Crew coordination commands can now target the assigned route leader or fan out to every accepted crew member on the booking while returning the updated provider-crew conversation threads for audit and follow-up.
Start-route commands now preview the customer-facing on-my-way notification, including the backend-estimated arrival window and live tracking affordance, before execution sends the same update.
After a route has started, arrival-update commands can also send a customer-safe "crew has arrived and is getting set up" notification while preserving the booking's lifecycle status until the normal proof-gated start-work action runs.

### Why the directory follows recommendations

For landscaping, trust matters more than it does in rideshare-style matching:

- providers are entering a customer's property
- service is often recurring
- the first experience strongly affects retention
- bad matches create refund, review, and support drag

Because of that, the platform should not launch with:

- open-ended provider browsing as the default path
- many featured or promoted provider slots competing for attention on a basic service request
- many-provider bidding on a single customer lead
- opaque hidden matching with no explanation

The platform also should not launch with a full Uber-style hidden match as the primary flow. For home services, customers usually want at least a minimal trust checkpoint before someone arrives at their property.

The target middle ground is:

- strong platform recommendation
- low customer effort
- enough provider transparency to create trust

### Competitive comparison

`Angi`

- primary value proposition: `Find providers`
- customer effort: `High`

`Thumbtack`

- primary value proposition: `Collect quotes`
- customer effort: `Medium to High`

`LawnStarter`

- primary value proposition: `Get lawn service`
- customer effort: `Low`

`YardMatch / GreenRain`

- primary value proposition: `Get matched with the best provider for your property`
- customer effort: `Very Low`

### Strategic principles

When evaluating customer-facing marketplace features, prefer:

- fewer clicks
- faster booking
- simpler decisions
- stronger recommendations
- better matching transparency
- provider-first supply economics
- local density over broad sparse geographic expansion

Avoid features that increase customer decision fatigue unless they materially improve outcomes.

Avoid marketplace drift toward:

- directory behavior
- promoted ranking as the primary discovery mechanism
- quote wars
- provider economics that treat supply like a disposable lead source

Operationally, growth should favor dense neighborhood coverage before broad geographic sprawl. A dense local marketplace improves:

- route efficiency
- recommendation confidence
- repeat-property retention
- provider earnings quality

### Marketplace metrics

Primary marketplace metric to add and watch:

- `Recommendation Acceptance Rate`

Definition:

- `accepted_recommendations / recommendation_views`

This metric should become a primary signal of:

- customer trust in the matching algorithm
- conversion efficiency
- recommendation quality
- marketplace liquidity health

Current baseline instrumentation:

- provider searches are now counted by source surface
- source-level search diagnostics now also track:
  - searches with no provider coverage
  - searches with providers but no open route window
  - recommendation booking intent before final booking creation
- recommendation views are emitted when ranked provider results return with a top match
- accepted recommendations are emitted when the customer books the recommended provider
- swapped recommendations are emitted when the customer books a revealed alternative
- alternative reveals are emitted when the customer asks to inspect other qualified providers
- recommendation dismissals are emitted when a customer requests a different match flow after seeing a recommendation without booking it
- ops telemetry now breaks recommendation performance down by booking surface, including:
  - `public-web-listings`
  - `customer-web-dashboard`
  - `customer-mobile-book`
- the ops overview now also returns backend-authored recommendation insights that call out low-volume caveats, coverage/open-window issues, weak source handoffs, and the strongest current surface before the team changes ranking or alternative-provider exposure

## Observability approach

- Every API request now receives an `X-Request-Id`; the API emits privacy-safe structured JSON for server errors and slow requests, retains a bounded in-process route/error summary, and shows five-minute reliability alerts in the authenticated ops dashboard.
- `Sentry` is initialized when `SENTRY_DSN` is configured. It receives uncaught exceptions, unhandled rejections, dependency timeouts, and HTTP 5xx failures with request-id/route tags while request bodies, headers, query strings, cookies, user data, email addresses, and phone numbers are excluded or redacted.
- Staging and production fail closed without a valid HTTPS Sentry project DSN. Configure alert rules in Sentry against the staging and production projects so critical issues page the on-call owner instead of relying on someone watching the dashboard.
- Booking history is served through opaque cursor pages (25 by default, 100 maximum), payments are restricted to the booking IDs in the current page, and PostgreSQL indexes cover customer/provider chronological reads.
- `OpenTelemetry` remains the next layer for cross-service traces and infrastructure metrics as the monolith grows beyond its current structured request telemetry.
- `PostHog` should handle product analytics and replay on web/mobile.
- `Sentry` should handle errors and performance on API, web, and mobile.
- Active users are defined by a heartbeat model: a session is considered active if it has reported within the last 5 minutes.
- Booking and refund KPIs should be authored by the backend on successful state changes, not by frontend-only clicks.
- The internal ops telemetry view should surface marketplace counters like recommendation acceptance alongside booking and support activity.
- The internal ops telemetry view now also tracks provider booking confirmations, provider booking declines, customer cancellations, Stripe checkout starts, payment failures/expirations, and payment authorization/capture counts so booking and payment health do not rely on raw event inspection.

## Review policy

- Reviews are tied to completed bookings only.
- The default flow schedules a booking-specific review invite 48 hours after service completion.
- Customers should review from that email or in-app booking prompt, not from a generic provider profile.
- One review is allowed per booking.

### Observability scaffolding included

- Shared telemetry event names in `packages/observability`
- Session heartbeat request/response contracts and API routes
- API endpoint for operational dashboard summaries: `/api/observability/overview`
- Bounded API error/latency aggregation, structured production logs, request correlation IDs, and Sentry exception delivery
- Web heartbeat provider and an internal ops dashboard page
- Separate customer/provider/crew-member mobile heartbeat providers for phone/tablet active-session tracking

## Address edge cases covered in the scaffold

- Customers can own or manage multiple saved properties and choose a default one for future bookings.
- Bookings store their own service-address snapshot so later default-address changes do not mutate old jobs.
- Address changes after booking follow policy rules:
  - `requested` bookings can update immediately
  - `confirmed` bookings at least 24 hours out require provider review
  - `in-progress`, `completed`, too-soon, or out-of-radius changes are blocked and should go through support

## Low-friction quote engine

- The quote flow is designed to start with just an address and service type.
- The backend returns an automated estimate for turf, shrubs, driveway, sidewalk, labor time, and price.
- If confidence is high, the quote is ready immediately.
- If confidence is medium or low, the system asks only one or two lightweight follow-up questions before checkout.
- The current code uses a heuristic estimator as a scaffold. The API shape is intentionally ready for a future licensed-imagery and ML pipeline.

### Recommended production architecture

- Use Google for address validation, geocoding, and map UX.
- Use licensed aerial imagery and/or parcel data for machine-readable property measurement.
- Run your property-estimation model on that licensed data, not on map tiles that are only licensed for visualization.
- Feed the resulting measurements into the shared instant-quote API so scheduling can reserve the right amount of crew time.

### Environment variables

See [.env.example](/Users/patrickkopps/Documents/app/.env.example:1) for the starting set of variables for API base URLs, OTLP export, Sentry, and PostHog.

## Notes

- The workspace started empty, so this repo is scaffolded from scratch.
- The current structure keeps one shared backend and one shared website, while splitting the mobile experience into dedicated customer, provider, and crew-member apps.

## Why not Swift right now?

- `React Native + Expo` is the default choice for iPhone, iPad, and Android to keep the product moving quickly with one mobile codebase.
- `Next.js` handles web because SEO and semantic crawlability matter for customer acquisition.
- `Swift` should be introduced only for proven platform-specific needs such as highly customized maps, background location, or specialized native integrations that React Native cannot handle well enough.

## When the environment has a package manager

Typical first-run commands:

```bash
npm install
npm run dev:api
npm run dev:web
npm run dev:customer-mobile
npm run dev:provider-mobile
npm run dev:crew-mobile
```

## September 2026 audit repairs

Recovery secrets are private in deployed environments; reset attempts and OAuth state consumption use durable security state. Booking writes validate ownership, signed server quotes, provider eligibility and future time windows. Web and customer-mobile booking requests carry the quote token. Initial recurring plans and bookings persist together. Calendar imports preserve other subscriptions, validate outbound destinations and expand timezone-aware recurrence. Checkout retries retain payment attempts, and refunds remain terminal.

Generate Prisma and apply `20260909010000_security_states` before releasing this API version. See the [repair completion report](reports/code-audit/2026-09-09/completion.md) for verification, operating limits, and the separate pre-existing empty-database migration-order blocker.


## Product analytics and launch operations

Optional web/mobile usage analytics now has validated collection, PostgreSQL persistence, bounded retries, retention, account linking, and a permission-gated PostHog exporter. Ops → Reports shows journeys, clicks/destinations, performance, supply activation, and settlement economics. Ops workspaces now open on action queues; provider/crew workspaces put jobs ahead of advanced settings. Customer quotes proceed directly to a revalidated recommendation.

See [analytics and operations](docs/ANALYTICS_AND_OPERATIONS.md) for setup, monitoring, mobile release controls, privacy intake, database restore rehearsal, and the remaining external activation gates. The first-party store works locally; live PostHog, independent alerts, vendor acceptance, and irreversible privacy fulfillment still require account/policy setup.

## Visit delays and rescheduling

Providers can report late arrivals or weather holds with a next-update deadline and propose a new service window for customer approval. Web and native booking screens expose the updates; the existing ops scheduler alerts customers, providers, and ops when an update or arrival window is overdue. See [the schedule recovery guide](docs/BOOKING_SCHEDULE_RECOVERY.md) for behavior, API routes, rollout, and limits.

## Provider client map

Providers can open **Clients** from the authenticated web navigation or `/provider/clients` (Spanish: `/es/provider/clients`). The responsive screen combines a searchable property list with a pan/zoom map, recurring/one-time and next-7/30-day filters, selected-property visit details, completed-visit history, and external directions. It works on desktop and mobile browsers; the native provider app is unchanged.

`GET /api/providers/clients` derives the provider identity from authentication, reads every page of that business's booking history, and groups non-cancelled bookings by customer and normalized booked address including unit. Only booked addresses are exposed; unrelated saved properties, gate codes, contact details, and job notes are excluded. Recurring means an active plan for that provider/customer/address. Past clients remain visible; cancelled-only properties are excluded. Shared coordinates have a single pin with a client chooser. Missing/invalid coordinates stay in the list, and city/postal-code locations are labeled approximate in property details.

The map uses bundled Leaflet with attributed OpenStreetMap tiles. Client labels stay in the application; the tile service receives viewport tile requests. Tile failures leave pins and the list usable. Map data is not an optimized driving route, and no unassigned nearby leads are exposed. Background tiles require network access and follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/); do not add bulk/offline prefetch. See the [Leaflet API](https://leafletjs.com/reference.html) when changing map behavior.

Validation: `node --test --import tsx apps/api/test/provider-clients.test.ts apps/api/test/authorization-controller.test.ts apps/api/test/marketplace-controller-routing.test.ts` and `npm run test:web:smoke -- tests/web/provider-clients.spec.ts`. Browser tests use both real authenticated bookings and explicitly mocked Barnegat map fixtures for visual and recovery coverage.

### Structured service recovery

- Customer Help now leads with a booking-linked problem form: missed visit, incomplete work, quality, damage, or billing; affected area; preferred remedy; photos or a missing-photo explanation. Customers can add details and request human review without repeating their report.
- Customer complaint photos remain private, are attached to the booking for ops review, and are excluded from marketing consent. Provider/crew web photos can be labeled by property area.
- Optional, consented OpenAI image comparison produces internal advisory notes and a follow-up suggestion. Missing configuration or failed analysis falls back to a rule-based checklist. Damage and human-review requests bypass AI. Decisions remain with ops.
- Ops can approve YardMatch-funded partial goodwill refunds without reducing provider earnings. Durable reservations, stable processor keys, cumulative refund amounts, balanced expense entries, and signed refund-event reconciliation protect retries and pending/failed outcomes. A later full refund covers only the remaining balance.
- See `LOCAL_DEVELOPMENT.md` for migration, model configuration, webhook events, recovery instructions, and the deliberate launch limits. Automatic financial approval and provider-funded partial deductions are not enabled.

### Provider service prices by ZIP

Providers choose their services and starting prices during web/native signup, then edit prices in web Management → Service prices or provider app Business → Work. Prices are stored per five-digit US ZIP and service, in integer USD cents. ZIP+4 API inputs normalize to the first five digits. Only the authenticated provider can edit their prices; only services that business offers can be priced.

Ops admins configure minimum starting prices in Ops → Administration → ZIP pricing minimums. Each change stores the previous amount, new amount, actor, time, and reason. Public minimum lookups omit that history. No business-approved minimum dollar amounts are seeded or assumed: unconfigured ZIP/service pairs keep the previous automatic quote calculation and cannot accept custom provider prices. In configured areas, the effective starting price is the greater of the provider’s saved price (or existing default) and the ZIP minimum. Increasing a minimum raises new quotes without overwriting a provider’s saved preference.

Customer quotes add the existing labor and property-size adjustments to that starting price. The service property determines the ZIP, not the provider’s business address. Provider-specific signed quotes are checked again when booking; a changed starting price or swapped provider requires a new quote. The public booking review requests each selected provider/service quote, and the customer dashboard/native flow asks the customer to review a changed total before submission. Existing bookings and active recurring plans retain their agreed prices. Configure approved ZIP minimums before making custom pricing available in a market.


## Critical-path activation and recovery

See [the critical-path acceptance matrix and rollout runbook](docs/CRITICAL_PATH_ACCEPTANCE.md). Provider/ops credential review and owned availability controls are now available. Declined/withdrawn or overdue visits remain open for explicit customer recovery consent; replacements preserve the agreed price, release previous crew and require new provider confirmation. Property corrections require provider review for confirmed visits and are blocked once travel starts.
