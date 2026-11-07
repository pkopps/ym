# Alerting and on-call

How Patrick and anyone else on call find out that YardMatch is down, especially when customers can't get matched or people can't sign in. The code side is in place. The accounts below still need to be created, and each alert path needs one deliberate test alert before launch.

## What the API exposes

| Endpoint | What it proves | Alert when |
|---|---|---|
| `GET /readyz` | The API process is up and the database answers within 3 s | Not 200 |
| `GET /api/observability/critical-paths` | Database, **provider matching**, and **password sign-in** all work end to end inside the API | Not 200 |
| `GET /api/observability/ops-automation/health` | Scheduled ops sweeps ran recently and succeeded (needs `Authorization: Bearer $OPS_AUTOMATION_TOKEN`) | Not 200 |
| Web home page (`https://<site>/`) | The website renders | Not 200, or a keyword such as `YardMatch` is missing |

`/api/observability/critical-paths` returns `200` only when every check passes. A failed check returns `503`, and so does one that isn't configured yet (`"status": "incomplete"`), so a missing canary setting can't look healthy. The body only says `pass`, `fail` or `not-configured` for each check. The reason for a failure goes to logs (`api_background_job_failed`, job `critical-path:<check>`) and to Sentry. Results are cached for 30 s, so frequent probes don't load the API.

The checks have no side effects:

- **Matching** runs the real recommendation search for a fixed address and service. It skips the paid Google address lookup, and its analytics are marked internal. It fails if fewer than `CRITICAL_PATH_MATCHING_MIN_RESULTS` providers match. Use `0` until real providers serve the canary address. After that, `1` catches the case where the search works but returns nobody.
- **Sign-in** loads the monitor account, verifies its password, checks it isn't locked or disabled, loads its profile, and signs and verifies a session token. It doesn't create a session or device record, and it never counts a failed attempt, so a wrong password can't lock the account.

### API settings (Render → Environment)

```
CRITICAL_PATH_MATCHING_ADDRESS={"line1":"…","city":"Barnegat","state":"NJ","postalCode":"08005","country":"US","point":{"latitude":…,"longitude":…}}
CRITICAL_PATH_MATCHING_CATEGORY=lawn-mowing
CRITICAL_PATH_MATCHING_MIN_RESULTS=0   # raise to 1 once providers serve this address
CRITICAL_PATH_SIGN_IN_EMAIL=monitor@<your-domain>
CRITICAL_PATH_SIGN_IN_PASSWORD=<long random password>
```

Create the monitor account through normal customer signup. Use an inbox you control, don't turn on two-factor, and don't book with it. Add its user ID to `ANALYTICS_EXCLUDED_USER_IDS`. Use a different monitor account for staging and for production.

## Recommended setup for a small team

PagerDuty is the industry standard for paging and escalation, and its free plan is enough for launch: up to 5 users, one on-call schedule, one escalation policy, and about 100 SMS/phone notifications a month. Push notifications through the PagerDuty app are the main alert channel. PagerDuty doesn't check your site by itself, so pair it with an uptime checker and Sentry:

1. **Uptime checks: Better Stack Uptime (free: 10 monitors, 3-minute checks) or UptimeRobot.** Create monitors for the four rows in the table above, checked from at least two regions. Require 2 consecutive failures before opening an incident to avoid one-off blips. Give the ops-automation monitor the bearer token as a custom request header, never in the URL.
2. **Paging: PagerDuty Free.** Create one service called "YardMatch production" and an escalation policy: page the on-call person, then escalate to Patrick after 10 minutes if no one acknowledges. Connect Better Stack and Sentry to that service with their PagerDuty integrations. Everyone on call installs the PagerDuty app and allows critical notifications.
3. **Errors: Sentry (already configured through `SENTRY_DSN`).** Add alert rules that send to PagerDuty:
   - a new issue or more than 5 events in 5 minutes where `http.route` is `/api/auth/login`, `/api/auth/google/callback`, `/api/providers/search` or `/api/bookings`
   - any event tagged `background.job:critical-path:*` or `background.job:notification-delivery`
   - all other new issues go to email or Slack only, not to the pager
4. **Status page (optional):** Better Stack's free status page can show whether sign-in and booking are working.

If you'd rather use a single tool, a Better Stack responder seat (about $29 per person per month) includes unlimited phone and SMS alerts plus on-call scheduling, and replaces PagerDuty. Check current pricing before you buy.

## What pages someone, and what doesn't

| Signal | Severity | Route |
|---|---|---|
| `critical-paths` matching or sign-in failing for 2 checks in a row | Critical | Page now |
| `/readyz` or web home down | Critical | Page now |
| Sentry spike on sign-in, search or booking routes | Critical | Page now |
| Ops-automation health 503 | High | Page during the day; notify overnight |
| Other new Sentry issues, slow-request warnings | Low | Email or Slack |

## Before launch

- [ ] Monitor accounts created in staging and production. `CRITICAL_PATH_*` set, and `critical-paths` returns 200 in both.
- [ ] Better Stack (or UptimeRobot) monitors created for all four endpoints.
- [ ] PagerDuty service, escalation policy and on-call schedule created, and the app installed by everyone on call.
- [ ] Sentry → PagerDuty integration and alert rules saved.
- [ ] Test alert: temporarily change `CRITICAL_PATH_SIGN_IN_PASSWORD` in staging. Confirm a page arrives within about 5 minutes and resolves after you restore it.
- [ ] Write down who is on call and how people hand off.

## What users see when something breaks

All web and provider-app screens use the shared API client, so every error message comes from one place (`packages/contracts/src/client.ts`, English and Spanish):

| Situation | Message (EN) |
|---|---|
| Request took longer than 30 s (reads) | YardMatch is taking longer than expected. Check your connection and try again. |
| Same, when saving a change | …plus "If you were saving a change, refresh to check whether it went through before trying again." |
| Offline / can't reach the API | You appear to be offline… / We couldn't reach YardMatch. Check your connection and try again. |
| 502/503/504 or a gateway HTML page | YardMatch is temporarily unavailable. Please try again in a few minutes. (Specific API messages such as "The service is busy" are kept.) |
| 500 | Something went wrong on our end. Please try again. If it keeps happening, contact support. (Reference: `<request id>`) |
| 429 | Too many attempts in a short time. Wait a minute and try again. |
| 401 with no message | Your session has ended. Please sign in again. |
| Validation and other 4xx | The API's own message, with no reference ID |

Errors also carry `kind` (`network`, `unavailable`, `server`, `rate-limited`, `session-expired`, `request`) and `retryable`, so a screen can choose a button without parsing the message. The web app has a page-level error screen (`app/error.tsx`, `app/global-error.tsx`) and a not-found page (`app/not-found.tsx`). The provider app has a crash screen with a retry button (`AppErrorBoundary`).
