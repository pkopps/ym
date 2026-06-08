import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import { CustomerAuthScreen } from "./auth/CustomerAuthScreen";
import { CustomerAppNavigator } from "./navigation/CustomerAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";
import { CustomerSessionProvider } from "./session/CustomerSessionContext";
import {
  clearStoredCustomerSession,
  getCustomerBiometricSupport,
  loadCustomerBiometricPreference,
  loadStoredCustomerSession,
  promptCustomerBiometricUnlock,
  saveCustomerBiometricPreference,
  saveStoredCustomerSession
} from "./lib/sessionSecurity";
import { registerCustomerPushDevice } from "./lib/pushNotifications";

const relockAfterMs = 60_000;

export default function App() {
  const [sessionEnvelope, setSessionEnvelope] = useState<AuthenticatedUserEnvelope | undefined>();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("device biometrics");
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("Unlock to continue.");
  const backgroundedAtRef = useRef<number | undefined>(undefined);

  async function signOutAndClearSession() {
    setSessionEnvelope(undefined);
    setIsBiometricLocked(false);
    setLockMessage("Unlock to continue.");
    await clearStoredCustomerSession();
  }

  async function handleAuthenticated(envelope: AuthenticatedUserEnvelope) {
    setSessionEnvelope(envelope);
    setIsBiometricLocked(false);
    setLockMessage("Unlock to continue.");
    await saveStoredCustomerSession(envelope);
  }

  async function handleSetBiometricEnabled(enabled: boolean) {
    if (enabled) {
      if (!biometricAvailable) {
        setLockMessage("This device does not have Face ID or another enrolled biometric method yet.");
        return false;
      }

      const unlocked = await promptCustomerBiometricUnlock();
      if (!unlocked) {
        setLockMessage(`Unable to verify ${biometricLabel}.`);
        return false;
      }
    }

    setBiometricEnabledState(enabled);
    await saveCustomerBiometricPreference(enabled);
    setLockMessage(enabled ? `${biometricLabel} will be used when you reopen the app.` : "Unlock to continue.");
    return true;
  }

  async function unlockWithBiometrics() {
    const unlocked = await promptCustomerBiometricUnlock();
    if (unlocked) {
      setIsBiometricLocked(false);
      setLockMessage("Unlock to continue.");
      return;
    }

    setLockMessage(`${biometricLabel} did not verify. Try again or sign in with your password.`);
  }

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const [{ available, label }, savedPreference, storedEnvelope] = await Promise.all([
        getCustomerBiometricSupport(),
        loadCustomerBiometricPreference(),
        loadStoredCustomerSession()
      ]);

      if (!isMounted) {
        return;
      }

      setBiometricAvailable(available);
      setBiometricLabel(label);
      setBiometricEnabledState(available && savedPreference);

      if (
        storedEnvelope &&
        storedEnvelope.user.role === "customer" &&
        Date.parse(storedEnvelope.session.expiresAtIso) > Date.now()
      ) {
        setSessionEnvelope(storedEnvelope);
        if (available && savedPreference) {
          setIsBiometricLocked(true);
        }
      } else if (storedEnvelope) {
        await clearStoredCustomerSession();
      }

      if (isMounted) {
        setIsRestoringSession(false);
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionEnvelope?.session.expiresAtIso) {
      return;
    }

    const signOutIfExpired = () => {
      if (Date.parse(sessionEnvelope.session.expiresAtIso) <= Date.now()) {
        void signOutAndClearSession();
      }
    };

    signOutIfExpired();
    const timeout = setTimeout(
      signOutIfExpired,
      Math.max(0, Date.parse(sessionEnvelope.session.expiresAtIso) - Date.now())
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "inactive" || state === "background") {
        backgroundedAtRef.current = Date.now();
      }

      if (state === "active") {
        signOutIfExpired();

        if (
          biometricEnabled &&
          biometricAvailable &&
          sessionEnvelope &&
          backgroundedAtRef.current &&
          Date.now() - backgroundedAtRef.current >= relockAfterMs
        ) {
          setIsBiometricLocked(true);
        }
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [biometricAvailable, biometricEnabled, sessionEnvelope]);

  useEffect(() => {
    if (isBiometricLocked && sessionEnvelope) {
      void unlockWithBiometrics();
    }
  }, [isBiometricLocked, sessionEnvelope]);

  useEffect(() => {
    if (!sessionEnvelope?.session.token) {
      return;
    }

    void registerCustomerPushDevice(sessionEnvelope.session.token).catch(() => {
      // Push registration is best-effort so unsupported simulators and Expo Go don't block auth flows.
    });
  }, [sessionEnvelope?.session.token]);

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <CustomerSessionProvider
          value={{
            envelope: sessionEnvelope,
            biometricEnabled,
            biometricAvailable,
            biometricLabel,
            setBiometricEnabled: handleSetBiometricEnabled,
            signOut: () => {
              void signOutAndClearSession();
            }
          }}
        >
          {isRestoringSession ? (
            <CenteredMessage eyebrow="Customer app" title="Restoring your session" description="Checking secure sign-in on this device." />
          ) : sessionEnvelope && isBiometricLocked ? (
            <BiometricLockScreen
              description={`Use ${biometricLabel} to reopen your customer account.`}
              eyebrow="Locked"
              message={lockMessage}
              onSignInInstead={() => {
                void signOutAndClearSession();
              }}
              onUnlock={() => {
                void unlockWithBiometrics();
              }}
              title={`Unlock with ${biometricLabel}`}
            />
          ) : sessionEnvelope ? (
            <CustomerAppNavigator />
          ) : (
            <CustomerAuthScreen onAuthenticated={(envelope) => void handleAuthenticated(envelope)} />
          )}
        </CustomerSessionProvider>
      </SafeAreaView>
    </ObservabilityProvider>
  );
}

function CenteredMessage({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.lockShell}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function BiometricLockScreen({
  eyebrow,
  title,
  description,
  message,
  onUnlock,
  onSignInInstead
}: {
  eyebrow: string;
  title: string;
  description: string;
  message: string;
  onUnlock: () => void;
  onSignInInstead: () => void;
}) {
  return (
    <View style={styles.lockShell}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onUnlock} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>Unlock now</Text>
      </Pressable>
      <Pressable onPress={onSignInInstead} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonLabel}>Use password instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lockShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: BrandTokens.spacing.md,
    paddingHorizontal: BrandTokens.spacing.xl,
    backgroundColor: BrandTokens.colors.surface
  },
  eyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center"
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22,
    textAlign: "center"
  },
  message: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20,
    textAlign: "center"
  },
  primaryButton: {
    minWidth: 220,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.xl,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    minWidth: 220,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.xl,
    paddingVertical: BrandTokens.spacing.md
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
