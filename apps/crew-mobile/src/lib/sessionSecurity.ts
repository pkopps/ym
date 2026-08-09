import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthDeviceDescriptor, AuthenticatedUserEnvelope } from "@yardmatch/contracts";

const sessionStorageKey = "yardmatch.crew.session";
const biometricPreferenceStorageKey = "yardmatch.crew.biometric-enabled";
const authDeviceStorageKey = "yardmatch.crew.auth-device-id";

type BiometricLabel = "Face ID" | "Fingerprint" | "device biometrics";

export async function loadStoredCrewSession() {
  const raw = await SecureStore.getItemAsync(sessionStorageKey);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AuthenticatedUserEnvelope;
  } catch {
    await SecureStore.deleteItemAsync(sessionStorageKey);
    return undefined;
  }
}

export async function saveStoredCrewSession(envelope: AuthenticatedUserEnvelope) {
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(envelope), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearStoredCrewSession() {
  await SecureStore.deleteItemAsync(sessionStorageKey);
}

export async function getCrewAuthDevice(): Promise<AuthDeviceDescriptor> {
  let id = await SecureStore.getItemAsync(authDeviceStorageKey);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(authDeviceStorageKey, id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
  const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown";
  return {
    id,
    label: Platform.OS === "ios" ? "Crew app on iPhone or iPad" : Platform.OS === "android" ? "Crew app on Android" : "Crew app",
    platform
  };
}

export async function loadCrewBiometricPreference() {
  return (await SecureStore.getItemAsync(biometricPreferenceStorageKey)) === "true";
}

export async function saveCrewBiometricPreference(enabled: boolean) {
  await SecureStore.setItemAsync(biometricPreferenceStorageKey, enabled ? "true" : "false", {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function getCrewBiometricSupport() {
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync()
  ]);

  const available = hasHardware && isEnrolled && supportedTypes.length > 0;
  return {
    available,
    label: resolveBiometricLabel(supportedTypes)
  };
}

export async function promptCrewBiometricUnlock() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock YardMatch",
    cancelLabel: "Use password instead",
    fallbackLabel: "Use passcode"
  });

  return result.success;
}

function resolveBiometricLabel(
  supportedTypes: LocalAuthentication.AuthenticationType[]
): BiometricLabel {
  if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "Face ID";
  }

  if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }

  return "device biometrics";
}
