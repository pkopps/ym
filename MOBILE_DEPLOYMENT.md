# YardMatch Mobile Test Distribution

YardMatch has three release apps: customer, provider, and crew. The legacy `apps/mobile` workspace is not a release target. Test binaries must use the staging API and must never be promoted automatically to public App Store or Google Play production.

## Build Profiles

Each release app has the same EAS profile contract:

- `development`: internal development client using the EAS `development` environment.
- `preview`: production-like internal distribution. Android produces an installable APK; iOS uses ad hoc internal distribution.
- `preview-simulator`: the preview configuration packaged for the iOS Simulator.
- `store-test`: store-signed build using EAS `preview` variables, so TestFlight and Google Play internal testing continue to use the YardMatch staging API.
- `production`: store-signed build using EAS `production` variables. This profile is intentionally absent from automated submission workflows.

Run `npm run verify:mobile-release` before requesting any build. Deployed mobile configs fail when `EXPO_PUBLIC_API_BASE_URL` is absent or does not use HTTPS.

## Native Identities

| App | Expo slug | iOS bundle identifier | Android application ID |
| --- | --- | --- | --- |
| Customer | `yardmatch-customer` | `com.yardmatch.customer` | `com.yardmatch.customer` |
| Provider | `yardmatch-provider` | `com.yardmatch.provider` | `com.yardmatch.provider` |
| Crew | `yardmatch-crew` | `com.yardmatch.crew` | `com.yardmatch.crew` |

These identifiers match the checked-in iOS projects and are unique. Confirm ownership and availability before creating store records; changing an identifier after the first store upload creates a different app.

## 1. Create And Link Expo Projects

Create one EAS project per release app in the same Expo organization. From each app directory, link the matching project interactively once:

```bash
cd apps/customer-mobile && eas init
cd apps/provider-mobile && eas init
cd apps/crew-mobile && eas init
```

Do not commit a personal Expo token. Record the resulting public project UUIDs as:

- `EXPO_CUSTOMER_PROJECT_ID`
- `EXPO_PROVIDER_PROJECT_ID`
- `EXPO_CREW_PROJECT_ID`

The dynamic app configs read the selected UUID from `EXPO_PUBLIC_EXPO_PROJECT_ID`. EAS project IDs and `EXPO_PUBLIC_*` values are embedded in the app and are not secrets.

## 2. Configure EAS Environments

In each Expo project, create these plain-text variables:

Preview environment:

- `EXPO_PUBLIC_YARDMATCH_ENV=staging`
- `EXPO_PUBLIC_API_BASE_URL=<HTTPS Render staging API URL>`
- `EXPO_PUBLIC_EXPO_PROJECT_ID=<that app's Expo project UUID>`

Production environment, only after the production environment exists:

- `EXPO_PUBLIC_YARDMATCH_ENV=production`
- `EXPO_PUBLIC_API_BASE_URL=<HTTPS production API URL>`
- `EXPO_PUBLIC_EXPO_PROJECT_ID=<that app's Expo project UUID>`

Values included in client code are public even if a platform labels them sensitive. API, Stripe, Blob, notification, Apple, and Google credentials must never use an `EXPO_PUBLIC_*` variable.

## 3. Initialize Credentials Interactively

EAS requires one successful interactive build per app/platform before CI can build non-interactively. This creates or selects signing credentials and registers iOS test devices for ad hoc builds:

```bash
cd apps/customer-mobile
EXPO_PUBLIC_YARDMATCH_ENV=staging \
EXPO_PUBLIC_API_BASE_URL=https://<render-staging-api> \
EXPO_PUBLIC_EXPO_PROJECT_ID=<customer-project-uuid> \
eas build --profile preview --platform ios
```

Repeat for Android and for provider and crew. Use `preview-simulator` when an iOS simulator artifact is sufficient and no physical-device provisioning is needed.

## 4. Configure GitHub Environments

Create a `mobile-preview` GitHub environment with:

- secret `EXPO_TOKEN`
- variable `STAGING_API_BASE_URL`
- variables `EXPO_CUSTOMER_PROJECT_ID`, `EXPO_PROVIDER_PROJECT_ID`, and `EXPO_CREW_PROJECT_ID`

Create a separately protected `mobile-store-test` environment with the same values and a required reviewer. Store signing and submission credentials in EAS, not in the repository. The workflow cannot access its Expo token until the environment approval gate passes.

## 5. Build Test Versions

Run the `Mobile internal preview` GitHub workflow and select one app, platform, and internal profile. It validates the selected app, then triggers EAS asynchronously. EAS provides the install link.

For store-facilitated testing, run `Mobile store test`. It uses the `store-test` profile and staging API:

- iOS uploads to App Store Connect, where the processed build can be assigned to a TestFlight internal group.
- Android submits an Android App Bundle to the Google Play internal track as a draft. Review and publish the draft from Play Console before inviting testers.

The first Google Play submission requires an app record and Google service-account key in EAS. TestFlight requires App Store Connect app records, agreements, signing credentials, test information, and tester groups.

## Acceptance Before Sharing

For every app/platform build:

1. Confirm the EAS build metadata uses `preview`, `preview-simulator`, or `store-test`, never `production`.
2. Sign in or create the correct role.
3. Confirm the app reads and writes only staging data.
4. Exercise push registration only with an approved staging device token.
5. For customer/provider/crew, verify the role-specific booking and photo workflow.
6. Record app, platform, profile, EAS build ID, Git commit, tester group, result, and known defects.

Never use `production` or auto-submit to a public track until the production launch checklist, store listings, legal review, and rollback rehearsal are complete.
