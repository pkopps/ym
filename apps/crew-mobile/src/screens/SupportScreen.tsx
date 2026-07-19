import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AppNotification,
  CrewPayoutLedgerResponse,
  CreateSupportTicketRequest,
  CrewMatchesResponse,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationDeliveryRecord,
  NotificationPreferences,
  SupportIssueType,
  SupportTicket,
  SupportTicketStatus
} from "@yardmatch/contracts";
import { I18nInstance, TranslationKey, type SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

type CrewAccountSection = "payouts" | "profile" | "alerts" | "language" | "security" | "help";
type LanguageSettings = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

const crewAccountSectionOptions: Array<{ value: CrewAccountSection; labelKey: TranslationKey }> = [
  { value: "payouts", labelKey: "provider_mobile.dashboard.payouts" },
  { value: "profile", labelKey: "crew_mobile.support.section.profile" },
  { value: "alerts", labelKey: "mobile.support.section.alerts" },
  { value: "language", labelKey: "common.language.label" },
  { value: "security", labelKey: "mobile.support.section.security" },
  { value: "help", labelKey: "mobile.support.section.help" }
];

type CrewPayoutEntry = CrewPayoutLedgerResponse["entries"][number];

const supportIssueLabelKeys: Record<SupportIssueType, TranslationKey> = {
  account: "mobile.support.issue.account",
  billing: "mobile.support.issue.billing",
  general: "mobile.support.issue.general",
  "service-quality": "mobile.support.issue.service_quality"
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

function formatCurrency(i18n: I18nInstance, cents: number) {
  return i18n.formatCurrency(cents);
}

function formatPayoutStatus(i18n: I18nInstance, status: CrewPayoutEntry["status"]) {
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
  const { biometricAvailable, biometricEnabled, biometricLabel, envelope, setBiometricEnabled, signOut } =
    useCrewSession();
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>();
  const [payoutLedger, setPayoutLedger] = useState<CrewPayoutLedgerResponse | undefined>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAlertPreferences, setShowAlertPreferences] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [showSupportHistory, setShowSupportHistory] = useState(false);
  const [activeSection, setActiveSection] = useState<CrewAccountSection>("payouts");
  const heldPayoutEntries = (payoutLedger?.entries ?? []).filter((entry) => entry.status === "on-hold");
  const blockedPayoutCents =
    (payoutLedger?.pendingCustomerPaymentCents ?? 0) +
    heldPayoutEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const payoutStateLabel =
    blockedPayoutCents > 0
      ? i18n.t("common.state.needs_attention")
      : (payoutLedger?.totalReadyCents ?? 0) > 0
        ? i18n.t("provider_mobile.support.payout.ready_now")
        : i18n.t("provider_mobile.support.payout.on_track");
  const enabledAlertCount = [
    preferences?.pushEnabled ?? true,
    preferences?.emailEnabled ?? true,
    preferences?.smsEnabled ?? true
  ].filter(Boolean).length;
  const currentLanguageLabel =
    languageSettings.locale === "es" ? i18n.t("common.language.spanish") : i18n.t("common.language.english");
  const sectionSummaries: Record<CrewAccountSection, string> = {
    payouts: payoutStateLabel,
    profile: i18n.t("crew_mobile.support.summary.radius", {
      count: matchesResponse?.crewMember.willingToTravelMiles ?? 0
    }),
    alerts: i18n.t("provider_mobile.support.summary.alerts", {
      unread: unreadCount,
      enabled: enabledAlertCount
    }),
    language: i18n.t("mobile.settings.language.summary", { language: currentLanguageLabel }),
    security: !biometricAvailable
      ? i18n.t("mobile.support.summary.unavailable")
      : biometricEnabled
        ? i18n.t("mobile.support.summary.biometric_on", { biometric: biometricLabel })
        : i18n.t("mobile.support.summary.biometric_off", { biometric: biometricLabel }),
    help:
      supportTickets.length > 0
        ? i18n.t("mobile.support.summary.recent_tickets", { count: supportTickets.length })
        : i18n.t("provider_mobile.support.summary.open_ticket")
  };

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextMatches, nextTickets, notificationResponse, nextPreferences, nextDeliveries, nextPayoutLedger] = await Promise.all([
        api.getCrewMatches(),
        api.getSupportTickets(),
        api.getNotifications(),
        api.getNotificationPreferences(),
        api.getNotificationDeliveries(),
        api.getCrewPayoutLedger()
      ]);
      setMatchesResponse(nextMatches);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setPreferences(nextPreferences);
      setDeliveries(nextDeliveries.deliveries);
      setPayoutLedger(nextPayoutLedger);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("mobile.support.error.load_account"));
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  async function handleCreateSupportTicket() {
    if (!envelope?.session.token || subject.trim().length === 0 || description.trim().length === 0) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
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
      await loadMatches();
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
      setErrorMessage("");
      const api = createCrewMobileApiClient();
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
      const api = createCrewMobileApiClient();
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

  async function handleBiometricToggle(nextValue: boolean) {
    const updated = await setBiometricEnabled(nextValue);
    if (updated) {
      setStatusMessage(
        nextValue
          ? i18n.t("crew_mobile.support.message.biometric_enabled", { biometric: biometricLabel })
          : i18n.t("mobile.support.message.biometric_disabled")
      );
      return;
    }

    if (nextValue) {
      setErrorMessage(i18n.t("mobile.support.error.enable_biometric", { biometric: biometricLabel }));
    }
  }

  return (
    <ScreenShell
      eyebrow={i18n.t("mobile.support.eyebrow")}
      title={i18n.t("mobile.support.title")}
      description={i18n.t("crew_mobile.support.description")}
    >
      {statusMessage ? <InfoCard title={i18n.t("mobile.support.updated")} description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title={i18n.t("common.state.needs_attention")} description={errorMessage} /> : null}

      <InfoCard title={i18n.t("mobile.support.account_tools")} description={sectionSummaries[activeSection]}>
        <View style={styles.issueRow}>
          {crewAccountSectionOptions.map((option) => {
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

      {activeSection === "payouts" ? (
      <InfoCard title={i18n.t("provider_mobile.dashboard.payouts")} description={payoutStateLabel}>
        <View style={styles.payoutSummaryGrid}>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.ready")}</Text>
            <Text style={styles.payoutSummaryValue}>{formatCurrency(i18n, payoutLedger?.totalReadyCents ?? 0)}</Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.next")}</Text>
            <Text style={styles.payoutSummaryValue}>
              {payoutLedger?.nextWeeklyPayoutDateIso
                ? i18n.formatDate(payoutLedger.nextWeeklyPayoutDateIso, {
                    month: "short",
                    day: "numeric"
                  })
                : i18n.t("provider_mobile.dashboard.pending")}
            </Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.support.payout.blocked")}</Text>
            <Text style={styles.payoutSummaryValue}>{formatCurrency(i18n, blockedPayoutCents)}</Text>
          </View>
          <View style={styles.payoutSummaryItem}>
            <Text style={styles.payoutSummaryLabel}>{i18n.t("provider_mobile.dashboard.payout.paid")}</Text>
            <Text style={styles.payoutSummaryValue}>{formatCurrency(i18n, payoutLedger?.totalPaidCents ?? 0)}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {i18n.t("crew_mobile.support.payout.schedule_summary", {
            hold: i18n.t("provider_mobile.dashboard.hold_hours", { count: payoutLedger?.holdPeriodHours ?? 0 }),
            scheduled: formatCurrency(i18n, payoutLedger?.totalScheduledCents ?? 0)
          })}
        </Text>
        {(payoutLedger?.entries ?? []).length > 0 ? (
          <View style={styles.ticketStack}>
            {(payoutLedger?.entries ?? []).slice(0, 3).map((entry) => (
              <View key={entry.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{entry.providerCompanyName}</Text>
                  <Text style={styles.meta}>
                    {i18n.t("provider_mobile.support.payout.entry_summary", {
                      service: entry.serviceLabel,
                      amount: formatCurrency(i18n, entry.amountCents)
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
          <Text style={styles.meta}>{i18n.t("crew_mobile.support.payout.empty")}</Text>
        )}
      </InfoCard>
      ) : null}

      {activeSection === "profile" ? (
      <InfoCard title={i18n.t("crew_mobile.support.account_basics")} description={i18n.t("crew_mobile.support.account_basics_description")}>
        <Text style={styles.title}>{matchesResponse?.crewMember.fullName ?? i18n.t("crew_mobile.support.crew_member_profile")}</Text>
        <Text style={styles.meta}>
          {i18n.t("crew_mobile.support.profile_summary", {
            days: (matchesResponse?.crewMember.availableWeekdays ?? [])
              .map((weekday) => i18n.t(`provider_mobile.support.weekday.${weekday.toLowerCase()}` as TranslationKey))
              .join(", "),
            count: matchesResponse?.crewMember.willingToTravelMiles ?? 0
          })}
        </Text>
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
      <InfoCard title={i18n.t("mobile.support.section.security")} description={i18n.t("crew_mobile.support.security_description")}>
        <View style={styles.switchRow}>
          <View style={styles.ticketCopy}>
            <Text style={styles.title}>{i18n.t("mobile.support.use_biometric", { biometric: biometricLabel })}</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? i18n.t("crew_mobile.support.biometric_description")
                : i18n.t("crew_mobile.support.biometric_unavailable")}
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
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>{i18n.t("mobile.support.log_out")}</Text>
        </Pressable>
      </InfoCard>
      ) : null}

      {activeSection === "alerts" ? (
      <InfoCard title={i18n.t("provider_mobile.support.updates.title")} description={i18n.t("mobile.support.unread_count", { count: unreadCount })}>
        {notifications.length > 0 ? (
          <View style={styles.ticketStack}>
            {notifications.slice(0, 4).map((notification) => (
              <View key={notification.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{notification.title}</Text>
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
          <View style={styles.issueRow}>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ pushEnabled: !(preferences?.pushEnabled ?? true) })}
              style={[styles.chip, (preferences?.pushEnabled ?? true) && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, (preferences?.pushEnabled ?? true) && styles.chipLabelActive]}>
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
              style={[styles.chip, (preferences?.emailEnabled ?? true) && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, (preferences?.emailEnabled ?? true) && styles.chipLabelActive]}>
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
              style={[styles.chip, (preferences?.smsEnabled ?? true) && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, (preferences?.smsEnabled ?? true) && styles.chipLabelActive]}>
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
      <InfoCard title={i18n.t("provider_mobile.support.delivery.title")} description={i18n.t("provider_mobile.support.delivery.description")}>
        {deliveries.length > 0 ? (
          <View style={styles.ticketStack}>
            {deliveries.slice(0, 4).map((delivery) => (
              <View key={delivery.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>
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
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {i18n.t(supportIssueLabelKeys[issueType])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.issueRow}>
              <Pressable
                onPress={() => setSelectedBookingId("")}
                style={[styles.chip, !selectedBookingId && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, !selectedBookingId && styles.chipLabelActive]}>{i18n.t("provider_mobile.support.no_booking")}</Text>
              </Pressable>
              {(matchesResponse?.matches ?? []).slice(0, 4).map((match) => {
                const isActive = selectedBookingId === match.bookingId;
                return (
                  <Pressable
                    key={match.id}
                    onPress={() => setSelectedBookingId(match.bookingId)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {match.providerCompanyName}
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
                    <Text style={styles.title}>{ticket.subject}</Text>
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
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  issueRow: {
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
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  chipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chipLabelActive: {
    color: "#ffffff"
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
