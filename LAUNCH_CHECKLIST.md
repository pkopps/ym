# YardMatch Launch Checklist

## Financial, Connect, and Legal Launch Gates

- [ ] Confirm the `2026-07-provider-funded-v1` fee amounts and provider-funded posture in the signed provider agreement.
- [ ] Have marketplace counsel confirm that each provider—not YardMatch—engages, supervises, insures, classifies, reports, and pays its crew.
- [ ] Have counsel confirm YardMatch's merchant-of-record, refund, dispute, negative-balance, and customer-receipt posture for separate charges and transfers.
- [ ] Activate and archive staging/production evidence for Stripe Connect Accounts v2 with Express dashboard access, `fees_collector: application`, `losses_collector: application`, and recipient `stripe_transfers` capability only.
- [x] Enforce active recipient transfer and payout capabilities before enabling a provider transfer.
- [x] Reconcile actual Stripe processing fees from charge balance transactions before creating the immutable settlement and provider transfer.
- [x] Restrict YardMatch disbursement execution to provider recipients, persist one idempotent transfer per settlement, and reverse released transfers before Stripe refunds or dispute handling proceeds.
- [ ] Run and archive a staging Stripe lifecycle with real test credentials: provider onboarding, checkout webhook, fee reconciliation, provider transfer, refund reversal, and dispute reversal.
- [ ] Verify business registration and general liability insurance for every launch provider.
- [ ] Verify workers-compensation coverage or a counsel-approved exemption before any provider engages crew through YardMatch.
- [ ] Have New Jersey counsel approve the category credential matrix, including fertilization and weed-control/pesticide work.
- [x] Apply all committed migrations locally, confirm an empty Prisma schema diff, and pass the PostgreSQL atomic-settlement/balanced-ledger integration test.
- [ ] Run the PostgreSQL migration/integration CI job and archive its passing result before production deployment.
- [x] Confirm staging and production startup fail without Postgres, a strong JWT, HTTPS URLs, exact CORS origins, private Blob photo storage, environment-appropriate Stripe credentials, and real email/SMS configuration; require notification allowlists and test-mode Stripe in staging.
- [x] Add required API/web production builds, customer/provider/crew cross-platform exports, mobile release-config validation, and retained CI metadata before Git-connected deployment.
- [ ] Provision the Vercel web/Blob and Render API/Postgres staging resources, run the safe staging seed, and archive passing remote API/web/photo-lifecycle smoke evidence.
- [ ] Create and protect the GitHub `staging`, `mobile-preview`, and `mobile-store-test` environments with the documented variables, secrets, and reviewers.
- [ ] Link customer/provider/crew EAS projects, initialize iOS/Android credentials interactively, and archive one accepted internal preview build per app/platform.
- [ ] Create App Store Connect and Google Play records and distribute one staging-backed customer, provider, and crew build through TestFlight/internal testing without enabling public release.
- [ ] Rehearse and record one coordinated Vercel/Render staging rollback and post-rollback acceptance run.

The repository now requests the approved Accounts v2 recipient configuration, reuses one Connect account per provider, blocks inactive capabilities or missing provider credentials, reconciles Stripe's actual balance-transaction fee, executes provider-only transfers from the originating charge, and records idempotent transfer/reversal ledger entries. The open Stripe items require a real Stripe account and credentials, so they remain deployment evidence rather than unfinished repository behavior.

The CI workflow creates a 90-day PostgreSQL launch-gate artifact containing migration deployment, migration status, schema-drift, and repository-test logs. The CI checkbox stays open until a passing remote run is archived and reviewed. Production startup is covered at the validator and real API process boundary, including rejection of non-PostgreSQL storage and malformed vendor configuration before the server listens.

Last updated: August 9, 2026

This is the working checklist for launch readiness beyond product code.

Use this file for the practical business and operations elements that need to exist before, during, and immediately after the Barnegat launch.

Related docs:

- `ROADMAP.md`
- `MARKETING_PLAN.md`
- `SEO_PLAN.md`
- `CONTENT_PLAN.md`
- `COSTS.md`
- `STAGING_DEPLOYMENT.md`
- `MOBILE_DEPLOYMENT.md`
- `RELEASE_RUNBOOK.md`

## How To Use This File

This file is not the strategy doc.

It is the operational checklist for making sure the launch behaves like a real business and not just a working app.

## 1. Offer And Pricing

Lock the first customer-facing offer before launch traffic starts.

Checklist:

- define the exact launch services
- define which services are in-scope versus out-of-scope
- decide whether the lead message is `fast booking`, `fast quote`, or both
- define the first-customer offer or introductory incentive
- write the provider-facing explanation of the hybrid pricing model
- decide whether payment processing is absorbed or passed through
- define when custom pricing or manual review is required
- define minimum job standards for launch

Current state:

- provider search now returns backend-authored service-fit summaries for complete versus partial multi-service coverage plus provider-economics summaries that compare estimated provider net against category or service-mix, duration, and route payout floors, including an ops-review warning when a short or distant job could undercut launch supply economics
- instant quotes now ask for driveway and sidewalk measurements on lower-confidence winter hardscape jobs, so snow shoveling, snow blowing, and ice-melt salting do not rely only on address heuristics for the measurements that drive duration
- saved-property geocodes are now reused across matching authenticated quote, booking, recurring-plan, and booking-address-change inputs, so repeat customers do not repeatedly geocode the same address
- provider assistant start-route and arrival-update commands now preview/send customer-safe ETA, tracking, and arrived/getting-set-up notifications while keeping lifecycle status changes behind the normal route/work gates

Questions to answer:

- what is the simplest thing a Barnegat homeowner can buy first?
- what jobs are too custom or too operationally messy for launch?
- what wording makes the offer feel trustworthy instead of vague?

## 2. Lead Capture And Follow-Up

Every lead needs a path and an owner.

Current state:

- website follow-up forms now land in a dedicated launch-lead queue with owner assignment, first-response SLA timestamps, next-follow-up scheduling, and converted or closed-lost outcomes
- the Help center now has an email-first Contact us path for pre-booking questions
- no-booking customer `general` and `account` support tickets now auto-create linked follow-up leads, so customer-service help requests do not depend on manual ops re-entry
- automated non-website sources can now post into the launch queue through shared-secret inbound endpoints with retry-safe `sourceReferenceId` deduplication, including direct email, Google Business Profile, and referral-specific payload shapes
- direct-email lead intake can now infer likely service, launch area, callback/text number, and follow-up preference from the relayed message while keeping intake notes visible for ops confirmation, it can dedupe from inbound email `messageId` metadata while preserving reply-to and thread details for ops, and it now accepts common form-encoded relay fields like `from`, `reply_to`, `message-id`, `in-reply-to`, `text`, and `html`
- ops can now manually log phone, text, mail, social, referral, GBP, and customer-service help requests into the same queue
- GBP-style inbound leads can now stay in a `platform-message` follow-up mode when there is no direct phone or email yet, so ops can still work the original thread cleanly
- referral forwarders can now fall back to the referrer as the live follow-up contact when the referred customer's direct contact details are still partial
- the ops lead queue now preserves GBP thread details, referral fallback-contact details, and inbound intake notes as structured metadata instead of only burying them inside the lead notes
- website leads now stay linked to later self-serve booking, recurring follow-on bookings, and review generation, and matching manual email/phone leads can auto-convert too, so the ops queue can show real conversion activity
- the ops lead queue now surfaces likely booking matches and supports manual booking attachment when the booking happened before the lead was captured
- the ops lead queue now also returns backend-authored next-step guidance plus grouped copy-ready drafts for customer follow-up, provider availability outreach, curated backup coverage, first-booking pilot readiness, and referral-source handoff, including first responses, customer-service help follow-up, quote/timing follow-up, booking confirmations, completed-job review requests, closed-lost closeout replies, provider availability checks, provider backup checks, first-booking provider readiness checks, referral-source follow-up, and referral asks
- the ops overview now shows launch-lead backlog pressure too, including overdue first responses, overdue follow-ups, and source-channel rollups
- the ops overview now also shows inbound automation health for direct inbox, GBP, referral, and review-reply forwarders, including recent automated activity plus stale-channel alerts when a live relay looks quiet
- those stale inbound-forwarder alerts can now also escalate through the configured external ops contacts, so a dead launch inbox or GBP relay can page the team instead of only waiting in the dashboard
- support, cancellation, refund, and booking-expectation pages are now published and linked from the homepage, Help center, footer, and sitemap
- privacy, terms, and provider standards pages are now published and linked from Help, the footer, the sitemap, and the provider marketing page
- provider verification is now explained publicly, and the homepage, launch town page, and launch service landing pages now show real proof signals from the public marketplace overview
- provider profiles now expose backend-authored business controls, so provider owners and ops can see owner-only team access, provider-managed controls, ops-managed visibility controls, payout-sensitive re-auth requirements, and launch guardrails before deeper team permissions ship
- authenticated users now receive a backend-authored sensitive-action policy from `/api/auth/me`, including the current provider payout-settings re-auth guard and contract-ready future guards for provider bank-account, provider payout-account, and customer payment-method changes
- those proof sections now include recent completed-booking review snippets tied to verified providers plus coverage-pocket cards based on verified supply and completed jobs, not just aggregate counts
- crew work history now includes backend-authored assignment, attendance, and performance summaries, so crew can see completed work, call-off history, attendance rate, reliability status, service follow-through, evidence contribution, route confirmation, provider breadth, and dispute/refund performance signals; crew compensation is explicitly provider-managed and excluded from YardMatch payout rails
- ops payout preview now creates provider-only Stripe transfer batches when Connect is configured and keeps an explicit zero crew-transfer exposure check; local development without Stripe retains auditable manual previews
- ops can create idempotent disbursement run records from preview batches, and a freshly re-authenticated ops admin can explicitly execute eligible Stripe runs after the scheduled date; every entry is revalidated against the booking, provider credentials, Connect capabilities, captured charge, immutable settlement, and exact provider net before money moves
- Stripe charge balance transactions provide the actual processing fee used by the immutable settlement, and provider transfers plus refund/dispute reversals are recorded as balanced, idempotent ledger movements with Stripe references
- crew match history now includes backend-authored availability constraints and assignment forecasts, so crew can see available/unavailable weekdays, travel radius, equipment and winter-work limits, active accepted load, upcoming accepted work, pending review opportunities, route-leader assignments, next scheduled assignment details, and workload warnings before launch volume scales
- remaining gap: wire the live GBP/referral forwarders and an actual direct inbox relay to the inbound endpoints so fewer leads depend on manual entry

Checklist:

- list all launch lead sources
- define where each source lands
- define who responds to each source
- define target first-response time
- define what counts as `new`, `qualified`, `booked`, `lost`, and `follow-up needed`
- define text, call, and email follow-up sequence
- create one shared lead tracker if no CRM exists yet
- make sure missed calls, forms, and DMs do not disappear

Lead sources to include:

- website form
- direct mail QR or short URL
- direct mail phone or text
- Reddit
- Facebook
- Nextdoor
- Google Business Profile
- referrals

## 3. Analytics And Attribution

If launch channels are not tracked, good and bad channels will look the same.

Current state:

- public web already captures privacy-safe first-touch attribution from `utm_*`, referrer, and landing-path data and now carries it into both marketplace events and website follow-up lead intake
- website and matching email/phone launch leads now stay linked through booked, completed, repeat-booking, review-invite, and review outcomes; live forwarders still need external channel setup and monitoring

Checklist:

- define the source taxonomy
- define how source is captured on every lead
- add channel, campaign, and offer tracking where possible
- track inquiry date, booked date, completed date, and repeat-booking date
- track reviews requested and reviews received
- build a simple launch KPI dashboard
- review the data weekly during launch

Minimum launch metrics:

- inquiries by source
- booked jobs by source
- completed jobs by source
- repeat bookings by source
- cost per inquiry
- cost per booked job
- average response time
- review request rate
- review completion rate

### Production SEO Activation

Current status: Patrick has not selected a production website domain. Local SEO improvements are implemented; production indexing and search performance are unverified.

- Select the canonical HTTPS domain, set `NEXT_PUBLIC_SITE_URL`, rebuild, and verify canonical URLs, sitemap, and robots output on the deployed site.
- Verify a Search Console property through DNS or the optional `GOOGLE_SITE_VERIFICATION` meta token; submit `/sitemap.xml` and inspect the English/Spanish launch pages.
- Establish search impressions/clicks and organic lead/booking baselines once real traffic exists.
- Obtain publication consent for real local job photos and testimonials before adding them to the Barnegat pages.
- Follow `SEO_PLAN.md` for detailed checks and measurement limits.

## 4. Google Business Profile And Reviews

This is a launch system, not just a profile setup task.

Checklist:

- create and verify the profile
- choose the right primary and secondary categories
- set service area correctly
- add website, phone, hours, and business description
- upload real photos
- add launch services
- define how and when review requests are sent
- define who replies to reviews
- define how negative reviews are escalated

Review workflow:

- request reviews only from real completed jobs
- ask quickly after successful service
- keep the ask simple
- respond to every review

## 5. Provider Onboarding And Quality Control

Supply quality can break trust faster than weak marketing can build it.

Checklist:

- define provider acceptance criteria
- define required business information
- define insurance or licensing checks if needed
- define service-area expectations
- define response-time expectations
- define cancellation and no-show expectations
- define photo or proof-of-work requirements
- define when a provider is paused, warned, or removed
- define who reviews provider quality issues

Minimum quality signals to watch:

- acceptance rate
- on-time rate
- cancellation rate
- support issue rate
- review quality
- repeat-booking rate

Current state:

- provider verification queue/profile responses now expose backend-authored onboarding automation actions with owners, priorities, due timestamps, route targets, blocking step keys, and notification copy
- ops can now run an authenticated provider onboarding automation sweep that sends due provider/ops action notifications idempotently and reports sent, already-sent, blocked, completed, dry-run, and not-due outcomes
- rejected providers who materially fix profile or dispatch blockers automatically re-enter pending review, and ops users receive an account notification pointing back to the provider verification queue

## 6. Customer Trust Assets

Trust needs to exist before a stranger is willing to book.

Checklist:

- write a clear `why YardMatch` explanation
- publish support contact information
- publish cancellation expectations
- publish refund expectations
- publish booking expectation FAQs
- add real photos where possible
- add early reviews once available
- make sure the website clearly explains what happens after a customer submits a request

Good trust assets:

- FAQs
- provider verification explanation
- booking process explanation
- review policy explanation
- support and escalation language

Current state:

- the public site explains provider verification, and the ops verification queue now includes a launch-fit checklist plus a recommended action before a provider goes live
- that checklist now covers profile completeness, service scope, launch-area fit, experience signal, operational readiness, service-quality expectations, and intervention readiness
- approvals that override a `manual-review` or `reject` recommendation now require a detailed launch rationale, so provider go-live exceptions stay auditable
- providers now see a backend-authored verification summary and checklist in their own dashboard, can edit company name, bio, experience, and categories directly, and rejected providers automatically move back into pending review when they make meaningful verification-related updates

## 7. Policy Basics

The policies do not need to be huge, but they do need to exist.

Checklist:

- privacy policy
- terms of service
- cancellation policy
- refund policy
- provider agreement or provider terms
- review policy alignment
- support and dispute escalation rules

Watch-out:

- the public promise, product behavior, and support behavior all need to match

## 8. Local Operations Playbook

This is the part many launches discover too late.

Checklist:

- define launch radius
- define neighborhoods or ZIPs that are in-range now
- define what happens when no provider is available
- define what happens when weather forces a reschedule
- define what happens when a customer no-shows
- define what happens when a provider no-shows
- define same-day versus future-booking rules
- define who communicates changes to the customer
- define which jobs require manual ops review

Operational scenarios to rehearse:

- booked job but no provider accepts
- provider accepts then cancels
- heavy rain changes route viability
- customer reports poor-quality service
- provider disputes the complaint

Current state:

- backend place search now has local fallback seeds for Barnegat/Ocean County launch pockets, including Barnegat, Manahawkin, Waretown, Forked River, Toms River, and Long Beach Township, with exact town/ZIP/known alias matches eligible for auto-select while partial guesses still require customer confirmation
- the ops overview now includes a backend-authored launch operations policy for coverage limits, low-supply recovery, weather and delay handling, no-shows, service-quality issues, completed-job disputes, evidence standards, intervention rules, escalation triggers, live pressure warnings, ZIP-level coverage pocket pressure summaries, and coverage action recommendations
- completed paid dispute cancellations now require refund-review settlement first, so captured customer payment and provider payout holds stay reconciled before ops closes a customer-favoring completed-job dispute
- ops can now create or reuse auditable launch-operations task records from current coverage recommendations, assign them, update status, record operator/completion notes, run an idempotent due-task notification sweep, escalate overdue tasks with priority-based thresholds, and include launch-task sweeps in the broader backend ops-automation runner with actor-stamped run history
- remaining gap: wire the backend runner into the chosen recurring scheduler and external ops workspace once the launch task handoff model is chosen

## 9. Retention And Repeat-Service

The hybrid model gets much stronger when repeat behavior is real.

Checklist:

- the customer dashboard now surfaces backend-authored “book again” and “start recurring mowing” nudges after completed jobs, and those nudges re-price the service plus reload a fresh recommendation instead of blindly cloning the last booking
- the first timing rules are now live too: recent-completion mowing nudges, 30-day cleanup follow-up, 60-day hedge-trimming reminders, spring mulch-refresh and fertilization reminders, fall leaf-return, aeration, and gutter-prep reminders, winter snow/ice readiness reminders, and a broader 90-day rebook fallback
- mowing retention now also distinguishes between weekly and every-2-weeks plans from recent booking history and calls out repeat-customer/provider-loyal context when the same property has already completed multiple visits
- loyalty-backed retention rebooks can now softly prefer a proven prior provider when the same property has strong completed-job history, while still running a fresh recommendation flow with alternatives
- the ops overview now tracks retention nudge views, clicks, acceptance rate, strategy-level performance, actual repeat-service conversions by retention source and provider, and backend-authored retention insights for low-volume caveats, leading strategies, weak click-to-booking handoffs, and provider-led repeat booking patterns so repeat-service momentum is visible before volume gets large
- remaining gap: define which additional services should push toward recurring cadence beyond the first mowing loop
- keep using launch retention data to decide whether gutter, snow, and ice prompts should stay one-time reminders or become stronger seasonal packages
- broaden loyalty or repeat-customer messaging beyond the current in-product retention prompts
- use retention insights during launch reviews to decide which source, provider, and strategy patterns deserve more volume

Best early retention candidates:

- lawn mowing
- seasonal cleanup follow-up
- hedge trimming reminders

## 10. Scripts And Templates

The launch moves faster when the team is not rewriting everything live.

Checklist:

- first-response text template
- missed-call callback template
- quote follow-up template
- booking-confirmation template
- review-request template
- referral-request template
- provider outreach template
- provider backup coverage template
- provider pilot-readiness template
- partner outreach template
- cancellation or delay template
- issue-resolution template

Important rule:

- templates should save time without sounding robotic
- the current ops lead queue now covers customer, provider availability, provider backup coverage, first-booking provider readiness, and referral-source drafts, the ops support queue covers delay, cancellation, refund, issue-resolution customer updates, provider coordination templates, structured exception-handling scripts for weather/route delays, no-shows, not-ready customers, access blockers, and incomplete service, plus stale-ticket SLA escalation notifications, and the ops dashboard now includes a public review-response queue with urgency labels, copy-ready replies, persisted posted/skipped state, channel-aware posting audit fields for GBP/shared-inbox/manual replies, structured mailbox/thread/location metadata for posted replies, a secret-protected generic inbound confirmation route plus source-specific shared-inbox and GBP forwarder routes for external reply automation, and an explicit path to open or link service-quality follow-up from negative reviews; remaining work is the real posting habit and the broader local ops playbook
- the internal ops dashboard and its launch/support/review/payout/verification tools now require an authenticated `ops` session instead of loading anonymously in the browser; seeded local `ops-admin` access, the CLI provisioning path, a first in-dashboard ops-account management board, an admin-vs-staff scope split for internal account management, invite/reset flows that avoid manually sharing passwords, account deactivate/reactivate controls, explicit auth-lock clearing with audit notes, a persisted access-change history, a persisted auth-event history for sign-ins / failures / lock triggers / reset flows / session rotations / explicit lock clears, last successful sign-in tracking, failed-sign-in tracking, repeated-failure temporary login locks, backend-authored internal access alerts for temporary locks / repeated failures / disabled-account login attempts, and live overview reporting for internal access health now exist, and the remaining work is the deeper internal role lifecycle beyond that bootstrap path

## 11. Launch Dashboard

This is the minimum operating view for the first few weeks.

Checklist:

- one place to see daily inquiries
- one place to see booked jobs
- one place to see source attribution
- one place to see pending follow-ups
- one place to see provider issues
- one place to see reviews requested and received

Current state:

- the ops dashboard now covers launch-lead backlog pressure plus review invites created, sent, opened, completed, expired, and invite-to-review completion rate
- the ops overview now also returns backend-authored recommendation insights for low-volume caveats, coverage/open-window gaps, weak source handoffs, and strongest current recommendation surface across public web, customer dashboard, and customer mobile sources

Minimum daily launch review:

- new leads
- response times
- bookings created
- jobs at risk
- customer complaints
- provider availability issues

## 12. Pre-Launch Readiness Check

Before turning on real traffic, confirm:

- the offer is finalized
- the customer path is clear
- the support contact path works
- lead tracking works
- policies exist
- Google Business Profile is live or in progress
- the first review-request flow exists
- provider standards are defined
- the launch radius is explicit
- the team knows who handles what

## 13. First 2 Weeks After Launch

During the first 2 weeks, review:

- which channels produce real inquiries
- which channels produce real bookings
- where leads are getting stuck
- whether response speed is fast enough
- what customers ask repeatedly
- whether providers are meeting expectations
- whether reviews are being requested consistently
- whether repeat-service opportunities are being missed

## Recommended Immediate Next Steps

The remaining launch steps now require business, legal, vendor, or production owners:

1. Approve the provider agreement, pricing posture, crew-responsibility language, credential matrix, and payment/refund/dispute allocation.
2. Activate Stripe Connect and run the archived staging lifecycle evidence listed in the financial gate section.
3. Verify every launch provider's business registration, liability insurance, and workers-compensation coverage or approved exemption.
4. Run the production configuration preflight and archive the green PostgreSQL CI artifact.
5. Select and configure production media storage/CDN, malware scanning, moderation, retention, and deletion controls for property and proof-of-work photos.
6. Activate the production email, SMS, push, direct-inbox, Google Business Profile, referral, review-response, and recurring scheduler integrations.
7. Rehearse the launch operations playbook with named owners before turning on traffic.
