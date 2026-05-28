import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  customerPastBookings,
  customerSavedProperties,
  customerUpcomingBookings
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { getCustomerMobileTracker } from "../lib/tracking";

export function DashboardScreen() {
  const tracker = getCustomerMobileTracker();
  const nextBooking = customerUpcomingBookings[0];
  const activeProperty = customerSavedProperties.find((property) => property.isDefault) ?? customerSavedProperties[0];
  const reviewReadyCount = customerPastBookings.filter((booking) => booking.status === "needs-review").length;

  const handleQuickAction = (action: "rebook" | "manage-bookings" | "review") => {
    void tracker.track(MarketplaceTelemetryEventCatalog.pageViewed, {
      app: "customer",
      screen: "home",
      action
    });
  };

  return (
    <ScreenShell eyebrow="Home" title="Your next service">
      <View style={styles.statRow}>
        <StatCard label="Upcoming" value={`${customerUpcomingBookings.length}`} />
        <StatCard label="Ready reviews" value={`${reviewReadyCount}`} />
        <StatCard label="Saved homes" value={`${customerSavedProperties.length}`} />
      </View>

      <InfoCard
        title={nextBooking.serviceLabel}
        description={`${nextBooking.dateLabel} • ${nextBooking.timeLabel}`}
      >
        <Text style={styles.primaryLine}>{nextBooking.providerName}</Text>
        <Text style={styles.secondaryLine}>{nextBooking.addressLine}</Text>
        <Text style={styles.noteLine}>{nextBooking.addressChangeState}</Text>
        <View style={styles.actionRow}>
          <QuickAction label="Rebook" onPress={() => handleQuickAction("rebook")} primary />
          <QuickAction label="Bookings" onPress={() => handleQuickAction("manage-bookings")} />
        </View>
      </InfoCard>

      <InfoCard title={activeProperty.label} description="Active property">
        <Text style={styles.primaryLine}>{activeProperty.addressLine}</Text>
        <Text style={styles.secondaryLine}>
          {activeProperty.nextServiceLabel ?? "No service booked yet"}
        </Text>
      </InfoCard>

      {reviewReadyCount > 0 ? (
        <InfoCard title="Review ready" description="Your last cleanup can be reviewed now.">
          <Text style={styles.primaryLine}>
            {customerPastBookings.find((booking) => booking.status === "needs-review")?.providerName}
          </Text>
          <Text style={styles.secondaryLine}>Share how the service went.</Text>
          <View style={styles.actionRow}>
            <QuickAction label="Leave review" onPress={() => handleQuickAction("review")} primary />
          </View>
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

function QuickAction({
  label,
  onPress,
  primary = false
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickAction, primary && styles.quickActionPrimary]}>
      <Text style={[styles.quickActionLabel, primary && styles.quickActionLabelPrimary]}>{label}</Text>
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
  primaryLine: {
    color: BrandTokens.colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 21
  },
  noteLine: {
    color: BrandTokens.colors.primaryStrong,
    lineHeight: 21
  },
  actionRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    marginTop: BrandTokens.spacing.sm
  },
  quickAction: {
    alignItems: "center",
    borderRadius: 999,
    borderColor: BrandTokens.colors.border,
    borderWidth: 1,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md
  },
  quickActionPrimary: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  quickActionLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  quickActionLabelPrimary: {
    color: "#ffffff"
  }
});
