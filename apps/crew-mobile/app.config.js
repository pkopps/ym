const deploymentEnvironment = process.env.EXPO_PUBLIC_YARDMATCH_ENV || "local";
const staging = deploymentEnvironment === "staging";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();

if (deploymentEnvironment !== "local" && (!apiBaseUrl || !apiBaseUrl.startsWith("https://"))) {
  throw new Error("Deployed crew builds require an HTTPS EXPO_PUBLIC_API_BASE_URL.");
}

module.exports = {
  expo: {
    name: staging ? "YardMatch Crew (Staging)" : "YardMatch Crew",
    slug: "yardmatch-crew",
    scheme: "yardmatch-crew",
    version: "0.1.0",
    orientation: "default",
    assetBundlePatterns: ["**/*"],
    plugins: [
      "expo-dev-client",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "YardMatch uses Face ID so you can quickly reopen the crew app on this device."
        }
      ],
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          photosPermission:
            "YardMatch uses your photo library so you can document completed service work.",
          cameraPermission:
            "YardMatch uses your camera so you can capture before-and-after service photos.",
          microphonePermission: false
        }
      ],
      "expo-notifications"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yardmatch.crew",
      infoPlist: {
        NSFaceIDUsageDescription:
          "YardMatch uses Face ID so you can quickly reopen the crew app on this device.",
        NSPhotoLibraryUsageDescription:
          "YardMatch uses your photo library so you can document completed service work.",
        NSCameraUsageDescription:
          "YardMatch uses your camera so you can capture before-and-after service photos."
      },
      entitlements: { "aps-environment": process.env.YARDMATCH_APS_ENVIRONMENT || "development" }
    },
    android: {
      package: "com.yardmatch.crew"
    },
    extra: expoProjectId ? { eas: { projectId: expoProjectId } } : undefined
  }
};
