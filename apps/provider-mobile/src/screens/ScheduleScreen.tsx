import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CustomerProviderConversationThread, ProviderStaffingOverview } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

type ViewMode = "calendar" | "list";

export function ScheduleScreen() {
  const { envelope } = useProviderSession();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function loadOverview() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setOverview(await api.getProviderStaffingOverview());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load schedule.");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [envelope?.session.token]);

  const jobs = overview?.jobs ?? [];

  async function completeJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.completeBooking({ bookingId });
      setStatusMessage("Job marked complete.");
      setActiveBookingId(undefined);
      setChatThread(undefined);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete that job.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openCustomerChat(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveBookingId(bookingId);
      setChatThread(await api.getCustomerProviderConversationThread(undefined, bookingId));
    } catch (error) {
      if (error instanceof Error && /Conversation not found/.test(error.message)) {
        setActiveBookingId(bookingId);
        setChatThread(undefined);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to open customer chat.");
    }
  }

  async function sendCustomerChat(bookingId: string) {
    if (!envelope?.session.token || !chatDraft.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setChatThread(
        await api.sendCustomerProviderMessage({
          threadId: chatThread?.thread.id,
          bookingId,
          body: chatDraft.trim()
        })
      );
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send customer message.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Schedule" title="Upcoming jobs">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "calendar"} label="Calendar" onPress={() => setViewMode("calendar")} />
        <ModeButton active={viewMode === "list"} label="List" onPress={() => setViewMode("list")} />
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {viewMode === "calendar" ? (
        <InfoCard title="This week" description="Crew-aware schedule blocks">
          <View style={styles.list}>
            {jobs.map((job) => (
              <View key={job.bookingId} style={styles.dayCard}>
                <Text style={styles.dayLabel}>
                  {new Date(job.scheduledStartIso).toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={styles.timeLabel}>
                  {new Date(job.scheduledStartIso).toLocaleTimeString(undefined, { timeStyle: "short" })}
                </Text>
                <Text style={styles.clientLabel}>{job.customerName}</Text>
                <Text style={styles.metaLine}>{job.category.replaceAll("-", " ")}</Text>
                <Text style={styles.metaLine}>
                  {job.requiredCrewMembers} crew • {job.assignedCrewMembers} assigned • {job.crewGap} open
                </Text>
                <Text style={styles.statusLine}>{job.status.replaceAll("-", " ")}</Text>
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="Job list" description={`${jobs.length} scheduled`}>
          <View style={styles.list}>
            {jobs.map((job) => (
              <View key={job.bookingId} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.clientLabel}>{job.customerName}</Text>
                  <Text style={styles.metaLine}>
                    {new Date(job.scheduledStartIso).toLocaleString()}
                  </Text>
                  <Text style={styles.metaLine}>{job.serviceAddress.line1}</Text>
                  <Text style={styles.metaLine}>
                    {job.category.replaceAll("-", " ")} • {job.assignedCrewMembers}/{job.requiredCrewMembers} crew
                  </Text>
                  <Text style={styles.statusLine}>{job.status.replaceAll("-", " ")}</Text>
                  {job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>Crew is on the way. Customer chat is open.</Text>
                  ) : null}
                  <View style={styles.actionRow}>
                    {(job.status === "requested" || job.status === "confirmed" || job.status === "in-progress") ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void completeJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Complete job"}</Text>
                      </Pressable>
                    ) : null}
                    {job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void openCustomerChat(job.bookingId)}
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Message customer</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {job.onRouteConfirmedAt && activeBookingId === job.bookingId ? (
                    <View style={styles.chatStack}>
                      {(chatThread?.messages ?? []).map((message) => (
                        <View key={message.id} style={styles.chatBubble}>
                          <Text style={styles.clientLabel}>
                            {message.senderRole === "provider" ? "You" : job.customerName}
                          </Text>
                          <Text style={styles.metaLine}>{message.body}</Text>
                        </View>
                      ))}
                      <TextInput
                        multiline
                        onChangeText={setChatDraft}
                        placeholder="Message the property owner."
                        placeholderTextColor={BrandTokens.colors.muted}
                        style={styles.input}
                        value={chatDraft}
                      />
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void sendCustomerChat(job.bookingId)}
                        style={styles.submitButton}
                      >
                        <Text style={styles.submitButtonLabel}>{isWorking ? "Sending..." : "Send message"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </InfoCard>
      )}
    </ScreenShell>
  );
}

function ModeButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(255,255,255,0.9)"
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
  list: {
    gap: BrandTokens.spacing.md
  },
  dayCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  dayLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  timeLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  clientLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  metaLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  statusLine: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  jobRow: {
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.colors.border,
    paddingBottom: BrandTokens.spacing.md
  },
  jobCopy: {
    gap: BrandTokens.spacing.xs
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.xs
  },
  completeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  completeButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  chatButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  chatButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chatStack: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  chatBubble: {
    gap: BrandTokens.spacing.xs
  },
  input: {
    minHeight: 92,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: BrandTokens.spacing.md,
    color: BrandTokens.colors.ink,
    textAlignVertical: "top"
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
