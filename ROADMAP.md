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
- ops notification-health dashboard coverage for overdue retries, exhausted failures, and noisy channels
- manual ops retry sweep for overdue notification deliveries
- external ops alert escalation to configured email/SMS contacts when delivery health is warning or critical
- existing booking, staffing, support, and review events already fan out through the external delivery pipeline when channels are enabled

- Replace mock delivery providers with real vendor integrations for:
  - APNs / FCM push and/or production Expo push rollout beyond Expo tokens

### Payments and payouts depth

Already done:

- internal provider payout ledger derived from real bookings, payments, crew matches, and refunds
- internal crew payout ledger derived from accepted completed work
- customer refund-review requests tied directly to real bookings and payments
- ops approval / denial of refund reviews from the internal support queue
- provider and crew payouts automatically move on hold while a refund review is open
- provider-configurable weekly payout timing and instant-payout eligibility rules
- ops payout preview board for upcoming provider and crew payout runs
- provider verification workflow with an ops review queue and provider-facing status visibility
- richer refund reporting and exception summaries in the ops dashboard

- Turn on real Stripe credentials in development and staging
- Verify production-style webhook handling end to end
- Add real refund handling synchronized with Stripe

## Phase 2: Needed For Launch

### Provider scheduling and dispatch depth

Already done:

- route-aware provider dispatch planning inside the calendar overview:
  - per-day route load summaries
  - crew gap visibility
  - estimated route miles
  - outlier-stop and idle-gap route risk heuristics
  - morning / afternoon / late-afternoon pressure by window
  - day-level recommendations when routes look overloaded
- automated crew/day load balancing:
  - same-day recommendation load is tracked while crew matches are generated
  - strong crew are no longer suggested indefinitely across every same-day job
  - later jobs fall back to fresher available crew before overloading the same few people
- better job-level staffing recommendations:
  - crew candidates now rank by fit instead of pure distance
  - overlapping accepted jobs are filtered out of new recommendations
  - providers can see recommendation labels, scores, and reasons in staffing review surfaces
- baseline provider dispatch controls:
  - service radius tuning
  - booking acceptance windows
  - staffing mode selection
  - staffing review reminder timing
  - departure reminder timing
  - route-leader mode that can stay provider-only or allow accepted-crew fallback
- baseline provider assistant natural-language scheduling help:
  - providers can confirm requested bookings from a plain-language command
  - providers can complete a booking from a plain-language command once the after-photo requirement is satisfied
  - providers can report customer-ready/access/completion issues from a plain-language command and trigger the existing exception workflow
  - providers can preview a plain-language reschedule command
  - ambiguous commands can return matching appointments for explicit selection
  - confirmed commands can move a booking to a broader window and notify the customer automatically
  - providers can also send a customer-facing late update from a plain-language command with a parsed delay amount
  - providers can start the route from a plain-language command and unlock customer tracking
  - providers can start work from a plain-language command once route start and before-photo requirements are satisfied

- Broaden the provider assistant beyond the shipped reschedule baseline:
  - richer crew/provider coordination actions from natural-language requests
  - more complex multi-step scheduling changes
  - deeper assistant support for dispatch reasoning and route management
- More provider controls for:
  - richer dispatch timing
  - more nuanced route-leader/delegation behavior across multiple crews

### Calendar interoperability, part 2

Already done:

- subscribable ICS feed
- merged provider calendar view
- manual outside-client / personal block handling
- outside blocks reducing YardMatch availability
- platform-specific provider calendar subscription actions for Apple Calendar, Google Calendar, and raw iCal feeds
- bulk stale / errored feed refresh for outside calendar imports
- external calendar sync health for mixed books of business:
  - stale or broken outside feeds are surfaced back to the provider
  - failed imports persist as saved subscriptions with error state instead of disappearing
  - providers can see when outside blocks are saved but not actually reducing YardMatch availability
  - providers can see when outside blocks overlap existing YardMatch jobs and create double-booking risk

Still left:

- optional deeper two-way sync later, if it proves worth the added complexity

### Search, address, and quote intelligence

Already done:

- backend address normalization across customer signup, saved properties, quoting, and booking snapshots
- smarter local place-search quality for customer search flows:
  - stronger city/state normalization
  - ZIP / postal matching
  - practical service-area aliases in the fallback dataset
- quote explainability improvements:
  - normalized-address feedback
  - measurement source breakdowns
  - confidence reasons that explain whether the estimate is leaning on saved property data, customer answers, or heuristics

- Improve geocoding quality beyond the current fallback + basic place search setup
- Improve explainability and confidence of quote / property measurement logic
  - complexity-aware quote follow-up questions and scope warnings are now shipped
- Improve provider ranking further beyond the current score-and-explanation model:
  - conversion signals once they are trustworthy enough to use
  - specialization-aware service-fit weighting is now shipped for marketplace search
  - richer service-fit weighting across more complex requests
  - stronger long-term reliability signals and calibration
  - continued tuning of distance and travel-burden tradeoffs

### Financial and internal ops tooling

Already done:

- refund overrides for ops from the support queue
- richer booking intervention controls through the current ops action console:
  - add notes
  - reschedule
  - restore active
  - cancel
  - complete
  - booking-level intervention audit trail
- baseline dispute evidence workflow on booking photos:
  - required before/after service photos
  - ops review and annotation on booking photo evidence
  - evidence already feeds disputes, refund reviews, and service-quality support
- broader booking evidence types are now shipped:
  - onsite notes
  - structured arrival/completion checklists
- ops evidence now feeds ticket-level resolution guidance:
  - reviewed evidence can summarize whether it leans provider, customer, or inconclusive
  - ops queue can suggest the likely next resolution action with confidence

Still left:

- deeper dispute evidence and resolution flows beyond the current photo workflow
- evidence workflow improvements beyond the shipped before/after photo requirement:
  - strengthen evidence linkage even further into bad reviews and service-quality support workflows
- audit-friendly internal tooling for support and financial exceptions

## Phase 3: Nice To Have After Launch

### Customer experience polish

Already done:

- recurring service plan baseline for customers, including:
  - weekly or biweekly recurring maintenance scheduling
  - repeat lawn mowing / cleanup plans without rebuilding the booking each time
  - automatic generation of the next recurring visit after the current one is completed
  - customer visibility into active recurring plans and upcoming visits

- Recurring service subscriptions
- Saved preferences and faster rebooking loops
- Better post-service loyalty and follow-up flows
- Richer customer-facing arrival/tracking notifications

### Crew operations polish

Already done:

- cancellation accountability messaging for crew members:
  - crew members now see a warning before cancelling an accepted assignment
  - the warning explains that repeated cancellations can hurt reliability standing
  - accepted-assignment cancellations now lower future staffing priority through recommendation penalties

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
- public customer web baseline polish, including a responsive homepage and live listings backed by provider search
- role-aware public login entry surfaces for customers, providers, and crew members
- place search baseline
- backend address normalization for customer properties, quotes, and booking snapshots
- quote explainability with measurement sources and confidence reasons
- in-app notifications and preference management
- support ticketing and dispute flows
- provider late notices and service exception handling
- provider ops queue and dispute resolution UI
- provider verification review queue
- Stripe Checkout scaffold and webhook plumbing
- provider ICS export and outside-calendar blocking
- external iCal calendar import into provider availability blocking
- provider calendar sync health for stale feeds, failed imports, and blocking-risk visibility
- provider dispatch planning summaries for day load, route miles, and window pressure
- device-backed provider live route tracking
- customer recurring service plans with automatic next-visit generation

## Recommended Execution Order

1. Real notification delivery beyond in-app
2. Real Google / Apple auth
3. Turn on real Stripe keys and finish refund / payout depth
4. Google / Apple calendar sync polish
5. Automated load balancing and deeper dispatch controls
6. Search / ranking / quote intelligence improvements
7. Richer ops and financial admin tooling
8. Post-launch loyalty, subscriptions, and deeper business tooling

## Notes

### Known bugs

- No current homepage bug is being tracked here as a launch blocker after the rotator rewrite.
- Continue visual QA on:
  - public homepage hero animation timing
  - responsive header spacing on smaller screens

### Branding

- Tentative future name change under consideration: `GreenRain`
- Keep product, domain, and asset naming flexible until the brand decision is finalized

### Arrival tracking

Already done:

- provider-led route start
- customer-facing arrival banner + full map
- provider-device-backed live tracking
- fallback to estimated route when live location is unavailable

Still left:

- background location behavior if desired later
- broader crew-member location tracking beyond the current provider-led route model:
  - track crew progress toward the service property
  - support interim stops like equipment pickup or staging locations before the property
  - only the business owner / provider should see individual crew-member route context
  - property owners should continue to see only the business owner / provider location, not individual crew locations
- stronger ETA recalculation
- delegated route leadership when the owner is not traveling with the crew

### Payments

Already done:

- Stripe Checkout API shape
- webhook-ready settlement flow
- customer web + mobile payment entry points
- provider payout ledger visibility
- crew payout ledger visibility
- refund review workflow with ops approval / denial and payout holds
- ops booking intervention console for notes, reschedules, cancel/restore/complete actions, and audit trail history
- required before-work and after-work photo evidence with booking-level timestamps and actor attribution
- onsite note and structured checklist evidence on active bookings
- ops evidence review and annotation directly on booking photos inside the support queue

Still left:

- real secrets and live processor verification
- live Stripe refund synchronization
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

### Scheduling

Already done:

- provider dispatch planning summaries in web/mobile calendar views
- per-day crew gap visibility
- route-mile estimates and day/window pressure summaries
- provider dispatch controls for:
  - service radius tuning
  - staffing mode selection
  - staffing review reminder timing
  - departure reminder timing
  - provider-only versus accepted-crew-fallback route leadership

Still left:

- AI-assisted dispatch changes
- more nuanced delegated route leadership across multiple crews
