import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { openAuthSessionAsync } from "expo-web-browser";
import { BrandTokens } from "@yardmatch/branding";
import {
  Address,
  AuthenticatedUserEnvelope,
  AuthFlowMode,
  PlaceSuggestion
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { createCustomerMobileApiClient } from "../lib/api";
import { getCustomerMobileTracker } from "../lib/tracking";

function getModeCopy(mode: AuthFlowMode) {
  return mode === "login"
    ? {
        eyebrow: "Customer login",
        title: "Welcome back.",
        description: "Log in to manage bookings, saved properties, and reviews.",
        submitLabel: "Log in"
      }
    : {
        eyebrow: "Customer sign up",
        title: "Book local lawn care faster.",
        description: "Start with email and password. Property details come after account creation.",
        submitLabel: "Create account"
      };
}

const customerRedirectUri = "yardmatch-customer://auth/complete";

function buildEstimatedPoint(state: string, postalCode: string) {
  const normalizedState = state.trim().toUpperCase();
  const stateSignal =
    normalizedState.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 40;
  const zipDigits = Number(postalCode.replace(/\D/g, "").slice(0, 5) || "10001");

  return {
    latitude: Number((25 + stateSignal * 0.5 + (zipDigits % 90) * 0.02).toFixed(5)),
    longitude: Number((-124 + stateSignal * 0.6 + (zipDigits % 120) * 0.03).toFixed(5))
  };
}

function createEmptyAddress(): Address {
  return {
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    point: {
      latitude: 0,
      longitude: 0
    }
  };
}

export function CustomerAuthScreen({
  onAuthenticated
}: {
  onAuthenticated: (envelope: AuthenticatedUserEnvelope) => void;
}) {
  const [mode, setMode] = useState<AuthFlowMode>("login");
  const [email, setEmail] = useState("jordan@example.com");
  const [password, setPassword] = useState("YardMatch123!");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetCodePreview, setResetCodePreview] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fullName, setFullName] = useState("Jordan Rivera");
  const [phone, setPhone] = useState("555-0100");
  const [propertyLabel, setPropertyLabel] = useState("Home");
  const [addressQuery, setAddressQuery] = useState("");
  const [address, setAddress] = useState<Address>(createEmptyAddress());
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [pendingSignupToken, setPendingSignupToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const authCopy = getModeCopy(mode);
  const tracker = getCustomerMobileTracker();
  const isCompletingSocialSignup = pendingSignupToken.length > 0;
  const canSubmitSignup =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.line1.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.state.trim().length > 0 &&
    address.postalCode.trim().length > 0 &&
    (isCompletingSocialSignup || password.trim().length > 0);

  useEffect(() => {
    if (mode !== "signup" || addressQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      createCustomerMobileApiClient()
        .searchPlaces(addressQuery)
        .then((response) => setSuggestions(response.suggestions))
        .catch(() => setSuggestions([]))
        .finally(() => setIsSearching(false));
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [addressQuery, mode]);

  function clearPendingSignupState() {
    setPendingSignupToken("");
  }

  const handleAuth = async (method: "password" | "google" | "apple") => {
    void tracker.track(MarketplaceTelemetryEventCatalog.mobileAuthCompleted, {
      app: "customer",
      method,
      mode
    });

    if (method !== "password") {
      try {
        setIsSubmitting(true);
        setErrorMessage("");
        clearPendingSignupState();
        const api = createCustomerMobileApiClient();
        const startUrl =
          method === "google"
            ? api.getGoogleAuthStartUrl({
                role: "customer",
                mode,
                redirectUri: customerRedirectUri
              })
            : api.getAppleAuthStartUrl({
                role: "customer",
                mode,
                redirectUri: customerRedirectUri
              });
        const result = await openAuthSessionAsync(startUrl, customerRedirectUri);
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
          if (currentUser.user.role !== "customer") {
            throw new Error("Use a customer account in the customer app.");
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
          const pendingToken = callbackUrl.searchParams.get("pendingToken");
          const socialEmail = callbackUrl.searchParams.get("email");
          const socialFullName = callbackUrl.searchParams.get("fullName");
          if (!pendingToken || !socialEmail) {
            throw new Error("The social signup callback was missing the account details we need.");
          }
          setMode("signup");
          setPendingSignupToken(pendingToken);
          setEmail(socialEmail);
          if (socialFullName) {
            setFullName(socialFullName);
          }
          setErrorMessage("");
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

    if (mode === "signup") {
      await handleSignupSubmit();
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      clearPendingSignupState();
      const api = createCustomerMobileApiClient();
      const envelope = await api.login({
        email: email.trim(),
        password
      });

      if (envelope.user.role !== "customer") {
        setErrorMessage("Use a customer account in the customer app.");
        return;
      }

      onAuthenticated(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log in right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (!canSubmitSignup) {
      setErrorMessage("Add your contact and property details so we can finish the account.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      const normalizedAddress: Address = {
        ...address,
        state: address.state.trim().toUpperCase(),
        postalCode: address.postalCode.trim(),
        point:
          selectedSuggestion &&
          selectedSuggestion.address.line1.toLowerCase() === address.line1.trim().toLowerCase() &&
          selectedSuggestion.address.city.toLowerCase() === address.city.trim().toLowerCase() &&
          selectedSuggestion.address.state.toLowerCase() === address.state.trim().toLowerCase() &&
          selectedSuggestion.address.postalCode === address.postalCode.trim()
            ? selectedSuggestion.address.point
            : buildEstimatedPoint(address.state, address.postalCode)
      };

      const envelope = pendingSignupToken
        ? await api.completeSocialSignup({
            pendingToken: pendingSignupToken,
            fullName: fullName.trim(),
            phone: phone.trim(),
            role: "customer",
            address: normalizedAddress,
            propertyLabel: propertyLabel.trim() || "Home"
          })
        : await api.registerUser({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            phone: phone.trim(),
            role: "customer",
            address: normalizedAddress,
            propertyLabel: propertyLabel.trim() || "Home"
          });

      if (envelope.user.role !== "customer") {
        setErrorMessage("Use a customer account in the customer app.");
        return;
      }

      onAuthenticated(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to finish signup right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    try {
      setIsRequestingReset(true);
      setErrorMessage("");
      setRecoveryMessage("");
      const api = createCustomerMobileApiClient();
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
      const api = createCustomerMobileApiClient();
      const envelope = await api.confirmPasswordReset({
        email: email.trim(),
        resetCode: recoveryCode.trim(),
        newPassword
      });
      if (envelope.user.role !== "customer") {
        setErrorMessage("Use a customer account in the customer app.");
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
                onPress={() => {
                  setMode(value);
                  if (value === "login") {
                    clearPendingSignupState();
                  }
                }}
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
            placeholder="customer@example.com"
            placeholderTextColor="#6e7d71"
            style={styles.input}
            value={email}
          />
          {!isCompletingSocialSignup ? (
            <TextInput
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#6e7d71"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          ) : null}
        </View>

        {mode === "signup" ? (
          <View style={styles.fieldStack}>
            {isCompletingSocialSignup ? (
              <View style={styles.inlineNotice}>
                <Text style={styles.noticeTitle}>Finish your customer account</Text>
                <Text style={styles.helper}>We already verified {email.trim()}. Add your property details to continue.</Text>
              </View>
            ) : null}
            <TextInput
              autoCapitalize="words"
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={fullName}
            />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={phone}
            />
            <TextInput
              autoCapitalize="words"
              onChangeText={(value) => {
                setAddressQuery(value);
                setSelectedSuggestion(undefined);
              }}
              placeholder="Search city or town"
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={addressQuery}
            />
            {suggestions.length > 0 ? (
              <View style={styles.suggestionStack}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => {
                      setAddressQuery(suggestion.label);
                      setAddress(suggestion.address);
                      setSelectedSuggestion(suggestion);
                      setSuggestions([]);
                    }}
                    style={styles.suggestionRow}
                  >
                    <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
                    <Text style={styles.suggestionMeta}>
                      {suggestion.source === "google-geocoding" ? "Google" : "Suggested area"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : addressQuery.trim().length >= 2 && isSearching ? (
              <Text style={styles.helper}>Searching nearby areas…</Text>
            ) : null}
            <TextInput
              autoCapitalize="words"
              onChangeText={(value) => setPropertyLabel(value)}
              placeholder="Property label"
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={propertyLabel}
            />
            <TextInput
              autoCapitalize="words"
              onChangeText={(value) =>
                setAddress((current) => ({
                  ...current,
                  line1: value
                }))
              }
              placeholder="Street address"
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={address.line1}
            />
            <View style={styles.inlineRow}>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) =>
                  setAddress((current) => ({
                    ...current,
                    city: value
                  }))
                }
                placeholder="City"
                placeholderTextColor="#6e7d71"
                style={[styles.input, styles.inlineInput]}
                value={address.city}
              />
              <TextInput
                autoCapitalize="characters"
                maxLength={2}
                onChangeText={(value) =>
                  setAddress((current) => ({
                    ...current,
                    state: value
                  }))
                }
                placeholder="ST"
                placeholderTextColor="#6e7d71"
                style={[styles.input, styles.stateInput]}
                value={address.state}
              />
              <TextInput
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={(value) =>
                  setAddress((current) => ({
                    ...current,
                    postalCode: value
                  }))
                }
                placeholder="ZIP"
                placeholderTextColor="#6e7d71"
                style={[styles.input, styles.zipInput]}
                value={address.postalCode}
              />
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => handleAuth("password")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {isSubmitting
              ? "Working..."
              : isCompletingSocialSignup
                ? "Finish account"
                : authCopy.submitLabel}
          </Text>
        </Pressable>

        {mode === "login" ? (
          <Pressable onPress={() => void handleRequestReset()} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>
              {isRequestingReset ? "Sending reset code..." : "Forgot password?"}
            </Text>
          </Pressable>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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

        <Text style={styles.helper}>
          {mode === "signup"
            ? "You can add service notes, payment details, and extra properties right after sign up."
            : "Property address, service notes, and payment setup come after sign in."}
        </Text>
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
  inlineRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
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
  inlineInput: {
    flex: 1
  },
  stateInput: {
    width: 72
  },
  zipInput: {
    width: 92
  },
  suggestionStack: {
    gap: BrandTokens.spacing.xs
  },
  suggestionRow: {
    gap: BrandTokens.spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  suggestionTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  suggestionMeta: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12
  },
  inlineNotice: {
    gap: BrandTokens.spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(242, 247, 243, 0.95)",
    padding: BrandTokens.spacing.md
  },
  noticeTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
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
