# YardMatch

YardMatch is a triple marketplace for homeowners and property managers who need lawn care, landscaping businesses that run customer-facing operations, and crew members who can join those businesses without running their own company.

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

## Product roadmap

- Active roadmap and backlog: [ROADMAP.md](/Users/patrickkopps/Documents/app/ROADMAP.md)
- Cost sheet and future P&L starter: [COSTS.md](/Users/patrickkopps/Documents/app/COSTS.md)

## Backend hardening status

- Local email/password auth is now wired with bearer-token sessions through:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
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
- If `DATABASE_URL` is present, the API selects the Prisma-backed repository at runtime.
- If `DATABASE_URL` is absent, the monolith falls back to the in-memory repository so frontend work can still run locally without a database.
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
  - the live ops overview now also surfaces internal access health, including active admin/staff counts, disabled-account count, temporary lock count, pending reset invites, never-signed-in and dormant-account counts, backend-authored internal access alerts for temporary locks / repeated failures / disabled-account login attempts, recent access changes, recent internal auth events, recent internal sign-ins, and recent failed internal sign-ins so staff-access drift and suspicious login activity are visible without opening each account record
- Real customer card payments are now prepared through Stripe hosted Checkout.
- Stripe webhook reconciliation now covers checkout completion, checkout expiry, payment-intent failures, and refund events so Stripe-originated payment state changes can flow back into the local booking and payout records.
- Disputed bookings now freeze settlement until support resolves them:
  - customers cannot continue Stripe Checkout or legacy payment authorization while the booking is disputed
  - captured disputed bookings now hold provider and crew payouts instead of settling normally
  - if ops resolves a completed disputed booking in the provider's favor, the booking now returns to `completed` instead of reopening as active work
- Provider and crew payout ledgers now read from real completed bookings, captured customer payments, accepted crew matches, refund state, and dispute holds.
- Providers can now choose a weekly payout day and whether instant payouts are enabled, and ops can preview upcoming payout runs before real bank-transfer rails are switched on.
- Refunds now flow through an internal review path instead of an instant customer-side reversal:
  - customers can request a refund review from completed paid bookings
  - a billing support ticket is created automatically
  - ops can approve or deny the review from the internal queue
  - provider and crew payouts move to `on-hold` while the refund review is open
  - when the original payment used Stripe Checkout and Stripe is configured, ops approval now triggers the live Stripe refund before the booking and payout ledger move to the refunded state
- The ops financial-exception board now lists payout holds directly, including both refund-review holds and dispute-driven settlement holds, instead of only surfacing a hold count.
- The ops support queue now builds a structured ticket timeline from ticket lifecycle changes, refund review events, booking interventions, and evidence reviews so financial and service decisions are easier to audit without reading raw descriptions.
- The ops support queue now steers completed disputed bookings toward "keep complete" actions when reviewed evidence supports the provider, instead of suggesting a return to the active schedule.
- When a dispute, service-quality case, or refund review includes submitted booking evidence, ops must review at least one evidence item before resolving the ticket, and the final resolution must match the direction supported by the reviewed evidence. If the reviewed evidence is mixed or inconclusive, ops now must add a specific manual rationale before closing the case.
- Manual ops booking interventions can still add notes or reschedule freely, but disputed outcome changes now must link the related support ticket, follow the same reviewed-evidence direction guard, and use a specific intervention note when the evidence is mixed or inconclusive.
- The ops support queue now consumes a backend-authored resolution policy payload, so evidence-review locks, blocked resolution directions, and detailed-rationale requirements come from the same source of truth the API enforces instead of being re-derived separately in the browser.
- The ops support queue now also includes backend-authored customer update drafts for active field issues, cancellations, refund approvals or denials, and dispute/service-resolution follow-up, so the same queue that recommends a decision also gives ops a copy-ready customer message for the likely next step.
- The public web SEO layer now uses a configurable `NEXT_PUBLIC_SITE_URL`, keeps the sitemap focused on launch-facing public pages, disallows auth/internal flows in `robots.txt`, and defaults the public customer search experience to `Barnegat, NJ` unless a different launch area label is configured.
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
- The ops launch-lead queue now also returns backend-authored next-step guidance plus grouped copy-ready drafts for customer follow-up, provider availability outreach, and referral-source follow-up. The current set covers first-response email/text/callbacks, customer-service help follow-up, quote/timing follow-up, booking confirmations, completed-job review requests, closed-lost closeout replies, provider availability checks, referral-source handoff notes, and referral asks so the team is not rewriting launch responses from scratch at each lead stage.
- The ops overview now also includes launch-lead backlog metrics such as open leads, overdue first responses, overdue follow-ups, converted/closed-lost counts, and source-channel rollups so the team can see queue pressure without opening every lead card.
- The ops overview now also surfaces review-request workflow counts, including review invites created, sent, opened, completed, expired, and the completion rate from invite to submitted review, and it now includes a backend-authored public review-response queue with urgency labels, support-aware watchouts, copy-ready public replies, persisted posted/skipped state, channel-aware posting audit fields for GBP/shared-inbox/manual replies, and an explicit support-escalation path that can open or link a service-quality follow-up from a negative review so review collection can turn into an actual response habit instead of a dead-end metric.
- The ops overview now also includes inbound automation health for launch leads and public review replies, with source-level status for direct inbox, GBP, referral, and reply-forwarder channels, recent automated activity, and stale-channel alerts so the team can tell whether external forwarders are actually feeding the launch queue and review workflow.
- Those inbound automation alerts can now also be escalated to the configured external ops contacts from the dashboard, using the same `NOTIFICATION_ALERT_EMAILS` / `NOTIFICATION_ALERT_SMS_NUMBERS` plumbing as notification-delivery escalation, so a dead inbox or GBP relay does not depend on someone actively watching the UI.
- The internal ops surfaces are no longer anonymously callable from the web app. The ops dashboard, support ops queue, launch-lead ops queue, provider verification queue, payout preview, notification ops tools, and review-response actions now require an authenticated `ops` session in the browser, and internal ops access no longer falls back to provider/business-owner accounts.
- The customer dashboard now also includes the first real retention loop: backend-authored “book again” and “start recurring mowing” nudges based on completed jobs, active recurring plans, and already-queued future work. Those nudges now follow category-aware timing too, including recent-completion mowing prompts, 30-day seasonal-cleanup follow-up, 60-day hedge-trimming reminders, spring mulch-refresh reminders, spring fertilization return reminders, fall leaf-return reminders, fall aeration return reminders, and a broader 90-day rebook fallback. The mowing flow now also distinguishes between weekly and every-2-weeks plans based on recent booking history and calls out repeat-customer/provider-loyal context when the same property has already completed multiple visits. These nudges keep the recommendation-first flow intact by re-pricing the service and loading a fresh provider recommendation instead of blindly cloning the last booking, while now allowing loyalty-backed rebooks to softly prefer a proven prior provider when the customer has strong history at the same property. Ops can also see nudge views, clicks, acceptance rate, strategy-level performance, plus actual repeat-service conversions by retention source and provider in the observability dashboard.
- The ops dashboard now includes a structured launch operations playbook for coverage limits, low-supply recovery, weather and delay handling, no-shows, and provider go-live decisions, so those launch rules are visible in-product instead of only buried in checklist notes.
- The provider verification queue now includes backend-authored launch-fit guidance, warnings, and a concrete checklist for profile completeness, service scope, launch-area fit, experience signal, operational readiness, service-quality expectations, and intervention readiness, and approvals that go against a `manual-review` or `reject` recommendation now require a detailed override note instead of a generic go-live click-through.
- The provider management board now also shows that same verification checklist in provider-friendly language, plus concrete next steps. Providers can update company name, bio, experience, and service categories directly in the dashboard, and rejected businesses are automatically moved back into `pending-review` when they make meaningful verification-related profile or dispatch-setting changes.
- The public site now includes dedicated trust pages for support expectations, cancellations, refund reviews, and booking expectations, and those pages are linked from the homepage, Help center, footer, and sitemap so launch visitors can verify how GreenRain behaves before they book.
- The legal and provider-facing trust layer is now live too: privacy basics, launch terms, and provider standards pages are published and linked from Help, the footer, the sitemap, and the provider marketing surface so both sides of the marketplace can see clearer launch expectations before committing.
- The homepage, Barnegat launch page, and launch service landing pages now surface stronger proof signals from the real public marketplace overview, including verified-provider counts, average rating, active service-category breadth, recent completed-booking review snippets tied to verified providers, current coverage-pocket cards based on verified supply and completed jobs, and a dedicated provider-verification explainer so public trust is grounded in current marketplace state instead of policy language alone.
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
npm run prisma:migrate
npm run prisma:seed
```

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
- Multiple saved customer properties with a default/primary address model
- Booking address snapshots plus post-booking address-change workflows
- Instant quote scaffolding with automated property-size estimation and confidence-based follow-up questions
- Optional Google Address Validation enrichment for quote/search/property/signup flows when configured
- Place search now returns structured confidence and match-reason metadata so clients can distinguish Google-verified suggestions from best local fallback guesses
- Recommendation-first public search no longer silently auto-selects weaker local fallback area guesses; low-confidence matches now require clearer customer confirmation

## Competitive positioning

### What YardMatch is not

YardMatch is not intended to become:

- a lead-generation marketplace
- a provider directory
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
- a limited fallback path to view a small number of other qualified providers

The platform should avoid making the customer do unnecessary marketplace work when GreenRain/YardMatch can make the recommendation confidently.

### Preferred launch model

GreenRain/YardMatch should launch with:

- one recommended provider
- a clear explanation of why that provider was chosen
- immediate booking controls
- a lightweight fallback path like `Show me another provider`

This is the preferred V1 middle ground:

- not a full directory flow where the customer browses many landscapers
- not an opaque hidden-match flow where the customer has no idea who was selected until after matching

In practical terms, the launch posture should be:

1. Customer tells us what they need.
2. The marketplace recommends the best provider.
3. The customer can confirm that recommendation quickly.
4. The customer can ask for a limited set of other qualified providers if trust is still needed.

This keeps friction low while still preserving homeowner trust.

Current baseline shipped:

- public listings, customer web dashboard, and customer mobile booking all show one recommended provider first
- alternative providers sit behind an explicit reveal instead of being the default primary view
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
  - neighborhood familiarity
  - completed YardMatch job count
  - availability-confidence messaging around the suggested route window
- alternative providers now use a curated framing layer instead of generic backup-card language:
  - `Highest rated`
  - `Closest route`
  - `Local specialist`
- weaker fallback area guesses no longer get silently auto-selected in the public recommendation flow; customers are prompted to choose a suggested area when search confidence is not strong enough

Alternative providers should remain a secondary trust feature, not the primary browsing mode. If alternatives are shown, they should be tightly curated rather than open-ended. Good examples include:

- `Best match`
- `Highest rated`

## Provider assistant

The provider assistant is meant to reduce dispatch friction, not just restate schedule data.

Current baseline includes:

- lifecycle commands like confirm, start route, start work, complete, late update, and exception reporting
- staffing commands like accept best crew, accept/deny crew, assign route leader, and message crew
- dispatch reasoning commands like:
  - `How does tomorrow look?`
  - `What needs attention tomorrow?`
  - `What should I move tomorrow?`
  - `Do I need more crew tomorrow?`

That last class matters because the assistant now moves beyond descriptive route summaries and can recommend a specific appointment/window adjustment when a day looks pressured.
It can also tell the provider when existing pending crew matches should be reviewed first versus when the booking still needs fresh sourcing.
When tomorrow has no meaningfully lighter same-day window left, it can now fall back to the next real cleaner route opening on a later day.
- `Local specialist`

### Why not launch as a full directory

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

## Observability approach

- `OpenTelemetry` should instrument the API for traces, metrics, and logs.
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
