import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { openAuthSessionAsync } from "expo-web-browser";
import { BrandTokens } from "@yardmatch/branding";
import { I18nInstance } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import {
  Address,
  AuthenticatedUserEnvelope,
  AuthFlowMode,
  PlaceSuggestion,
  TwoFactorChallengeResponse
} from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { createCrewMobileApiClient } from "../lib/api";
import { getCrewAuthDevice } from "../lib/sessionSecurity";
import { getCrewMobileTracker } from "../lib/tracking";

function getModeCopy(i18n: I18nInstance, mode: AuthFlowMode) {
  return mode === "login"
    ? {
        eyebrow: i18n.t("mobile.auth.crew_login_eyebrow"),
        title: i18n.t("mobile.auth.crew_login_title"),
        description: i18n.t("mobile.auth.crew_login_description"),
        submitLabel: i18n.t("mobile.auth.log_in")
      }
    : {
        eyebrow: i18n.t("mobile.auth.crew_signup_eyebrow"),
        title: i18n.t("mobile.auth.crew_signup_title"),
        description: i18n.t("mobile.auth.crew_signup_description"),
        submitLabel: i18n.t("auth_signup.create_account")
      };
}

const crewRedirectUri = "yardmatch-crew://auth/complete";
type AuthCompletionSource = "login" | "signup";

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

export function CrewAuthScreen({
  onAuthenticated
}: {
  onAuthenticated: (envelope: AuthenticatedUserEnvelope, source: AuthCompletionSource) => void;
}) {
  const i18n = useI18n();
  const [mode, setMode] = useState<AuthFlowMode>("login");
  const [signupStep, setSignupStep] = useState<"account" | "homeBase">("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetCodePreview, setResetCodePreview] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [address, setAddress] = useState<Address>(createEmptyAddress());
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [pendingSignupToken, setPendingSignupToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallengeResponse>();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const authCopy = getModeCopy(i18n, mode);
  const tracker = getCrewMobileTracker();
  const isCompletingSocialSignup = pendingSignupToken.length > 0;
  const canSubmitLogin = email.trim().length > 0 && password.trim().length > 0;
  const canContinueSignupAccount =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    (isCompletingSocialSignup || password.trim().length > 0);
  const canSubmitSignup =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.line1.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.state.trim().length > 0 &&
    address.postalCode.trim().length > 0 &&
    (isCompletingSocialSignup || password.trim().length > 0);
  const canSubmitPrimary =
    mode === "login"
      ? canSubmitLogin
      : signupStep === "account"
        ? canContinueSignupAccount
        : canSubmitSignup;

  useEffect(() => {
    if (mode !== "signup" || signupStep !== "homeBase" || addressQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      createCrewMobileApiClient()
        .searchPlaces(addressQuery)
        .then((response) => setSuggestions(response.suggestions))
        .catch(() => setSuggestions([]))
        .finally(() => setIsSearching(false));
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [addressQuery, mode, signupStep]);

  function clearPendingSignupState() {
    setPendingSignupToken("");
  }

  function handlePrimarySubmit() {
    if (mode === "signup" && signupStep === "account") {
      if (!canContinueSignupAccount) {
        setErrorMessage(
          isCompletingSocialSignup
            ? i18n.t("mobile.auth.error.name_phone")
            : i18n.t("mobile.auth.error.name_email_phone_password")
        );
        return;
      }

      setErrorMessage("");
      setSignupStep("homeBase");
      return;
    }

    void handleAuth("password");
  }

  const handleAuth = async (method: "password" | "google" | "apple") => {
    void tracker.track(MarketplaceTelemetryEventCatalog.mobileAuthCompleted, {
      app: "crew",
      method,
      mode
    });

    if (method !== "password") {
      try {
        setIsSubmitting(true);
        setErrorMessage("");
        clearPendingSignupState();
        const api = createCrewMobileApiClient();
        const startUrl =
          method === "google"
            ? api.getGoogleAuthStartUrl({
                role: "crew-member",
                mode,
                redirectUri: crewRedirectUri
              })
            : api.getAppleAuthStartUrl({
                role: "crew-member",
                mode,
                redirectUri: crewRedirectUri
              });
        const result = await openAuthSessionAsync(startUrl, crewRedirectUri);
        if (result.type !== "success" || !result.url) {
          return;
        }

        const callbackUrl = new URL(result.url);
        const status = callbackUrl.searchParams.get("authStatus");
        if (status === "success") {
          const token = callbackUrl.searchParams.get("token");
          const expiresAtIso = callbackUrl.searchParams.get("expiresAtIso");
          if (!token || !expiresAtIso) {
            throw new Error(i18n.t("mobile.auth.error.missing_social_session"));
          }
          api.setAuthToken(token);
          const currentUser = await api.getCurrentUser();
          if (currentUser.user.role !== "crew-member") {
            throw new Error(i18n.t("mobile.auth.error.crew_role"));
          }
          onAuthenticated({
            session: {
              token,
              expiresAtIso,
              expiresInSeconds: Math.max(0, Math.round((Date.parse(expiresAtIso) - Date.now()) / 1000))
            },
            user: currentUser.user
          }, mode === "signup" ? "signup" : "login");
          return;
        }

        if (status === "pending-signup") {
          const pendingToken = callbackUrl.searchParams.get("pendingToken");
          const socialEmail = callbackUrl.searchParams.get("email");
          const socialFullName = callbackUrl.searchParams.get("fullName");
          if (!pendingToken || !socialEmail) {
            throw new Error(i18n.t("mobile.auth.error.missing_social_signup"));
          }
          setMode("signup");
          setSignupStep("account");
          setPendingSignupToken(pendingToken);
          setEmail(socialEmail);
          if (socialFullName) {
            setFullName(socialFullName);
          }
          setErrorMessage("");
          return;
        }

        throw new Error(
          callbackUrl.searchParams.get("message") ?? i18n.t("mobile.auth.error.social_signin")
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.social_signin"));
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
      const api = createCrewMobileApiClient();
      const envelope = await api.login({
        email: email.trim(),
        password,
        device: await getCrewAuthDevice()
      });

      if ("twoFactorRequired" in envelope) {
        setTwoFactorChallenge(envelope);
        setTwoFactorCode("");
        return;
      }

      if (envelope.user.role !== "crew-member") {
        setErrorMessage(i18n.t("mobile.auth.error.crew_role"));
        return;
      }

      onAuthenticated(envelope, "login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.login"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (!canSubmitSignup) {
      setErrorMessage(i18n.t("mobile.auth.error.crew_signup_details"));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      const device = await getCrewAuthDevice();
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
            role: "crew-member",
            address: normalizedAddress
          })
        : await api.registerUser({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            phone: phone.trim(),
            role: "crew-member",
            device,
            address: normalizedAddress
          });

      if (envelope.user.role !== "crew-member") {
        setErrorMessage(i18n.t("mobile.auth.error.crew_role"));
        return;
      }

      onAuthenticated(envelope, "signup");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.signup"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    try {
      setIsRequestingReset(true);
      setErrorMessage("");
      setRecoveryMessage("");
      const api = createCrewMobileApiClient();
      const result = await api.requestPasswordReset({
        email: email.trim()
      });
      setShowRecovery(true);
      setRecoveryMessage(result.message);
      setResetCodePreview(result.resetCodePreview ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.start_reset"));
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      setIsResettingPassword(true);
      setErrorMessage("");
      setRecoveryMessage("");
      const api = createCrewMobileApiClient();
      const envelope = await api.confirmPasswordReset({
        email: email.trim(),
        resetCode: recoveryCode.trim(),
        newPassword,
        device: await getCrewAuthDevice()
      });
      if ("twoFactorRequired" in envelope) {
        setTwoFactorChallenge(envelope);
        setShowRecovery(false);
        return;
      }

      if (envelope.user.role !== "crew-member") {
        setErrorMessage(i18n.t("mobile.auth.error.crew_role"));
        return;
      }

      onAuthenticated(envelope, "login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.reset_password"));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorChallenge || twoFactorCode.length !== 6) {
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const envelope = await createCrewMobileApiClient().verifyTwoFactorLogin({
        challengeToken: twoFactorChallenge.challengeToken,
        code: twoFactorCode,
        rememberDevice
      });
      if (envelope.user.role !== "crew-member") {
        setErrorMessage(i18n.t("mobile.auth.error.crew_role"));
        return;
      }
      onAuthenticated(envelope, "login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.login"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendTwoFactor = async () => {
    if (!twoFactorChallenge) return;
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setTwoFactorChallenge(await createCrewMobileApiClient().resendTwoFactorChallenge({ challengeToken: twoFactorChallenge.challengeToken }));
      setTwoFactorCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.auth.error.login"));
    } finally { setIsSubmitting(false); }
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
                    setSignupStep("account");
                  } else if (mode !== "signup") {
                    setSignupStep("account");
                  }
                }}
                style={[styles.modeButton, isActive && styles.modeButtonActive]}
              >
                <Text style={[styles.modeLabel, isActive && styles.modeLabelActive]}>
                  {value === "login" ? i18n.t("mobile.auth.log_in") : i18n.t("mobile.auth.sign_up")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "signup" ? (
          <View style={styles.signupPath}>
            <View style={[styles.signupPathItem, signupStep === "account" && styles.signupPathItemActive]}>
              <Text style={[styles.signupPathLabel, signupStep === "account" && styles.signupPathLabelActive]}>
                {i18n.t("mobile.auth.step.account")}
              </Text>
              <Text style={styles.signupPathMeta}>
                {canContinueSignupAccount ? i18n.t("provider_live.step.ready") : i18n.t("provider_live.step.now")}
              </Text>
            </View>
            <View style={[styles.signupPathItem, signupStep === "homeBase" && styles.signupPathItemActive]}>
              <Text style={[styles.signupPathLabel, signupStep === "homeBase" && styles.signupPathLabelActive]}>
                {i18n.t("mobile.auth.step.home_base")}
              </Text>
              <Text style={styles.signupPathMeta}>
                {signupStep === "homeBase"
                  ? canSubmitSignup
                    ? i18n.t("provider_live.step.ready")
                    : i18n.t("provider_live.step.now")
                  : i18n.t("customer_live.next")}
              </Text>
            </View>
          </View>
        ) : null}

        {mode === "login" || signupStep === "account" ? (
          <View style={styles.fieldStack}>
            <TextInput
              autoCapitalize="none"
              onChangeText={setEmail}
              placeholder={i18n.t("mobile.auth.placeholder.crew_email")}
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={email}
            />
            {!isCompletingSocialSignup ? (
              <TextInput
                onChangeText={setPassword}
                placeholder={i18n.t("auth_signup.field.password")}
                placeholderTextColor="#6e7d71"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            ) : null}
          </View>
        ) : null}

        {mode === "signup" ? (
          <View style={styles.fieldStack}>
            {isCompletingSocialSignup ? (
              <View style={styles.inlineNotice}>
                <Text style={styles.noticeTitle}>{i18n.t("mobile.auth.finish_crew_account")}</Text>
                <Text style={styles.helper}>
                  {i18n.t("mobile.auth.verified_email_continue", { email: email.trim() })}
                </Text>
              </View>
            ) : null}
            {signupStep === "account" ? (
              <>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={setFullName}
                  placeholder={i18n.t("auth_signup.field.full_name")}
                  placeholderTextColor="#6e7d71"
                  style={styles.input}
                  value={fullName}
                />
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setPhone}
                  placeholder={i18n.t("auth_signup.field.phone")}
                  placeholderTextColor="#6e7d71"
                  style={styles.input}
                  value={phone}
                />
              </>
            ) : (
              <>
                <View style={styles.inlineNotice}>
                  <Text style={styles.noticeTitle}>{i18n.t("mobile.auth.step.home_base")}</Text>
                  <Text style={styles.helper}>{i18n.t("mobile.auth.crew_home_base_helper")}</Text>
                </View>
                <Pressable onPress={() => setSignupStep("account")} style={styles.linkButton}>
                  <Text style={styles.linkButtonLabel}>{i18n.t("mobile.auth.edit_account")}</Text>
                </Pressable>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) => {
                    setAddressQuery(value);
                    setSelectedSuggestion(undefined);
                  }}
                  placeholder={i18n.t("mobile.auth.search_city")}
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
                          {suggestion.source === "google-geocoding"
                            ? i18n.t("mobile.auth.google_verified_area")
                            : i18n.t("mobile.auth.suggested_area")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : addressQuery.trim().length >= 2 && isSearching ? (
                  <Text style={styles.helper}>{i18n.t("mobile.auth.searching_nearby_areas")}</Text>
                ) : null}
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) =>
                    setAddress((current) => ({
                      ...current,
                      line1: value
                    }))
                  }
                  placeholder={i18n.t("mobile.auth.home_address")}
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
                    placeholder={i18n.t("auth_signup.field.city")}
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
                    placeholder={i18n.t("auth_signup.field.state")}
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
                    placeholder={i18n.t("auth_signup.field.zip")}
                    placeholderTextColor="#6e7d71"
                    style={[styles.input, styles.zipInput]}
                    value={address.postalCode}
                  />
                </View>
              </>
            )}
          </View>
        ) : null}

        <Pressable
          disabled={isSubmitting || !canSubmitPrimary || Boolean(twoFactorChallenge)}
          onPress={handlePrimarySubmit}
          style={[styles.primaryButton, (!canSubmitPrimary || isSubmitting) && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isSubmitting
              ? i18n.t("mobile.bookings.working")
              : isCompletingSocialSignup
                ? signupStep === "account"
                  ? i18n.t("common.actions.continue")
                  : i18n.t("mobile.auth.finish_account")
                : mode === "signup" && signupStep === "account"
                  ? i18n.t("common.actions.continue")
                  : authCopy.submitLabel}
          </Text>
        </Pressable>

        {mode === "login" && !twoFactorChallenge ? (
          <Pressable onPress={() => void handleRequestReset()} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>
              {isRequestingReset ? i18n.t("mobile.auth.sending_reset_code") : i18n.t("mobile.auth.forgot_password")}
            </Text>
          </Pressable>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {twoFactorChallenge ? (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>{i18n.t("security.challenge.title")}</Text>
            <Text style={styles.helper}>{i18n.t("security.challenge.body", { destination: twoFactorChallenge.destinationHint })}</Text>
            {twoFactorChallenge.codePreview ? (
              <Text style={styles.helper}>{i18n.t("security.setup.local_preview", { code: twoFactorChallenge.codePreview })}</Text>
            ) : null}
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setTwoFactorCode(value.replace(/\D/g, ""))}
              placeholder={i18n.t("security.setup.code")}
              placeholderTextColor="#6e7d71"
              style={styles.input}
              value={twoFactorCode}
            />
            <Pressable onPress={() => setRememberDevice((current) => !current)} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{rememberDevice ? "✓ " : ""}{i18n.t("security.challenge.remember")}</Text>
            </Pressable>
            <Pressable
              disabled={isSubmitting || twoFactorCode.length !== 6}
              onPress={() => void handleVerifyTwoFactor()}
              style={[styles.primaryButton, (isSubmitting || twoFactorCode.length !== 6) && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonLabel}>{i18n.t("security.challenge.verify")}</Text>
            </Pressable>
            <Pressable disabled={isSubmitting} onPress={() => void handleResendTwoFactor()} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("security.challenge.resend")}</Text>
            </Pressable>
            <Pressable onPress={() => { setTwoFactorChallenge(undefined); setTwoFactorCode(""); }} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("security.challenge.cancel")}</Text>
            </Pressable>
          </View>
        ) : null}

        {showRecovery && !twoFactorChallenge ? (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>{i18n.t("mobile.auth.reset_password_title")}</Text>
            <Text style={styles.helper}>
              {i18n.t("mobile.auth.use_latest_reset_code", {
                account: email.trim() || i18n.t("mobile.auth.your_account")
              })}
            </Text>
            {recoveryMessage ? <Text style={styles.helper}>{recoveryMessage}</Text> : null}
            {resetCodePreview ? (
              <Text style={styles.helper}>{i18n.t("mobile.auth.local_preview_code", { code: resetCodePreview })}</Text>
            ) : null}
            <View style={styles.fieldStack}>
              <TextInput
                onChangeText={setRecoveryCode}
                placeholder={i18n.t("mobile.auth.reset_code")}
                placeholderTextColor="#6e7d71"
                style={styles.input}
                value={recoveryCode}
              />
              <TextInput
                onChangeText={setNewPassword}
                placeholder={i18n.t("mobile.auth.new_password")}
                placeholderTextColor="#6e7d71"
                secureTextEntry
                style={styles.input}
                value={newPassword}
              />
            </View>
            <View style={styles.recoveryActions}>
              <Pressable onPress={() => void handleConfirmReset()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>
                  {isResettingPassword ? i18n.t("mobile.auth.updating") : i18n.t("mobile.auth.reset_password")}
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
                <Text style={styles.linkButtonLabel}>{i18n.t("common.actions.close")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {mode === "login" || signupStep === "account" ? (
          <View style={styles.socialStack}>
            <Pressable onPress={() => handleAuth("google")} style={styles.socialButton}>
              <AntDesign color="#4285F4" name="google" size={18} />
              <Text style={styles.socialLabel}>{i18n.t("mobile.auth.continue_google")}</Text>
            </Pressable>
            <Pressable onPress={() => handleAuth("apple")} style={styles.socialButton}>
              <AntDesign color={BrandTokens.colors.ink} name="apple" size={18} />
              <Text style={styles.socialLabel}>{i18n.t("mobile.auth.continue_apple")}</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.helper}>
          {mode === "signup"
            ? i18n.t("mobile.auth.crew_signup_helper")
            : i18n.t("mobile.auth.crew_login_helper")}
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
  signupPath: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  signupPathItem: {
    flex: 1,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.9)",
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  signupPathItemActive: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  signupPathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  signupPathLabelActive: {
    color: BrandTokens.colors.primaryStrong
  },
  signupPathMeta: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: "700"
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
  primaryButtonDisabled: {
    opacity: 0.46
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
