import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AppNotification,
  CrewPayoutLedgerResponse,
  CreateSupportTicketRequest,
  CrewMatchesResponse,
  NotificationDeliveryRecord,
  NotificationPreferences,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export function SupportScreen() {
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load account.");
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
      setStatusMessage("Support ticket submitted.");
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      setShowSupportComposer(false);
      await loadMatches();
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
      setErrorMessage("");
      const api = createCrewMobileApiClient();
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
      const api = createCrewMobileApiClient();
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

  async function handleBiometricToggle(nextValue: boolean) {
    const updated = await setBiometricEnabled(nextValue);
    if (updated) {
      setStatusMessage(
        nextValue
          ? `${biometricLabel} will be used when you reopen the crew app.`
          : "Biometric unlock turned off for this app."
      );
      return;
    }

    if (nextValue) {
      setErrorMessage(`Unable to enable ${biometricLabel} right now.`);
    }
  }

  return (
    <ScreenShell
      eyebrow="Account"
      title="Account"
      description="Payouts, alerts, security, and support."
    >
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Payouts" description="Live earnings ledger">
        <Text style={styles.meta}>
          Ready now: {formatCurrency(payoutLedger?.totalReadyCents ?? 0)} • Scheduled:{" "}
          {formatCurrency(payoutLedger?.totalScheduledCents ?? 0)}
        </Text>
        <Text style={styles.meta}>
          Waiting on customer payment: {formatCurrency(payoutLedger?.pendingCustomerPaymentCents ?? 0)}
        </Text>
        <Text style={styles.meta}>
          Next weekly crew payout:{" "}
          {payoutLedger?.nextWeeklyPayoutDateIso
            ? new Date(payoutLedger.nextWeeklyPayoutDateIso).toLocaleString()
            : "Not available"}
        </Text>
        {(payoutLedger?.entries ?? []).length > 0 ? (
          <View style={styles.ticketStack}>
            {(payoutLedger?.entries ?? []).slice(0, 3).map((entry) => (
              <View key={entry.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{entry.providerCompanyName}</Text>
                  <Text style={styles.meta}>
                    {entry.serviceLabel} • {formatCurrency(entry.amountCents)}
                  </Text>
                  <Text style={styles.meta}>{entry.note}</Text>
                </View>
                <Text style={styles.meta}>{entry.status.replaceAll("-", " ")}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>Completed shifts will show payout entries here.</Text>
        )}
      </InfoCard>

      <InfoCard title="Account basics" description="Keep details up to date">
        <Text style={styles.title}>{matchesResponse?.crewMember.fullName ?? "Crew member profile"}</Text>
        <Text style={styles.meta}>
          {(matchesResponse?.crewMember.availableWeekdays ?? []).join(", ")} •{" "}
          {matchesResponse?.crewMember.willingToTravelMiles ?? 0} mile travel radius
        </Text>
      </InfoCard>

      <InfoCard title="Security" description="Protect this device without slowing down daily work">
        <View style={styles.switchRow}>
          <View style={styles.ticketCopy}>
            <Text style={styles.title}>Use {biometricLabel}</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? "Ask for biometric unlock after the app has been away for about a minute."
                : "Face ID or another enrolled biometric method is not available on this device yet."}
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
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
      </InfoCard>

      <InfoCard title="Updates" description={`${unreadCount} unread`}>
        {notifications.length > 0 ? (
          <View style={styles.ticketStack}>
            {notifications.slice(0, 4).map((notification) => (
              <View key={notification.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{notification.title}</Text>
                  <Text style={styles.meta}>{notification.body}</Text>
                </View>
                <Text style={styles.meta}>{notification.isRead ? "Read" : "New"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No updates yet.</Text>
        )}
        {unreadCount > 0 ? (
          <Pressable
            disabled={isWorking}
            onPress={() => void handleMarkNotificationsRead()}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonLabel}>Mark updates read</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setShowAlertPreferences((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAlertPreferences ? "Hide alert preferences" : "Alert preferences"}
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
                Push {(preferences?.pushEnabled ?? true) ? "on" : "off"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ emailEnabled: !(preferences?.emailEnabled ?? true) })}
              style={[styles.chip, (preferences?.emailEnabled ?? true) && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, (preferences?.emailEnabled ?? true) && styles.chipLabelActive]}>
                Email {(preferences?.emailEnabled ?? true) ? "on" : "off"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isWorking}
              onPress={() => void updateNotificationPreferences({ smsEnabled: !(preferences?.smsEnabled ?? true) })}
              style={[styles.chip, (preferences?.smsEnabled ?? true) && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, (preferences?.smsEnabled ?? true) && styles.chipLabelActive]}>
                SMS {(preferences?.smsEnabled ?? true) ? "on" : "off"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </InfoCard>

      <InfoCard title="Delivery activity" description="Recent push, email, and SMS sends">
        {deliveries.length > 0 ? (
          <View style={styles.ticketStack}>
            {deliveries.slice(0, 4).map((delivery) => (
              <View key={delivery.id} style={styles.ticketRow}>
                <View style={styles.ticketCopy}>
                  <Text style={styles.title}>{delivery.channel.toUpperCase()} • {delivery.title}</Text>
                  <Text style={styles.meta}>{delivery.destination}</Text>
                </View>
                <Text style={styles.meta}>{delivery.status}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>Nothing sent yet.</Text>
        )}
      </InfoCard>

      <InfoCard title="Help" description="Get help quickly.">
        <Pressable
          onPress={() => setShowSupportComposer((current) => !current)}
          style={showSupportComposer ? styles.linkButton : styles.primaryButton}
        >
          <Text style={showSupportComposer ? styles.linkButtonLabel : styles.primaryButtonLabel}>
            {showSupportComposer ? "Hide ticket form" : "Open support ticket"}
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
                      {issueType.replaceAll("-", " ")}
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
                <Text style={[styles.chipLabel, !selectedBookingId && styles.chipLabelActive]}>No booking</Text>
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
              placeholder="Short subject"
              placeholderTextColor={BrandTokens.colors.muted}
              style={styles.input}
              value={subject}
            />
            <TextInput
              multiline
              onChangeText={setDescription}
              placeholder="What happened, and what should support know?"
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.textarea]}
              value={description}
            />
            <Pressable
              disabled={isWorking || subject.trim().length === 0 || description.trim().length === 0}
              onPress={() => void handleCreateSupportTicket()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Sending..." : "Send ticket"}</Text>
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
                {showSupportHistory ? "Hide recent tickets" : "Recent tickets"}
              </Text>
            </Pressable>
            {showSupportHistory ? (
            <View style={styles.ticketStack}>
              {supportTickets.slice(0, 3).map((ticket) => (
                <View key={ticket.id} style={styles.ticketRow}>
                  <View style={styles.ticketCopy}>
                    <Text style={styles.title}>{ticket.subject}</Text>
                    <Text style={styles.meta}>
                      {ticket.issueType.replaceAll("-", " ")} • {ticket.status}
                    </Text>
                  </View>
                  <Text style={styles.meta}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
            ) : null}
          </>
        ) : null}
      </InfoCard>
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
