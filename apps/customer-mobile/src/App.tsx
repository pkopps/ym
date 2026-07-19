import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import {
  createI18n,
  loadFallbackMessages,
  loadLocaleMessages,
  type MessageDictionary,
  type SupportedLocale,
  type TranslationKey,
  type TranslationValues
} from "@yardmatch/i18n";
import { I18nProvider, useI18n } from "@yardmatch/i18n/react";
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
import {
  getCustomerMobileLocale,
  loadStoredCustomerLocale,
  saveCustomerLocale,
  setCustomerMobileLocale
} from "./lib/i18n";

const relockAfterMs = 60_000;
const mobileLocales: SupportedLocale[] = ["en", "es"];
type AuthCompletionSource = "login" | "signup";

export default function App() {
  const [locale, setLocale] = useState<SupportedLocale>(getCustomerMobileLocale);
  const [messages, setMessages] = useState<MessageDictionary | undefined>();
  const [fallbackMessages, setFallbackMessages] = useState<MessageDictionary | undefined>();
  const [sessionEnvelope, setSessionEnvelope] = useState<AuthenticatedUserEnvelope | undefined>();
  const [showLanguageOnboarding, setShowLanguageOnboarding] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("");
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const backgroundedAtRef = useRef<number | undefined>(undefined);
  const i18n = useMemo(
    () =>
      messages
        ? createI18n({
            locale,
            messages,
            fallbackMessages
          })
        : undefined,
    [fallbackMessages, locale, messages]
  );
  const resolvedBiometricLabel = biometricLabel || i18n?.t("mobile.auth.device_biometrics") || "";

  function t(key: TranslationKey, values?: TranslationValues) {
    return i18n?.t(key, values) ?? "";
  }

  useEffect(() => {
    let isMounted = true;

    loadStoredCustomerLocale()
      .then((storedLocale) => {
        if (isMounted) {
          setLocale(storedLocale);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setCustomerMobileLocale(locale);

    Promise.all([
      loadLocaleMessages(locale),
      locale === "en" ? loadLocaleMessages("en") : loadFallbackMessages()
    ])
      .then(([nextMessages, nextFallbackMessages]) => {
        if (isMounted) {
          setMessages(nextMessages);
          setFallbackMessages(nextFallbackMessages);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [locale]);

  async function handleLocaleChange(nextLocale: SupportedLocale) {
    setLocale(nextLocale);
    await saveCustomerLocale(nextLocale);
  }

  async function signOutAndClearSession() {
    setSessionEnvelope(undefined);
    setShowLanguageOnboarding(false);
    setIsBiometricLocked(false);
    setLockMessage(t("mobile.auth.unlock_prompt"));
    await clearStoredCustomerSession();
  }

  async function handleAuthenticated(envelope: AuthenticatedUserEnvelope, source: AuthCompletionSource = "login") {
    setSessionEnvelope(envelope);
    setShowLanguageOnboarding(source === "signup");
    setIsBiometricLocked(false);
    setLockMessage(t("mobile.auth.unlock_prompt"));
    await saveStoredCustomerSession(envelope);
  }

  async function handleSetBiometricEnabled(enabled: boolean) {
    if (enabled) {
      if (!biometricAvailable) {
        setLockMessage(t("mobile.auth.no_biometrics"));
        return false;
      }

      const unlocked = await promptCustomerBiometricUnlock();
      if (!unlocked) {
        setLockMessage(t("mobile.auth.unable_to_verify", { biometricLabel: resolvedBiometricLabel }));
        return false;
      }
    }

    setBiometricEnabledState(enabled);
    await saveCustomerBiometricPreference(enabled);
    setLockMessage(
      enabled
        ? t("mobile.auth.will_use_biometrics", { biometricLabel: resolvedBiometricLabel })
        : t("mobile.auth.unlock_prompt")
    );
    return true;
  }

  async function unlockWithBiometrics() {
    const unlocked = await promptCustomerBiometricUnlock();
    if (unlocked) {
      setIsBiometricLocked(false);
      setLockMessage(t("mobile.auth.unlock_prompt"));
      return;
    }

    setLockMessage(t("mobile.auth.unlock_failed", { biometricLabel: resolvedBiometricLabel }));
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

  if (!i18n || !messages || !fallbackMessages) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
      </SafeAreaView>
    );
  }

  return (
    <I18nProvider fallbackMessages={fallbackMessages} locale={locale} messages={messages}>
      <ObservabilityProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <CustomerSessionProvider
          value={{
            envelope: sessionEnvelope,
            biometricEnabled,
            biometricAvailable,
            biometricLabel: resolvedBiometricLabel,
            setBiometricEnabled: handleSetBiometricEnabled,
            signOut: () => {
              void signOutAndClearSession();
            }
          }}
        >
          {isRestoringSession ? (
            <CenteredMessage
              eyebrow={t("mobile.auth.customer_eyebrow")}
              title={t("mobile.auth.restoring_title")}
              description={t("mobile.auth.restoring_description")}
            />
          ) : sessionEnvelope && isBiometricLocked ? (
            <BiometricLockScreen
              description={t("mobile.auth.unlock_description_customer", { biometricLabel: resolvedBiometricLabel })}
              eyebrow={t("mobile.auth.locked_eyebrow")}
              message={lockMessage || t("mobile.auth.unlock_prompt")}
              onSignInInstead={() => {
                void signOutAndClearSession();
              }}
              onUnlock={() => {
                void unlockWithBiometrics();
              }}
              title={t("mobile.auth.unlock_title", { biometricLabel: resolvedBiometricLabel })}
            />
          ) : sessionEnvelope && showLanguageOnboarding ? (
            <LanguageOnboardingScreen
              locale={locale}
              onContinue={() => setShowLanguageOnboarding(false)}
              onLocaleChange={(nextLocale) => void handleLocaleChange(nextLocale)}
            />
          ) : sessionEnvelope ? (
            <CustomerAppNavigator
              languageSettings={{
                locale,
                onLocaleChange: (nextLocale) => {
                  void handleLocaleChange(nextLocale);
                }
              }}
            />
          ) : (
            <CustomerAuthScreen onAuthenticated={(envelope, source) => void handleAuthenticated(envelope, source)} />
          )}
        </CustomerSessionProvider>
        </SafeAreaView>
      </ObservabilityProvider>
    </I18nProvider>
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
  const i18n = useI18n();

  return (
    <View style={styles.lockShell}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onUnlock} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>{i18n.t("common.actions.unlock_now")}</Text>
      </Pressable>
      <Pressable onPress={onSignInInstead} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonLabel}>{i18n.t("common.actions.use_password_instead")}</Text>
      </Pressable>
    </View>
  );
}

function LanguageOnboardingScreen({
  locale,
  onLocaleChange,
  onContinue
}: {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
  onContinue: () => void;
}) {
  const i18n = useI18n();

  return (
    <View style={styles.lockShell}>
      <Text style={styles.eyebrow}>{i18n.t("mobile.language_onboarding.eyebrow")}</Text>
      <Text style={styles.title}>{i18n.t("mobile.language_onboarding.title")}</Text>
      <Text style={styles.description}>{i18n.t("mobile.language_onboarding.description")}</Text>
      <MobileLanguagePicker locale={locale} onLocaleChange={onLocaleChange} />
      <Pressable onPress={onContinue} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>{i18n.t("common.actions.continue")}</Text>
      </Pressable>
    </View>
  );
}

function MobileLanguagePicker({
  locale,
  onLocaleChange
}: {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
}) {
  const i18n = useI18n();

  return (
    <View accessibilityLabel={i18n.t("common.language.label")} style={styles.languagePicker}>
      {mobileLocales.map((option) => (
        <Pressable
          accessibilityRole="button"
          key={option}
          onPress={() => onLocaleChange(option)}
          style={[styles.languageOption, locale === option && styles.languageOptionActive]}
        >
          <Text style={[styles.languageOptionLabel, locale === option && styles.languageOptionLabelActive]}>
            {option === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english")}
          </Text>
        </Pressable>
      ))}
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
  },
  languagePicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: BrandTokens.spacing.sm,
    backgroundColor: BrandTokens.colors.surface,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  languageOption: {
    minWidth: 104,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  languageOptionActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.primary
  },
  languageOptionLabel: {
    color: BrandTokens.colors.inkSoft,
    fontWeight: "700"
  },
  languageOptionLabelActive: {
    color: "#ffffff"
  }
});
