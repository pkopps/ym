# Visit timing and schedule recovery

Implemented September 19, 2026, at Patrick's request to make late, weather-affected, and rescheduled visits visible to customers before they feel abandoned.

## Customer promise

Each provider timing update says what changed, whether arrival is still estimated or uncertain, and when the next update is due. A weather hold means arrival is **not confirmed**. A late update contains a future ETA on the original service day. Changing the service day requires a reschedule proposal.

The existing arrival windows are preserved: morning 7 a.m.–noon, afternoon noon–4 p.m., and evening 4–8 p.m. Morning is five hours; the other windows are four. New schedule controls and messages use America/New_York with daylight-saving conversion. The exact internal job duration is preserved when proposing a new arrival window.

Customers see timing updates and approval controls in the main web booking card and native Visits screen. Notifications link to the affected booking; native push taps open Visits. Customers can accept a new window or ask for another. Declining leaves the visit open and makes the provider responsible for offering another window. Customers can contact support through the existing booking context.

A provider proposal does not move the booking. Customer acceptance rechecks provider conflicts and external calendar blocks, preserves price and the recurring plan, resets route tracking, and returns accepted crew matches to provider review. Crew receive a notice to wait for assignment reconfirmation. Provider-initiated recovery can be accepted inside the normal customer 24-hour reschedule lock. Ordinary customer-initiated rescheduling retains its existing policy. Ops can still perform audited interventions.

Only the affected visit moves. The recurring plan's anchor and frequency stay unchanged; this does not promise that every future visit will arrive at the same clock time.

## Provider actions

Web management and the native Schedule screen expose:

- Running late: arrival estimate, customer-facing reason, and a next-update deadline no later than arrival.
- Weather hold: reason and next-update deadline without inventing an ETA.
- New window proposed: service date and arrival window, reason, and next-update deadline.

A deadline must be in the next 24 hours. The web form offers 30, 60, 120, or 240 minutes; mobile defaults to 60 minutes, capped by the ETA for late updates. Existing one-tap late actions use this same backend. The provider assistant now proposes a move for customer approval rather than moving the visit silently. Confirm the booking before sending these updates.

Starting the route resolves a weather/late hold and sends the existing on-route notification. A pending or declined reschedule must be resolved before route start. Completion, cancellation, refunds, disputes, and other schedule changes resolve obsolete active update records; history remains available.

## Proactive follow-up

The existing operations automation runner now includes `booking-schedule-follow-ups` by default. It detects:

- A promised update or ETA that has passed without a new update.
- A confirmed visit whose arrival window ended without route start or work beginning.

It sends a booking notification to the customer, provider, and ops. Customer copy acknowledges uncertainty and says the provider and operations were alerted; it does not claim anyone has already called the provider or guarantee arrival. Follow-ups use deterministic notification IDs, so overlapping runs cannot duplicate the same recipient's notice. A new provider update establishes a new deadline.

Run the existing `scripts/run-ops-automation.mjs` scheduler with its normal authentication and deployment configuration. A five-minute cadence is appropriate for these checks; a deadline alert runs on the first sweep at or after that deadline. The backend does not start a separate timer. Keep the scheduler health check and independent missed-run monitor active.

Notifications use existing in-app, push, email, and SMS preferences and sender configuration. Outbound delivery now uses the complete stored message rather than the 160-character ops preview, preserving timing and follow-up details. Email/SMS include the application visit URL; push includes the notification action path. Existing failed-delivery retries remain in effect.

## API and persistence

- `POST /api/bookings/schedule-update`: booking provider only; `bookingId`, `kind`, `reason`, `nextUpdateByIso`, with `expectedArrivalIso` for running late or `proposedStartIso` / `proposedEndIso` for rescheduling.
- `POST /api/bookings/schedule-response`: booking customer only; `bookingId`, `updateId`, `action` (`accept` or `decline`).
- `POST /api/observability/ops-automation/run-due`: ops authenticated; pass the new sweep key for a focused dry run.

Migration `20260920010000_booking_schedule_updates` adds `scheduleUpdates` JSON history and `scheduleVersion`. Compare-and-update guards reject stale responses. Acceptance uses the existing provider calendar lock across API instances; booking, crew review changes, and in-app response notifications commit together before external delivery. Repeated matching customer responses are idempotent. Proposals do not reserve a window: acceptance can fail if another booking has taken it.

## Deployment and remaining limits

Apply migrations and deploy the API before clients that use the new routes. Redeploy the operations runner and confirm its live run history includes the new sweep. Verify real email/SMS/push delivery and native notification taps with staging accounts and approved devices. Local tests use mock senders and cannot prove production delivery. No production deployment or vendor activation occurred in this task.

Weather holds are provider-reported. Forecast ingestion, automatically detecting bad weather, batch updates for an entire route, repeated escalation ownership after an ignored ops alert, and suggesting alternative provider capacity are separate follow-ups. The existing scheduler must actually run for overdue notices to be sent. Customer views preserve the last known state during temporary network failures; web and native Visits refresh timing in the foreground.
