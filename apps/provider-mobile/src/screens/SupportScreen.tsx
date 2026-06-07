import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AppNotification,
  CreateSupportTicketRequest,
  ExternalCalendarBlockType,
  getExternalCalendarBlockLabel,
  NotificationDeliveryRecord,
  NotificationPreferences,
  ProviderCalendarSubscriptionResponse,
  ProviderProfile,
  ProviderStaffingOverview,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];
const externalCalendarBlockOptions: ExternalCalendarBlockType[] = [
  "off-platform-client",
  "personal-time",
  "travel-buffer",
  "equipment-maintenance"
];

function formatLocalDateTimeValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function SupportScreen() {
  const { envelope, signOut } = useProviderSession();
  const [provider, setProvider] = useState<ProviderProfile | undefined>();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>();
  const [calendarSubscription, setCalendarSubscription] =
    useState<ProviderCalendarSubscriptionResponse | undefined>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [blockTitle, setBlockTitle] = useState("Off-platform client");
  const [blockType, setBlockType] = useState<ExternalCalendarBlockType>("off-platform-client");
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

  async function loadProvider() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [me, nextOverview, nextTickets, notificationResponse, nextPreferences, nextDeliveries, nextCalendarSubscription] = await Promise.all([
        api.getCurrentUser(),
        api.getProviderStaffingOverview(),
        api.getSupportTickets(),
        api.getNotifications(),
        api.getNotificationPreferences(),
        api.getNotificationDeliveries(),
        api.getProviderCalendarSubscription()
      ]);
      setProvider(me.user as ProviderProfile);
      setOverview(nextOverview);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setPreferences(nextPreferences);
      setDeliveries(nextDeliveries.deliveries);
      setCalendarSubscription(nextCalendarSubscription);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load settings.");
    }
  }

  useEffect(() => {
    void loadProvider();
  }, [envelope?.session.token]);

  async function saveSettings(updates: Partial<Pick<ProviderProfile, "serviceRadiusMiles" | "staffingMode">>) {
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
        staffingMode: updates.staffingMode ?? provider.staffingMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setProvider(nextProvider);
      setStatusMessage("Settings updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update settings.");
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
        sponsoredListingEnabled: provider.sponsoredListingEnabled,
        externalEventsBlockingEnabled:
          overrides.enabled ?? provider.calendarConnection.externalEventsBlockingEnabled ?? false,
        externalCalendarBlocks:
          overrides.blocks ?? provider.calendarConnection.externalBlocks ?? []
      });
      setProvider(nextProvider);
      setStatusMessage(
        (overrides.enabled ?? nextProvider.calendarConnection.externalEventsBlockingEnabled)
          ? "Outside calendar blocks now protect your YardMatch schedule."
          : "Outside calendar blocks are saved without affecting availability yet."
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update outside calendar blocks.");
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
      setErrorMessage("Use a valid start and end time like 2026-06-10T09:00.");
      return;
    }

    const nextBlocks = [
      ...(provider.calendarConnection.externalBlocks ?? []),
      {
        id: `manual-block-${Date.now()}`,
        title: blockTitle.trim() || getExternalCalendarBlockLabel(blockType),
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
    setBlockTitle("Off-platform client");
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
      setStatusMessage("Support ticket submitted.");
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      await loadProvider();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open a support ticket.");
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
      setStatusMessage("Notifications marked read.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update notifications.");
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
      setStatusMessage("Delivery preferences updated.");
      const nextDeliveries = await api.getNotificationDeliveries();
      setDeliveries(nextDeliveries.deliveries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update delivery preferences.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Account" title="Settings and payouts">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Service radius" description="Measured from customer property addresses">
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.max(5, (provider?.serviceRadiusMiles ?? 15) - 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>-5</Text>
          </Pressable>
          <Text style={styles.valueText}>{provider?.serviceRadiusMiles ?? 0} miles</Text>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.min(60, (provider?.serviceRadiusMiles ?? 15) + 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>+5</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Staffing mode" description="Choose how matched crew is added">
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ staffingMode: "review-first" })}
            style={[styles.secondaryButton, provider?.staffingMode === "review-first" && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "review-first" && styles.secondaryButtonLabelActive]}>
              Review first
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ staffingMode: "auto-accept" })}
            style={[styles.secondaryButton, provider?.staffingMode === "auto-accept" && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "auto-accept" && styles.secondaryButtonLabelActive]}>
              Auto accept
            </Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Payouts" description="Weekly direct deposit is still the default">
        <Text style={styles.meta}>Crew payout depth stays web-first for now so the field app stays lighter.</Text>
      </InfoCard>

      <InfoCard title="Calendar sync" description="Keep YardMatch work alongside outside clients">
        <Text style={styles.meta}>
          Subscribe to your YardMatch schedule in Apple Calendar, Google Calendar, or Outlook so booked jobs show up
          next to direct clients and personal blocks.
        </Text>
        <View style={styles.ticketStack}>
          {calendarSubscription?.instructions.map((instruction) => (
            <Text key={instruction} style={styles.meta}>
              • {instruction}
            </Text>
          ))}
        </View>
        <View style={styles.stepRow}>
          <Pressable
            disabled={!calendarSubscription}
            onPress={() => calendarSubscription && void Linking.openURL(calendarSubscription.feedUrl)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Open feed URL</Text>
          </Pressable>
          <Pressable
            disabled={!calendarSubscription}
            onPress={() => calendarSubscription && void Linking.openURL(calendarSubscription.webcalUrl)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Subscribe with webcal</Text>
          </Pressable>
        </View>
        <View style={styles.ticketStack}>
          <Text style={styles.meta}>
            {(provider?.calendarConnection.externalEventsBlockingEnabled ?? false)
              ? "Outside blocks are actively reducing YardMatch availability."
              : "Outside blocks are saved only until you switch blocking on."}
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
                Blocking on
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
                Save only
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={blockTitle}
            onChangeText={setBlockTitle}
            placeholder="Outside block title"
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
                  {getExternalCalendarBlockLabel(option)}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={blockStartText}
            onChangeText={setBlockStartText}
            placeholder="Start like 2026-06-10T09:00"
            placeholderTextColor={BrandTokens.colors.inkSoft}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={blockEndText}
            onChangeText={setBlockEndText}
            placeholder="End like 2026-06-10T11:00"
            placeholderTextColor={BrandTokens.colors.inkSoft}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={blockNotes}
            onChangeText={setBlockNotes}
            placeholder="Optional note"
            placeholderTextColor={BrandTokens.colors.inkSoft}
            style={[styles.input, styles.multilineInput]}
            multiline
          />
          <Pressable disabled={isWorking} onPress={() => void handleAddCalendarBlock()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>Add outside block</Text>
          </Pressable>
          {(provider?.calendarConnection.externalBlocks ?? []).map((block) => (
            <View key={block.id} style={styles.ticketRow}>
              <View style={styles.ticketCopy}>
                <Text style={styles.valueText}>{block.title}</Text>
                <Text style={styles.meta}>
                  {getExternalCalendarBlockLabel(block.blockType)} • {new Date(block.startIso).toLocaleString()} to{" "}
                  {new Date(block.endIso).toLocaleString()}
                </Text>
                {block.notes ? <Text style={styles.meta}>{block.notes}</Text> : null}
              </View>
              <Pressable
                disabled={isWorking}
                onPress={() => void handleRemoveCalendarBlock(block.id)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard title="Updates" description={`${unreadCount} unread`}>
        <View style={styles.ticketStack}>
          {notifications.slice(0, 4).map((notification) => (
            <View key={notification.id} style={styles.ticketRow}>
              <View style={styles.ticketCopy}>
                <Text style={styles.valueText}>{notification.title}</Text>
                <Text style={styles.meta}>{notification.body}</Text>
              </View>
              <Text style={styles.meta}>{notification.isRead ? "Read" : "New"}</Text>
            </View>
          ))}
        </View>
        <Pressable
          disabled={isWorking || unreadCount === 0}
          onPress={() => void handleMarkNotificationsRead()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>Mark updates read</Text>
        </Pressable>
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking}
            onPress={() => void updateNotificationPreferences({ pushEnabled: !(preferences?.pushEnabled ?? true) })}
            style={[styles.secondaryButton, (preferences?.pushEnabled ?? true) && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, (preferences?.pushEnabled ?? true) && styles.secondaryButtonLabelActive]}>
              Push {(preferences?.pushEnabled ?? true) ? "on" : "off"}
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking}
            onPress={() => void updateNotificationPreferences({ emailEnabled: !(preferences?.emailEnabled ?? true) })}
            style={[styles.secondaryButton, (preferences?.emailEnabled ?? true) && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, (preferences?.emailEnabled ?? true) && styles.secondaryButtonLabelActive]}>
              Email {(preferences?.emailEnabled ?? true) ? "on" : "off"}
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking}
            onPress={() => void updateNotificationPreferences({ smsEnabled: !(preferences?.smsEnabled ?? true) })}
            style={[styles.secondaryButton, (preferences?.smsEnabled ?? true) && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, (preferences?.smsEnabled ?? true) && styles.secondaryButtonLabelActive]}>
              SMS {(preferences?.smsEnabled ?? true) ? "on" : "off"}
            </Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Delivery activity" description="Recent push, email, and SMS sends">
        <View style={styles.ticketStack}>
          {deliveries.slice(0, 4).map((delivery) => (
            <View key={delivery.id} style={styles.ticketRow}>
              <View style={styles.ticketCopy}>
                <Text style={styles.valueText}>{delivery.channel.toUpperCase()} • {delivery.title}</Text>
                <Text style={styles.meta}>{delivery.destination}</Text>
              </View>
              <Text style={styles.meta}>{delivery.status}</Text>
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard title="Support" description="Open an ops or job issue ticket">
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
                  {issueType.replaceAll("-", " ")}
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
              No booking
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
          placeholder="Short subject"
          placeholderTextColor={BrandTokens.colors.muted}
          style={styles.input}
          value={subject}
        />
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="What happened, and what do you need help with?"
          placeholderTextColor={BrandTokens.colors.muted}
          style={[styles.input, styles.textarea]}
          value={description}
        />
        <Pressable
          disabled={isWorking || subject.trim().length === 0 || description.trim().length === 0}
          onPress={() => void handleCreateSupportTicket()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>{isWorking ? "Sending..." : "Open support ticket"}</Text>
        </Pressable>
        <View style={styles.ticketStack}>
          {supportTickets.slice(0, 3).map((ticket) => (
            <View key={ticket.id} style={styles.ticketRow}>
              <View style={styles.ticketCopy}>
                <Text style={styles.valueText}>{ticket.subject}</Text>
                <Text style={styles.meta}>
                  {ticket.issueType.replaceAll("-", " ")} • {ticket.status}
                </Text>
              </View>
              <Text style={styles.meta}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard title="Session" description="Manage this device">
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
      </InfoCard>
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
  secondaryButtonLabelActive: {
    color: "#ffffff"
  },
  valueText: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
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
