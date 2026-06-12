import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { createCustomerMobileApiClient } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

function getExpoProjectId(): string | undefined {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_EXPO_PROJECT_ID;
}

function isPushDisabledForLocalDeviceBuild(): boolean {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_DISABLE_PUSH_FOR_LOCAL_DEVICE === "1";
}

export async function registerCustomerPushDevice(sessionToken: string): Promise<void> {
  if (isPushDisabledForLocalDeviceBuild()) {
    return;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;
  if (finalStatus !== "granted") {
    finalStatus = (await Notifications.requestPermissionsAsync()).status;
  }
  if (finalStatus !== "granted") {
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!token) {
    return;
  }

  const api = createCustomerMobileApiClient();
  api.setAuthToken(sessionToken);
  await api.registerPushDevice({
    platform: Platform.OS === "android" ? "android" : "ios",
    provider: "expo",
    token
  });
}
