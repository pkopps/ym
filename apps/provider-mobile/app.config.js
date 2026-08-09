const deploymentEnvironment = process.env.EXPO_PUBLIC_YARDMATCH_ENV || "local";
const staging = deploymentEnvironment === "staging";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();

if (deploymentEnvironment !== "local" && (!apiBaseUrl || !apiBaseUrl.startsWith("https://"))) {
  throw new Error("Deployed provider builds require an HTTPS EXPO_PUBLIC_API_BASE_URL.");
}

module.exports = {
  expo: {
    name: staging ? "YardMatch Provider (Staging)" : "YardMatch Provider",
    slug: "yardmatch-provider",
    scheme: "yardmatch-provider",
    version: "0.1.0",
    orientation: "default",
    assetBundlePatterns: ["**/*"],
    plugins: [
      "expo-dev-client",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "YardMatch uses Face ID so you can quickly reopen the provider app on this device."
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "YardMatch uses your location while you are heading to a property so customers can follow your live arrival ETA."
        }
      ],
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          photosPermission:
            "YardMatch uses your photo library so you can document service work for the customer.",
          cameraPermission:
            "YardMatch uses your camera so you can capture before-and-after service photos.",
          microphonePermission: false
        }
      ],
      "expo-notifications"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yardmatch.provider",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "YardMatch uses your location while you are heading to a property so customers can follow your live arrival ETA.",
        NSFaceIDUsageDescription:
          "YardMatch uses Face ID so you can quickly reopen the provider app on this device.",
        NSPhotoLibraryUsageDescription:
          "YardMatch uses your photo library so you can document service work for the customer.",
        NSCameraUsageDescription:
          "YardMatch uses your camera so you can capture before-and-after service photos."
      },
      entitlements: { "aps-environment": process.env.YARDMATCH_APS_ENVIRONMENT || "development" }
    },
    android: {
      package: "com.yardmatch.provider"
    },
    extra: expoProjectId ? { eas: { projectId: expoProjectId } } : undefined
  }
};
