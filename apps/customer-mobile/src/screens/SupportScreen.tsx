import { AnalyticsPreferences } from "../providers/ObservabilityProvider";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View, Pressable, TextInput } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AccountSecuritySettings,
  AppNotification,
  BookingArrivalTracking,
  Booking,
  CreateCustomerPropertyRequest,
  CreateSupportTicketRequest,
  CustomerProperty,
  NotificationDeliveryRecord,
  NotificationPreferences,
  SupportIssueType,
  SupportTicket,
  TwoFactorChallengeResponse,
  TwoFactorMethod
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey, type SupportedLocale } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { CustomerPropertyForm } from "../components/CustomerPropertyForm";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createCustomerMobileApiClient } from "../lib/api";
import { getCustomerAuthDevice } from "../lib/sessionSecurity";
import { findTrackableBooking, parseTrackingBookingId } from "../lib/arrivalTracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

type CustomerAccountSection = "properties" | "alerts" | "language" | "security" | "help";
type LanguageSettings = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

const accountSectionOptions: Array<{ value: CustomerAccountSection; labelKey: TranslationKey }> = [
  { value: "properties", labelKey: "mobile.support.section.properties" },
  { value: "alerts", labelKey: "mobile.support.section.alerts" },
  { value: "language", labelKey: "common.language.label" },
  { value: "security", labelKey: "mobile.support.section.security" },
  { value: "help", labelKey: "mobile.support.section.help" }
];

const supportIssueLabelKeys: Record<SupportIssueType, TranslationKey> = {
  billing: "mobile.support.issue.billing",
  "service-quality": "mobile.support.issue.service_quality",
  account: "mobile.support.issue.account",
  general: "mobile.support.issue.general"
};

function getEnabledAlertCount(preferences?: NotificationPreferences) {
  if (!preferences) {
    return undefined;
  }

  return [
    preferences.pushEnabled,
    preferences.emailEnabled,
    preferences.smsEnabled,
    preferences.reviewRemindersEnabled
  ].filter(Boolean).length;
}

function formatPropertyArea(i18n: I18nInstance, value?: number) {
  if (!value) {
    return i18n.t("mobile.support.not_set");
  }

  return i18n.t("mobile.support.property.area_sq_ft", { count: value });
}

function formatPropertyLocation(property: CustomerProperty) {
  return `${property.address.city}, ${property.address.state} ${property.address.postalCode}`;
}

function getPropertyAccessLabel(i18n: I18nInstance, property: CustomerProperty) {
  if (property.gateCode && property.accessNotes) {
    return i18n.t("mobile.support.property.gate_notes");
  }

  if (property.gateCode) {
    return i18n.t("mobile.support.property.gate_saved");
  }

  if (property.accessNotes) {
    return i18n.t("mobile.support.property.notes_saved");
  }

  return i18n.t("mobile.support.not_set");
}

function getPropertyMeasurementLabel(i18n: I18nInstance, property: CustomerProperty) {
  const savedMeasurements = [
    property.lawnSizeSqFt,
    property.shrubBedSqFt,
    property.drivewaySqFt,
    property.sidewalkLinearFt
  ].filter(Boolean).length;

  if (savedMeasurements === 0) {
    return i18n.t("mobile.support.not_set");
  }

  return i18n.t("mobile.support.property.measurements_saved", { count: savedMeasurements });
}

export function SupportScreen({ languageSettings }: { languageSettings: LanguageSettings }) {
  const i18n = useI18n();
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>();
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [showAddPropertyForm, setShowAddPropertyForm] = useState(false);
  const [showAlertPreferences, setShowAlertPreferences] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [showSupportHistory, setShowSupportHistory] = useState(false);
  const [activeSection, setActiveSection] = useState<CustomerAccountSection>("properties");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [securitySettings, setSecuritySettings] = useState<AccountSecuritySettings>();
  const [securityMethod, setSecurityMethod] = useState<TwoFactorMethod>("email");
  const [securityChallenge, setSecurityChallenge] = useState<TwoFactorChallengeResponse>();
  const [securityCode, setSecurityCode] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const { biometricAvailable, biometricEnabled, biometricLabel, envelope, setBiometricEnabled, signOut } =
    useCustomerSession();
  const defaultProperty = properties.find((property) => property.isDefault) ?? properties[0];
  const enabledAlertCount = getEnabledAlertCount(preferences);
  const currentLanguageLabel =
    languageSettings.locale === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english");
  const sectionSummaries: Record<CustomerAccountSection, string> = {
    properties: defaultProperty
      ? i18n.t("mobile.support.summary.default_property", { property: defaultProperty.label })
      : i18n.t("mobile.support.summary.saved_properties", { count: properties.length }),
    alerts: enabledAlertCount === undefined
      ? i18n.t("mobile.support.summary.loading")
      : i18n.t("mobile.support.summary.alerts_on", { count: enabledAlertCount }),
    security: securitySettings?.twoFactorEnabled
      ? i18n.t("security.two_factor.on", {
          destination: securitySettings.destinationHint ?? "",
          method: i18n.t(securitySettings.method === "sms" ? "security.method.sms" : "security.method.email")
        })
      : !biometricAvailable
      ? i18n.t("mobile.support.summary.unavailable")
      : biometricEnabled
        ? i18n.t("mobile.support.summary.biometric_on", { biometric: biometricLabel })
        : i18n.t("mobile.support.summary.biometric_off", { biometric: biometricLabel }),
    language: i18n.t("mobile.settings.language.summary", { language: currentLanguageLabel }),
    help:
      supportTickets.length > 0
        ? i18n.t("mobile.support.summary.recent_tickets", { count: supportTickets.length })
        : i18n.t("mobile.support.summary.start_ticket")
  };

  async function loadAccount() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const device = await getCustomerAuthDevice();
      const [nextProperties, nextBookings, nextTickets, notificationResponse, nextPreferences, nextDeliveries, nextSecurity] = await Promise.all([
        api.getCustomerProperties(),
        api.getBookings(),
        api.getSupportTickets(),
        api.getNotifications(),
        api.getNotificationPreferences(),
        api.getNotificationDeliveries(),
        api.getSecuritySettings(device.id)
      ]);
      setProperties(nextProperties);
      setBookings(nextBookings);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setPreferences(nextPreferences);
      setDeliveries(nextDeliveries.deliveries);
      setSecuritySettings(nextSecurity);
      setSecurityMethod(nextSecurity.method ?? "email");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.load_account"));
    } finally {
      setIsInitialLoading(false);
    }
  }

  async function beginTwoFactorSetup() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setSecurityChallenge(await api.beginTwoFactorSetup({ method: securityMethod, device: await getCustomerAuthDevice() }));
      setSecurityCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmTwoFactorSetup() {
    if (!envelope?.session.token || !securityChallenge) return;
    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setSecuritySettings(await api.confirmTwoFactorSetup({ challengeToken: securityChallenge.challengeToken, code: securityCode, rememberDevice: true }));
      setSecurityChallenge(undefined);
      setSecurityCode("");
      setStatusMessage(i18n.t("security.status.updated"));
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function disableTwoFactor() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setSecuritySettings(await api.disableTwoFactor({ password: securityPassword }));
      setSecurityPassword("");
      setStatusMessage(i18n.t("security.status.updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeTrustedDevice(trustedDeviceId: string) {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.revokeTrustedDevice({ trustedDeviceId });
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeAllSessions() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.revokeOtherSessions();
      signOut();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
      setIsWorking(false);
    }
  }

  async function handleUpdatePreferences(
    updates: Partial<Pick<NotificationPreferences, "pushEnabled" | "emailEnabled" | "smsEnabled" | "reviewRemindersEnabled">>
  ) {
    if (!envelope?.session.token || !preferences) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextPreferences = await api.updateNotificationPreferences(updates);
      setPreferences(nextPreferences);
      setStatusMessage(i18n.t("mobile.support.message.delivery_preferences_updated"));
      const nextDeliveries = await api.getNotificationDeliveries();
      setDeliveries(nextDeliveries.deliveries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.update_notification_preferences"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMarkNotificationsRead() {
    if (!envelope?.session.token || unreadCount === 0) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const response = await api.markNotificationsRead({});
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setStatusMessage(i18n.t("mobile.support.message.notifications_marked_read"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("notifications.error.update"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateProperty(payload: CreateCustomerPropertyRequest) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const property = await api.createCustomerProperty(payload);
      setStatusMessage(i18n.t("mobile.support.message.property_added", { property: property.label }));
      setShowAddPropertyForm(false);
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.book.error.save_property"));
    } finally {
      setIsWorking(false);
    }
  }

  async function openTrackingFromNotification(notification: AppNotification) {
    if (!envelope?.session.token) {
      return;
    }

    const fallbackBookingId = findTrackableBooking(bookings)?.id;
    const bookingId =
      parseTrackingBookingId(notification.actionHref) ??
      (notification.title.toLowerCase().includes("on the way") ? fallbackBookingId : undefined);

    if (!bookingId) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setTracking(await api.getBookingTracking(bookingId));
      setActiveTrackingBookingId(bookingId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.open_arrival_tracking"));
    } finally {
      setIsWorking(false);
    }
  }

  async function refreshTracking() {
    if (!envelope?.session.token || !activeTrackingBookingId) {
      return;
    }

    const api = createCustomerMobileApiClient();
    api.setAuthToken(envelope.session.token);
    setTracking(await api.getBookingTracking(activeTrackingBookingId));
  }

  async function handleSetDefault(propertyId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.setDefaultCustomerProperty({ propertyId });
      setStatusMessage(i18n.t("mobile.support.message.default_property_updated"));
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.update_default_property"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateSupportTicket() {
    if (!envelope?.session.token || subject.trim().length === 0 || description.trim().length === 0) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createSupportTicket({
        bookingId: selectedBookingId || undefined,
        issueType: selectedIssueType,
        subject: subject.trim(),
        description: description.trim()
      } satisfies CreateSupportTicketRequest);
      setStatusMessage(i18n.t("mobile.support.message.support_ticket_submitted"));
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      setShowSupportComposer(false);
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.open_support_ticket"));
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, [envelope?.session.token]);

  async function handleBiometricToggle(nextValue: boolean) {
    const updated = await setBiometricEnabled(nextValue);
    if (updated) {
      setStatusMessage(
        nextValue
          ? i18n.t("mobile.support.message.biometric_enabled", { biometric: biometricLabel })
          : i18n.t("mobile.support.message.biometric_disabled")
      );
      return;
    }

    if (nextValue) {
      setErrorMessage(i18n.t("mobile.support.error.enable_biometric", { biometric: biometricLabel }));
    }
  }

  if (isInitialLoading && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("mobile.support.eyebrow")}
        title={i18n.t("mobile.support.title")}
        description={i18n.t("mobile.support.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={3} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("mobile.support.eyebrow")}
      title={i18n.t("mobile.support.title")}
      description={i18n.t("mobile.support.description")}
    >
      <AnalyticsPreferences />
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <InfoCard title={i18n.t("mobile.support.account_tools")} description={sectionSummaries[activeSection]}>
        <View style={styles.chipWrap}>
          {accountSectionOptions.map((option) => {
            const isActive = option.value === activeSection;
            return (
              <Pressable
                key={option.value}
                onPress={() => setActiveSection(option.value)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{i18n.t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      {activeSection === "properties" ? (
      <InfoCard
        title={defaultProperty ? i18n.t("mobile.support.default_property") : i18n.t("mobile.support.saved_properties")}
        description={defaultProperty ? i18n.t("mobile.support.default_property_description") : i18n.t("mobile.support.add_property_description")}
      >
        {defaultProperty ? (
          <View style={styles.propertySummary}>
            <View style={styles.propertySummaryHeader}>
              <View style={styles.copy}>
                <Text style={styles.propertySummaryTitle}>{defaultProperty.label}</Text>
                <Text style={styles.meta}>{defaultProperty.address.line1}</Text>
                <Text style={styles.meta}>{formatPropertyLocation(defaultProperty)}</Text>
              </View>
              <Text style={styles.badge}>{i18n.t("mobile.book.default_property")}</Text>
            </View>
            <View style={styles.propertyFactGrid}>
              <View style={styles.propertyFact}>
                <Text style={styles.propertyFactLabel}>{i18n.t("mobile.support.property.lawn")}</Text>
                <Text style={styles.propertyFactValue}>{formatPropertyArea(i18n, defaultProperty.lawnSizeSqFt)}</Text>
              </View>
              <View style={styles.propertyFact}>
                <Text style={styles.propertyFactLabel}>{i18n.t("mobile.support.property.access")}</Text>
                <Text style={styles.propertyFactValue}>{getPropertyAccessLabel(i18n, defaultProperty)}</Text>
              </View>
              <View style={styles.propertyFact}>
                <Text style={styles.propertyFactLabel}>{i18n.t("mobile.support.property.beds")}</Text>
                <Text style={styles.propertyFactValue}>{formatPropertyArea(i18n, defaultProperty.shrubBedSqFt)}</Text>
              </View>
              <View style={styles.propertyFact}>
                <Text style={styles.propertyFactLabel}>{i18n.t("mobile.support.property.details")}</Text>
                <Text style={styles.propertyFactValue}>{getPropertyMeasurementLabel(i18n, defaultProperty)}</Text>
              </View>
            </View>
          </View>
        ) : null}
        {properties.length > 0 ? (
          <View style={styles.list}>
            {properties.map((property) => (
              <View key={property.id} style={styles.propertyRow}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{property.label}</Text>
                  <Text style={styles.meta}>{property.address.line1}</Text>
                  <Text style={styles.meta}>{formatPropertyLocation(property)}</Text>
                </View>
                {property.isDefault ? (
                  <Text style={styles.badge}>{i18n.t("mobile.book.default_property")}</Text>
                ) : (
                  <Pressable
                    disabled={isWorking}
                    onPress={() => void handleSetDefault(property.id)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkButtonLabel}>{i18n.t("mobile.support.set_default")}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{i18n.t("mobile.support.no_properties_saved")}</Text>
        )}
        <Pressable
          disabled={isWorking}
          onPress={() => setShowAddPropertyForm((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAddPropertyForm ? i18n.t("common.actions.close") : i18n.t("mobile.book.add_property")}
          </Text>
        </Pressable>
        {showAddPropertyForm ? (
          <CustomerPropertyForm isWorking={isWorking} onSubmit={handleCreateProperty} submitLabel={i18n.t("mobile.book.add_property")} />
        ) : null}
      </InfoCard>
      ) : null}

      {activeSection === "language" ? (
      <InfoCard title={i18n.t("mobile.settings.language.title")} description={i18n.t("mobile.settings.language.description")}>
        <View style={styles.chipWrap}>
          {(["en", "es"] as SupportedLocale[]).map((option) => {
            const isActive = languageSettings.locale === option;
            return (
              <Pressable
                key={option}
                onPress={() => languageSettings.onLocaleChange(option)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {option === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>
      ) : null}

      {activeSection === "security" ? (
      <InfoCard title={i18n.t("mobile.support.section.security")} description={sectionSummaries.security}>
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={styles.title}>{i18n.t("mobile.support.use_biometric", { biometric: biometricLabel })}</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? i18n.t("mobile.support.use_biometric_description")
                : i18n.t("mobile.support.biometric_unavailable")}
            </Text>
          </View>
          <Switch
            disabled={!biometricAvailable || isWorking}
            onValueChange={(value) => {
              void handleBiometricToggle(value);
            }}
            value={biometricEnabled}
          />
        </View>
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionHeading}>{i18n.t("security.two_factor.title")}</Text>
        <Text style={styles.meta}>
          {securitySettings?.twoFactorEnabled && securitySettings.destinationHint && securitySettings.method
            ? i18n.t("security.two_factor.on", {
                destination: securitySettings.destinationHint,
                method: i18n.t(securitySettings.method === "sms" ? "security.method.sms" : "security.method.email")
              })
            : i18n.t("security.two_factor.off")}
        </Text>
        <View style={styles.chipWrap}>
          {(["email", "sms"] as TwoFactorMethod[]).map((method) => (
            <Pressable key={method} onPress={() => setSecurityMethod(method)} style={[styles.chip, securityMethod === method && styles.chipActive]}>
              <Text style={[styles.chipLabel, securityMethod === method && styles.chipLabelActive]}>
                {i18n.t(method === "sms" ? "security.method.sms" : "security.method.email")}
              </Text>
            </Pressable>
          ))}
        </View>
        {securityChallenge ? (
          <View style={styles.list}>
            <Text style={styles.meta}>{i18n.t("security.setup.sent", { destination: securityChallenge.destinationHint })}</Text>
            {securityChallenge.codePreview ? <Text style={styles.meta}>{i18n.t("security.setup.local_preview", { code: securityChallenge.codePreview })}</Text> : null}
            <TextInput keyboardType="number-pad" maxLength={6} onChangeText={(value) => setSecurityCode(value.replace(/\D/g, ""))} placeholder={i18n.t("security.setup.code")} style={styles.input} value={securityCode} />
            <Pressable disabled={isWorking || securityCode.length !== 6} onPress={() => void confirmTwoFactorSetup()} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("security.setup.confirm")}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable disabled={isWorking} onPress={() => void beginTwoFactorSetup()} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>{i18n.t("security.setup.send")}</Text>
          </Pressable>
        )}
        {securitySettings?.twoFactorEnabled ? (
          <View style={styles.list}>
            <TextInput onChangeText={setSecurityPassword} placeholder={i18n.t("security.disable.password")} secureTextEntry style={styles.input} value={securityPassword} />
            <Pressable disabled={isWorking || !securityPassword} onPress={() => void disableTwoFactor()} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("security.disable.action")}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionHeading}>{i18n.t("security.alerts.title")}</Text>
        <Text style={styles.meta}>{i18n.t("security.alerts.body")}</Text>
        <Text style={styles.sectionHeading}>{i18n.t("security.devices.title")}</Text>
        {securitySettings?.trustedDevices.length ? securitySettings.trustedDevices.map((device) => (
          <View key={device.id} style={styles.ticketRow}>
            <View style={styles.copy}>
              <Text style={styles.title}>{device.label}{device.isCurrentDevice ? ` · ${i18n.t("security.devices.current")}` : ""}</Text>
              <Text style={styles.meta}>{i18n.t("security.devices.last_seen", { date: i18n.formatDate(device.lastSeenAt) })}</Text>
            </View>
            <Pressable disabled={isWorking} onPress={() => void revokeTrustedDevice(device.id)} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("security.devices.remove")}</Text>
            </Pressable>
          </View>
        )) : <Text style={styles.meta}>{i18n.t("security.devices.empty")}</Text>}
        <Text style={styles.meta}>{i18n.t("security.sessions.warning")}</Text>
        <Pressable disabled={isWorking} onPress={() => void revokeAllSessions()} style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>{i18n.t("security.sessions.revoke")}</Text>
        </Pressable>
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>{i18n.t("mobile.support.log_out")}</Text>
        </Pressable>
      </InfoCard>
      ) : null}

      {activeSection === "alerts" ? (
      <InfoCard title={i18n.t("notifications.updates")} description={i18n.t("mobile.support.unread_count", { count: unreadCount })}>
        {notifications.length > 0 ? (
          <View style={styles.list}>
            {notifications.slice(0, 4).map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() => void openTrackingFromNotification(notification)}
                style={styles.ticketRow}
              >
                <View style={styles.copy}>
                  <Text style={styles.title}>{notification.title}</Text>
                  <Text style={styles.meta}>{notification.body}</Text>
                  {parseTrackingBookingId(notification.actionHref) ||
                  notification.title.toLowerCase().includes("on the way") ? (
                    <Text style={styles.notificationLink}>{i18n.t("mobile.support.open_live_map")}</Text>
                  ) : null}
                </View>
                <Text style={styles.badge}>{notification.isRead ? i18n.t("mobile.support.notification.read") : i18n.t("common.state.new")}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{i18n.t("mobile.support.all_caught_up")}</Text>
        )}
        {unreadCount > 0 ? (
          <Pressable
            disabled={isWorking}
            onPress={() => void handleMarkNotificationsRead()}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonLabel}>{i18n.t("mobile.support.mark_read")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={isWorking}
          onPress={() => setShowAlertPreferences((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAlertPreferences ? i18n.t("common.actions.close") : i18n.t("mobile.support.preferences")}
          </Text>
        </Pressable>
        {showAlertPreferences ? (
          <View style={styles.list}>
            <PreferenceRow
              label={i18n.t("mobile.support.preference.push")}
              value={preferences?.pushEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ pushEnabled: value })}
            />
            <PreferenceRow
              label={i18n.t("mobile.support.preference.email")}
              value={preferences?.emailEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ emailEnabled: value })}
            />
            <PreferenceRow
              label={i18n.t("mobile.support.preference.sms")}
              value={preferences?.smsEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ smsEnabled: value })}
            />
            <PreferenceRow
              label={i18n.t("mobile.support.preference.review_reminders")}
              value={preferences?.reviewRemindersEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ reviewRemindersEnabled: value })}
            />
          </View>
        ) : null}

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionHeading}>{i18n.t("mobile.support.sent_alerts")}</Text>
        {deliveries.length > 0 ? (
          <View style={styles.list}>
            {deliveries.slice(0, 4).map((delivery) => (
              <View key={delivery.id} style={styles.ticketRow}>
                <View style={styles.copy}>
                  <Text style={styles.title}>
                    {delivery.channel.toUpperCase()} • {delivery.title}
                  </Text>
                  <Text style={styles.meta}>{delivery.destination}</Text>
                  <Text style={styles.meta}>{delivery.provider}</Text>
                </View>
                <Text style={styles.badge}>{delivery.status}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{i18n.t("mobile.support.no_delivery_records")}</Text>
        )}
      </InfoCard>
      ) : null}

      {activeSection === "help" ? (
      <InfoCard title={i18n.t("mobile.support.section.help")} description={sectionSummaries.help}>
        <Pressable
          onPress={() => setShowSupportComposer((current) => !current)}
          style={showSupportComposer ? styles.linkButton : styles.primaryButton}
        >
          <Text style={showSupportComposer ? styles.linkButtonLabel : styles.primaryButtonLabel}>
            {showSupportComposer ? i18n.t("common.actions.close") : i18n.t("mobile.support.new_ticket")}
          </Text>
        </Pressable>
        {showSupportComposer ? (
          <View style={styles.list}>
            <View style={styles.chipWrap}>
              {supportIssueOptions.map((issueType) => {
                const isActive = issueType === selectedIssueType;
                return (
                  <Pressable
                    key={issueType}
                    onPress={() => setSelectedIssueType(issueType)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {i18n.t(supportIssueLabelKeys[issueType])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.list}>
              <Text style={styles.meta}>{i18n.t("mobile.support.visit_optional")}</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  onPress={() => setSelectedBookingId("")}
                  style={[styles.chip, !selectedBookingId && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, !selectedBookingId && styles.chipLabelActive]}>
                    {i18n.t("mobile.support.no_visit")}
                  </Text>
                </Pressable>
                {bookings.slice(0, 4).map((booking) => {
                  const isActive = selectedBookingId === booking.id;
                  return (
                    <Pressable
                      key={booking.id}
                      onPress={() => setSelectedBookingId(booking.id)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                        {i18n.t(serviceCategoryToI18nKey(booking.category))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TextInput
              onChangeText={setSubject}
              placeholder={i18n.t("mobile.support.subject")}
              placeholderTextColor={BrandTokens.colors.muted}
              style={styles.input}
              value={subject}
            />
            <TextInput
              multiline
              onChangeText={setDescription}
              placeholder={i18n.t("mobile.support.what_happened")}
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.textarea]}
              value={description}
            />
            <Pressable
              disabled={isWorking || subject.trim().length === 0 || description.trim().length === 0}
              onPress={() => void handleCreateSupportTicket()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>
                {isWorking ? i18n.t("mobile.support.sending") : i18n.t("mobile.support.send")}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {supportTickets.length > 0 ? (
          <>
            <Pressable
              onPress={() => setShowSupportHistory((current) => !current)}
              style={styles.linkButton}
            >
              <Text style={styles.linkButtonLabel}>
                {showSupportHistory ? i18n.t("common.actions.close") : i18n.t("mobile.support.recent_tickets")}
              </Text>
            </Pressable>
            {showSupportHistory ? (
              <View style={styles.list}>
                {supportTickets.slice(0, 3).map((ticket) => (
                  <View key={ticket.id} style={styles.ticketRow}>
                    <View style={styles.copy}>
                      <Text style={styles.title}>{ticket.subject}</Text>
                      <Text style={styles.meta}>
                        {i18n.t(supportIssueLabelKeys[ticket.issueType])} • {ticket.status}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{i18n.formatDate(ticket.createdAt)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </InfoCard>
      ) : null}

      <ArrivalTrackingModal
        onClose={() => {
          setTracking(undefined);
          setActiveTrackingBookingId(undefined);
        }}
        onRefresh={() => void refreshTracking()}
        tracking={tracking}
        visible={Boolean(tracking && activeTrackingBookingId)}
      />
    </ScreenShell>
  );
}

function PreferenceRow({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={styles.title}>{label}</Text>
      <Switch
        trackColor={{ false: BrandTokens.colors.border, true: BrandTokens.colors.primary }}
        thumbColor="#ffffff"
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  propertySummary: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: BrandTokens.colors.surface,
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  propertySummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  propertySummaryTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  propertyFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  propertyFact: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: BrandTokens.spacing.md
  },
  propertyFactLabel: {
    color: BrandTokens.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  propertyFactValue: {
    color: BrandTokens.colors.ink,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: BrandTokens.spacing.xs
  },
  propertyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: BrandTokens.spacing.md
  },
  copy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  sectionHeading: {
    color: BrandTokens.colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  badge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  linkButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  logoutButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingVertical: BrandTokens.spacing.md
  },
  logoutButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.94)"
  },
  chipActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.primary
  },
  chipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chipLabelActive: {
    color: "#ffffff"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  input: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    color: BrandTokens.colors.ink,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  notificationLink: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
