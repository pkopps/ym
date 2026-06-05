# YardMatch Roadmap

## Purpose

This roadmap captures the highest-impact work remaining to turn YardMatch from a strong functional prototype into a reliable marketplace for:

- property owners
- landscaping business owners
- crew members

The current product already supports the core marketplace loop:

- customer search and booking
- provider staffing review and crew matching
- crew on-route and start-work flow
- customer/provider chat after on-route
- reviews, support, notifications, and Stripe-ready checkout plumbing

The next phases focus on operational reliability, real-world delivery, and launch readiness.

## Phase 1: Must-Have Before Beta

### Core trust and access

- Finish real Google and Apple authentication
- Add password reset and account recovery
- Harden session expiration and logout behavior across web and mobile

### Address and property intelligence

- Improve place search and geocoding quality
- Normalize addresses consistently before matching and booking
- Increase confidence and explainability of property measurement / quote logic

### Fulfillment operations

- Expand booking lifecycle handling for:
  - late crew arrival
  - no-show
  - unable-to-access-property
  - service could not be completed
- Add customer/provider support flows tied directly to those lifecycle states

### Notifications delivery

- Add real delivery channels for:
  - push
  - SMS
  - email
- Add reminders and retry logic for critical events

### Payments baseline

- Keep Stripe Checkout as the first real payment rail
- Turn on real Stripe credentials in development and staging
- Add production webhook verification and end-to-end smoke coverage

## Phase 2: Needed For Launch

### Provider operations depth

- Route-aware daily scheduling
- Crew/day load balancing
- Better job-level staffing recommendations
- More provider controls for:
  - service area
  - staffing mode
  - acceptance windows

### Arrival and live service tracking

- Upgrade computed arrival tracking to true device-backed live location sharing
- Add better ETA recalculation
- Add arrival confirmation and “work started” visibility on both web and mobile
- Add customer-facing route confidence messaging and fallback handling

### Financial operations

- Real refunds with Stripe synchronization
- Provider payout ledger
- Crew payout ledger
- Weekly / instant payout rules where applicable

### Internal ops tooling

- Admin tools for:
  - booking intervention
  - refund override
  - support triage
  - dispute resolution
  - provider verification

## Phase 3: Nice To Have After Launch

### Marketplace optimization

- Better search and ranking based on:
  - reliability
  - conversion
  - property fit
  - distance and travel burden
  - sponsored placement controls

### Customer experience polish

- Recurring service subscriptions
- Saved preferences and rebooking shortcuts
- Better arrival/tracking notifications
- Richer post-service follow-up and loyalty loops

### Crew operations polish

- Performance and attendance summaries
- More detailed availability constraints
- Crew earnings and payout history
- Better assignment and schedule forecasting

### Growth and business tools

- Provider verification and onboarding automation
- Richer business profile controls
- Calendar integrations
- Team permissions
- Partnership and affiliate deal workflows

## Recommended Execution Order

1. Real auth completion
2. Notification delivery beyond in-app
3. Fulfillment edge cases and operational states
4. Turn on real Stripe keys and finish payment/payout depth
5. Upgrade computed arrival tracking to real device-backed tracking
6. Internal ops/admin layer
7. Search/ranking optimization

## Arrival Tracking Notes

The first version of arrival tracking is intentionally lightweight:

- crew marks the booking `on route`
- the backend computes a live route position from crew base location toward the service property
- customers and providers can view ETA, progress, remaining distance, and a live map-style arrival panel

The next upgrade path is:

- device-backed live location updates from the crew mobile app
- stronger ETA recalculation
- better route confidence and exception handling when progress stalls

## Payments Notes

Stripe is on the roadmap as the long-term payment system of record for customer payments.

Current direction:

- hosted Stripe Checkout first
- verified webhook-based settlement
- then refunds, provider payouts, and crew payouts

That sequence gives YardMatch a reliable core payments path before expanding into a full marketplace money movement layer.
