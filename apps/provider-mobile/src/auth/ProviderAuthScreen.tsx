import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { openAuthSessionAsync } from "expo-web-browser";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope, AuthFlowMode } from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { createProviderMobileApiClient } from "../lib/api";
import { getProviderMobileTracker } from "../lib/tracking";

function getModeCopy(mode: AuthFlowMode) {
  return mode === "login"
    ? {
        eyebrow: "Business owner login",
        title: "Run the operation from one app.",
        description: "Log in to manage schedules, crews, clients, routes, and payouts.",
        submitLabel: "Log in"
      }
    : {
        eyebrow: "Business owner sign up",
        title: "Grow your landscaping business with YardMatch.",
        description: "Start with email and password. Territory, crews, and business setup come after account creation.",
        submitLabel: "Create account"
      };
}

const providerRedirectUri = "yardmatch-provider://auth/complete";

function getProviderWebBaseUrl() {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtimeEnv?.EXPO_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
}

export function ProviderAuthScreen({
  onAuthenticated
}: {
  onAuthenticated: (envelope: AuthenticatedUserEnvelope) => void;
}) {
  const [mode, setMode] = useState<AuthFlowMode>("login");
  const [email, setEmail] = useState("ariana@greenstride.example");
  const [password, setPassword] = useState("YardMatch123!");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetCodePreview, setResetCodePreview] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingSignupUrl, setPendingSignupUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const authCopy = getModeCopy(mode);
  const tracker = getProviderMobileTracker();

  const handleAuth = async (method: "password" | "google" | "apple") => {
    void tracker.track(MarketplaceTelemetryEventCatalog.mobileAuthCompleted, {
      app: "provider",
      method,
      mode
    });

    if (method !== "password") {
      try {
        setIsSubmitting(true);
        setErrorMessage("");
        setPendingSignupUrl("");
        const api = createProviderMobileApiClient();
        const startUrl =
          method === "google"
            ? api.getGoogleAuthStartUrl({
                role: "provider",
                mode,
                redirectUri: providerRedirectUri
              })
            : api.getAppleAuthStartUrl({
                role: "provider",
                mode,
                redirectUri: providerRedirectUri
              });
        const result = await openAuthSessionAsync(startUrl, providerRedirectUri);
        if (result.type !== "success" || !result.url) {
          return;
        }

        const callbackUrl = new URL(result.url);
        const status = callbackUrl.searchParams.get("authStatus");
        if (status === "success") {
          const token = callbackUrl.searchParams.get("token");
          const expiresAtIso = callbackUrl.searchParams.get("expiresAtIso");
          if (!token || !expiresAtIso) {
            throw new Error("The social sign-in callback was missing session details.");
          }
          api.setAuthToken(token);
          const currentUser = await api.getCurrentUser();
          if (currentUser.user.role !== "provider") {
            throw new Error("Use a business owner account in the provider app.");
          }
          onAuthenticated({
            session: {
              token,
              expiresAtIso,
              expiresInSeconds: Math.max(0, Math.round((Date.parse(expiresAtIso) - Date.now()) / 1000))
            },
            user: currentUser.user
          });
          return;
        }

        if (status === "pending-signup") {
          const webUrl = new URL("/auth/complete", getProviderWebBaseUrl());
          callbackUrl.searchParams.forEach((value, key) => {
            webUrl.searchParams.set(key, value);
          });
          setPendingSignupUrl(webUrl.toString());
          setErrorMessage("Finish the last few business account details on the web, then come back to the app.");
          return;
        }

        throw new Error(
          callbackUrl.searchParams.get("message") ?? "Unable to finish the social sign-in right now."
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to finish social sign-in right now.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode !== "login") {
      setErrorMessage("Mobile signup is not wired yet. Use Google or Apple above, or finish signup on the web.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setPendingSignupUrl("");
      const api = createProviderMobileApiClient();
      const envelope = await api.login({
        email: email.trim(),
        password
      });

      if (envelope.user.role !== "provider") {
        setErrorMessage("Use a business-owner account in the provider app.");
        return;
      }

      onAuthenticated(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log in right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    try {
      setIsRequestingReset(true);
      setErrorMessage("");
      setRecoveryMessage("");
      const api = createProviderMobileApiClient();
      const result = await api.requestPasswordReset({
        email: email.trim()
      });
      setShowRecovery(true);
      setRecoveryMessage(result.message);
      setResetCodePreview(result.resetCodePreview ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start password reset right now.");
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      setIsResettingPassword(true);
      setErrorMessage("");
      setRecoveryMessage("");
      const api = createProviderMobileApiClient();
      const envelope = await api.confirmPasswordReset({
        email: email.trim(),
        resetCode: recoveryCode.trim(),
        newPassword
      });

      if (envelope.user.role !== "provider") {
        setErrorMessage("Use a business-owner account in the provider app.");
        return;
      }

      onAuthenticated(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset the password right now.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{authCopy.eyebrow}</Text>
        <Text style={styles.title}>{authCopy.title}</Text>
        <Text style={styles.description}>{authCopy.description}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          {(["login", "signup"] as const).map((value) => {
            const isActive = value === mode;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[styles.modeButton, isActive && styles.modeButtonActive]}
              >
                <Text style={[styles.modeLabel, isActive && styles.modeLabelActive]}>
                  {value === "login" ? "Log in" : "Sign up"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldStack}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setEmail}
            placeholder="crewlead@greenstride.example"
            placeholderTextColor="#6e7d71"
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#6e7d71"
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>

        <Pressable onPress={() => handleAuth("password")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>{isSubmitting ? "Working..." : authCopy.submitLabel}</Text>
        </Pressable>

        <Pressable onPress={() => void handleRequestReset()} style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>
            {isRequestingReset ? "Sending reset code..." : "Forgot password?"}
          </Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {pendingSignupUrl ? (
          <Pressable onPress={() => void openAuthSessionAsync(pendingSignupUrl)} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Finish social signup on the web</Text>
          </Pressable>
        ) : null}

        {showRecovery ? (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>Reset your password</Text>
            <Text style={styles.helper}>Use the latest reset code for {email.trim() || "your account"}.</Text>
            {recoveryMessage ? <Text style={styles.helper}>{recoveryMessage}</Text> : null}
            {resetCodePreview ? <Text style={styles.helper}>Local preview code: {resetCodePreview}</Text> : null}
            <View style={styles.fieldStack}>
              <TextInput
                onChangeText={setRecoveryCode}
                placeholder="Reset code"
                placeholderTextColor="#6e7d71"
                style={styles.input}
                value={recoveryCode}
              />
              <TextInput
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor="#6e7d71"
                secureTextEntry
                style={styles.input}
                value={newPassword}
              />
            </View>
            <View style={styles.recoveryActions}>
              <Pressable onPress={() => void handleConfirmReset()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>
                  {isResettingPassword ? "Updating..." : "Reset password"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowRecovery(false);
                  setRecoveryCode("");
                  setNewPassword("");
                  setRecoveryMessage("");
                  setResetCodePreview("");
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonLabel}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.socialStack}>
          <Pressable onPress={() => handleAuth("google")} style={styles.socialButton}>
            <AntDesign color="#4285F4" name="google" size={18} />
            <Text style={styles.socialLabel}>Continue with Google</Text>
          </Pressable>
          <Pressable onPress={() => handleAuth("apple")} style={styles.socialButton}>
            <AntDesign color={BrandTokens.colors.ink} name="apple" size={18} />
            <Text style={styles.socialLabel}>Continue with Apple</Text>
          </Pressable>
        </View>

        <Text style={styles.helper}>Service radius, crew settings, and payouts stay behind sign in so setup feels lighter.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: BrandTokens.spacing.hero,
    gap: BrandTokens.spacing.xl,
    backgroundColor: BrandTokens.colors.surface
  },
  hero: {
    gap: BrandTokens.spacing.md
  },
  eyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 38
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    gap: BrandTokens.spacing.lg,
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.xl
  },
  modeRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.85)"
  },
  modeButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  modeLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modeLabelActive: {
    color: "#ffffff"
  },
  fieldStack: {
    gap: BrandTokens.spacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    borderRadius: 16,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    color: BrandTokens.colors.ink
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  socialStack: {
    gap: BrandTokens.spacing.md
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandTokens.spacing.sm,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  socialLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  linkButton: {
    alignItems: "center"
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  recoveryCard: {
    gap: BrandTokens.spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: BrandTokens.spacing.lg
  },
  recoveryTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    fontSize: 18
  },
  recoveryActions: {
    gap: BrandTokens.spacing.sm
  },
  helper: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  },
  errorText: {
    color: "#b34332",
    lineHeight: 22
  }
});
