import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthDeviceDescriptor, AuthenticatedUserEnvelope } from "@yardmatch/contracts";

const sessionStorageKey = "yardmatch.provider.session";
const biometricPreferenceStorageKey = "yardmatch.provider.biometric-enabled";
const authDeviceStorageKey = "yardmatch.provider.auth-device-id";

type BiometricLabel = "Face ID" | "Fingerprint" | "device biometrics";

export async function loadStoredProviderSession() {
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

export async function saveStoredProviderSession(envelope: AuthenticatedUserEnvelope) {
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(envelope), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearStoredProviderSession() {
  await SecureStore.deleteItemAsync(sessionStorageKey);
}

export async function getProviderAuthDevice(): Promise<AuthDeviceDescriptor> {
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
    label: Platform.OS === "ios" ? "Provider app on iPhone or iPad" : Platform.OS === "android" ? "Provider app on Android" : "Provider app",
    platform
  };
}

export async function loadProviderBiometricPreference() {
  return (await SecureStore.getItemAsync(biometricPreferenceStorageKey)) === "true";
}

export async function saveProviderBiometricPreference(enabled: boolean) {
  await SecureStore.setItemAsync(biometricPreferenceStorageKey, enabled ? "true" : "false", {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function getProviderBiometricSupport() {
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

export async function promptProviderBiometricUnlock() {
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
