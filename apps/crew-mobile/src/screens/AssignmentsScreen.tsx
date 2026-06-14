import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

type ViewMode = "upcoming" | "history";

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

  const items = (matchesResponse?.matches ?? []).filter((match) =>
    viewMode === "upcoming"
      ? match.status !== "denied" && match.status !== "cancelled-by-crew"
      : match.status === "denied" || match.status === "cancelled-by-crew"
  );

  return (
    <ScreenShell eyebrow="Schedule" title="Your work">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "history"} label="History" onPress={() => setViewMode("history")} />
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard
        title={viewMode === "upcoming" ? "Matched and accepted work" : "Past decisions"}
        description={`${items.length} items`}
      >
        <View style={styles.list}>
          {items.map((assignment) => (
            <View key={assignment.id} style={styles.assignmentRow}>
              <Text style={styles.dayPill}>
                {new Date(assignment.scheduledStartIso).toLocaleDateString(undefined, { weekday: "short" })}
              </Text>
              <View style={styles.copy}>
                <Text style={styles.title}>{assignment.providerCompanyName}</Text>
                <Text style={styles.meta}>{assignment.category.replaceAll("-", " ")}</Text>
                <Text style={styles.meta}>{new Date(assignment.scheduledStartIso).toLocaleString()}</Text>
                <Text style={styles.meta}>{assignment.serviceAddress.line1}</Text>
                {assignment.isAssignedRouteLeader ? (
                  <Text style={styles.meta}>You are the assigned route leader for this job.</Text>
                ) : assignment.requiresRouteLeaderAssignment ? (
                  <Text style={styles.meta}>The business owner still needs to assign a route leader.</Text>
                ) : null}
                {assignment.status === "cancelled-by-crew" && assignment.cancellationReason ? (
                  <Text style={styles.warning}>You cancelled this job: {assignment.cancellationReason}</Text>
                ) : null}
                {assignment.status === "accepted" &&
                (assignment.bookingStatus === "requested" ||
                  (assignment.bookingStatus === "confirmed" && !assignment.onRouteConfirmedAt)) ? (
                  <Pressable
                    onPress={() => confirmCancelAssignment(assignment.id)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonLabel}>Cancel assignment</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.earnings}>{assignment.status.replaceAll("-", " ")}</Text>
            </View>
          ))}
        </View>
      </InfoCard>
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
  assignmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandTokens.spacing.md
  },
  dayPill: {
    minWidth: 52,
    textAlign: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    color: BrandTokens.colors.primaryStrong,
    paddingVertical: BrandTokens.spacing.sm,
    fontWeight: "700",
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
  earnings: {
    color: BrandTokens.colors.primaryStrong,
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
