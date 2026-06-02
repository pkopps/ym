import { ReactNode, useEffect } from "react";
import { Dimensions, Platform } from "react-native";
import { SessionHeartbeatFactory } from "@yardmatch/observability";
import { createCustomerMobileApiClient } from "../lib/api";

function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ym-customer-mobile-${Date.now()}`;
}

function getPlatformSurface(): "ios-phone" | "ios-tablet" | "android-phone" | "android-tablet" {
  const isTablet = Dimensions.get("window").width >= 900;

  if (Platform.OS === "ios") {
    return isTablet ? "ios-tablet" : "ios-phone";
  }

  return isTablet ? "android-tablet" : "android-phone";
}

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const api = createCustomerMobileApiClient();
    const sessionId = createSessionId();

    const sendHeartbeat = () => {
      void api.trackSessionHeartbeat(
        SessionHeartbeatFactory.create({
          sessionId,
          role: "customer",
          platform: getPlatformSurface(),
          path: "customer-mobile-shell"
        })
      ).catch(() => {
        // Mobile prototypes should stay usable even when the local API is offline.
      });
    };

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return children;
}
