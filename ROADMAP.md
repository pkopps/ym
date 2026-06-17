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

- Keep extending support and financial exception tooling beyond the current structured ticket timeline, refund review history, booking intervention history, evidence-review history, and the new evidence-before-resolution guard for disputes and refund reviews.
- Keep tightening dispute evidence workflows beyond the current before/after photos, notes, and checklists now that ops must review at least one submitted evidence item before resolving dispute/service-quality/refund-review tickets.
- Continue testing booking interventions, refund reviews, and payout holds with real-world scenarios.

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
