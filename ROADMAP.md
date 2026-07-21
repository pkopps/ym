# YardMatch Roadmap And TODO

This is the single source of truth for forward-looking product and launch work.

Keep this file focused on decisions, priorities, and unfinished work. Completed feature history belongs in `README.md` only when it explains current product behavior or developer setup.

## Product Direction

### Product Design Standard

YardMatch should feel like the simplest possible landscaping marketplace: calm, predictable, polished, and never AI-generated.

Use the public UX reference screenshots in `zocdoc-screenshots/screenshots/zocdoc/` as pattern research only. Study the marketplace mechanics: search, filters, provider cards, profiles, booking steps, trust cues, progressive disclosure, mobile screenshots, and app-store onboarding. Do not copy Zocdoc branding, logos, exact text, or protected visual identity.

Before changing customer, provider, or crew UI, check whether the change reduces cognitive load, removes unnecessary decisions, keeps one clear purpose per screen, makes the next action obvious, improves trust, and feels natural on iOS. If not, simplify before building.

YardMatch / GreenRain is a managed marketplace, not a directory.

The customer experience should stay recommendation-first:

1. Customer chooses the service, timing, and property.
2. YardMatch recommends the best provider for that request.
3. Customer can confirm quickly.
4. Customer can reveal a small set of qualified backup options if they want more trust.

Avoid drifting into:

- open-ended provider browsing as the default flow
- many-provider bidding on one common-service lead
- quote-comparison-first behavior for routine property care
- promoted-listings-first discovery
- ranking or pricing choices that squeeze provider economics and damage supply quality

## Priority 1: Launch-Critical

### Payments And Payouts

- Turn on real Stripe credentials in development and staging.
- Verify production-style Stripe webhook handling end to end with live credentials now that local webhook reconciliation covers checkout completion, expiry, payment failures, and refund events.
- Use checkout start/capture/failure telemetry in ops while validating the live Stripe cutover so abandoned or expired payment sessions are visible without raw event digging.
- Validate live Stripe refund synchronization in development and staging after ops approves a refund review.
- Keep validating dispute-related settlement freezes now that disputed bookings block new payment attempts and hold captured provider/crew payouts until support resolves them.
- Turn the backend-authored payout policy, manual provider/crew disbursement batch previews, and idempotent manual disbursement run audit records now exposed in the ops payout routes into real provider and crew disbursement rails once the production payout provider and credentials are selected.

### Notification Delivery

- Finish production push rollout beyond development Expo tokens.
- Decide whether production push should stay on Expo push or move to direct APNs / FCM.
- Confirm production email and SMS sender setup for Resend and Twilio.
- Keep ops notification-health monitoring active for overdue retries, noisy channels, external alert target drift, and the backend-authored delivery policy now showing missing production sender configuration.

### Auth And Sensitive Actions

- Keep Google and Apple auth configured in staging and production.
- Extend stronger re-auth beyond the current provider payout-setting guard and the backend-authored `sensitiveActionPolicy` now returned by `/api/auth/me` for future provider bank-account, provider payout-account, and customer payment-method changes into actual future bank/payment-method routes when those surfaces are built.
- Keep tightening internal-role separation beyond the new authenticated internal guard now protecting the web ops dashboard and internal ops API surfaces from anonymous access. Dedicated `ops` accounts now exist for staff login, seeded local admin access exists for development, the provider/business-owner fallback has been removed from internal ops access, internal account-management routes are now limited to `ops-admin` while ordinary ops tooling still works for operations staff, the internal dashboard can now list/create/update ops accounts plus rotate another ops user's sessions/password without dropping to the CLI, it can prepare reset/invite links for new or existing ops users through the normal password-reset flow instead of relying on manually shared passwords, it can deactivate or reactivate another ops account while invalidating active sessions, it can now also explicitly clear a temporary auth lock with an audit note, it preserves a structured access-change history instead of only the most recent note, it now tracks the most recent successful internal sign-in method/time plus failed-sign-in state per ops account, repeated failed ops password attempts now trigger a temporary lock until recovery, each ops account now keeps a durable authentication-event history for sign-ins / failures / lock triggers / reset flows / session rotations / explicit lock clears, and the live ops overview now reports internal access health, locked-or-dormant accounts, backend-authored internal access alerts for temporary locks / repeated failures / disabled-account login attempts, a backend-authored admin-and-operations access governance policy, recent access changes, recent internal auth events, recent internal sign-ins, and recent failed internal sign-ins. The remaining work is the deeper internal lifecycle beyond this first admin-vs-staff split, especially more granular RBAC once the internal org grows past the current admin/operations model.

### Production Operations

- Keep extending support and financial exception tooling beyond the current structured ticket timeline, payout-hold queue, refund review history, booking intervention history, evidence-review history, the new evidence-before-resolution guard for disputes and refund reviews, backend-authored customer update drafts for delays, cancellations, refund approvals or denials, issue-resolution follow-up, provider coordination templates, structured exception-handling scripts for weather/route delays, no-shows, not-ready customers, access blockers, and incomplete-service cases, and the ops-authenticated stale-ticket escalation sweep that notifies ops when unresolved launch-sensitive support cases pass backend-owned SLA thresholds.
- Keep testing completed-job dispute scenarios now that provider-favoring resolutions should return those bookings to `completed` and release payout holds cleanly, while customer-favoring cancellation of completed paid disputes is blocked until a refund review is open or approved so settlement state stays reconciled.
- Keep tightening dispute evidence workflows beyond the current before/after photos, notes, and checklists now that ops must review at least one submitted evidence item before resolving dispute/service-quality/refund-review tickets, the final resolution direction must match the reviewed evidence signal, mixed evidence requires a specific written rationale before the case can close, and the ops UI now reads those guardrails from a backend-authored resolution policy instead of client-side heuristics.
- Keep aligning manual intervention tooling with the same dispute/refund controls now that outcome-changing ops interventions must also link the support ticket, respect reviewed evidence direction, and use a specific intervention rationale when the evidence is mixed or inconclusive.
- Continue testing booking interventions, refund reviews, and payout holds with real-world scenarios.

### Launch Readiness And Go-To-Market Ops

- Finalize business approval for the first-customer offer and introductory pricing posture now that instant quotes and the public marketplace overview expose a backend-authored hybrid-model launch pricing policy with service list and provider-facing economics explanation.
- Keep extending the new launch-lead queue beyond the current email-first Contact us forms, the automatic linkage for no-booking customer general/account support tickets, the new shared-secret inbound endpoints for direct email/GBP/referral-style forwarders, the new `platform-message` contact mode for Google Business Profile-style thread follow-up without a direct phone/email yet, the new referral-forwarder fallback path that can follow up through the referrer when the customer details are still partial, the new structured channel metadata for GBP thread details, referral fallback contacts, inbound-intake notes, direct-email reply-to details, and email message/thread ids, the new relayed-message inference that can now pull likely service/area/contact cues out of direct-email inquiries before ops touches them, the new form-encoded direct-inbox relay compatibility for common forwarded-email fields like `from`, `reply_to`, `message-id`, `in-reply-to`, `text`, and `html`, the new launch-lead backlog metrics now visible in ops, the new inbound-automation health section in the ops overview that shows source-level activity, expected-but-never-seen channel alerts, and external escalation for stale automated lead and review forwarders, ops manual intake for phone/text/social/referral/mail/GBP/customer-service requests, owner assignment, first-response SLA, next-follow-up scheduling, converted/closed-lost outcomes, and the backend-authored next-step guidance plus copy-ready customer reply drafts now shown in the ops queue so every inbound pre-booking inquiry lands in the same owned workflow automatically where possible.
- Keep extending the current privacy-safe first-touch web attribution and launch-lead loop beyond the current website flow, which now links Contact us inquiries through self-serve booking, recurring follow-on bookings, and review generation, can auto-convert matching email or phone leads entered by ops, and now gives ops suggested booking matches plus manual attachment for cases where the booking happened before the lead existed. The remaining work is expanding the same closed-loop linkage to live inbound channels automatically instead of relying on manual ops intake, especially direct-inbox forwarding and any remaining referral/GBP forwarders that still are not posting into the queue yet.
- Launch and fully complete Google Business Profile, review-request workflows, and public review-response habits as a first-class local-growth system. The ops overview now covers review invites created, sent, opened, completed, expired, and invite-to-review completion rate, and now also surfaces a backend-authored public review-response queue with priority, draft replies, persisted posted/skipped response state, channel-aware posting audit fields for GBP/shared-inbox/manual replies, structured reply-channel metadata for mailbox/thread/location traceability, a secret-protected generic inbound confirmation route plus source-specific shared-inbox and GBP forwarder routes for external reply automation, and an explicit path to open or link service-quality support follow-up from negative reviews. The remaining work is still the live GBP loop plus the real outward-facing posting habit once those replies are happening in production.
- Keep extending provider onboarding and verification beyond the current queue guidance and checklist now shown to ops for profile completeness, service scope, launch-area fit, experience signal, operational readiness, service-quality expectations, incident history, and intervention readiness, the approval-override rule that requires a detailed rationale before ops can send a `manual-review` or `reject` recommendation live anyway, the provider-side verification summary plus auto-resubmission loop for rejected businesses that make meaningful profile or dispatch-setting fixes, the backend-authored onboarding automation plan now returned on verification queue/profile responses for profile fixes, dispatch-setting fixes, ops review, narrow launch pilots, first-booking monitoring, incident recovery, stable owner/priority/due-date automation actions, blocking step keys, route targets, notification copy, automatic ops notifications when rejected providers re-enter review, and the ops-authenticated onboarding automation sweep that idempotently sends due provider/ops action notifications. The remaining work is deeper live workflow automation beyond this notification-backed sweep before scaling supply.
- Build on the now-published support, cancellation, refund, booking-expectation, privacy, terms, provider-standards, and provider-verification pages and the new homepage, town-page, and service-page proof sections, which now also surface recent completed-booking review snippets tied to verified providers plus current coverage pockets from verified supply and completed jobs, by adding the remaining credibility assets still needed for launch, especially deeper neighborhood-level proof and any deeper provider-facing agreement detail that operations or legal review still require.
- Keep technical SEO cleanup moving beyond the current real site-url config, public-route sitemap focus, internal-route crawl blocking, Barnegat launch defaults, and the first live landing pages for `/barnegat-nj`, lawn mowing, and yard cleanup into stronger local trust signals and the next town/service content wave.
- Keep extending the in-product launch operations playbook beyond the backend-authored policy now exposed on the ops overview for coverage limits, low-supply recovery, weather and delay handling, no-shows, service-quality issues, completed-job disputes, evidence standards, intervention rules, escalation triggers, live pressure warnings, ZIP-level coverage pocket pressure summaries, and coverage action recommendations built from verified supply, booking load, field exceptions, service-quality tickets, and supported categories. Ops can now create or reuse auditable task records from current coverage recommendations, update assignment, status, operator notes, and completion notes, run idempotent due-task notifications, escalate overdue tasks with priority-based thresholds, and include those launch task sweeps in the authenticated backend ops-automation runner alongside provider onboarding and support SLA sweeps; each runner invocation now persists an actor-stamped run history for audit and external scheduler reconciliation. The remaining work is external scheduler/workspace integration, production cadence, and any source-of-truth handoff details before scaling.
- Keep extending the first retention loops beyond the current dashboard nudges that now turn completed one-time jobs into recommendation-first “book again” or “start recurring mowing” flows, with observability on nudge views, clicks, acceptance rate, strategy-level performance, actual repeat-service conversions by retention source and provider, and backend-authored retention insights for low-volume caveats, leading strategies, source handoff quality, and provider-led repeat booking patterns. The current timing rules now cover recent mowing follow-up, 30-day cleanup follow-up, 60-day hedge-trimming reminders, spring mulch-refresh and fertilization windows, fall leaf-return, aeration, and gutter-prep windows, winter snow/ice readiness windows, and a broader 90-day rebook fallback, and mowing prompts now distinguish between weekly and every-2-weeks cadence while carrying repeat-customer/provider-loyal context into the UI and analytics. Retention-driven rebooks can now also softly prefer a proven prior provider when the customer has strong same-property history, without abandoning fresh ranking or curated alternatives. The remaining work is richer loyalty/package logic beyond these timing windows as launch volume clarifies which services should become recurring or seasonal habits.
- Keep expanding the new launch scripts/templates layer beyond the current grouped drafts now generated in the ops lead queue for first response, quote follow-up, customer-service help follow-up, booking confirmation, completed-job review requests, closed-lost/exception closeout replies, provider availability outreach, curated backup coverage checks, first-booking pilot readiness checks, referral-source handoff follow-up, referral asks, public review responses, support-side provider coordination for active field exceptions, and structured support exception scripts for weather/route delays, no-shows, not-ready customers, access blockers, and incomplete service into the broader local ops playbook.
- Keep the detailed execution checklist current in `LAUNCH_CHECKLIST.md`.

## Priority 2: Marketplace Quality

### Customer Matchmaking

- Keep improving trust framing as longer-term dispute, cancellation, fulfillment, and review signals become reliable.
- Keep alternative providers curated and limited.
- Review recommendation performance by surface as launch volume grows, now that the ops overview exposes source-level metrics plus backend-authored recommendation insights for:
  - public web listings
  - customer web dashboard
  - customer mobile booking
- Track and review:
  - recommendation views
  - alternative reveals
  - recommendation dismissals
  - accepted recommendations
  - swapped recommendations
  - recommendation acceptance rate
- Add deeper time-based cohort interpretation once traffic volume is meaningful beyond the current source-level low-volume, coverage, handoff, and strongest-surface insights.
- Do not launch hidden Uber-style matching as the default unless trust data later supports it.

### Search, Location, And Address Quality

- Keep improving geocoding quality beyond the fallback dataset and optional Google APIs, now that the local fallback dataset covers the Barnegat/Ocean County launch pockets with town, ZIP, and practical alias matching.
- Keep saved-property geocode reuse aggressive within allowed usage rules now that matching authenticated quote, booking, recurring-plan, and booking-address-change inputs reuse the saved property geocode instead of repeatedly geocoding the same address.
- Keep anonymous location lookup session-scoped unless there is a clear product reason to save it.
- Keep tuning which fallback area suggestions can be auto-selected and which require customer confirmation, preserving the current guard that exact town/ZIP/known aliases are strong while partial fallback guesses need confirmation.
- Evaluate whether denser market coverage can improve neighborhood-aware matching confidence beyond the first Barnegat, Manahawkin, Waretown, Forked River, Toms River, and Long Beach Township launch seeds.
- Continue improving quote and property-measurement confidence beyond the current saved-property, follow-up-answer, winter hardscape driveway/sidewalk, and complex-lot confidence prompts, especially once licensed imagery or parcel data becomes available.

### Ranking And Provider Economics

- Keep tuning provider ranking beyond the current score-and-explanation model.
- Add trustworthy conversion, reliability, and fulfillment signals only after they have enough data volume.
- Keep service-fit weighting strong for more complex multi-service requests, now that provider search exposes complete-versus-partial service-fit summaries and can recommend full-mix providers ahead of partial category matches.
- Preserve provider-first economics, including minimum acceptable payout thinking, now surfaced in provider search as a backend-authored estimated-net-vs-payout-floor summary for the requested category or service mix, duration, and route.

## Priority 3: Provider Operations

### Dispatch And Assistant

- Keep broadening dispatch-adjustment reasoning beyond the current single-command recommendation set, now that the assistant compares candidate relief slots, returns staffing-first guidance when crew capacity is the dominant pressure, and includes a multi-booking staffing plan for competing crew gaps.
- Keep enriching staffing recommendations with real crew acceptance, call-off, and route-leader behavior now that the assistant returns structured review/source guidance across multiple bookings and can flag fully staffed accepted-crew-fallback jobs that still need a route leader assigned.
- Keep broadening crew/provider coordination actions from natural-language requests now that provider assistant messages can target named crew, the route leader, or all accepted crew on a booking, and start-route commands preview/send backend-estimated customer ETA, arrival, and live tracking copy without bypassing lifecycle gates.

### Calendar Interoperability

- Polish mixed on-platform and off-platform schedule sync.
- Evaluate deeper Google / Apple calendar interoperability only if two-way sync becomes worth the complexity.

### Route And Crew Location

- Decide whether background location is worth the operational and privacy complexity.
- If broader crew tracking is added, keep individual crew-member location visible only to the business owner who hired the crew.
- Property owners should continue to see only the business/provider route status, not individual crew members.

## Priority 4: Post-Launch Growth

### Customer Experience

- Improve saved preferences and faster rebooking loops.
- Add richer recurring-service subscription controls if customer demand supports it.
- Improve post-service loyalty and follow-up flows.
- Expand arrival and tracking notifications after live operations show the right cadence.

### Crew Experience

- Keep extending crew performance summaries beyond the backend-authored payout-ledger performance summary now covering completed assignments, clean completions, dispute/refund signals, route confirmation, crew-captured evidence, provider breadth, service categories, highlights, warnings, and performance status.
- Keep extending crew attendance history beyond the backend-authored payout-ledger attendance summary now covering accepted assignments, active assignments, completed assignments, crew cancellations, attendance rate, last cancellation, and reliability status.
- Keep extending crew availability constraints beyond the backend-authored crew match constraints summary now covering available and unavailable weekdays, travel radius, schedule preference, equipment and winter-work limits, active accepted load, route-leader load, status, warnings, and guidance.
- Keep extending crew earnings and payout history beyond the current crew payout ledger and backend-authored earnings summary now covering completed assignment count, ready/scheduled/on-hold/reversed earnings, customer-payment holds, weekly payout timing, and payout guidance.
- Keep improving crew assignment forecasting beyond the backend-authored crew match forecast now covering upcoming accepted work, pending provider review, active assignments, route-leader assignments, next scheduled provider/category/status, workload band, warnings, and guidance.

### Provider Business Tooling

- Keep extending team permissions beyond the backend-authored owner-only team access policy now exposed on provider profiles.
- Keep extending richer business profile controls beyond the backend-authored provider businessControls summary now covering owner-managed profile/dispatch/payout controls, ops-managed visibility controls, fresh re-auth requirements, launch guardrails, and warnings.
- Keep extending onboarding automation beyond the current contract-backed provider onboarding actions, ops resubmission notifications, and idempotent onboarding automation sweep.
- Explore partnership and affiliate workflows after the core marketplace is stable.

## Operating Principles

- Local density beats broad sparse expansion.
- Dense routes improve recommendation quality, provider earnings, and customer reliability.
- Every customer-facing feature should reduce effort unless added choice materially improves trust or outcomes.
- Every provider-facing feature should make operations easier, not create more admin work.
- Docs should stay current by removing completed backlog items instead of accumulating victory laps.
