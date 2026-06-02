import { Dimensions, Platform } from "react-native";
import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { createProviderMobileApiClient } from "./api";

function getPlatformSurface(): "ios-phone" | "ios-tablet" | "android-phone" | "android-tablet" {
  const isTablet = Dimensions.get("window").width >= 900;

  if (Platform.OS === "ios") {
    return isTablet ? "ios-tablet" : "ios-phone";
  }

  return isTablet ? "android-tablet" : "android-phone";
}

export function getProviderMobileTracker() {
  return new MobileAnalyticsTracker(
    createProviderMobileApiClient(),
    "provider",
    getPlatformSurface(),
    "provider-mobile-live"
  );
}
