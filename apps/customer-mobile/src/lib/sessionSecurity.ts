import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthDeviceDescriptor, AuthenticatedUserEnvelope } from "@yardmatch/contracts";

const sessionStorageKey = "yardmatch.customer.session";
const biometricPreferenceStorageKey = "yardmatch.customer.biometric-enabled";
const authDeviceStorageKey = "yardmatch.customer.auth-device-id";

type BiometricLabel = "Face ID" | "Fingerprint" | "device biometrics";

export async function loadStoredCustomerSession() {
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

export async function saveStoredCustomerSession(envelope: AuthenticatedUserEnvelope) {
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(envelope), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearStoredCustomerSession() {
  await SecureStore.deleteItemAsync(sessionStorageKey);
}

export async function getCustomerAuthDevice(): Promise<AuthDeviceDescriptor> {
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
    label: Platform.OS === "ios" ? "Customer app on iPhone or iPad" : Platform.OS === "android" ? "Customer app on Android" : "Customer app",
    platform
  };
}

export async function loadCustomerBiometricPreference() {
  return (await SecureStore.getItemAsync(biometricPreferenceStorageKey)) === "true";
}

export async function saveCustomerBiometricPreference(enabled: boolean) {
  await SecureStore.setItemAsync(biometricPreferenceStorageKey, enabled ? "true" : "false", {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function getCustomerBiometricSupport() {
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

export async function promptCustomerBiometricUnlock() {
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
