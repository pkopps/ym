import { Dimensions, Platform } from "react-native";
import { MarketplaceApiClient } from "@yardmatch/contracts";
import { MobileAnalyticsTracker } from "@yardmatch/observability";

function getPlatformSurface(): "ios-phone" | "ios-tablet" | "android-phone" | "android-tablet" {
  const isTablet = Dimensions.get("window").width >= 900;

  if (Platform.OS === "ios") {
    return isTablet ? "ios-tablet" : "ios-phone";
  }

  return isTablet ? "android-tablet" : "android-phone";
}

export function getCrewMobileTracker() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const api = new MarketplaceApiClient(runtimeEnv?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000");

  return new MobileAnalyticsTracker(api, "crew-member", getPlatformSurface(), "crew-mobile-demo");
}
