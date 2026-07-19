# Engineer Checkpoint Evidence

## Branch And Commit

- Branch: `main`
- Commit: `b186d5dc995f9075a877bc4ab257a2b3a1d40ca7`
- Worktree: `/Users/patrickkopps/Documents/app`
- Updated: `2026-07-19 19:43 EDT`

## Completed Work

- Added shared scalable i18n infrastructure in `@yardmatch/i18n` with `en`, `es`, and `pseudo` resources, ICU formatting, fallback behavior, validation, TMS export/import support, literal auditing, and unit coverage.
- Wired Spanish web routing at `/es`, localized public marketplace/search/listings/header/footer surfaces, added a visible language picker, and updated metadata, sitemap, and robots handling.
- Propagated `X-YardMatch-Locale` through the shared API client, web client factory, and customer/provider/crew mobile API factories.
- Added API locale resolution and localized recognized API/auth errors plus provider calendar window presentation labels without changing stable enum/key fields.
- Localized customer/provider/crew mobile shells, auth/navigation, and major dashboard/support/schedule/assignment states with persisted language choice, device fallback, selected-pack loading, and English/Spanish pickers.
- Moved trust-policy, launch content, auth/login, route wrappers, arrival tracking, provider management/payments, ops dashboard/account/support/lead/finance/verification/review/payout/playbook, and landscaping illustration presentation copy into locale resources.
- Closed the strict source-code string audit. `npm run i18n:audit:literals` now passes with no likely hardcoded UI strings.
- Cleaned the generated internal ops Spanish resources so only proper/sample values remain identical to English: `Casey Ops`, `ops@example.com`, `Google`, and `Apple`.
- Reworked mobile language choice UX: customer/provider/crew apps now show language selection once after successful signup, remove the old always-visible root picker, and keep language switching in the signed-in account/settings tab. The web picker remains in the upper-right header.
- Fixed the CI-only clean typecheck failure by generating Prisma Client in GitHub Actions before `npm run typecheck` and before web smoke starts the API.

## Validation Results

- `npm run i18n:audit:literals`: passed, no likely hardcoded UI strings found.
- `npm run i18n:validate`: passed, 3,389 keys across `en`, `es`, and `pseudo`.
- `npm --workspace @yardmatch/i18n run test`: passed, 4 tests.
- `npm run typecheck`: passed.
- Fresh clone CI reproduction: `npm ci` passed; `npm run typecheck` failed before Prisma generation with missing Prisma generated-client types; `npm run prisma:generate` passed; `npm run typecheck` passed afterward.
- `npm run test:api`: passed, 189 tests.
- `npm run test:web:smoke`: passed, 6 tests including `/es`.
- `npx expo export --platform ios` from `apps/customer-mobile`: passed.
- `npx expo export --platform ios` from `apps/provider-mobile`: passed.
- `npx expo export --platform ios` from `apps/crew-mobile`: passed.
- `node reports/agent-checkpoints/engineer/latest/capture-i18n-screenshots.mjs`: passed, 4 screenshots captured.

## Screenshot Evidence

- Desktop 1440x900 English home: `reports/agent-checkpoints/engineer/latest/desktop-home-en.png`
- Desktop 1440x900 Spanish home: `reports/agent-checkpoints/engineer/latest/desktop-home-es.png`
- Mobile 390x844 English home: `reports/agent-checkpoints/engineer/latest/mobile-home-en.png`
- Mobile 390x844 Spanish home: `reports/agent-checkpoints/engineer/latest/mobile-home-es.png`
- Screenshot capture script: `reports/agent-checkpoints/engineer/latest/capture-i18n-screenshots.mjs`

## Known Defects

- Next.js logs the existing middleware-to-proxy deprecation warning during local runs.
- Some commands print the existing `NO_COLOR`/`FORCE_COLOR` warning.
- Full Expo web export still needs `react-native-web` or a native-only platform config if web export is required; native iOS exports pass.

## Recommended Next Task

Choose the TMS vendor and run human Spanish copy review against the completed resource files, then wire vendor-specific sync into CI.
