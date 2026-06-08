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

## Backend hardening status

- Local email/password auth is now wired with bearer-token sessions through:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Google and Apple social auth now use real OAuth start/callback flows plus:
  - `POST /api/auth/social/complete`
- To turn Google and Apple auth on locally, set:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `APPLE_CLIENT_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
  - `APP_BASE_URL` (for example `http://localhost:3000`)
- Protected customer/provider routes now derive identity from the bearer token instead of trusting caller-supplied IDs.
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
- To turn device push on in development builds, set:
  - `EXPO_PUBLIC_EXPO_PROJECT_ID` in the mobile apps
  - push credentials for the Expo project / native app IDs
- To turn real email/SMS delivery on locally, set:
  - `RESEND_API_KEY`
  - `NOTIFICATION_EMAIL_FROM`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- Prisma/Postgres scaffolding is in place under [`apps/api/prisma`](</Users/patrickkopps/Documents/app/apps/api/prisma>).
- If `DATABASE_URL` is present, the API selects the Prisma-backed repository at runtime.
- If `DATABASE_URL` is absent, the monolith falls back to the in-memory repository so frontend work can still run locally without a database.
- Real customer card payments are now prepared through Stripe hosted Checkout.
- To turn the real checkout path on locally, set:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `APP_BASE_URL` (for Stripe success/cancel redirects, for example `http://localhost:3000`)

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
- Payments, refunds, and service-quality issue workflows
- Structured provider reviews with overall, timeliness, and attention-to-detail ratings plus free text
- Customer support intake
- Shared help-center content for customer, provider, and crew-member documentation across web and mobile
- Analytics event logging for funnel and operational analysis
- SEO metadata, robots, sitemap, and semantic marketing pages
- Multiple saved customer properties with a default/primary address model
- Booking address snapshots plus post-booking address-change workflows
- Instant quote scaffolding with automated property-size estimation and confidence-based follow-up questions

## Observability approach

- `OpenTelemetry` should instrument the API for traces, metrics, and logs.
- `PostHog` should handle product analytics and replay on web/mobile.
- `Sentry` should handle errors and performance on API, web, and mobile.
- Active users are defined by a heartbeat model: a session is considered active if it has reported within the last 5 minutes.
- Booking and refund KPIs should be authored by the backend on successful state changes, not by frontend-only clicks.

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
