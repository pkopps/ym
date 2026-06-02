import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewMatchesResponse } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCrewMobileApiClient } from "../lib/api";
import { useCrewSession } from "../session/CrewSessionContext";

export function SupportScreen() {
  const { envelope, signOut } = useCrewSession();
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

  return (
    <ScreenShell eyebrow="Account" title="Earnings and help">
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

      <InfoCard title="Help" description="Fast support routes">
        <Text style={styles.meta}>Support remains lighter in the app so job, chat, and availability stay front and center.</Text>
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
