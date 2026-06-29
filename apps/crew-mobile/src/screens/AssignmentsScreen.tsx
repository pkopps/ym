import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

type ViewMode = "upcoming" | "history";

function formatAssignmentStatus(status: string) {
  return status.replaceAll("-", " ");
}

function formatAssignmentDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatAssignmentTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatHourlyPay(cents: number) {
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100)}/hr`;
}

function getAssignmentSummary(assignment: CrewMatchesResponse["matches"][number]) {
  if (assignment.onRouteConfirmedAt) {
    return assignment.isAssignedRouteLeader ? "Route is live. You lead this crew." : "Route is live.";
  }

  if (assignment.lateEtaIso) {
    return `Delay sent for ${formatAssignmentTime(assignment.lateEtaIso)}.`;
  }

  if (assignment.bookingStatus === "requested") {
    return "Waiting on the business to confirm.";
  }

  if (assignment.bookingStatus === "confirmed") {
    return assignment.isAssignedRouteLeader ? "You are leading this route." : "Confirmed and ready.";
  }

  return formatAssignmentStatus(assignment.bookingStatus);
}

export function AssignmentsScreen() {
  const { envelope } = useCrewSession();
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [matchesResponse, setMatchesResponse] = useState<CrewMatchesResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadMatches() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setMatchesResponse(await api.getCrewMatches());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load assignments.");
    }
  }

  useEffect(() => {
    void loadMatches();
  }, [envelope?.session.token]);

  async function cancelAssignment(crewMatchId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCrewMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setErrorMessage("");
      await api.cancelCrewMatch({
        crewMatchId,
        reason: "Crew member cancelled from the assignments screen."
      });
      setStatusMessage("Assignment cancelled. The business owner was notified.");
      await loadMatches();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to cancel assignment.");
    }
  }

  function confirmCancelAssignment(crewMatchId: string) {
    Alert.alert(
      "Cancel accepted assignment?",
      "Backing out of an accepted shift can negatively affect your reliability score, which may reduce your chances of being selected for future crews.",
      [
        { text: "Keep assignment", style: "cancel" },
        {
          text: "Cancel assignment",
          style: "destructive",
          onPress: () => void cancelAssignment(crewMatchId)
        }
      ]
    );
  }

  const acceptedAssignments = useMemo(
    () => (matchesResponse?.matches ?? []).filter((match) => match.status === "accepted"),
    [matchesResponse]
  );
  const pendingAssignments = useMemo(
    () => (matchesResponse?.matches ?? []).filter((match) => match.status === "pending-provider-review"),
    [matchesResponse]
  );
  const pastAssignments = useMemo(
    () =>
      (matchesResponse?.matches ?? []).filter(
        (match) => match.status === "denied" || match.status === "cancelled-by-crew"
      ),
    [matchesResponse]
  );

  return (
    <ScreenShell eyebrow="Schedule" title="Assignments" description="See upcoming work and past decisions.">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "history"} label="History" onPress={() => setViewMode("history")} />
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {viewMode === "upcoming" ? (
        <>
          {acceptedAssignments.length > 0 ? (
            <InfoCard title="Accepted shifts" description={`${acceptedAssignments.length} upcoming`}>
              <View style={styles.list}>
                {acceptedAssignments.map((assignment) => (
                  <View key={assignment.id} style={styles.assignmentCard}>
                    <View style={styles.assignmentHeader}>
                      <View style={styles.copy}>
                        <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                        <Text style={styles.meta}>{assignment.category.replaceAll("-", " ")}</Text>
                      </View>
                      <Text style={styles.statusPill}>{formatAssignmentStatus(assignment.bookingStatus)}</Text>
                    </View>
                    <View style={styles.factRow}>
                      <Text style={styles.factPill}>{formatAssignmentDay(assignment.scheduledStartIso)}</Text>
                      <Text style={styles.factPill}>{formatAssignmentTime(assignment.scheduledStartIso)}</Text>
                      <Text style={styles.factPill}>{formatHourlyPay(assignment.hourlyRateCents)}</Text>
                    </View>
                    <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                    <Text style={styles.summary}>{getAssignmentSummary(assignment)}</Text>
                    <View style={styles.copy}>
                      {assignment.isAssignedRouteLeader ? (
                        <Text style={styles.meta}>You are the assigned route leader.</Text>
                      ) : assignment.requiresRouteLeaderAssignment ? (
                        <Text style={styles.meta}>The business owner still needs to assign a route leader.</Text>
                      ) : null}
                      {(assignment.bookingStatus === "requested" ||
                        (assignment.bookingStatus === "confirmed" && !assignment.onRouteConfirmedAt)) ? (
                        <Pressable
                          onPress={() => confirmCancelAssignment(assignment.id)}
                          style={styles.cancelButton}
                        >
                          <Text style={styles.cancelButtonLabel}>Cancel assignment</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </InfoCard>
          ) : null}

          {pendingAssignments.length > 0 ? (
            <InfoCard title="Waiting on providers" description={`${pendingAssignments.length} pending`}>
              <View style={styles.list}>
                {pendingAssignments.map((assignment) => (
                  <View key={assignment.id} style={styles.assignmentCard}>
                    <View style={styles.assignmentHeader}>
                      <View style={styles.copy}>
                        <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                        <Text style={styles.meta}>{assignment.category.replaceAll("-", " ")}</Text>
                      </View>
                      <Text style={styles.statusPill}>{formatAssignmentStatus(assignment.status)}</Text>
                    </View>
                    <View style={styles.factRow}>
                      <Text style={styles.factPill}>{formatAssignmentDay(assignment.scheduledStartIso)}</Text>
                      <Text style={styles.factPill}>{formatAssignmentTime(assignment.scheduledStartIso)}</Text>
                      <Text style={styles.factPill}>{formatHourlyPay(assignment.hourlyRateCents)}</Text>
                    </View>
                    <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                    <Text style={styles.summary}>We’ll notify you when the business owner decides.</Text>
                  </View>
                ))}
              </View>
            </InfoCard>
          ) : null}

          {acceptedAssignments.length === 0 && pendingAssignments.length === 0 ? (
            <InfoCard title="No upcoming work" description="Nothing is scheduled right now.">
              <Text style={styles.meta}>Keep your availability current so new work can find you.</Text>
            </InfoCard>
          ) : null}
        </>
      ) : (
        <InfoCard title="Past decisions" description={`${pastAssignments.length} items`}>
          <View style={styles.list}>
            {pastAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                    <Text style={styles.meta}>{assignment.category.replaceAll("-", " ")}</Text>
                  </View>
                  <Text style={styles.statusPill}>{formatAssignmentStatus(assignment.status)}</Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={styles.factPill}>{formatAssignmentDay(assignment.scheduledStartIso)}</Text>
                  <Text style={styles.factPill}>{formatAssignmentTime(assignment.scheduledStartIso)}</Text>
                  <Text style={styles.factPill}>{formatHourlyPay(assignment.hourlyRateCents)}</Text>
                </View>
                <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                {assignment.status === "cancelled-by-crew" && assignment.cancellationReason ? (
                  <Text style={styles.warning}>You cancelled this job: {assignment.cancellationReason}</Text>
                ) : null}
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
  assignmentCard: {
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.94)",
    gap: BrandTokens.spacing.md,
    padding: BrandTokens.spacing.md
  },
  assignmentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  factRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  factPill: {
    borderRadius: 999,
    backgroundColor: "rgba(20, 40, 29, 0.06)",
    color: BrandTokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs,
    overflow: "hidden"
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
  summary: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 20,
    fontWeight: "700"
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs,
    overflow: "hidden",
    fontWeight: "700"
  },
  cancelButton: {
    alignSelf: "flex-start",
    marginTop: BrandTokens.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b25555",
    backgroundColor: "#fff3f1",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  cancelButtonLabel: {
    color: "#a03838",
    fontWeight: "700"
  },
  warning: {
    color: "#a03838",
    lineHeight: 20
  }
});
