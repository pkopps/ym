# YardMatch Testing Plan

## Summary

YardMatch should use a **layered testing strategy**, not a single tool.

- **Unit + domain tests** for business rules
- **API integration tests** for auth, bookings, staffing, disputes, notifications, calendar, and payments
- **Playwright** for web end-to-end coverage
- **Maestro** for mobile end-to-end coverage across iPhone/iPad and Android

## Tool Recommendation

### Playwright

**Yes, Playwright is a very good tool for YardMatch**, but mainly for:

- web app end-to-end testing
- browser login flows
- customer/provider web workflows
- public search and booking flows
- ops portal workflows

Playwright is a strong fit because it gives us:

- built-in test runner
- auto-waiting
- tracing and screenshots
- good CI support
- isolated browser contexts

Playwright is **not** the best single tool for the Expo mobile apps.

### Maestro

For the mobile apps, **Maestro is the best next tool to adopt first**.

Why:

- works well at the UI layer for React Native / Expo apps
- lower setup friction than Detox
- easier to write practical flow tests quickly
- strong fit for smoke tests and user-journey coverage
- supports iOS simulators and Android emulators

### Detox

Detox is still good, but I would **not** make it the first mobile E2E investment here.

Why not first:

- more setup and maintenance overhead
- more native/app-instrumentation complexity
- slower path to getting broad flow coverage compared with Maestro

## Recommended Test Stack

### 1. Domain and backend tests

Keep and expand the current Node/API tests for:

- auth
- booking lifecycle
- staffing
- disputes
- support
- notifications
- calendar blocking
- payment state transitions

These are the fastest and most reliable tests for core marketplace logic.

### 2. Web E2E with Playwright

Use Playwright for:

- public homepage and search
- customer booking flow
- customer cancel/reschedule/review
- provider management and route start
- provider/customer chat
- ops dispute resolution
- auth callback and session persistence on web

### 3. Mobile E2E with Maestro

Use Maestro for:

- customer mobile login
- customer booking flow
- customer bookings actions
- customer arrival tracking banner and full map
- provider route start / late update / complete job
- crew availability and schedule flows
- biometric lock/unlock smoke checks where feasible

## Coverage Matrix

### Unit / domain

Focus:

- quote calculation
- provider ranking
- service-window labeling
- address-change rules
- staffing auto-match rules
- dispute state transitions
- notification fanout decisions
- calendar block overlap logic

### API integration

Focus:

- email/password auth
- Google/Apple auth completion
- role ownership enforcement
- booking creation
- booking confirm/start/on-route/late/complete
- cancel/reschedule
- review eligibility and duplicate prevention
- staffing match accept/deny
- support ticket creation and ops resolution
- notification preferences and delivery records
- external calendar import and block enforcement
- Stripe checkout state changes

### Web E2E

Focus:

- customer public search-first journey
- login and password reset
- social auth redirect handling
- customer dashboard lifecycle actions
- provider management board
- floating chat window
- support/help flows
- ops queue dispute resolution

### Mobile E2E

Focus:

- role login flows
- secure session restore
- biometric unlock
- customer home/banner/booking flows
- provider schedule and route flows
- crew availability and schedule flows
- account/support flows

## Priority Order

### Phase 1: Stabilize core backend confidence

Add more API integration tests before more UI automation.

Reason:

- cheapest place to catch regressions
- covers the marketplace brain directly
- already fits the current repo well

### Phase 2: Add Playwright for critical web flows

Start with the smallest high-value web smoke suite:

- public customer search
- customer login
- customer booking
- provider confirm + start route
- customer sees on-route state

### Phase 3: Add Maestro for mobile smoke flows

Start with:

- customer login
- provider login
- customer bookings tab actions
- provider route start
- crew availability update

### Phase 4: Expand reliability and CI

Add:

- traces
- screenshots/videos on failure
- parallel CI jobs
- nightly full-suite runs
- tagged smoke vs regression suites

## Initial Automated Smoke Suite

This is the first suite I would build.

### API smoke

- register temp customer
- login
- create property
- create quote
- search providers
- create booking
- provider confirms booking
- provider starts route
- customer tracking is available
- provider completes booking
- customer review becomes available

### Web smoke with Playwright

- customer can search from `/`
- customer can log in
- customer can see bookings
- provider can log in
- provider can confirm booking
- provider can start route
- customer sees on-route state

### Mobile smoke with Maestro

- customer app login
- customer sees bookings
- provider app login
- provider starts route
- customer sees arrival banner

## Manual Testing Checklist

Automation will not replace all manual review yet.

Keep manual passes for:

- tablet layouts
- Android-specific UI issues
- iPad spacing and orientation
- maps/tracking presentation
- social auth vendor configuration
- Stripe real-card testing
- notification delivery with real providers

## CI Strategy

### On every PR

Run:

- `npm run typecheck`
- `npm run test:api`
- Playwright web smoke subset

### Nightly

Run:

- full API suite
- full Playwright suite
- Maestro mobile smoke suite

### Before beta / release candidate

Run:

- full regression suite
- real Postgres-backed environment
- real Stripe test mode
- real Google/Apple auth test credentials
- iPhone + Android + tablet manual signoff

## Repo Setup To Add Next

### Playwright

Add:

- `playwright.config.ts`
- `tests/web/`
- seeded auth helpers
- environment bootstrap for local API + web

### Maestro

Add:

- `.maestro/`
- separate flows for customer/provider/crew
- emulator/simulator boot instructions
- test account fixtures

## Proposed First Deliverables

If we implement this plan in order, the first concrete testing deliverables should be:

1. Playwright setup and a `web-smoke` suite
2. More auth/social-auth API integration tests
3. Maestro setup and `mobile-smoke` flows
4. CI scripts for smoke vs full regression

## Recommendation

Use:

- **Playwright for web**
- **Maestro for mobile**
- keep **API integration tests** as the core safety net

That gives YardMatch the best balance of:

- speed
- reliability
- setup cost
- coverage across web, backend, and Expo mobile apps
