import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  ProviderCrewConversation,
  ProviderCrewConversationThread,
  ProviderStaffingOverview
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

export function ClientsScreen() {
  const { envelope } = useProviderSession();
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [conversations, setConversations] = useState<ProviderCrewConversation[]>([]);
  const [activeThread, setActiveThread] = useState<ProviderCrewConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function loadData() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextOverview, nextConversations] = await Promise.all([
        api.getProviderStaffingOverview(),
        api.getProviderCrewConversations()
      ]);
      setOverview(nextOverview);
      setConversations(nextConversations);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load crew matches.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [envelope?.session.token]);

  async function reviewMatch(crewMatchId: string, action: "accept" | "deny") {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.reviewCrewMatch({ crewMatchId, action });
      setStatusMessage(action === "accept" ? "Crew member accepted." : "Crew member declined.");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that match.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openConversation(threadId?: string, crewMatchId?: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveThread(await api.getProviderCrewConversationThread(threadId, crewMatchId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open chat.");
    }
  }

  async function sendChat() {
    if (!envelope?.session.token || !chatDraft.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextThread = await api.sendProviderCrewMessage({
        threadId: activeThread?.thread.id,
        crewMatchId: activeThread?.thread.crewMatchId,
        body: chatDraft.trim()
      });
      setActiveThread(nextThread);
      setChatDraft("");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setIsWorking(false);
    }
  }

  const jobsNeedingAttention = (overview?.jobs ?? []).filter((job) => job.crewGap > 0);

  return (
    <ScreenShell eyebrow="Crew" title="Staffing and coverage">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Open crew needs" description={`${jobsNeedingAttention.length} jobs need more help`}>
        <View style={styles.list}>
          {jobsNeedingAttention.map((job) => (
            <View key={job.bookingId} style={styles.section}>
              <Text style={styles.title}>{job.customerName}</Text>
              <Text style={styles.meta}>
                {job.category.replaceAll("-", " ")} • {job.crewGap} open spot{job.crewGap === 1 ? "" : "s"}
              </Text>
              {job.matches.map((match) => {
                const existingConversation = conversations.find((conversation) => conversation.crewMatchId === match.id);
                return (
                  <View key={match.id} style={styles.matchRow}>
                    <View style={styles.copy}>
                      <Text style={styles.title}>{match.crewMemberName}</Text>
                      <Text style={styles.meta}>
                        {match.categories.map((category) => category.replaceAll("-", " ")).join(" • ")}
                      </Text>
                      <Text style={styles.meta}>
                        {match.distanceMiles} mi • {match.availableWeekdays.join(", ")}
                      </Text>
                    </View>
                    <View style={styles.buttonStack}>
                      {match.status === "pending-provider-review" ? (
                        <>
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void reviewMatch(match.id, "accept")}
                            style={styles.primaryButton}
                          >
                            <Text style={styles.primaryButtonLabel}>Accept</Text>
                          </Pressable>
                          <Pressable
                            disabled={isWorking}
                            onPress={() => void reviewMatch(match.id, "deny")}
                            style={styles.secondaryButton}
                          >
                            <Text style={styles.secondaryButtonLabel}>Deny</Text>
                          </Pressable>
                        </>
                      ) : null}
                      <Pressable
                        onPress={() => void openConversation(existingConversation?.id, match.id)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonLabel}>Chat</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </InfoCard>

      {activeThread ? (
        <InfoCard title={activeThread.thread.crewMemberName} description={activeThread.thread.status.replaceAll("-", " ")}>
          <View style={styles.list}>
            {activeThread.messages.map((message) => (
              <View key={message.id} style={styles.section}>
                <Text style={styles.title}>{message.senderRole === "provider" ? "You" : activeThread.thread.crewMemberName}</Text>
                <Text style={styles.meta}>{message.body}</Text>
              </View>
            ))}
          </View>
          <TextInput
            multiline
            onChangeText={setChatDraft}
            placeholder="Ask about timing, equipment, or site access."
            placeholderTextColor={BrandTokens.colors.muted}
            style={styles.input}
            value={chatDraft}
          />
          <Pressable disabled={isWorking} onPress={() => void sendChat()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Send"}</Text>
          </Pressable>
        </InfoCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  section: {
    gap: BrandTokens.spacing.xs
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandTokens.colors.border,
    paddingTop: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
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
  buttonStack: {
    gap: BrandTokens.spacing.sm
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    borderRadius: 16,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    color: BrandTokens.colors.ink,
    minHeight: 96
  }
});
