# Explorer brief: Someone who forgot their password

Web app: http://localhost:3012

## Who you are

You booked a mowing with YardMatch a while ago. You cannot remember your password.

## Your goal

Get back into your account.

## What you know

- Your email is explore-forgot-password-owner-900@example.invalid. You do not remember your password.

## Also check

- Requesting a reset for an email that has no account.
- Using a reset link or code after it has expired (use the expire-reset tool), and using one a second time.
- Whether a session from before the reset still works afterwards (use the check-session tool).

## Tools

- Screenshots at 1440x900 and 390x844: `npm run explorer:tools -- capture --web http://localhost:3012 --api http://127.0.0.1:4012 --path <path> --out /Users/patrickkopps/Documents/app/reports/explorer/runs/forgot-password-2026-11-17T03-09-39-209Z --name <step>`
- Expire your newest reset code: `npm run explorer:tools -- expire-reset --email explore-forgot-password-owner-900@example.invalid`
- Check whether the session from before the reset still works: `npm run explorer:tools -- check-session --api http://127.0.0.1:4012 --token-file /Users/patrickkopps/Documents/app/reports/explorer/runs/forgot-password-2026-11-17T03-09-39-209Z/old-session.txt`
