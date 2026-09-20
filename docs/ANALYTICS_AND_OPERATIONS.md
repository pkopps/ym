# Product measurement and operations

## What is implemented

Web navigation, authored actions, internal link destinations, form submissions/validation failures, Web Vitals, and generic client-error counters feed the API. Customer/provider/crew apps capture screen changes and authored actions. Analytics is off until the person enables it in the web footer or mobile Help preferences. Web DNT/GPC overrides that choice. No autocapture of form values, chat, addresses, photographs, query strings, or error messages is used. Session replay is not enabled.

The API validates a client-event allowlist and derives account identity and role from authentication. Clients cannot submit payment, booking, or other business-outcome events. An optional request header correlates consenting anonymous visits with server outcomes; it grants no business permissions. Sign-in links anonymous and authenticated journeys. Sign-out/account switching clears queued events and rotates identity. Ops activity and configured internal/test account IDs are excluded from product reports. Use separate databases and PostHog projects for deployment environments; production export is disabled outside `YARDMATCH_ENV=production`.

With PostgreSQL, accepted events are stored before collection returns success. IDs deduplicate retries across API instances and restart. Web retries keep up to 100 events in session storage, five attempts, maximum 24 hours. Mobile retries keep up to 20 small encrypted SecureStore event records (local storage in Expo web), retry on foreground/next action, and expire after five attempts or 24 hours. These limits can lose telemetry during a long outage: analytics is not an accounting ledger. The in-memory API remains a local-only, bounded fallback.

Server writes are asynchronous to avoid breaking bookings when analytics is unavailable. Pending writes are bounded to 10,000; health shows pending/dropped writes and failures. A process crash before flush can lose a pending server event. Financial reporting reads durable settlement records rather than inferring revenue from client clicks. Historical legacy observability views retain their 10,000-event working window; the product report queries persisted history with an explicit 50,000-event result cap and truncation warning.

## Reports and interpretation

Ops → Reports contains a person-level ordered funnel: page/screen visit → quote → search → recommendation → request → confirmation → payment → completion. Anonymous identification, provider confirmations, and booking-scoped payment actors join back to the customer. The report shows counts, denominators, source/platform/language/category/area segments, reasons, returning customers, and a low-volume caution below 30 visitors. It measures observed consenting journeys, not all site visitors. A person can have multiple bookings; use settlement records for booking-level financial reconciliation. A report window can omit earlier identity or journey steps.

Provider activation totals show registered, verified, available, first-booking, and completed-job supply. These are current database totals, not a cohort conversion rate. Settlement totals distinguish status, actual processor fees, provider net, and platform net. Platform net is **not profit**: support labor, marketing, incentives, disputes outside the current window, and taxes require separate cost inputs. Do not scale a market from a handful of observations.

## Optional PostHog export

Set `POSTHOG_API_KEY` to the project token, `POSTHOG_HOST` to the project's HTTPS ingestion origin, and `ANALYTICS_IDENTITY_HASH_KEY` to a unique random secret of at least 32 characters. Never put the secret in `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, source control, or screenshots. Changing it breaks identity continuity. Provision/access verification is still pending; no live project was activated in this batch.

Only events carrying permission at collection are eligible for export. First-party server records without that permission stay in YardMatch, so PostHog is not the complete financial ledger. Identity-like property values and distinct IDs are HMAC-hashed. `$identify` links the hashed visitor and account; a deterministic event `uuid` and `$insert_id` remain stable across delivery retries, following [PostHog event deduplication](https://posthog.com/docs/data/events). Delivery uses the [PostHog batch API](https://posthog.com/docs/api/capture), bounded batches, timeouts, and exponential retry up to ten attempts. Investigate backlog/failures before resetting attempts; do not delete failed rows to make the dashboard look healthy. Opt-out stops new optional collection and clears the device queue; it does not erase previously collected history. An account privacy request is the route for historical erasure/export review.

`ANALYTICS_RETENTION_DAYS` defaults to 90, bounded 7–365. Maintenance prunes first-party analytics by received time. Configure equivalent vendor retention/deletion separately. Review the final legal copy and policy before production.

## Scheduled operations and monitoring

`.github/workflows/ops-automation.yml` runs every 15 minutes only when repository/environment variable `OPS_AUTOMATION_ENABLED=1`. It requires environment `operations`, variable `OPS_API_BASE_URL`, and secret `OPS_AUTOMATION_TOKEN`. On the API set the same strong token, `OPS_AUTOMATION_USER_ID` to an active named ops account, and `OPS_AUTOMATION_ENABLED=1`. Keep live mode off until a dry run and notification-provider staging acceptance succeed.

Run `node scripts/run-ops-automation.mjs` with `API_BASE_URL` and the token. It defaults to dry-run; `OPS_AUTOMATION_EXECUTE=1` enables execution. Existing sweep idempotency and actor-stamped audit history remain in force. The runner stores non-sensitive run evidence under `reports/ci/ops-automation/`. Failed sweeps fail the job. GitHub notification delivery still needs an owner and a verified test alert.

`GET /api/observability/ops-automation/health` accepts the scheduler token and returns 503 when disabled, missing/older than 45 minutes, failed, or materially backed up. `node scripts/check-ops-health.mjs` is a read-only probe. Configure an **independent** external monitor against this endpoint: a GitHub job cannot alert reliably that GitHub's own schedule never ran. Do not put the bearer token in a URL. This independent monitor and delivery test remain pending account setup.

Ops → Administration also shows expiring/expired verified provider credentials. Credential checks still gate jobs/transfers; this dashboard does not extend an expiration or approve an exemption.

## Data lifecycle

Account → Security accepts account-data export, account deletion, and photo-removal requests. Authenticated users see only their requests; ops can review with mandatory notes. Open request kinds deduplicate, and each ops review appends actor, time, status, and notes atomically. Intake **does not delete the account** or stop active work. No “fulfilled” status is offered without an implemented fulfillment action.

Before fulfillment, establish ownership, inventory account/profile/auth/session/push/device/analytics/photo records, inspect active bookings and recurring plans, preserve evidence for disputes/refunds/chargebacks, and obtain the approved financial/legal retention rules. Record retained categories and reasons, disable access and rotate sessions when appropriate, coordinate vendor erasure, then verify that private media delivery and exports no longer expose removed data. Export must use an authenticated expiring delivery path, never a public object URL. Automatic erasure and vendor erasure are intentionally gated on this policy and access; the app does not claim those actions happened.

`PHOTO_RETENTION_REVIEW_DAYS=<approved-age> DATABASE_URL=<review-db> node scripts/inspect-data-lifecycle.mjs` creates a count-only review inventory, holds disputed bookings, and deletes nothing. An age of 90 was used only against synthetic local data for verification, not adopted as the production photo policy. Review open support/refund cases and legal holds before any later deletion implementation.

## Restore and release controls

`npm run prisma:deploy` bootstraps the historical initial schema only on an empty database, records its original migration name, then applies normal migrations. This fixes a crew migration dated earlier than init without changing deployed migration checksums. Run one deployment migration job at a time. Existing non-empty databases are not reset or silently baselined.

The historical ordering also prevents a raw `prisma migrate dev` shadow-database replay. For new schema work, generate and review SQL with `prisma migrate diff --from-url <isolated-current-schema-database> --to-schema-datamodel apps/api/prisma/schema.prisma --script`, place it in a new timestamped migration, and verify `npm run prisma:deploy` plus an empty drift check on a fresh isolated database. Do not accept a reset of a valuable local/staging database. A future migration-history rebaseline needs an inventory of deployed histories; this batch preserves them.

Run `node scripts/rehearse-database-restore.mjs` with `BACKUP_SOURCE_DATABASE_URL`, `RESTORE_TARGET_DATABASE_URL`, and optionally `POSTGRES_BIN`. The target must be an empty, separate local database named `ym_restore_*`. The dump is permission-restricted, removed afterward, and never committed. Use a quiescent source; evidence records per-table counts and duration. Then run schema diff and `TEST_DATABASE_URL=<restored-db> npm run test:api:postgres` against the restore. This batch verified a synthetic local restore; production backup access, backup age/RPO, restore duration/RTO, and coordinated deployment rollback still need an owner and staging rehearsal.

Mobile clients send their app/version. Set `MINIMUM_CUSTOMER_MOBILE_VERSION`, `MINIMUM_PROVIDER_MOBILE_VERSION`, or `MINIMUM_CREW_MOBILE_VERSION` to block older marked builds; `PAUSE_*_MOBILE=1` pauses an app. Apps refresh the policy at startup/foreground and offer a retry screen. The API enforces it on requests. Unmarked older builds cannot be retroactively identified; publish marked builds before relying on this control. Version-config verification checks Expo version, API header, and release screen agree. Recovery: restore the last supported minimum or clear pause, then check foreground refresh and a booking-safe read. This does not replace staged EAS releases and an actual rollback rehearsal.

## Activation checklist

- [ ] Restore Stripe Projects account verification; create/attach PostHog project and verify real ingestion/dashboards.
- [ ] Configure staging resources, notification senders, real Stripe test acceptance, and approved production origin.
- [ ] Enable scheduled sweeps after dry-run acceptance; configure independent missed-run monitoring and verify alert delivery.
- [ ] Approve account/photo/vendor retention and fulfillment policy; implement/test irreversible fulfillment against staging.
- [ ] Distribute marked mobile preview builds and rehearse minimum-version/pause recovery on devices.
- [ ] Verify CodeRabbit GitHub installation and an actual main-bound PR review. Configuration alone is not proof.
