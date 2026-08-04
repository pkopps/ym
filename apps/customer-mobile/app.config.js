const disablePushForLocalDevice =
  process.env.YARDMATCH_DISABLE_PUSH_FOR_LOCAL_DEVICE === "1" ||
  process.env.EXPO_PUBLIC_DISABLE_PUSH_FOR_LOCAL_DEVICE === "1";

const bundleIdentifier =
  process.env.YARDMATCH_IOS_BUNDLE_IDENTIFIER || "com.yardmatch.customer";

module.exports = {
  expo: {
    name: "YardMatch Customer",
    slug: "yardmatch-customer",
    scheme: "yardmatch-customer",
    version: "0.1.0",
    orientation: "default",
    assetBundlePatterns: ["**/*"],
    plugins: [
      "expo-dev-client",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "YardMatch uses Face ID so you can quickly reopen the customer app on this device."
        }
      ],
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          photosPermission:
            "YardMatch uses your photo library so you can show providers the parts of your property that need service.",
          cameraPermission:
            "YardMatch uses your camera so you can photograph the parts of your property that need service."
        }
      ],
      ...(disablePushForLocalDevice ? [] : ["expo-notifications"])
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier,
      infoPlist: {
        NSFaceIDUsageDescription:
          "YardMatch uses Face ID so you can quickly reopen the customer app on this device.",
        NSPhotoLibraryUsageDescription:
          "YardMatch uses your photo library so you can show providers the parts of your property that need service.",
        NSCameraUsageDescription:
          "YardMatch uses your camera so you can photograph the parts of your property that need service."
      },
      entitlements: disablePushForLocalDevice
        ? {}
        : {
            "aps-environment": "development"
          }
    },
    android: {
      package: "com.yardmatch.customer"
    }
  }
};
