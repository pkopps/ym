# YardMatch Roadmap

## Purpose

This roadmap reflects the work that is still meaningfully left after the current backend, web, and mobile marketplace passes.

YardMatch already supports a real core loop:

- customer search, quote, booking, cancel, reschedule, and review
- provider confirmation, route start, work start, completion, late notices, and exception reporting
- crew matching, staffing review, accepted work visibility, and availability management
- customer/provider chat after route start
- support tickets, disputes, ops resolution, in-app notifications, and delivery preferences
- Stripe-ready checkout plumbing
- provider calendar feed, outside blocking, merged schedule views
- device-backed provider arrival tracking
- secure mobile session persistence with optional biometric unlock

What remains now is mostly launch-hardening, real third-party delivery, money movement depth, and more sophisticated provider operations.

## Phase 1: Highest Priority Remaining Work

### Real auth completion

Already done:

- Google auth backend/web/mobile flow when configured
- Apple auth backend/web/mobile flow when configured
- native mobile signup completion for password and social-first account creation
- web session persistence across refreshes
- web multi-tab session sync and logout propagation
- browser session invalidation when the API returns `401`

- Add stronger re-auth for sensitive actions later, especially:
  - payout settings
  - bank changes
  - payment-method changes

### Real notification delivery

Already done:

- persisted in-app notifications and delivery preferences
- persisted external delivery records
- mobile push-device registration endpoints
- Expo push-token support for mobile devices
- real Resend email integration when configured
- real Twilio SMS integration when configured
- retry metadata for failed push sends
- retry logic for real push, email, and SMS delivery attempts

- Replace mock delivery providers with real vendor integrations for:
  - APNs / FCM push and/or production Expo push rollout beyond Expo tokens
- Add production delivery observability and alerting
- Turn the existing departure / on-route / issue / review events into true device notifications

### Payments and payouts depth

Already done:

- internal provider payout ledger derived from real bookings, payments, crew matches, and refunds
- internal crew payout ledger derived from accepted completed work

- Turn on real Stripe credentials in development and staging
- Verify production-style webhook handling end to end
- Add real refund handling synchronized with Stripe
- Define weekly / instant payout rules where applicable

## Phase 2: Needed For Launch

### Provider scheduling and dispatch depth

- Route-aware daily scheduling
- Crew/day load balancing
- Better job-level staffing recommendations
- More provider controls for:
  - service area
  - staffing mode
  - acceptance windows
  - dispatch timing / route-leader behavior

### Calendar interoperability, part 2

Already done:

- subscribable ICS feed
- merged provider calendar view
- manual outside-client / personal block handling
- outside blocks reducing YardMatch availability

Still left:

- Google Calendar sync polish
- Apple Calendar / iCal subscription polish
- stronger external sync behavior for mixed books of business
- optional deeper two-way sync later, if it proves worth the added complexity

### Search, address, and quote intelligence

- Improve geocoding quality beyond the current fallback + basic place search setup
- Normalize addresses more aggressively before matching and booking
- Improve explainability and confidence of quote / property measurement logic
- Improve provider ranking using:
  - reliability
  - conversion
  - service fit
  - distance and travel burden
  - sponsored placement rules

### Financial and internal ops tooling

- Refund overrides for ops
- Provider verification workflow
- Richer booking intervention controls
- Deeper dispute evidence and resolution flows
- Audit-friendly internal tooling for support and financial exceptions

## Phase 3: Nice To Have After Launch

### Customer experience polish

- Recurring service subscriptions
- Saved preferences and faster rebooking loops
- Better post-service loyalty and follow-up flows
- Richer customer-facing arrival/tracking notifications

### Crew operations polish

- Performance summaries
- Attendance history
- Richer availability constraints
- Crew earnings and payout history
- Better assignment forecasting

### Provider business tooling

- Team permissions
- Richer business profile controls
- Onboarding automation
- Partnership / affiliate workflows

## What Is Already Done

The following items are no longer roadmap gaps and should be treated as completed foundation:

- password reset and account recovery
- mobile secure session persistence
- optional biometric unlock on mobile
- place search baseline
- in-app notifications and preference management
- support ticketing and dispute flows
- provider late notices and service exception handling
- provider ops queue and dispute resolution UI
- Stripe Checkout scaffold and webhook plumbing
- provider ICS export and outside-calendar blocking
- external iCal calendar import into provider availability blocking
- device-backed provider live route tracking

## Recommended Execution Order

1. Real notification delivery beyond in-app
2. Real Google / Apple auth
3. Turn on real Stripe keys and finish refund / payout depth
4. Google / Apple calendar sync polish
5. Route-aware scheduling and load balancing
6. Search / ranking / quote intelligence improvements
7. Richer ops and financial admin tooling
8. Post-launch loyalty, subscriptions, and deeper business tooling

## Notes

### Arrival tracking

Already done:

- provider-led route start
- customer-facing arrival banner + full map
- provider-device-backed live tracking
- fallback to estimated route when live location is unavailable

Still left:

- background location behavior if desired later
- stronger ETA recalculation
- delegated route leadership when the owner is not traveling with the crew

### Payments

Already done:

- Stripe Checkout API shape
- webhook-ready settlement flow
- customer web + mobile payment entry points
- provider payout ledger visibility
- crew payout ledger visibility

Still left:

- real secrets and live processor verification
- refunds
- payout disbursement rules and rails

### Calendar

Already done:

- provider subscription endpoint
- public ICS feed
- merged provider calendar timeline
- external blocking against YardMatch availability
- external iCal feed import for outside calendars

Still left:

- deeper Google / Apple calendar interoperability
- sync polish for mixed on-platform and off-platform schedules
