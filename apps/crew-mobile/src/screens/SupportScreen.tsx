import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { crewAssignmentHistory, crewAssignments } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function SupportScreen() {
  const totalHours = [...crewAssignments, ...crewAssignmentHistory].reduce(
    (sum, assignment) => sum + assignment.plannedHours,
    0
  );
  const totalEarnings = [...crewAssignments, ...crewAssignmentHistory].reduce(
    (sum, assignment) => sum + Number(assignment.expectedEarnings.replace(/[^0-9.]/g, "")),
    0
  );

  return (
    <ScreenShell eyebrow="Account" title="Earnings and help">
      <View style={styles.statRow}>
        <StatCard label="Hours worked" value={`${totalHours}`} />
        <StatCard label="Earned" value={`$${totalEarnings.toFixed(0)}`} />
      </View>

      <InfoCard title="Payouts" description="Weekly direct deposit">
        <Text style={styles.meta}>Next deposit lands Thursday or Friday.</Text>
        <Text style={styles.meta}>Instant payout options stay on the business-owner side for now.</Text>
      </InfoCard>

      <InfoCard title="Account basics" description="Keep details up to date">
        <Text style={styles.title}>Crew member profile</Text>
        <Text style={styles.meta}>Flexible schedule • Snow work enabled • 20 mile travel radius</Text>
      </InfoCard>

      <InfoCard title="Help" description="Fast support routes">
        <View style={styles.helpRow}>
          <HelpChip label="Assignment issue" />
          <HelpChip label="Unsafe site" />
          <HelpChip label="Account help" />
        </View>
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

function HelpChip({ label }: { label: string }) {
  return (
    <Pressable style={styles.helpChip}>
      <Text style={styles.helpChipLabel}>{label}</Text>
    </Pressable>
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
  helpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  helpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  helpChipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
