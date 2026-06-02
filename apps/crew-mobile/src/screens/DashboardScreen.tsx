import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse, ProviderCrewConversationThread } from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { getCrewMobileTracker } from "../lib/tracking";
import { useCrewSession } from "../session/CrewSessionContext";

export function DashboardScreen() {
  const tracker = getCrewMobileTracker();
  const { envelope } = useCrewSession();
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [activeThread, setActiveThread] = useState<ProviderCrewConversationThread | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const acceptedMatch = useMemo(
    () => matchesResponse?.matches.find((match) => match.status === "accepted"),
    [matchesResponse]
  );

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setMatchesResponse(await api.getCrewMatches());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load today’s work.");
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  async function openConversation() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveThread(await api.getProviderCrewConversationThread(undefined, acceptedMatch.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open chat.");
    }
  }

  async function sendChat() {
    if (!envelope?.session.token || !chatDraft.trim() || !acceptedMatch) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextThread = await api.sendProviderCrewMessage({
        threadId: activeThread?.thread.id,
        crewMatchId: acceptedMatch.id,
        body: chatDraft.trim()
      });
      setActiveThread(nextThread);
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Today" title="Your next shift">
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {acceptedMatch ? (
        <InfoCard
          title={acceptedMatch.providerCompanyName}
          description={`${new Date(acceptedMatch.scheduledStartIso).toLocaleDateString()} • ${new Date(acceptedMatch.scheduledStartIso).toLocaleTimeString()}`}
        >
          <Text style={styles.title}>{acceptedMatch.category.replaceAll("-", " ")}</Text>
          <Text style={styles.meta}>{acceptedMatch.serviceAddress.line1}</Text>
          <Text style={styles.meta}>
            {acceptedMatch.serviceAddress.city}, {acceptedMatch.serviceAddress.state}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() =>
                void tracker.track(MarketplaceTelemetryEventCatalog.crewCheckInCompleted, {
                  app: "crew",
                  assignmentId: acceptedMatch.id
                })
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>Check in</Text>
            </Pressable>
            <Pressable onPress={() => void openConversation()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Chat</Text>
            </Pressable>
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="No accepted shift yet" description="Keep your availability and skills current.">
          <Text style={styles.meta}>Providers will see you automatically when the job fits your profile.</Text>
        </InfoCard>
      )}

      <View style={styles.statRow}>
        <StatCard label="Accepted" value={`${matchesResponse?.matches.filter((match) => match.status === "accepted").length ?? 0}`} />
        <StatCard label="Pending" value={`${matchesResponse?.matches.filter((match) => match.status === "pending-provider-review").length ?? 0}`} />
      </View>

      {activeThread ? (
        <InfoCard title={activeThread.thread.providerName} description={activeThread.thread.status.replaceAll("-", " ")}>
          <View style={styles.list}>
            {activeThread.messages.map((message) => (
              <View key={message.id} style={styles.messageRow}>
                <Text style={styles.title}>{message.senderRole === "crew-member" ? "You" : activeThread.thread.providerName}</Text>
                <Text style={styles.meta}>{message.body}</Text>
              </View>
            ))}
          </View>
          <TextInput
            multiline
            onChangeText={setChatDraft}
            placeholder="Ask about timing or equipment."
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  buttonRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    marginTop: BrandTokens.spacing.sm
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
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
  list: {
    gap: BrandTokens.spacing.md
  },
  messageRow: {
    gap: BrandTokens.spacing.xs
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
