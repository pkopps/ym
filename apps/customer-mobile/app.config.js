const disablePushForLocalDevice =
  process.env.YARDMATCH_DISABLE_PUSH_FOR_LOCAL_DEVICE === "1" ||
  process.env.EXPO_PUBLIC_DISABLE_PUSH_FOR_LOCAL_DEVICE === "1";

const deploymentEnvironment = process.env.EXPO_PUBLIC_YARDMATCH_ENV || "local";
const staging = deploymentEnvironment === "staging";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();
const bundleIdentifier =
  process.env.YARDMATCH_IOS_BUNDLE_IDENTIFIER || "com.patrickkopps.yardmatch.customer";

if (deploymentEnvironment !== "local" && (!apiBaseUrl || !apiBaseUrl.startsWith("https://"))) {
  throw new Error("Deployed customer builds require an HTTPS EXPO_PUBLIC_API_BASE_URL.");
}

module.exports = {
  expo: {
    name: staging ? "YardMatch Customer (Staging)" : "YardMatch Customer",
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
            "YardMatch uses your camera so you can photograph the parts of your property that need service.",
          microphonePermission: false
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
        : { "aps-environment": process.env.YARDMATCH_APS_ENVIRONMENT || "development" }
    },
    android: {
      package: "com.yardmatch.customer"
    },
    extra: expoProjectId ? { eas: { projectId: expoProjectId } } : undefined
  }
};
