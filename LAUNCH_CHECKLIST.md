# YardMatch Launch Checklist

Last updated: June 17, 2026

This is the working checklist for launch readiness beyond product code.

Use this file for the practical business and operations elements that need to exist before, during, and immediately after the Barnegat launch.

Related docs:

- `ROADMAP.md`
- `MARKETING_PLAN.md`
- `SEO_PLAN.md`
- `CONTENT_PLAN.md`
- `COSTS.md`

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
- direct-email lead intake can now infer likely service, launch area, callback/text number, and follow-up preference from the relayed message while keeping intake notes visible for ops confirmation, and it can now also dedupe from inbound email `messageId` metadata while preserving reply-to and thread details for ops
- ops can now manually log phone, text, mail, social, referral, GBP, and customer-service help requests into the same queue
- GBP-style inbound leads can now stay in a `platform-message` follow-up mode when there is no direct phone or email yet, so ops can still work the original thread cleanly
- referral forwarders can now fall back to the referrer as the live follow-up contact when the referred customer's direct contact details are still partial
- the ops lead queue now preserves GBP thread details, referral fallback-contact details, and inbound intake notes as structured metadata instead of only burying them inside the lead notes
- website leads now stay linked to later self-serve booking, recurring follow-on bookings, and review generation, and matching manual email/phone leads can auto-convert too, so the ops queue can show real conversion activity
- the ops lead queue now surfaces likely booking matches and supports manual booking attachment when the booking happened before the lead was captured
- the ops lead queue now also returns backend-authored next-step guidance plus grouped copy-ready drafts for customer follow-up, provider availability outreach, and referral-source handoff, including first responses, customer-service help follow-up, quote/timing follow-up, booking confirmations, completed-job review requests, closed-lost closeout replies, provider availability checks, referral-source follow-up, and referral asks
- the ops overview now shows launch-lead backlog pressure too, including overdue first responses, overdue follow-ups, and source-channel rollups
- support, cancellation, refund, and booking-expectation pages are now published and linked from the homepage, Help center, footer, and sitemap
- privacy, terms, and provider standards pages are now published and linked from Help, the footer, the sitemap, and the provider marketing page
- provider verification is now explained publicly, and the homepage, launch town page, and launch service landing pages now show real proof signals from the public marketplace overview
- those proof sections now include recent completed-booking review snippets tied to verified providers plus coverage-pocket cards based on verified supply and completed jobs, not just aggregate counts
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
- remaining gap: connect booked, completed, repeat-booking, and review outcomes back to the same inquiry record without manual reconciliation

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

- the ops dashboard now includes a first structured launch playbook for coverage limits, low-supply recovery, weather and delay handling, no-shows, and provider go-live decisions
- remaining gap: expand that guidance into deeper service-quality expectations, intervention rules, and any neighborhood-or-ZIP-level launch detail ops still needs

## 9. Retention And Repeat-Service

The hybrid model gets much stronger when repeat behavior is real.

Checklist:

- the customer dashboard now surfaces backend-authored “book again” and “start recurring mowing” nudges after completed jobs, and those nudges re-price the service plus reload a fresh recommendation instead of blindly cloning the last booking
- the first timing rules are now live too: recent-completion mowing nudges, 30-day cleanup follow-up, 60-day hedge-trimming reminders, spring mulch-refresh and fertilization reminders, fall leaf-return and aeration reminders, and a broader 90-day rebook fallback
- mowing retention now also distinguishes between weekly and every-2-weeks plans from recent booking history and calls out repeat-customer/provider-loyal context when the same property has already completed multiple visits
- loyalty-backed retention rebooks can now softly prefer a proven prior provider when the same property has strong completed-job history, while still running a fresh recommendation flow with alternatives
- the ops overview now tracks retention nudge views, clicks, acceptance rate, strategy-level performance, and actual repeat-service conversions by retention source and provider so repeat-service momentum is visible before volume gets large
- remaining gap: define which additional services should push toward recurring cadence beyond the first mowing loop
- deepen seasonal reminder flows beyond the current mulch, fertilization, leaf-return, and aeration windows
- broaden loyalty or repeat-customer messaging beyond the current in-product retention prompts
- track repeat-service conversion by source and by provider

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
- partner outreach template
- cancellation or delay template
- issue-resolution template

Important rule:

- templates should save time without sounding robotic
- the current ops lead queue now covers customer, provider, and referral-source drafts, the ops support queue covers delay, cancellation, refund, and issue-resolution customer updates, and the ops dashboard now includes a public review-response queue with urgency labels, copy-ready replies, persisted posted/skipped state, and an explicit path to open or link service-quality follow-up from negative reviews; remaining work is the real posting habit and deeper exception-handling scripts plus the broader local ops playbook
- the internal ops dashboard and its launch/support/review/payout/verification tools now require an authenticated `ops` session instead of loading anonymously in the browser; seeded local ops access and the CLI provisioning path now exist, and the remaining work is the fuller ops/admin role lifecycle beyond that bootstrap path

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

If we want the highest-leverage business readiness work next, do these first:

1. Finalize the launch offer and service scope.
2. Create the lead tracker and source taxonomy.
3. Set up Google Business Profile and review workflow.
4. Write the provider acceptance and quality rules.
5. Publish the core customer-facing policy and trust pages.
6. Define the repeat-service follow-up plan for mowing customers.
7. Draft the launch scripts and templates.
