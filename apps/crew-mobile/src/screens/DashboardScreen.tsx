import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

type CrewAssignment = CrewMatchesResponse["matches"][number];
type CrewPrimaryAction = "start-route" | "start-work" | "proof";
type ShiftStepStatus = "complete" | "current" | "pending";

function formatShiftWindow(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} • ${time}`;
}

function formatHourlyPay(cents: number) {
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100)}/hr`;
}

function getCrewRoleLabel(assignment: CrewAssignment) {
  if (assignment.isAssignedRouteLeader) {
    return "Route lead";
  }

  if (assignment.requiresRouteLeaderAssignment) {
    return "Lead pending";
  }

  return "Crew";
}

function getCrewPrimaryAction(assignment: CrewAssignment): CrewPrimaryAction | undefined {
  if (
    assignment.bookingStatus === "confirmed" &&
    !assignment.onRouteConfirmedAt &&
    assignment.isAssignedRouteLeader
  ) {
    return "start-route";
  }

  if (assignment.bookingStatus === "confirmed" && assignment.onRouteConfirmedAt) {
    return "start-work";
  }

  if (assignment.bookingStatus === "in-progress") {
    return "proof";
  }

  return undefined;
}

function getShiftStepStatus(stepIndex: number, activeStepIndex: number): ShiftStepStatus {
  if (stepIndex < activeStepIndex) {
    return "complete";
  }

  return stepIndex === activeStepIndex ? "current" : "pending";
}

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
  const [showEvidenceTools, setShowEvidenceTools] = useState(false);
  const [showShiftOptions, setShowShiftOptions] = useState(false);
  const [beforeNoteDraft, setBeforeNoteDraft] = useState("");
  const [afterNoteDraft, setAfterNoteDraft] = useState("");
  const acceptedMatch = useMemo(
    () => matchesResponse?.matches.find((match) => match.status === "accepted"),
    [matchesResponse]
  );
  const acceptedPrimaryAction = acceptedMatch ? getCrewPrimaryAction(acceptedMatch) : undefined;
  const pendingCount = matchesResponse?.matches.filter((match) => match.status === "pending-provider-review").length ?? 0;
  const acceptedCount = matchesResponse?.matches.filter((match) => match.status === "accepted").length ?? 0;
  const activeShiftStepIndex =
    acceptedMatch?.bookingStatus === "in-progress"
      ? 3
      : acceptedMatch?.bookingStatus === "confirmed" && acceptedMatch.onRouteConfirmedAt
        ? 2
        : acceptedMatch?.bookingStatus === "confirmed"
          ? 1
          : 0;
  const shiftSteps = [
    {
      label: "Accepted",
      value: acceptedMatch ? formatShiftWindow(acceptedMatch.scheduledStartIso) : "Waiting"
    },
    {
      label: "Route",
      value: acceptedMatch?.onRouteConfirmedAt ? "Live" : "Next"
    },
    {
      label: "Work",
      value: acceptedMatch?.bookingStatus === "in-progress" ? "Started" : "Start onsite"
    },
    {
      label: "Proof",
      value: acceptedMatch
        ? `${acceptedMatch.beforeEvidenceCount + acceptedMatch.afterEvidenceCount} saved`
        : "Photos"
    }
  ].map((step, index) => ({
    ...step,
    status: getShiftStepStatus(index, activeShiftStepIndex)
  }));

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

  async function startRoute() {
    if (!envelope?.session.token || !acceptedMatch) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setIsWorking(true);
      setErrorMessage("");
      await api.markBookingOnRoute({ bookingId: acceptedMatch.bookingId });
      setStatusMessage("Route started. The customer can now track the arrival.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the route.");
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
    <ScreenShell eyebrow="Today" title="Today" description="See what matters now.">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {acceptedMatch ? (
        <InfoCard
          title={acceptedMatch.providerCompanyName}
          description="Accepted shift"
        >
          <View style={styles.shiftPath}>
            {shiftSteps.map((step, index) => (
              <View key={step.label} style={[styles.shiftPathStep, styles[`shiftPathStep_${step.status}`]]}>
                <View style={[styles.shiftPathIndex, styles[`shiftPathIndex_${step.status}`]]}>
                  <Text style={[styles.shiftPathIndexLabel, styles[`shiftPathIndexLabel_${step.status}`]]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.shiftPathCopy}>
                  <Text style={styles.shiftPathLabel}>{step.label}</Text>
                  <Text numberOfLines={2} style={styles.shiftPathValue}>{step.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.title}>{acceptedMatch.category.replaceAll("-", " ")}</Text>
          <Text style={styles.meta}>{acceptedMatch.serviceAddress.line1}</Text>
          <Text style={styles.meta}>
            {acceptedMatch.serviceAddress.city}, {acceptedMatch.serviceAddress.state}
          </Text>
          <View style={styles.shiftSummaryGrid}>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>Window</Text>
              <Text style={styles.shiftSummaryValue}>{formatShiftWindow(acceptedMatch.scheduledStartIso)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>Pay</Text>
              <Text style={styles.shiftSummaryValue}>{formatHourlyPay(acceptedMatch.hourlyRateCents)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>Role</Text>
              <Text style={styles.shiftSummaryValue}>{getCrewRoleLabel(acceptedMatch)}</Text>
            </View>
            <View style={styles.shiftSummaryItem}>
              <Text style={styles.shiftSummaryLabel}>Proof</Text>
              <Text style={styles.shiftSummaryValue}>
                {acceptedMatch.beforeEvidenceCount} before • {acceptedMatch.afterEvidenceCount} after
              </Text>
            </View>
          </View>
          <Text style={styles.statusLine}>{acceptedMatch.bookingStatus.replaceAll("-", " ")}</Text>
          {acceptedMatch.isAssignedRouteLeader ? (
            <Text style={styles.meta}>You are the assigned route leader for this job.</Text>
          ) : acceptedMatch.requiresRouteLeaderAssignment ? (
            <Text style={styles.meta}>The business owner still needs to choose which accepted crew member leads the route.</Text>
          ) : null}
          {acceptedPrimaryAction === undefined && acceptedMatch.bookingStatus === "requested" ? (
            <View style={styles.waitingBadge}>
            <Text style={styles.waitingBadgeLabel}>Waiting on business confirmation.</Text>
            </View>
          ) : null}
          {acceptedPrimaryAction === undefined && acceptedMatch.bookingStatus === "confirmed" && !acceptedMatch.onRouteConfirmedAt ? (
            <View style={styles.waitingBadge}>
              <Text style={styles.waitingBadgeLabel}>
                Business owner or assigned route leader will start the route.
              </Text>
            </View>
          ) : null}
          {acceptedPrimaryAction === "start-route" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void startRoute()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Start route"}</Text>
            </Pressable>
          ) : null}
          {acceptedPrimaryAction === "start-work" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => void startWork()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Working..." : "Start work"}</Text>
            </Pressable>
          ) : null}
          {acceptedPrimaryAction === "proof" ? (
            <Pressable
              disabled={isWorking}
              onPress={() => setShowEvidenceTools((current) => !current)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>
                {showEvidenceTools ? "Hide proof" : "Add proof"}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.buttonRow}>
            {(acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") &&
            acceptedPrimaryAction !== "proof" ? (
              <Pressable onPress={() => setShowEvidenceTools((current) => !current)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>
                  {showEvidenceTools ? "Hide proof of work" : "Proof of work"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setShowShiftOptions((current) => !current)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {showShiftOptions ? "Hide shift options" : "Shift options"}
              </Text>
            </Pressable>
          </View>
          {showEvidenceTools && (acceptedMatch.bookingStatus === "confirmed" || acceptedMatch.bookingStatus === "in-progress") ? (
            <View style={styles.toolStack}>
              <TextInput
                value={beforeNoteDraft}
                onChangeText={setBeforeNoteDraft}
                placeholder="Add a before-work note for ops and disputes."
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void captureEvidencePhoto("before")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>
                    {acceptedMatch.beforeEvidenceCount > 0 ? "Add before photo" : "Capture before photo"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveEvidenceNote("before")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Save before note</Text>
                </Pressable>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveEvidenceChecklist("before")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Save arrival checklist</Text>
                </Pressable>
              </View>
              <TextInput
                value={afterNoteDraft}
                onChangeText={setAfterNoteDraft}
                placeholder="Add an after-work note for ops and disputes."
                placeholderTextColor={BrandTokens.colors.inkSoft}
                style={styles.input}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void captureEvidencePhoto("after")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>
                    {acceptedMatch.afterEvidenceCount > 0 ? "Add after photo" : "Capture after photo"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveEvidenceNote("after")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Save after note</Text>
                </Pressable>
                <Pressable
                  disabled={isWorking}
                  onPress={() => void saveEvidenceChecklist("after")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Save completion checklist</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {showShiftOptions ? (
            <View style={styles.toolStack}>
              <Text style={styles.meta}>Reliability call-offs on record: {matchesResponse?.crewMember.cancellationCount ?? 0}</Text>
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
          ) : null}
          <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Open schedule</Text>
          </Pressable>
        </InfoCard>
      ) : (
        <InfoCard title="No accepted shift yet" description="Keep your profile ready.">
          <Text style={styles.meta}>Providers will see you automatically when the job fits your profile.</Text>
          <Pressable onPress={onOpenAvailability} style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>Update availability</Text>
          </Pressable>
        </InfoCard>
      )}

      <InfoCard title="Assignments" description={`${acceptedCount} accepted • ${pendingCount} pending`}>
        <Text style={styles.meta}>
          {pendingCount > 0
            ? "You still have pending matches waiting on the business owner."
            : "No other pending decisions right now."}
        </Text>
        <Pressable onPress={onOpenSchedule} style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>Open schedule</Text>
        </Pressable>
      </InfoCard>

    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shiftPath: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  shiftPathStep: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 74,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: BrandTokens.spacing.sm,
    padding: BrandTokens.spacing.sm
  },
  shiftPathStep_complete: {
    borderColor: "rgba(47, 125, 76, 0.16)"
  },
  shiftPathStep_current: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  shiftPathStep_pending: {
    opacity: 0.82
  },
  shiftPathIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  shiftPathIndex_complete: {
    backgroundColor: "rgba(47, 125, 76, 0.14)"
  },
  shiftPathIndex_current: {
    backgroundColor: BrandTokens.colors.primary
  },
  shiftPathIndex_pending: {
    backgroundColor: "rgba(20, 40, 29, 0.08)"
  },
  shiftPathIndexLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  shiftPathIndexLabel_complete: {
    color: BrandTokens.colors.primaryStrong
  },
  shiftPathIndexLabel_current: {
    color: "#ffffff"
  },
  shiftPathIndexLabel_pending: {
    color: BrandTokens.colors.inkSoft
  },
  shiftPathCopy: {
    flex: 1,
    gap: 2
  },
  shiftPathLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  shiftPathValue: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  statusLine: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  shiftSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  shiftSummaryItem: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  shiftSummaryLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  shiftSummaryValue: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
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
  toolStack: {
    gap: BrandTokens.spacing.sm,
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
  list: {
    gap: BrandTokens.spacing.md
  }
});
