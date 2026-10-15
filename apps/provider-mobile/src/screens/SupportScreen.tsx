import { ProviderActivationCard } from "../components/ProviderActivationCard";
import { ProviderPricingCard } from "../components/ProviderPricingCard";
import { AnalyticsPreferences } from "../providers/ObservabilityProvider";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AccountSecuritySettings,
  AppNotification,
  CreateExternalCalendarImportRequest,
  CreateSupportTicketRequest,
  ExternalCalendarProvider,
  ExternalCalendarBlockType,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationDeliveryRecord,
  NotificationPreferences,
  ProviderPayoutLedgerResponse,
  ProviderCalendarImportsResponse,
  ProviderCalendarSubscriptionResponse,
  ProviderProfile,
  ProviderStaffingOverview,
  SupportIssueType,
  SupportTicket,
  SupportTicketStatus,
  TwoFactorChallengeResponse,
  TwoFactorMethod
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey, type SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { SkeletonCard } from "../components/SkeletonCard";
import { createProviderMobileApiClient } from "../lib/api";
import { unlessFeatureDisabled } from "../lib/launchFeatures";
import { getProviderAuthDevice } from "../lib/sessionSecurity";
import { useProviderSession } from "../session/ProviderSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];
const externalCalendarBlockOptions: ExternalCalendarBlockType[] = [
  "off-platform-client",
  "personal-time",
  "travel-buffer",
  "equipment-maintenance"
];
const externalCalendarImportProviders: ExternalCalendarProvider[] = ["google", "apple", "ical"];

type ProviderBusinessSection = "work" | "payouts" | "alerts" | "language" | "security" | "help";
type LanguageSettings = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

const businessSectionOptions: Array<{ value: ProviderBusinessSection; labelKey: TranslationKey }> = [
  { value: "work", labelKey: "provider_mobile.support.section.work" },
  { value: "payouts", labelKey: "provider_mobile.dashboard.payouts" },
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

const externalCalendarBlockLabelKeys: Record<ExternalCalendarBlockType, TranslationKey> = {
  "off-platform-client": "provider_mobile.support.calendar.block_type.off_platform_client",
  "personal-time": "provider_mobile.support.calendar.block_type.personal_time",
  "travel-buffer": "provider_mobile.support.calendar.block_type.travel_buffer",
  "equipment-maintenance": "provider_mobile.support.calendar.block_type.equipment_maintenance"
};

const externalCalendarProviderLabelKeys: Record<ExternalCalendarProvider, TranslationKey> = {
  apple: "provider_mobile.support.calendar.provider.apple",
  google: "provider_mobile.support.calendar.provider.google",
  ical: "provider_mobile.support.calendar.provider.ical"
};

const notificationChannelLabelKeys: Record<NotificationChannel, TranslationKey> = {
  email: "mobile.support.preference.email",
  "in-app": "provider_mobile.support.notification.channel.in_app",
  push: "mobile.support.preference.push",
  sms: "mobile.support.preference.sms"
};

const notificationDeliveryStatusLabelKeys: Record<NotificationDeliveryStatus, TranslationKey> = {
  failed: "provider_mobile.support.notification.delivery.failed",
  queued: "provider_mobile.support.notification.delivery.queued",
  sent: "provider_mobile.support.notification.delivery.sent",
  skipped: "provider_mobile.support.notification.delivery.skipped"
};

const supportTicketStatusLabelKeys: Record<SupportTicketStatus, TranslationKey> = {
  open: "provider_mobile.support.ticket.status.open",
  resolved: "provider_mobile.support.ticket.status.resolved",
  triaged: "provider_mobile.support.ticket.status.triaged"
};

type ProviderPayoutEntry = ProviderPayoutLedgerResponse["entries"][number];

function formatLocalDateTimeValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatCurrency(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents);
}

function formatCalendarHealthLabel(i18n: I18nInstance, status: "healthy" | "attention" | "at-risk") {
  switch (status) {
    case "healthy":
      return i18n.t("provider_mobile.support.calendar.healthy");
    case "attention":
      return i18n.t("common.state.needs_attention");
    case "at-risk":
      return i18n.t("provider_mobile.support.calendar.at_risk");
  }
}

function formatWeekdayLabel(i18n: I18nInstance, weekday: ProviderProfile["weeklyPayoutDay"]) {
  const map: Record<ProviderProfile["weeklyPayoutDay"], TranslationKey> = {
    Mon: "provider_mobile.support.weekday.mon",
    Tue: "provider_mobile.support.weekday.tue",
    Wed: "provider_mobile.support.weekday.wed",
    Thu: "provider_mobile.support.weekday.thu",
    Fri: "provider_mobile.support.weekday.fri",
    Sat: "provider_mobile.support.weekday.sat",
    Sun: "provider_mobile.support.weekday.sun"
  };

  return i18n.t(map[weekday]);
}

function formatMinimumLeadHoursLabel(i18n: I18nInstance, hours: number) {
  if (hours <= 0) {
    return i18n.t("provider_mobile.support.no_minimum");
  }

  return i18n.t("provider_mobile.support.hours", { count: hours });
}

function formatPayoutStatus(i18n: I18nInstance, status: ProviderPayoutEntry["status"]) {
  switch (status) {
    case "awaiting-customer-payment":
      return i18n.t("provider_mobile.dashboard.payout.awaiting_payment");
    case "on-hold":
      return i18n.t("provider_mobile.dashboard.payout.on_hold");
    case "scheduled":
      return i18n.t("provider_mobile.dashboard.payout.scheduled");
    case "ready":
      return i18n.t("provider_mobile.dashboard.payout.ready");
    case "paid":
      return i18n.t("provider_mobile.dashboard.payout.paid");
    case "reversed":
      return i18n.t("provider_mobile.dashboard.payout.reversed");
  }
}

function formatExternalCalendarBlockLabel(i18n: I18nInstance, blockType: ExternalCalendarBlockType) {
  return i18n.t(externalCalendarBlockLabelKeys[blockType]);
}

function formatExternalCalendarProviderLabel(i18n: I18nInstance, provider: ExternalCalendarProvider) {
  return i18n.t(externalCalendarProviderLabelKeys[provider]);
}

function formatNotificationChannelLabel(i18n: I18nInstance, channel: NotificationChannel) {
  return i18n.t(notificationChannelLabelKeys[channel]);
}

function formatNotificationDeliveryStatus(i18n: I18nInstance, status: NotificationDeliveryStatus) {
  return i18n.t(notificationDeliveryStatusLabelKeys[status]);
}

function formatSupportTicketStatus(i18n: I18nInstance, status: SupportTicketStatus) {
  return i18n.t(supportTicketStatusLabelKeys[status]);
}

export function SupportScreen({ languageSettings }: { languageSettings: LanguageSettings }) {
  const i18n = useI18n();
  const {
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    envelope,
    setBiometricEnabled,
    signOut
  } = useProviderSession();
  const [provider, setProvider] = useState<ProviderProfile | undefined>();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>();
  const [calendarSubscription, setCalendarSubscription] =
    useState<ProviderCalendarSubscriptionResponse | undefined>();
  const [calendarImports, setCalendarImports] = useState<ProviderCalendarImportsResponse | undefined>();
  const [payoutLedger, setPayoutLedger] = useState<ProviderPayoutLedgerResponse | undefined>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [blockTitle, setBlockTitle] = useState(() => i18n.t("provider_mobile.support.calendar.default_block_title"));
  const [blockType, setBlockType] = useState<ExternalCalendarBlockType>("off-platform-client");
  const [importTitle, setImportTitle] = useState(() => i18n.t("provider_mobile.support.calendar.default_import_title"));
  const [importProvider, setImportProvider] = useState<ExternalCalendarProvider>("google");
  const [importFeedUrl, setImportFeedUrl] = useState("");
  const [blockStartText, setBlockStartText] = useState(() =>
    formatLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [blockEndText, setBlockEndText] = useState(() =>
    formatLocalDateTimeValue(new Date(Date.now() + 26 * 60 * 60 * 1000))
  );
  const [blockNotes, setBlockNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showStaffingSettings, setShowStaffingSettings] = useState(false);
  const [showCalendarTools, setShowCalendarTools] = useState(false);
  const [showAlertPreferences, setShowAlertPreferences] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [showSupportHistory, setShowSupportHistory] = useState(false);
  const [activeSection, setActiveSection] = useState<ProviderBusinessSection>("work");
  const [securitySettings, setSecuritySettings] = useState<AccountSecuritySettings>();
  const [securityMethod, setSecurityMethod] = useState<TwoFactorMethod>("email");
  const [securityChallenge, setSecurityChallenge] = useState<TwoFactorChallengeResponse>();
  const [securityCode, setSecurityCode] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const calendarHealth = calendarImports?.syncHealth;
  const heldPayoutEntries = (payoutLedger?.entries ?? []).filter((entry) => entry.status === "on-hold");
  const blockedPayoutCents =
    (payoutLedger?.pendingCustomerPaymentCents ?? 0) +
    heldPayoutEntries.reduce((sum, entry) => sum + entry.providerNetAmountCents, 0);
  const payoutStateLabel =
    blockedPayoutCents > 0
      ? i18n.t("common.state.needs_attention")
      : (payoutLedger?.totalNetReadyCents ?? 0) > 0
        ? i18n.t("provider_mobile.support.payout.ready_now")
        : i18n.t("provider_mobile.support.payout.on_track");
  const enabledAlertCount = [
    preferences?.pushEnabled ?? true,
    preferences?.emailEnabled ?? true,
    preferences?.smsEnabled ?? true
  ].filter(Boolean).length;
  const currentLanguageLabel =
    languageSettings.locale === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english");
  const sectionSummaries: Record<ProviderBusinessSection, string> = {
    work: i18n.t("provider_mobile.support.summary.radius", { count: provider?.serviceRadiusMiles ?? 0 }),
    payouts: payoutStateLabel,
    alerts: i18n.t("provider_mobile.support.summary.alerts", {
      unread: unreadCount,
      enabled: enabledAlertCount
    }),
    language: i18n.t("mobile.settings.language.summary", { language: currentLanguageLabel }),
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
    help:
      supportTickets.length > 0
        ? i18n.t("mobile.support.summary.recent_tickets", { count: supportTickets.length })
        : i18n.t("provider_mobile.support.summary.open_ticket")
  };

  async function loadProvider() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const device = await getProviderAuthDevice();
      const [
        me,
        nextOverview,
        nextTickets,
        notificationResponse,
        nextPreferences,
        nextDeliveries,
        nextCalendarSubscription,
        nextCalendarImports,
        nextPayoutLedger,
        nextSecurity
      ] = await Promise.all([
        api.getCurrentUser(),
        api.getProviderStaffingOverview(),
        api.getSupportTickets(),
        api.getNotifications(),
        api.getNotificationPreferences(),
        api.getNotificationDeliveries(),
        api.getProviderCalendarSubscription(),
        api.getProviderCalendarImports(),
        unlessFeatureDisabled(api.getProviderPayoutLedger()),
        api.getSecuritySettings(device.id)
      ]);
      setProvider(me.user as ProviderProfile);
      setOverview(nextOverview);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setPreferences(nextPreferences);
      setDeliveries(nextDeliveries.deliveries);
      setCalendarSubscription(nextCalendarSubscription);
      setCalendarImports(nextCalendarImports);
      setPayoutLedger(nextPayoutLedger);
      setSecuritySettings(nextSecurity);
      setSecurityMethod(nextSecurity.method ?? "email");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.load_settings"));
    } finally {
      setIsInitialLoading(false);
    }
  }

  useEffect(() => {
    void loadProvider();
  }, [envelope?.session.token]);

  async function saveSettings(
    updates: Partial<
      Pick<
        ProviderProfile,
        | "serviceRadiusMiles"
        | "minimumBookingLeadHours"
        | "staffingMode"
        | "crewReviewLeadHours"
        | "departureReminderLeadMinutes"
        | "routeLeaderMode"
        | "weeklyPayoutDay"
        | "instantPayoutsEnabled"
      >
    >
  ) {
    if (!envelope?.session.token || !provider) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextProvider = await api.updateProviderSettings({
        serviceRadiusMiles: updates.serviceRadiusMiles ?? provider.serviceRadiusMiles,
        minimumBookingLeadHours: updates.minimumBookingLeadHours ?? provider.minimumBookingLeadHours,
        staffingMode: updates.staffingMode ?? provider.staffingMode,
        crewReviewLeadHours: updates.crewReviewLeadHours ?? provider.crewReviewLeadHours,
        departureReminderLeadMinutes:
          updates.departureReminderLeadMinutes ?? provider.departureReminderLeadMinutes,
        routeLeaderMode: updates.routeLeaderMode ?? provider.routeLeaderMode,
        weeklyPayoutDay: updates.weeklyPayoutDay ?? provider.weeklyPayoutDay,
        instantPayoutsEnabled:
          updates.instantPayoutsEnabled ?? provider.instantPayoutsEnabled,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setProvider(nextProvider);
      setStatusMessage(i18n.t("provider_mobile.support.message.settings_updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.update_settings"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveCalendarBlockingSettings(
    overrides: Partial<{
      enabled: boolean;
      blocks: NonNullable<ProviderProfile["calendarConnection"]["externalBlocks"]>;
    }>
  ) {
    if (!envelope?.session.token || !provider) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextProvider = await api.updateProviderSettings({
        serviceRadiusMiles: provider.serviceRadiusMiles,
        staffingMode: provider.staffingMode,
        crewReviewLeadHours: provider.crewReviewLeadHours,
        departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
        routeLeaderMode: provider.routeLeaderMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled,
        externalEventsBlockingEnabled:
          overrides.enabled ?? provider.calendarConnection.externalEventsBlockingEnabled ?? false,
        externalCalendarBlocks:
          overrides.blocks ?? provider.calendarConnection.externalBlocks ?? []
      });
      setProvider(nextProvider);
      setStatusMessage(
        (overrides.enabled ?? nextProvider.calendarConnection.externalEventsBlockingEnabled)
          ? i18n.t("provider_mobile.support.message.calendar_blocks_protecting")
          : i18n.t("provider_mobile.support.message.calendar_blocks_saved")
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.update_calendar_blocks"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAddCalendarBlock() {
    if (!provider) {
      return;
    }

    const start = new Date(blockStartText);
    const end = new Date(blockEndText);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setErrorMessage(i18n.t("provider_mobile.support.error.valid_start_end"));
      return;
    }

    const nextBlocks = [
      ...(provider.calendarConnection.externalBlocks ?? []),
      {
        id: `manual-block-${Date.now()}`,
        title: blockTitle.trim() || formatExternalCalendarBlockLabel(i18n, blockType),
        blockType,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        notes: blockNotes.trim() || undefined,
        source: "manual" as const,
        createdAt: new Date().toISOString()
      }
    ];

    await saveCalendarBlockingSettings({
      enabled: true,
      blocks: nextBlocks
    });
    setBlockTitle(i18n.t("provider_mobile.support.calendar.default_block_title"));
    setBlockType("off-platform-client");
    setBlockNotes("");
  }

  async function handleRemoveCalendarBlock(blockId: string) {
    if (!provider) {
      return;
    }

    await saveCalendarBlockingSettings({
      blocks: (provider.calendarConnection.externalBlocks ?? []).filter((block) => block.id !== blockId)
    });
  }

  async function handleCreateCalendarImport() {
    if (!envelope?.session.token || !importTitle.trim() || !importFeedUrl.trim()) {
      setErrorMessage(i18n.t("provider_mobile.support.error.calendar_title_feed"));
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextImports = await api.createProviderCalendarImport({
        title: importTitle.trim(),
        provider: importProvider,
        feedUrl: importFeedUrl.trim()
      } satisfies CreateExternalCalendarImportRequest);
      setCalendarImports(nextImports);
      setImportFeedUrl("");
      setStatusMessage(i18n.t("provider_mobile.support.message.calendar_synced"));
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.import_calendar"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSyncCalendarImport(subscriptionId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextImports = await api.syncProviderCalendarImport({ subscriptionId });
      setCalendarImports(nextImports);
      setStatusMessage(i18n.t("provider_mobile.support.message.calendar_refreshed"));
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.refresh_calendar"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSyncStaleCalendarImports() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextImports = await api.syncStaleProviderCalendarImports();
      setCalendarImports(nextImports);
      setStatusMessage(
        nextImports.attemptedSubscriptionCount === 0
          ? i18n.t("provider_mobile.support.message.no_stale_feeds")
          : i18n.t("provider_mobile.support.message.stale_feeds_refreshed", {
              synced: nextImports.syncedSubscriptionCount,
              failed: nextImports.failedSubscriptionCount
            })
      );
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.refresh_stale_calendars"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRemoveCalendarImport(subscriptionId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextImports = await api.removeProviderCalendarImport({ subscriptionId });
      setCalendarImports(nextImports);
      setStatusMessage(i18n.t("provider_mobile.support.message.calendar_removed"));
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.remove_calendar"));
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
      const api = createProviderMobileApiClient();
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
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.open_support_ticket"));
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
      const api = createProviderMobileApiClient();
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

  async function updateNotificationPreferences(
    updates: Partial<Pick<NotificationPreferences, "pushEnabled" | "emailEnabled" | "smsEnabled">>
  ) {
    if (!envelope?.session.token || !preferences) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextPreferences = await api.updateNotificationPreferences(updates);
      setPreferences(nextPreferences);
      setStatusMessage(i18n.t("mobile.support.message.delivery_preferences_updated"));
      const nextDeliveries = await api.getNotificationDeliveries();
      setDeliveries(nextDeliveries.deliveries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("provider_mobile.support.error.update_delivery_preferences"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleBiometricToggle(nextValue: boolean) {
    const updated = await setBiometricEnabled(nextValue);
    if (updated) {
      setStatusMessage(
        nextValue
          ? i18n.t("provider_mobile.support.message.biometric_enabled", { biometric: biometricLabel })
          : i18n.t("mobile.support.message.biometric_disabled")
      );
      return;
    }

    if (nextValue) {
      setErrorMessage(i18n.t("mobile.support.error.enable_biometric", { biometric: biometricLabel }));
    }
  }

  async function beginTwoFactorSetup() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setSecurityChallenge(await api.beginTwoFactorSetup({ method: securityMethod, device: await getProviderAuthDevice() }));
      setSecurityCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally { setIsWorking(false); }
  }

  async function confirmTwoFactorSetup() {
    if (!envelope?.session.token || !securityChallenge) return;
    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.confirmTwoFactorSetup({ challengeToken: securityChallenge.challengeToken, code: securityCode, rememberDevice: true });
      setSecurityChallenge(undefined);
      setSecurityCode("");
      setStatusMessage(i18n.t("security.status.updated"));
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally { setIsWorking(false); }
  }

  async function disableTwoFactor() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setSecuritySettings(await api.disableTwoFactor({ password: securityPassword }));
      setSecurityPassword("");
      setStatusMessage(i18n.t("security.status.updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally { setIsWorking(false); }
  }

  async function revokeTrustedDevice(trustedDeviceId: string) {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.revokeTrustedDevice({ trustedDeviceId });
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally { setIsWorking(false); }
  }

  async function revokeAllSessions() {
    if (!envelope?.session.token) return;
    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.revokeOtherSessions();
      signOut();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
      setIsWorking(false);
    }
  }

  if (isInitialLoading && !errorMessage) {
    return (
      <ScreenShell
        eyebrow={i18n.t("provider_mobile.support.eyebrow")}
        title={i18n.t("provider_mobile.support.title")}
        description={i18n.t("provider_mobile.support.description")}
      >
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} showAction showAvatar />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={4} />
        <SkeletonCard label={i18n.t("common.loading.content")} lines={3} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("provider_mobile.support.eyebrow")}
      title={i18n.t("provider_mobile.support.title")}
      description={i18n.t("provider_mobile.support.description")}
    >
      <AnalyticsPreferences />
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      {provider ? (
        <InfoCard
          title={
            provider.verificationStatus === "verified"
              ? i18n.t("provider_mobile.support.verification.verified")
              : provider.verificationStatus === "rejected"
                ? i18n.t("provider_mobile.support.verification.needs_updates")
                : i18n.t("provider_mobile.support.verification.in_progress")
          }
          description={
            provider.verificationStatus === "verified"
              ? i18n.t("provider_mobile.support.verification.live")
              : provider.verificationStatus === "rejected"
                ? provider.verificationNotes ??
                  i18n.t("provider_mobile.support.verification.rejected_fallback")
                : i18n.t("provider_mobile.support.verification.review_pending")
          }
        >
          <Text style={styles.meta}>
            {i18n.t("provider_mobile.support.verification.submitted", {
              date: i18n.formatDate(provider.verificationSubmittedAt ?? provider.createdAt)
            })}
            {provider.verificationReviewedAt
              ? ` ${i18n.t("provider_mobile.support.verification.reviewed", {
                  date: i18n.formatDate(provider.verificationReviewedAt)
                })}`
              : ""}
          </Text>
        </InfoCard>
      ) : null}

      <InfoCard title={i18n.t("provider_mobile.support.business_tools")} description={sectionSummaries[activeSection]}>
        <View style={styles.issueRow}>
          {businessSectionOptions.filter((option) => option.value !== "payouts" || payoutLedger).map((option) => {
            const isActive = option.value === activeSection;
            return (
              <Pressable
                key={option.value}
                onPress={() => setActiveSection(option.value)}
                style={[styles.secondaryButton, isActive && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, isActive && styles.secondaryButtonLabelActive]}>
                  {i18n.t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      {activeSection === "work" && provider ? <ProviderActivationCard provider={provider} token={envelope?.session.token} onUpdated={setProvider} /> : null}
      {activeSection === "work" && provider ? <ProviderPricingCard postalCode={provider.address.postalCode} categories={provider.categories} token={envelope?.session.token} /> : null}
      {activeSection === "work" ? (
      <InfoCard title={i18n.t("auth_signup.field.service_radius")} description={i18n.t("provider_mobile.support.radius_description")}>
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.max(5, (provider?.serviceRadiusMiles ?? 15) - 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.minus_5_miles")}</Text>
          </Pressable>
          <Text style={styles.valueText}>{i18n.t("provider_radius.value_miles", { count: provider?.serviceRadiusMiles ?? 0 })}</Text>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.min(60, (provider?.serviceRadiusMiles ?? 15) + 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.plus_5_miles")}</Text>
          </Pressable>
        </View>
      </InfoCard>
      ) : null}

      {activeSection === "language" ? (
      <InfoCard title={i18n.t("mobile.settings.language.title")} description={i18n.t("mobile.settings.language.description")}>
        <View style={styles.issueRow}>
          {(["en", "es"] as SupportedLocale[]).map((option) => {
            const isActive = languageSettings.locale === option;
            return (
              <Pressable
                key={option}
                onPress={() => languageSettings.onLocaleChange(option)}
                style={[styles.secondaryButton, isActive && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, isActive && styles.secondaryButtonLabelActive]}>
                  {option === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>
      ) : null}

      {activeSection === "security" ? (
      <InfoCard title={i18n.t("mobile.support.section.security")} description={i18n.t("provider_mobile.support.security_description")}>
        <View style={styles.switchRow}>
          <View style={styles.ticketCopy}>
            <Text style={styles.title}>{i18n.t("mobile.support.use_biometric", { biometric: biometricLabel })}</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? i18n.t("provider_mobile.support.biometric_description")
                : i18n.t("provider_mobile.support.biometric_unavailable")}
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
        <View style={styles.ticketStack}>
          <Text style={styles.title}>{i18n.t("security.two_factor.title")}</Text>
          <Text style={styles.meta}>
            {securitySettings?.twoFactorEnabled && securitySettings.destinationHint && securitySettings.method
              ? i18n.t("security.two_factor.on", { destination: securitySettings.destinationHint, method: i18n.t(securitySettings.method === "sms" ? "security.method.sms" : "security.method.email") })
              : i18n.t("security.two_factor.off")}
          </Text>
          <View style={styles.issueRow}>
            {(["email", "sms"] as TwoFactorMethod[]).map((method) => (
              <Pressable key={method} onPress={() => setSecurityMethod(method)} style={[styles.secondaryButton, securityMethod === method && styles.secondaryButtonActive]}>
                <Text style={[styles.secondaryButtonLabel, securityMethod === method && styles.secondaryButtonLabelActive]}>{i18n.t(method === "sms" ? "security.method.sms" : "security.method.email")}</Text>
              </Pressable>
            ))}
          </View>
          {securityChallenge ? (
            <>
              <Text style={styles.meta}>{i18n.t("security.setup.sent", { destination: securityChallenge.destinationHint })}</Text>
              {securityChallenge.codePreview ? <Text style={styles.meta}>{i18n.t("security.setup.local_preview", { code: securityChallenge.codePreview })}</Text> : null}
              <TextInput keyboardType="number-pad" maxLength={6} onChangeText={(value) => setSecurityCode(value.replace(/\D/g, ""))} placeholder={i18n.t("security.setup.code")} style={styles.input} value={securityCode} />
              <Pressable disabled={isWorking || securityCode.length !== 6} onPress={() => void confirmTwoFactorSetup()} style={styles.secondaryButton}><Text style={styles.secondaryButtonLabel}>{i18n.t("security.setup.confirm")}</Text></Pressable>
            </>
          ) : <Pressable disabled={isWorking} onPress={() => void beginTwoFactorSetup()} style={styles.secondaryButton}><Text style={styles.secondaryButtonLabel}>{i18n.t("security.setup.send")}</Text></Pressable>}
          {securitySettings?.twoFactorEnabled ? (
            <>
              <TextInput onChangeText={setSecurityPassword} placeholder={i18n.t("security.disable.password")} secureTextEntry style={styles.input} value={securityPassword} />
              <Pressable disabled={isWorking || !securityPassword} onPress={() => void disableTwoFactor()} style={styles.secondaryButton}><Text style={styles.secondaryButtonLabel}>{i18n.t("security.disable.action")}</Text></Pressable>
            </>
          ) : null}
          <Text style={styles.title}>{i18n.t("security.alerts.title")}</Text>
          <Text style={styles.meta}>{i18n.t("security.alerts.body")}</Text>
          <Text style={styles.title}>{i18n.t("security.devices.title")}</Text>
          {securitySettings?.trustedDevices.length ? securitySettings.trustedDevices.map((device) => (
            <View key={device.id} style={styles.ticketRow}>
              <View style={styles.ticketCopy}><Text style={styles.title}>{device.label}</Text><Text style={styles.meta}>{i18n.t("security.devices.last_seen", { date: i18n.formatDate(device.lastSeenAt) })}</Text></View>
              <Pressable disabled={isWorking} onPress={() => void revokeTrustedDevice(device.id)} style={styles.secondaryButton}><Text style={styles.secondaryButtonLabel}>{i18n.t("security.devices.remove")}</Text></Pressable>
            </View>
          )) : <Text style={styles.meta}>{i18n.t("security.devices.empty")}</Text>}
          <Text style={styles.meta}>{i18n.t("security.sessions.warning")}</Text>
          <Pressable disabled={isWorking} onPress={() => void revokeAllSessions()} style={styles.secondaryButton}><Text style={styles.secondaryButtonLabel}>{i18n.t("security.sessions.revoke")}</Text></Pressable>
        </View>
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>{i18n.t("mobile.support.log_out")}</Text>
        </Pressable>
      </InfoCard>
      ) : null}

      {activeSection === "work" ? (
      <InfoCard title={i18n.t("provider_mobile.support.staffing.title")} description={i18n.t("provider_mobile.support.staffing.description")}>
        <Text style={styles.meta}>
          {i18n.t("provider_mobile.support.staffing.summary", {
            mode:
              provider?.staffingMode === "auto-accept"
                ? i18n.t("provider_mobile.dashboard.staffing_mode.auto_accept")
                : i18n.t("provider_mobile.dashboard.staffing_mode.review_first"),
            reviewHours: provider?.crewReviewLeadHours ?? 0,
            leadTime: formatMinimumLeadHoursLabel(i18n, provider?.minimumBookingLeadHours ?? 0)
          })}
        </Text>
        <Text style={styles.meta}>
          {i18n.t("provider_mobile.support.staffing.route_summary", {
            minutes: provider?.departureReminderLeadMinutes ?? 0,
            mode:
              provider?.routeLeaderMode === "accepted-crew-fallback"
                ? i18n.t("provider_mobile.support.route_leader.crew_fallback_tracking")
                : i18n.t("provider_mobile.support.route_leader.provider_tracking")
          })}
        </Text>
        <Pressable
          onPress={() => setShowStaffingSettings((current) => !current)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>
            {showStaffingSettings ? i18n.t("common.actions.close") : i18n.t("provider_mobile.support.staffing.details")}
          </Text>
        </Pressable>
        {showStaffingSettings ? (
          <View style={styles.ticketStack}>
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ staffingMode: "review-first" })}
                style={[styles.secondaryButton, provider?.staffingMode === "review-first" && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "review-first" && styles.secondaryButtonLabelActive]}>
                  {i18n.t("provider_mobile.dashboard.staffing_mode.review_first")}
                </Text>
              </Pressable>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ staffingMode: "auto-accept" })}
                style={[styles.secondaryButton, provider?.staffingMode === "auto-accept" && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "auto-accept" && styles.secondaryButtonLabelActive]}>
                  {i18n.t("provider_mobile.dashboard.staffing_mode.auto_accept")}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{i18n.t("provider_mobile.support.staffing.review_timing")}</Text>
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ crewReviewLeadHours: Math.max(1, (provider?.crewReviewLeadHours ?? 24) - 1) })}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.minus_1_hour")}</Text>
              </Pressable>
              <Text style={styles.valueText}>{i18n.t("provider_mobile.support.hours", { count: provider?.crewReviewLeadHours ?? 0 })}</Text>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ crewReviewLeadHours: Math.min(72, (provider?.crewReviewLeadHours ?? 24) + 1) })}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.plus_1_hour")}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{i18n.t("provider_mobile.support.staffing.acceptance_window")}</Text>
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() =>
                  void saveSettings({ minimumBookingLeadHours: Math.max(0, (provider?.minimumBookingLeadHours ?? 0) - 1) })
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.minus_1_hour")}</Text>
              </Pressable>
              <Text style={styles.valueText}>{formatMinimumLeadHoursLabel(i18n, provider?.minimumBookingLeadHours ?? 0)}</Text>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() =>
                  void saveSettings({ minimumBookingLeadHours: Math.min(72, (provider?.minimumBookingLeadHours ?? 0) + 1) })
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.plus_1_hour")}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{i18n.t("provider_mobile.support.staffing.departure_reminder")}</Text>
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() =>
                  void saveSettings({
                    departureReminderLeadMinutes: Math.max(
                      10,
                      (provider?.departureReminderLeadMinutes ?? 60) - 10
                    )
                  })
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.minus_10_min")}</Text>
              </Pressable>
              <Text style={styles.valueText}>{i18n.t("provider_mobile.support.minutes", { count: provider?.departureReminderLeadMinutes ?? 0 })}</Text>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() =>
                  void saveSettings({
                    departureReminderLeadMinutes: Math.min(
                      180,
                      (provider?.departureReminderLeadMinutes ?? 60) + 10
                    )
                  })
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.settings.plus_10_min")}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{i18n.t("provider_mobile.support.route_leader.title")}</Text>
            <View style={styles.stepRow}>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ routeLeaderMode: "provider-only" })}
                style={[styles.secondaryButton, provider?.routeLeaderMode === "provider-only" && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, provider?.routeLeaderMode === "provider-only" && styles.secondaryButtonLabelActive]}>
                  {i18n.t("provider_mobile.support.route_leader.provider_only")}
                </Text>
              </Pressable>
              <Pressable
                disabled={isWorking || !provider}
                onPress={() => void saveSettings({ routeLeaderMode: "accepted-crew-fallback" })}
                style={[
                  styles.secondaryButton,
                  provider?.routeLeaderMode === "accepted-crew-fallback" && styles.secondaryButtonActive
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonLabel,
                    provider?.routeLeaderMode === "accepted-crew-fallback" && styles.secondaryButtonLabelActive
                  ]}
                >
                  {i18n.t("provider_mobile.support.route_leader.crew_fallback")}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>
              {provider?.routeLeaderMode === "accepted-crew-fallback"
                ? i18n.t("provider_mobile.support.route_leader.crew_fallback_description")
                : i18n.t("provider_mobile.support.route_leader.provider_only_description")}
            </Text>
          </View>
        ) : null}
      </InfoCard>
      ) : null}

      {activeSection === "payouts" && payoutLedger ? (
      <InfoCard title={i18n.t("provider_mobile.dashboard.payouts")} description={payoutStateLabel}>
        <View style={styles.payoutSummaryGrid}>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.ready")}</Text>
            <Text style={styles.payoutSummaryValue}>{formatCurrency(i18n, payoutLedger?.totalNetReadyCents ?? 0)}</Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.next")}</Text>
            <Text style={styles.payoutSummaryValue}>
              {payoutLedger?.payoutSchedule
                ? i18n.formatDate(payoutLedger.payoutSchedule.nextWeeklyPayoutDateIso, {
                    month: "short",
                    day: "numeric"
                  })
                : i18n.t("mobile.support.not_set")}
            </Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.support.payout.blocked")}</Text>
            <Text style={styles.payoutSummaryValue}>{formatCurrency(i18n, blockedPayoutCents)}</Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.crew_compensation")}</Text>
            <Text style={styles.payoutSummaryValue}>{i18n.t("provider_mobile.dashboard.provider_managed")}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {i18n.t("provider_mobile.support.payout.schedule_summary", {
            instant: formatCurrency(i18n, payoutLedger?.payoutSchedule.instantPayoutEligibleCents ?? 0),
            scheduled: formatCurrency(i18n, payoutLedger?.totalNetScheduledCents ?? 0),
            mode: provider?.instantPayoutsEnabled
              ? i18n.t("provider_mobile.support.payout.instant_on")
              : i18n.t("provider_mobile.support.payout.weekly_only")
          })}
        </Text>
        {(payoutLedger?.entries ?? []).length > 0 ? (
          <View style={styles.ticketStack}>
            {(payoutLedger?.entries ?? []).slice(0, 3).map((entry) => (
              <View key={entry.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{entry.customerName}</Text>
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.support.payout.entry_summary", {
                      service: entry.serviceLabel,
                      amount: formatCurrency(i18n, entry.providerNetAmountCents)
                    })}
                  </Text>
                  <Text style={styles.meta}>{entry.note}</Text>
                </View>
                <Text
                  style={[
                    styles.payoutStatusBadge,
                    (entry.status === "ready" || entry.status === "paid") && styles.payoutStatusBadgeHealthy,
                    (entry.status === "on-hold" ||
                      entry.status === "reversed" ||
                      entry.status === "awaiting-customer-payment") &&
                      styles.payoutStatusBadgeWarning
                  ]}
                >
                  {formatPayoutStatus(i18n, entry.status)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{i18n.t("provider_mobile.support.payout.empty")}</Text>
        )}
        <View style={styles.stepRow}>
          {(["Tue", "Thu", "Fri"] as const).map((weekday) => (
            <Pressable
              disabled={isWorking || !provider}
              key={weekday}
              onPress={() => void saveSettings({ weeklyPayoutDay: weekday })}
              style={[
                styles.secondaryButton,
                provider?.weeklyPayoutDay === weekday && styles.secondaryButtonActive
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonLabel,
                  provider?.weeklyPayoutDay === weekday && styles.secondaryButtonLabelActive
                ]}
              >
                {formatWeekdayLabel(i18n, weekday)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ instantPayoutsEnabled: true })}
            style={[
              styles.secondaryButton,
              provider?.instantPayoutsEnabled && styles.secondaryButtonActive
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonLabel,
                provider?.instantPayoutsEnabled && styles.secondaryButtonLabelActive
              ]}
            >
              {i18n.t("provider_mobile.support.payout.enable_instant")}
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ instantPayoutsEnabled: false })}
            style={[
              styles.secondaryButton,
              !provider?.instantPayoutsEnabled && styles.secondaryButtonActive
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonLabel,
                !provider?.instantPayoutsEnabled && styles.secondaryButtonLabelActive
              ]}
            >
              {i18n.t("provider_mobile.support.payout.weekly_only")}
            </Text>
          </Pressable>
        </View>
      </InfoCard>
      ) : null}

      {activeSection === "work" ? (
      <InfoCard
        title={i18n.t("provider_live.calendar.eyebrow")}
        description={i18n.t("provider_mobile.support.calendar.description")}
      >
        <Text style={styles.meta}>{i18n.t("provider_live.calendar.body")}</Text>
        {calendarHealth ? (
          <View style={styles.ticketRow}>
            <View style={styles.ticketCopy}>
              <Text style={styles.valueText}>
                {i18n.t("provider_mobile.support.calendar.health_title", {
                  status: formatCalendarHealthLabel(i18n, calendarHealth.status)
                })}
              </Text>
              <Text style={styles.meta}>
                {i18n.t("provider_live.calendar.health_counts", {
                  feeds: calendarHealth.subscriptionCount,
                  importedBlocks: calendarHealth.importedBlockCount,
                  mode: calendarHealth.externalBlockingEnabled
                    ? i18n.t("provider_live.calendar.blocking_on")
                    : i18n.t("provider_live.calendar.save_only")
                })}
              </Text>
              <Text style={styles.meta}>
                {i18n.t("provider_live.calendar.health_issues", {
                  errors: calendarHealth.erroredSubscriptionCount,
                  staleFeeds: calendarHealth.staleSubscriptionCount,
                  conflicts: calendarHealth.conflictingYardmatchJobCount
                })}
              </Text>
              {calendarHealth.notes.map((note) => (
                <Text key={note} style={styles.meta}>
                  {note}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={() => setShowCalendarTools((current) => !current)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>
            {showCalendarTools ? i18n.t("common.actions.close") : i18n.t("provider_mobile.support.calendar.tools")}
          </Text>
        </Pressable>
        {showCalendarTools ? (
          <View style={styles.ticketStack}>
            <View style={styles.ticketStack}>
              {calendarSubscription?.instructions.map((instruction) => (
                <Text key={instruction} style={styles.meta}>
                  • {instruction}
                </Text>
              ))}
              {calendarSubscription?.actions.map((action) => (
                <Text key={`${action.platform}-helper`} style={styles.meta}>
                  • {action.label}: {action.helperText}
                </Text>
              ))}
            </View>
            <View style={styles.stepRow}>
              {calendarSubscription?.actions.map((action) => (
                <Pressable
                  disabled={!calendarSubscription}
                  key={action.platform}
                  onPress={() => void Linking.openURL(action.href)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.ticketStack}>
              {(calendarHealth?.staleSubscriptionCount ?? 0) > 0 || (calendarHealth?.erroredSubscriptionCount ?? 0) > 0 ? (
                <Pressable disabled={isWorking} onPress={() => void handleSyncStaleCalendarImports()} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.sync_stale_feeds")}</Text>
                </Pressable>
              ) : null}
              <Text style={styles.valueText}>{i18n.t("provider_mobile.support.calendar.import_feed_title")}</Text>
              <Text style={styles.meta}>{i18n.t("provider_mobile.support.calendar.import_feed_description")}</Text>
              <TextInput
                value={importTitle}
                onChangeText={setImportTitle}
                placeholder={i18n.t("provider_live.calendar.import_title")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
              />
              <View style={styles.issueRow}>
                {externalCalendarImportProviders.map((option) => (
                  <Pressable
                    key={option}
                    disabled={isWorking}
                    onPress={() => setImportProvider(option)}
                    style={[styles.secondaryButton, importProvider === option && styles.secondaryButtonActive]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonLabel,
                        importProvider === option && styles.secondaryButtonLabelActive
                      ]}
                    >
                      {formatExternalCalendarProviderLabel(i18n, option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={importFeedUrl}
                onChangeText={setImportFeedUrl}
                placeholder={i18n.t("provider_live.calendar.feed_url_placeholder")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
                autoCapitalize="none"
              />
              <Pressable disabled={isWorking} onPress={() => void handleCreateCalendarImport()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.import_outside")}</Text>
              </Pressable>
              {(calendarImports?.subscriptions ?? []).map((subscription) => (
                <View key={subscription.id} style={styles.ticketRow}>
                  <View style={styles.ticketCopy}>
                    <Text style={styles.valueText}>{subscription.title}</Text>
                    <Text style={styles.meta}>
                      {i18n.t("provider_mobile.support.calendar.subscription_summary", {
                        provider: formatExternalCalendarProviderLabel(i18n, subscription.provider),
                        events: i18n.t("provider_live.calendar.imported_events", {
                          count: subscription.importedEventCount
                        })
                      })}
                    </Text>
                    <Text style={styles.meta}>
                      {i18n.t("provider_mobile.support.calendar.subscription_status", {
                        status:
                          subscription.syncStatus === "active"
                            ? i18n.t("provider_live.calendar.sync_active")
                            : i18n.t("provider_live.calendar.sync_issue")
                      })}
                    </Text>
                    {subscription.lastSyncedAt ? (
                      <Text style={styles.meta}>
                        {i18n.t("provider_mobile.support.calendar.synced_at", {
                          date: i18n.formatDate(subscription.lastSyncedAt, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        })}
                      </Text>
                    ) : null}
                    {subscription.lastError ? <Text style={styles.meta}>{subscription.lastError}</Text> : null}
                  </View>
                  <View style={styles.ticketStack}>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void handleSyncCalendarImport(subscription.id)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.sync_now")}</Text>
                    </Pressable>
                    <Pressable
                      disabled={isWorking}
                      onPress={() => void handleRemoveCalendarImport(subscription.id)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.remove_feed")}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.ticketStack}>
              <Text style={styles.meta}>
                {(provider?.calendarConnection.externalEventsBlockingEnabled ?? false)
                  ? i18n.t("provider_mobile.support.calendar.blocks_active")
                  : i18n.t("provider_mobile.support.calendar.blocks_saved")}
              </Text>
              <View style={styles.stepRow}>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveCalendarBlockingSettings({ enabled: true })}
                  style={[
                    styles.secondaryButton,
                    (provider?.calendarConnection.externalEventsBlockingEnabled ?? false) &&
                      styles.secondaryButtonActive
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonLabel,
                      (provider?.calendarConnection.externalEventsBlockingEnabled ?? false) &&
                        styles.secondaryButtonLabelActive
                    ]}
                  >
                    {i18n.t("provider_mobile.support.calendar.blocking_on")}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveCalendarBlockingSettings({ enabled: false })}
                  style={[
                    styles.secondaryButton,
                    !(provider?.calendarConnection.externalEventsBlockingEnabled ?? false) &&
                      styles.secondaryButtonActive
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonLabel,
                      !(provider?.calendarConnection.externalEventsBlockingEnabled ?? false) &&
                        styles.secondaryButtonLabelActive
                    ]}
                  >
                    {i18n.t("provider_mobile.support.calendar.save_only")}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={blockTitle}
                onChangeText={setBlockTitle}
                placeholder={i18n.t("provider_live.calendar.block_title")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
              />
              <View style={styles.issueRow}>
                {externalCalendarBlockOptions.map((option) => (
                  <Pressable
                    key={option}
                    disabled={isWorking}
                    onPress={() => setBlockType(option)}
                    style={[styles.secondaryButton, blockType === option && styles.secondaryButtonActive]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonLabel,
                        blockType === option && styles.secondaryButtonLabelActive
                      ]}
                    >
                      {formatExternalCalendarBlockLabel(i18n, option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={blockStartText}
                onChangeText={setBlockStartText}
                placeholder={i18n.t("provider_mobile.support.calendar.start_placeholder")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                value={blockEndText}
                onChangeText={setBlockEndText}
                placeholder={i18n.t("provider_mobile.support.calendar.end_placeholder")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                value={blockNotes}
                onChangeText={setBlockNotes}
                placeholder={i18n.t("provider_live.calendar.block_notes_placeholder")}
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={[styles.input, styles.multilineInput]}
                multiline
              />
              <Pressable disabled={isWorking} onPress={() => void handleAddCalendarBlock()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.add_outside_block")}</Text>
              </Pressable>
              {(provider?.calendarConnection.externalBlocks ?? []).map((block) => (
                <View key={block.id} style={styles.ticketRow}>
                  <View style={styles.ticketCopy}>
                    <Text style={styles.valueText}>{block.title}</Text>
                    <Text style={styles.meta}>
                      {i18n.t("provider_mobile.support.calendar.block_summary", {
                        type: formatExternalCalendarBlockLabel(i18n, block.blockType),
                        start: i18n.formatDate(block.startIso, {
                          dateStyle: "medium",
                          timeStyle: "short"
                        }),
                        end: i18n.formatDate(block.endIso, {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })
                      })}
                    </Text>
                    {block.notes ? <Text style={styles.meta}>{block.notes}</Text> : null}
                  </View>
                  <Pressable
                    disabled={isWorking}
                    onPress={() => void handleRemoveCalendarBlock(block.id)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonLabel}>{i18n.t("provider_live.calendar.remove_block")}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </InfoCard>
      ) : null}

      {activeSection === "alerts" ? (
      <InfoCard title={i18n.t("provider_mobile.support.updates.title")} description={i18n.t("mobile.support.unread_count", { count: unreadCount })}>
        {notifications.length > 0 ? (
          <View style={styles.ticketStack}>
            {notifications.slice(0, 4).map((notification) => (
              <View key={notification.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.valueText}>{notification.title}</Text>
                  <Text style={styles.meta}>{notification.body}</Text>
                </View>
                <Text style={styles.meta}>
                  {notification.isRead ? i18n.t("mobile.support.notification.read") : i18n.t("common.state.new")}
                </Text>
              </View>
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
          onPress={() => setShowAlertPreferences((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAlertPreferences ? i18n.t("common.actions.close") : i18n.t("mobile.support.preferences")}
          </Text>
        </Pressable>
        {showAlertPreferences ? (
          <View style={styles.stepRow}>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ pushEnabled: !(preferences?.pushEnabled ?? true) })}
              style={[styles.secondaryButton, (preferences?.pushEnabled ?? true) && styles.secondaryButtonActive]}
            >
              <Text style={[styles.secondaryButtonLabel, (preferences?.pushEnabled ?? true) && styles.secondaryButtonLabelActive]}>
                {i18n.t("provider_mobile.support.preference_state", {
                  label: i18n.t("mobile.support.preference.push"),
                  state: (preferences?.pushEnabled ?? true)
                    ? i18n.t("provider_mobile.support.state.on")
                    : i18n.t("provider_mobile.support.state.off")
                })}
              </Text>
            </Pressable>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ emailEnabled: !(preferences?.emailEnabled ?? true) })}
              style={[styles.secondaryButton, (preferences?.emailEnabled ?? true) && styles.secondaryButtonActive]}
            >
              <Text style={[styles.secondaryButtonLabel, (preferences?.emailEnabled ?? true) && styles.secondaryButtonLabelActive]}>
                {i18n.t("provider_mobile.support.preference_state", {
                  label: i18n.t("mobile.support.preference.email"),
                  state: (preferences?.emailEnabled ?? true)
                    ? i18n.t("provider_mobile.support.state.on")
                    : i18n.t("provider_mobile.support.state.off")
                })}
              </Text>
            </Pressable>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ smsEnabled: !(preferences?.smsEnabled ?? true) })}
              style={[styles.secondaryButton, (preferences?.smsEnabled ?? true) && styles.secondaryButtonActive]}
            >
              <Text style={[styles.secondaryButtonLabel, (preferences?.smsEnabled ?? true) && styles.secondaryButtonLabelActive]}>
                {i18n.t("provider_mobile.support.preference_state", {
                  label: i18n.t("mobile.support.preference.sms"),
                  state: (preferences?.smsEnabled ?? true)
                    ? i18n.t("provider_mobile.support.state.on")
                    : i18n.t("provider_mobile.support.state.off")
                })}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </InfoCard>
      ) : null}

      {activeSection === "alerts" ? (
      <InfoCard
        title={i18n.t("provider_mobile.support.delivery.title")}
        description={i18n.t("provider_mobile.support.delivery.description")}
      >
        {deliveries.length > 0 ? (
          <View style={styles.ticketStack}>
            {deliveries.slice(0, 4).map((delivery) => (
              <View key={delivery.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.valueText}>
                    {i18n.t("provider_mobile.support.delivery.item_title", {
                      channel: formatNotificationChannelLabel(i18n, delivery.channel),
                      title: delivery.title
                    })}
                  </Text>
                  <Text style={styles.meta}>{delivery.destination}</Text>
                </View>
                <Text style={styles.meta}>{formatNotificationDeliveryStatus(i18n, delivery.status)}</Text>
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
          <View style={styles.ticketStack}>
            <View style={styles.issueRow}>
              {supportIssueOptions.map((issueType) => {
                const isActive = issueType === selectedIssueType;
                return (
                  <Pressable
                    key={issueType}
                    onPress={() => setSelectedIssueType(issueType)}
                    style={[styles.secondaryButton, isActive && styles.secondaryButtonActive]}
                  >
                    <Text style={[styles.secondaryButtonLabel, isActive && styles.secondaryButtonLabelActive]}>
                      {i18n.t(supportIssueLabelKeys[issueType])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.issueRow}>
              <Pressable
                onPress={() => setSelectedBookingId("")}
                style={[styles.secondaryButton, !selectedBookingId && styles.secondaryButtonActive]}
              >
                <Text style={[styles.secondaryButtonLabel, !selectedBookingId && styles.secondaryButtonLabelActive]}>
                  {i18n.t("provider_mobile.support.no_booking")}
                </Text>
              </Pressable>
              {(overview?.jobs ?? []).slice(0, 3).map((job) => {
                const isActive = selectedBookingId === job.bookingId;
                return (
                  <Pressable
                    key={job.bookingId}
                    onPress={() => setSelectedBookingId(job.bookingId)}
                    style={[styles.secondaryButton, isActive && styles.secondaryButtonActive]}
                  >
                    <Text style={[styles.secondaryButtonLabel, isActive && styles.secondaryButtonLabelActive]}>
                      {job.customerName}
                    </Text>
                  </Pressable>
                );
              })}
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
            <View style={styles.ticketStack}>
              {supportTickets.slice(0, 3).map((ticket) => (
                <View key={ticket.id} style={styles.ticketRow}>
                  <View style={styles.ticketCopy}>
                    <Text style={styles.valueText}>{ticket.subject}</Text>
                    <Text style={styles.meta}>
                      {i18n.t("provider_mobile.support.ticket.summary", {
                        issue: i18n.t(supportIssueLabelKeys[ticket.issueType]),
                        status: formatSupportTicketStatus(i18n, ticket.status)
                      })}
                    </Text>
                  </View>
                  <Text style={styles.meta}>{i18n.formatDate(ticket.createdAt)}</Text>
                </View>
              ))}
            </View>
            ) : null}
          </>
        ) : null}
      </InfoCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonActive: {
    backgroundColor: BrandTokens.colors.primary
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  linkButton: {
    alignSelf: "flex-start",
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
  secondaryButtonLabelActive: {
    color: "#ffffff"
  },
  valueText: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  fieldLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  issueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
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
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  ticketStack: {
    gap: BrandTokens.spacing.sm
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  ticketCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  payoutSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  payoutSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  payoutSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  payoutSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  payoutStatusBadge: {
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs,
    textTransform: "capitalize"
  },
  payoutStatusBadgeHealthy: {
    backgroundColor: "rgba(47, 125, 76, 0.12)",
    color: BrandTokens.colors.success
  },
  payoutStatusBadgeWarning: {
    backgroundColor: "rgba(226, 154, 69, 0.16)",
    color: "#8a581b"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
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
  logoutButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  logoutButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
