import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

  const items = (matchesResponse?.matches ?? []).filter((match) =>
    viewMode === "upcoming" ? match.status !== "denied" : match.status === "denied"
  );

  return (
    <ScreenShell eyebrow="Schedule" title="Your work">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "upcoming"} label="Upcoming" onPress={() => setViewMode("upcoming")} />
        <ModeButton active={viewMode === "history"} label="History" onPress={() => setViewMode("history")} />
      </View>

      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard
        title={viewMode === "upcoming" ? "Matched and accepted work" : "Not selected"}
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
  }
});
