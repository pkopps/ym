# Engineer Checkpoint: Account Two-Factor And Device Security

## Branch And Commit

- Branch: `main`
- Baseline commit: `a5469ccb6ab24e39739004b42e54fdbb42fd4634`
- State: implemented and verified in the working tree; not yet committed.

## Completed Work

- Added email/SMS two-factor setup and login challenges for password-backed customer, provider, crew, and ops accounts.
- Added hashed expiring codes, resend throttling, cross-role lockout, hashed 30-day device trust, and fresh-session guards for security changes.
- Added mandatory new-device in-app/email warnings, recent activity, device removal, and global session/device revocation.
- Added the web security center and focused second-step login experience plus matching customer/provider/crew mobile controls.
- Added Prisma migration/repository mapping, contracts/client routes, API docs, English/Spanish copy, regression tests, and operational documentation.

## In-Progress Work

- Repository work is complete. Live vendor acceptance awaits staging credentials and approved QA destinations.

## Remaining Work

- Prove Resend and Twilio delivery in staging on physical devices.
- Add an OAuth-to-2FA challenge handoff before supporting social-only 2FA enrollment.
- Consider recovery codes, authenticator-app/TOTP, and richer sign-in risk/location context.

## Blockers

- Live email/SMS evidence requires staging Resend/Twilio configuration and allowlisted destinations.
- Social-only accounts are intentionally excluded from enrollment until OAuth can complete the YardMatch second step.

## Changed Workflows

- Password login now decides between a full session and a two-factor challenge based on account settings and remembered-device state.
- Password reset now honors the same two-factor/new-device boundary before issuing a session.
- Users can choose or change email/SMS delivery, remove remembered devices, review activity, and revoke all sessions from web or mobile.
- Successful unrecognized-device sign-ins now generate durable activity plus an in-app and forced-email warning.

## Validation Results

- Prisma Client generation, migration deployment, and zero-diff schema comparison passed.
- TypeScript, zero-warning ESLint, and 3,578-key English/Spanish/pseudo validation passed.
- API suite: 256 tests, 254 passed, 2 expected PostgreSQL-only skips, 0 failed.
- PostgreSQL repository suite: 2/2 passed, including durable security-state persistence.
- API and Next.js production builds passed; `/account/security` generated successfully.
- Playwright web smoke: 16/16 passed, including email setup and new-device verification at desktop/mobile dimensions.
- Customer/provider/crew Expo exports passed for web, iOS, and Android; mobile release configuration passed.
- In-app browser review at 1440x900 and 390x844 found no application console errors or horizontal overflow.

## Known Defects

- Live vendor delivery is unverified without staging credentials; local mock delivery passed.
- Social-only 2FA enrollment is fail-closed pending OAuth challenge handoff.
- Device warnings do not yet include IP-derived location/risk signals; recovery codes and TOTP are future enhancements.

## Screenshot Paths

- `account-security-enabled-desktop.png`
- `two-factor-login-mobile.png`
- `account-security-activity-mobile.png`

## Recommended Next Task

Run allowlisted staging email/SMS acceptance on physical devices, then implement the OAuth-to-2FA handoff.
