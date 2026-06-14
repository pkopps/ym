import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

export function DashboardScreen({
  onOpenAvailability,
  onOpenSchedule
}: {
  onOpenAvailability?: () => void;
  onOpenSchedule?: () => void;
}) {
  const { envelope } = useCrewSession();
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [beforeNoteDraft, setBeforeNoteDraft] = useState("");
  const [afterNoteDraft, setAfterNoteDraft] = useState("");
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

  async function startWork() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      await api.startBooking({ bookingId: acceptedMatch.bookingId });
      setStatusMessage("Work started.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start work.");
    } finally {
      setIsWorking(false);
    }
  }

  async function captureEvidencePhoto(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Camera access is required to capture service photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        imageDataUrl: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
      });
      setStatusMessage(
        phase === "before" ? "Before photo saved to the job record." : "After photo saved to the job record."
      );
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to capture that service photo.");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceNote(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    const draft = (phase === "before" ? beforeNoteDraft : afterNoteDraft).trim();
    if (!draft) {
      setErrorMessage("Add a short onsite note before saving it.");
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        evidenceType: "note",
        note: draft
      });
      if (phase === "before") {
        setBeforeNoteDraft("");
      } else {
        setAfterNoteDraft("");
      }
      setStatusMessage(phase === "before" ? "Before-work note saved." : "After-work note saved.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that onsite note.");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEvidenceChecklist(phase: "before" | "after") {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    const checklistItems =
      phase === "before"
        ? [
            { label: "Access path confirmed", completed: true },
            { label: "Equipment unloaded", completed: true },
            { label: "Service area reviewed", completed: true }
          ]
        : [
            { label: "Primary service completed", completed: true },
            { label: "Debris cleared", completed: true },
            { label: "Gate secured", completed: true }
          ];

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.addBookingEvidence({
        bookingId: acceptedMatch.bookingId,
        phase,
        evidenceType: "checklist",
        checklistItems
      });
      setStatusMessage(phase === "before" ? "Arrival checklist saved." : "Completion checklist saved.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that checklist.");
    } finally {
      setIsWorking(false);
    }
  }

  async function cancelAcceptedAssignment() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.cancelCrewMatch({
        crewMatchId: acceptedMatch.id,
        reason: "Crew member cancelled from the mobile crew dashboard."
      });
      setStatusMessage("Assignment cancelled. The business owner was notified.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel this assignment.");
    } finally {
      setIsWorking(false);
    }
  }

  function confirmCancelAcceptedAssignment() {
    if (!acceptedMatch) {
      return;
    }

    Alert.alert(
      "Cancel accepted assignment?",
      "Backing out of an accepted shift can negatively affect your reliability score, which may reduce your chances of being selected for future crews.",
      [
        { text: "Keep assignment", style: "cancel" },
        {
          text: "Cancel assignment",
          style: "destructive",
          onPress: () => void cancelAcceptedAssignment()
        }
      ]
    );
  }

  return (
    <ScreenShell eyebrow="Today" title="Your next shift">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
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
          <Text style={styles.meta}>Status: {acceptedMatch.bookingStatus.replaceAll("-", " ")}</Text>
          <Text style={styles.meta}>Reliability call-offs on record: {matchesResponse?.crewMember.cancellationCount ?? 0}</Text>
          <Text style={styles.meta}>
            Evidence • before {acceptedMatch.beforeEvidenceCount} • after {acceptedMatch.afterEvidenceCount}
          </Text>
          <TextInput
            value={beforeNoteDraft}
            onChangeText={setBeforeNoteDraft}
            placeholder="Add a before-work note for ops and disputes."
            placeholderTextColor={BrandTokens.colors.inkSoft}
            style={styles.input}
          />
          <View style={styles.buttonRow}>
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void captureEvidencePhoto("before")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {acceptedMatch.beforeEvidenceCount > 0 ? "Add before photo" : "Capture before photo"}
                </Text>
              </Pressable>
            ) : null}
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void saveEvidenceNote("before")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Save before note</Text>
              </Pressable>
            ) : null}
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void saveEvidenceChecklist("before")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Save arrival checklist</Text>
              </Pressable>
            ) : null}
            <TextInput
              value={afterNoteDraft}
              onChangeText={setAfterNoteDraft}
              placeholder="Add an after-work note for ops and disputes."
              placeholderTextColor={BrandTokens.colors.inkSoft}
              style={styles.input}
            />
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void captureEvidencePhoto("after")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {acceptedMatch.afterEvidenceCount > 0 ? "Add after photo" : "Capture after photo"}
                </Text>
              </Pressable>
            ) : null}
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void saveEvidenceNote("after")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Save after note</Text>
              </Pressable>
            ) : null}
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void saveEvidenceChecklist("after")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Save completion checklist</Text>
              </Pressable>
            ) : null}
            {acceptedMatch.bookingStatus === "requested" ? (
              <View style={styles.waitingBadge}>
                <Text style={styles.waitingBadgeLabel}>Waiting on business confirmation</Text>
              </View>
            ) : null}
            {acceptedMatch.bookingStatus === "confirmed" && !acceptedMatch.onRouteConfirmedAt ? (
              <View style={styles.waitingBadge}>
                <Text style={styles.waitingBadgeLabel}>Business owner will start the route</Text>
              </View>
            ) : null}
            {acceptedMatch.bookingStatus === "confirmed" && acceptedMatch.onRouteConfirmedAt ? (
              <Pressable
                disabled={isWorking}
                onPress={() => void startWork()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Start work"}</Text>
              </Pressable>
            ) : null}
            {acceptedMatch.bookingStatus === "in-progress" ? (
              <View style={styles.waitingBadge}>
                <Text style={styles.waitingBadgeLabel}>Job in progress</Text>
              </View>
            ) : null}
            {(acceptedMatch.bookingStatus === "requested" ||
              (acceptedMatch.bookingStatus === "confirmed" && !acceptedMatch.onRouteConfirmedAt)) ? (
              <Pressable
                disabled={isWorking}
                onPress={confirmCancelAcceptedAssignment}
                style={styles.dangerButton}
              >
                <Text style={styles.dangerButtonLabel}>Cancel assignment</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void Linking.openURL(`tel:${acceptedMatch.providerPhone}`)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonLabel}>Call business</Text>
            </Pressable>
          </View>
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Open schedule</Text>
          </Pressable>
        </InfoCard>
      ) : (
        <InfoCard title="No accepted shift yet" description="Keep your availability and skills current.">
          <Text style={styles.meta}>Providers will see you automatically when the job fits your profile.</Text>
          <Pressable onPress={onOpenAvailability} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Update availability</Text>
          </Pressable>
        </InfoCard>
      )}

      <View style={styles.statRow}>
        <StatCard label="Accepted" value={`${matchesResponse?.matches.filter((match) => match.status === "accepted").length ?? 0}`} />
        <StatCard label="Pending" value={`${matchesResponse?.matches.filter((match) => match.status === "pending-provider-review").length ?? 0}`} />
        <StatCard label="Call-offs" value={`${matchesResponse?.crewMember.cancellationCount ?? 0}`} />
      </View>

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
  input: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    color: BrandTokens.colors.ink,
    backgroundColor: "rgba(255,255,255,0.95)"
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  dangerButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b25555",
    backgroundColor: "#fff3f1",
    paddingVertical: BrandTokens.spacing.md
  },
  dangerButtonLabel: {
    color: "#a03838",
    fontWeight: "700"
  },
  waitingBadge: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    paddingVertical: BrandTokens.spacing.md,
    paddingHorizontal: BrandTokens.spacing.md
  },
  waitingBadgeLabel: {
    color: BrandTokens.colors.inkSoft,
    fontWeight: "700",
    textAlign: "center"
  },
  linkButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
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
  }
});
