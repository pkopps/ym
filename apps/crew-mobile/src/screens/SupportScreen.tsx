import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AppNotification,
  CreateSupportTicketRequest,
  CrewMatchesResponse,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

export function SupportScreen() {
  const { envelope, signOut } = useCrewSession();
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextMatches, nextTickets, notificationResponse] = await Promise.all([
        api.getCrewMatches(),
        api.getSupportTickets(),
        api.getNotifications()
      ]);
      setMatchesResponse(nextMatches);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load account.");
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  const totalAccepted = useMemo(
    () => matchesResponse?.matches.filter((match) => match.status === "accepted").length ?? 0,
    [matchesResponse]
  );
  const totalPending = useMemo(
    () => matchesResponse?.matches.filter((match) => match.status === "pending-provider-review").length ?? 0,
    [matchesResponse]
  );

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

  return (
    <ScreenShell eyebrow="Account" title="Earnings and help">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <View style={styles.statRow}>
        <StatCard label="Accepted work" value={`${totalAccepted}`} />
        <StatCard label="Pending" value={`${totalPending}`} />
      </View>

      <InfoCard title="Payouts" description="Weekly direct deposit">
        <Text style={styles.meta}>Business owners handle payout release after service completion.</Text>
      </InfoCard>

      <InfoCard title="Account basics" description="Keep details up to date">
        <Text style={styles.title}>{matchesResponse?.crewMember.fullName ?? "Crew member profile"}</Text>
        <Text style={styles.meta}>
          {(matchesResponse?.crewMember.availableWeekdays ?? []).join(", ")} •{" "}
          {matchesResponse?.crewMember.willingToTravelMiles ?? 0} mile travel radius
        </Text>
      </InfoCard>

      <InfoCard title="Updates" description={`${unreadCount} unread`}>
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
        <Pressable
          disabled={isWorking || unreadCount === 0}
          onPress={() => void handleMarkNotificationsRead()}
          style={styles.chip}
        >
          <Text style={styles.chipLabel}>Mark updates read</Text>
        </Pressable>
      </InfoCard>

      <InfoCard title="Help" description="Fast support routes">
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
          <Text style={styles.primaryButtonLabel}>{isWorking ? "Sending..." : "Open support ticket"}</Text>
        </Pressable>
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
      </InfoCard>

      <InfoCard title="Session" description="Manage this device">
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
      </InfoCard>
    </ScreenShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md
  },
  statCard: {
    flex: 1,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.xs
  },
  statValue: {
    color: BrandTokens.colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  statLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 13,
    fontWeight: "600"
  },
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
