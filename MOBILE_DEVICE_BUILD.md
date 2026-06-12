# Mobile Device Build Guide

This repo now supports proper Expo development builds for:

- `apps/customer-mobile`
- `apps/provider-mobile`
- `apps/crew-mobile`

## Recommended first target

Start with the customer app first:

- `apps/customer-mobile`

It has the least device-specific operational complexity, so it is the fastest way to confirm the real-phone path works.

## What is configured already

Each app now has:

- `expo-dev-client`
- stable iOS bundle identifiers
- stable Android package names
- `eas.json` with a `development` profile
- convenience scripts:
  - `npm run dev:client`
  - `npm run ios:device`
  - `npm run ios:device:personal`
  - `npm run android:device`

## Path 1: Fastest local iPhone install from your Mac

Use this if:

- you have a Mac
- you have Xcode
- you can connect your iPhone by cable or trusted Wi‑Fi
- you want the fastest path without waiting on TestFlight

### Customer app

1. Connect the iPhone to the Mac and trust the device.
2. Open the app folder:

```bash
cd apps/customer-mobile
```

3. Build and install directly to the device:

```bash
npm run ios:device
```

4. In another terminal, start Metro for the dev client:

```bash
cd apps/customer-mobile
npm run dev:client
```

### Notes

- The first iOS device build will open Xcode signing prompts if your Apple signing is not already configured.
- You need an Apple developer team selected in Xcode for the bundle identifier:
  - `com.yardmatch.customer`

### Customer app with a personal Apple team

If you are building to your own iPhone with a free personal Apple team, the push entitlement will block signing.

Use the personal-device build mode instead:

```bash
cd apps/customer-mobile
npm run ios:device:personal
```

Then start Metro in another terminal with:

```bash
cd apps/customer-mobile
npm run dev:client:personal
```

This mode disables push entitlements only for the local customer-device build so the app can install on a personal team certificate.

## Path 2: Fastest local Android install from your Mac

Use this if:

- you have Android Studio installed
- your Android phone has Developer Options and USB debugging enabled

### Customer app

1. Connect the Android device by USB.
2. Open the app folder:

```bash
cd apps/customer-mobile
```

3. Build and install directly to the device:

```bash
npm run android:device
```

4. In another terminal, start Metro for the dev client:

```bash
cd apps/customer-mobile
npm run dev:client
```

### Android package name

- `com.yardmatch.customer`

## Path 3: Cloud development build distribution

Use this if:

- you want a shareable install link
- you want to move toward TestFlight / Play internal testing

### Per app

Example for customer:

```bash
cd apps/customer-mobile
npx eas login
npx eas build:configure
npx eas build --profile development --platform ios
```

or:

```bash
cd apps/customer-mobile
npx eas build --profile development --platform android
```

### What still needs to happen for EAS

- sign in to Expo with `eas login`
- run `eas build:configure` once so the app gets a real EAS project ID
- configure Apple credentials for iOS builds
- configure Android signing for Play-distributed builds later if needed

## Bundle identifiers and package names

### Customer

- iOS: `com.yardmatch.customer`
- Android: `com.yardmatch.customer`

### Provider

- iOS: `com.yardmatch.provider`
- Android: `com.yardmatch.provider`

### Crew

- iOS: `com.yardmatch.crew`
- Android: `com.yardmatch.crew`

## Best next move

If the goal is to start using the app on your own phone as quickly as possible:

1. Build `apps/customer-mobile` to your actual phone first
2. Confirm the dev client launches against local Metro
3. After that, repeat the same setup for provider and crew
4. Once that works, decide whether to add TestFlight / Play internal testing as the distribution layer
