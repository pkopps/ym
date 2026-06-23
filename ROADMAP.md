# YardMatch Roadmap And TODO

This is the single source of truth for forward-looking product and launch work.

Keep this file focused on decisions, priorities, and unfinished work. Completed feature history belongs in `README.md` only when it explains current product behavior or developer setup.

## Product Direction

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
- Define payout disbursement rules and eventual payout rails for providers and crew.

### Notification Delivery

- Finish production push rollout beyond development Expo tokens.
- Decide whether production push should stay on Expo push or move to direct APNs / FCM.
- Confirm production email and SMS sender setup for Resend and Twilio.
- Keep ops notification-health monitoring active for overdue retries and noisy channels.

### Auth And Sensitive Actions

- Keep Google and Apple auth configured in staging and production.
- Extend stronger re-auth beyond the current provider payout-setting guard to future bank changes and payment-method changes.

### Production Operations

- Keep extending support and financial exception tooling beyond the current structured ticket timeline, payout-hold queue, refund review history, booking intervention history, evidence-review history, the new evidence-before-resolution guard for disputes and refund reviews, and the first backend-authored customer update drafts now shown in the ops support queue for delays, cancellations, refund approvals or denials, and issue-resolution follow-up.
- Keep testing completed-job dispute scenarios now that provider-favoring resolutions should return those bookings to `completed` and release payout holds cleanly.
- Keep tightening dispute evidence workflows beyond the current before/after photos, notes, and checklists now that ops must review at least one submitted evidence item before resolving dispute/service-quality/refund-review tickets, the final resolution direction must match the reviewed evidence signal, mixed evidence requires a specific written rationale before the case can close, and the ops UI now reads those guardrails from a backend-authored resolution policy instead of client-side heuristics.
- Keep aligning manual intervention tooling with the same dispute/refund controls now that outcome-changing ops interventions must also link the support ticket, respect reviewed evidence direction, and use a specific intervention rationale when the evidence is mixed or inconclusive.
- Continue testing booking interventions, refund reviews, and payout holds with real-world scenarios.

### Launch Readiness And Go-To-Market Ops

- Lock the first-customer offer, launch service list, introductory pricing framing, and provider-facing pricing explanation around the chosen hybrid model.
- Keep extending the new launch-lead queue beyond the current email-first Contact us forms, the automatic linkage for no-booking customer general/account support tickets, the new shared-secret inbound endpoints for direct email/GBP/referral-style forwarders, the new `platform-message` contact mode for Google Business Profile-style thread follow-up without a direct phone/email yet, the new referral-forwarder fallback path that can follow up through the referrer when the customer details are still partial, the new structured channel metadata for GBP thread details and referral fallback contacts, the new launch-lead backlog metrics now visible in ops, ops manual intake for phone/text/social/referral/mail/GBP/customer-service requests, owner assignment, first-response SLA, next-follow-up scheduling, converted/closed-lost outcomes, and the backend-authored next-step guidance plus copy-ready customer reply drafts now shown in the ops queue so every inbound pre-booking inquiry lands in the same owned workflow automatically where possible.
- Keep extending the current privacy-safe first-touch web attribution and launch-lead loop beyond the current website flow, which now links Contact us inquiries through self-serve booking, recurring follow-on bookings, and review generation, can auto-convert matching email or phone leads entered by ops, and now gives ops suggested booking matches plus manual attachment for cases where the booking happened before the lead existed. The remaining work is expanding the same closed-loop linkage to more inbound channels automatically instead of relying on manual ops intake, especially live direct-inbox forwarding and any remaining referral/GBP forwarders that still are not posting into the queue yet.
- Launch and fully complete Google Business Profile, review-request workflows, and public review-response habits as a first-class local-growth system. The ops overview now covers review invites created, sent, opened, completed, expired, and invite-to-review completion rate, but the remaining work is still the live GBP loop and the outward-facing review-response habit.
- Keep extending provider onboarding and verification beyond the current queue guidance and checklist now shown to ops for profile completeness, service scope, launch-area fit, experience signal, operational readiness, service-quality expectations, and intervention readiness, the new approval-override rule that requires a detailed rationale before ops can send a `manual-review` or `reject` recommendation live anyway, and the new provider-side verification summary plus auto-resubmission loop for rejected businesses that make meaningful profile or dispatch-setting fixes. The remaining work is any still-missing intervention rules, tighter go-live criteria, and broader onboarding automation before scaling supply.
- Build on the now-published support, cancellation, refund, booking-expectation, privacy, terms, provider-standards, and provider-verification pages and the new homepage, town-page, and service-page proof sections, which now also surface recent completed-booking review snippets tied to verified providers plus current coverage pockets from verified supply and completed jobs, by adding the remaining credibility assets still needed for launch, especially deeper neighborhood-level proof and any deeper provider-facing agreement detail that operations or legal review still require.
- Keep technical SEO cleanup moving beyond the current real site-url config, public-route sitemap focus, internal-route crawl blocking, Barnegat launch defaults, and the first live landing pages for `/barnegat-nj`, lawn mowing, and yard cleanup into stronger local trust signals and the next town/service content wave.
- Keep extending the new in-product launch operations playbook beyond the first dashboard guidance now covering coverage limits, low-supply recovery, weather and delay handling, no-shows, and provider go-live decisions. The remaining work is deeper scenario detail, service-quality expectations, and any tighter intervention rules the team still needs before scaling.
- Define the first retention loops for recurring mowing, rebooking nudges, and post-job follow-up so repeat-service behavior starts intentionally instead of accidentally.
- Keep expanding the new launch scripts/templates layer beyond the current grouped drafts now generated in the ops lead queue for first response, quote follow-up, customer-service help follow-up, booking confirmation, completed-job review requests, closed-lost/exception closeout replies, provider availability outreach, referral-source handoff follow-up, and referral asks into any remaining review-response, provider-outreach, or exception-handling templates plus the broader local ops playbook.
- Keep the detailed execution checklist current in `LAUNCH_CHECKLIST.md`.

## Priority 2: Marketplace Quality

### Customer Matchmaking

- Keep improving trust framing as longer-term dispute, cancellation, fulfillment, and review signals become reliable.
- Keep alternative providers curated and limited.
- Review recommendation performance by surface once usage volume exists:
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
- Add time-based and cohort interpretation once traffic volume is meaningful.
- Do not launch hidden Uber-style matching as the default unless trust data later supports it.

### Search, Location, And Address Quality

- Keep improving geocoding quality beyond the fallback dataset and optional Google APIs.
- Cache saved-property geocodes aggressively within allowed usage rules so repeat bookings do not repeatedly geocode the same address.
- Keep anonymous location lookup session-scoped unless there is a clear product reason to save it.
- Tune which fallback area suggestions can be auto-selected and which require customer confirmation.
- Evaluate whether denser market coverage can improve neighborhood-aware matching confidence.
- Continue improving quote and property-measurement confidence, especially for complex lots.

### Ranking And Provider Economics

- Keep tuning provider ranking beyond the current score-and-explanation model.
- Add trustworthy conversion, reliability, and fulfillment signals only after they have enough data volume.
- Keep service-fit weighting strong for more complex multi-service requests.
- Preserve provider-first economics, including minimum acceptable payout thinking.

## Priority 3: Provider Operations

### Dispatch And Assistant

- Broaden dispatch-adjustment reasoning beyond the current move-recommendation baseline.
- Compare multiple candidate relief slots instead of only the first cleaner opening.
- Distinguish route pressure caused by staffing gaps from route pressure better solved by moving work.
- Broaden staffing recommendations across multiple competing bookings, not just the top-pressure booking.
- Add richer crew/provider coordination actions from natural-language requests where they reduce real dispatch friction.

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

- Add crew performance summaries.
- Add attendance history.
- Add richer availability constraints.
- Add crew earnings and payout history.
- Improve assignment forecasting.

### Provider Business Tooling

- Add team permissions.
- Add richer business profile controls.
- Add onboarding automation.
- Explore partnership and affiliate workflows after the core marketplace is stable.

## Operating Principles

- Local density beats broad sparse expansion.
- Dense routes improve recommendation quality, provider earnings, and customer reliability.
- Every customer-facing feature should reduce effort unless added choice materially improves trust or outcomes.
- Every provider-facing feature should make operations easier, not create more admin work.
- Docs should stay current by removing completed backlog items instead of accumulating victory laps.
