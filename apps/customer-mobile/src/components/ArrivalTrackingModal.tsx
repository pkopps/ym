import { useEffect } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { BookingArrivalTracking } from "@yardmatch/contracts";
import {
  buildTrackingDetail,
  buildTrackingDirectionsUrl,
  buildTrackingMapImageUrl,
  buildTrackingSummary
} from "../lib/arrivalTracking";

export function ArrivalTrackingModal({
  visible,
  tracking,
  providerName,
  onClose,
  onRefresh
}: {
  visible: boolean;
  tracking?: BookingArrivalTracking;
  providerName?: string;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  useEffect(() => {
    if (!visible || !onRefresh) {
      return;
    }

    onRefresh();
    const intervalId = setInterval(onRefresh, 30000);
    return () => clearInterval(intervalId);
  }, [onRefresh, visible]);

  if (!tracking) {
    return null;
  }

  const summary = buildTrackingSummary(tracking);
  const detail = buildTrackingDetail(tracking);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" transparent={false} visible={visible}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Arrival tracking</Text>
            <Text style={styles.title}>{summary}</Text>
            <Text style={styles.description}>
              {providerName ?? "Landscaping business"}{providerName ? " crew" : ""} heading to{" "}
              {tracking.destination.line1}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonLabel}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Image resizeMode="cover" source={{ uri: buildTrackingMapImageUrl(tracking) }} style={styles.mapImage} />

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {tracking.etaMinutes && tracking.etaMinutes > 0 ? `${tracking.etaMinutes} min` : "Now"}
              </Text>
              <Text style={styles.statLabel}>ETA</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {typeof tracking.remainingDistanceMiles === "number"
                  ? `${tracking.remainingDistanceMiles.toFixed(1)} mi`
                  : "--"}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{tracking.progressPercent}%</Text>
              <Text style={styles.statLabel}>Route</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{tracking.crewMemberName ?? "Assigned crew member"}</Text>
            <Text style={styles.panelText}>{tracking.message}</Text>
            {detail ? <Text style={styles.panelMeta}>{detail}</Text> : null}
            <Text style={styles.panelMeta}>
              {tracking.source === "provider-device"
                ? tracking.isLiveLocationStale
                  ? "Live provider location has not refreshed in a few minutes."
                  : "This map is using the provider's live phone location."
                : tracking.source === "crew-device"
                  ? tracking.isLiveLocationStale
                    ? "Live crew location has not refreshed in a few minutes."
                    : "This map is using a crew member's live phone location."
                  : "This map is using YardMatch's estimated route until live location is available."}
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Service address</Text>
            <Text style={styles.panelText}>{tracking.destination.line1}</Text>
            <Text style={styles.panelMeta}>
              {tracking.destination.city}, {tracking.destination.state} {tracking.destination.postalCode}
            </Text>
          </View>

          <View style={styles.actionRow}>
            {onRefresh ? (
              <Pressable onPress={onRefresh} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>Refresh</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void Linking.openURL(buildTrackingDirectionsUrl(tracking))}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>Open in Maps</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: BrandTokens.colors.surface,
    paddingTop: BrandTokens.spacing.hero
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingBottom: BrandTokens.spacing.lg
  },
  headerCopy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  eyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 28,
    fontWeight: "700"
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  },
  closeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  closeButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  content: {
    gap: BrandTokens.spacing.lg,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingBottom: BrandTokens.spacing.xxl
  },
  mapImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: BrandTokens.radius.lg,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  statRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  statCard: {
    flex: 1,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs
  },
  statValue: {
    color: BrandTokens.colors.ink,
    fontSize: 20,
    fontWeight: "700"
  },
  statLabel: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  panel: {
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.lg,
    gap: BrandTokens.spacing.xs
  },
  panelTitle: {
    color: BrandTokens.colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  panelText: {
    color: BrandTokens.colors.ink,
    lineHeight: 22
  },
  panelMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
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
  }
});
