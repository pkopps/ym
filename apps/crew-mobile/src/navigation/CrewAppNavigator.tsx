import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { AssignmentsScreen } from "../screens/AssignmentsScreen";
import { AvailabilityScreen } from "../screens/AvailabilityScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { SupportScreen } from "../screens/SupportScreen";

type TabKey = "dashboard" | "assignments" | "availability" | "support";

const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentProps<typeof Feather>["name"] }> = [
  { key: "dashboard", label: "Home", icon: "home" },
  { key: "assignments", label: "Assignments", icon: "map-pin" },
  { key: "availability", label: "Availability", icon: "clock" },
  { key: "support", label: "Support", icon: "life-buoy" }
];

export function CrewAppNavigator() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  const screen = {
    dashboard: <DashboardScreen />,
    assignments: <AssignmentsScreen />,
    availability: <AvailabilityScreen />,
    support: <SupportScreen />
  }[activeTab];

  return (
    <View style={styles.app}>
      <View style={styles.body}>{screen}</View>
      <View style={styles.nav}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              accessibilityRole="button"
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.navButton, isActive && styles.navButtonActive]}
            >
              <Feather
                color={isActive ? "#ffffff" : BrandTokens.colors.primaryStrong}
                name={tab.icon}
                size={18}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: BrandTokens.colors.border,
    borderTopWidth: 1,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: BrandTokens.radius.sm,
    gap: BrandTokens.spacing.xs,
    paddingVertical: BrandTokens.spacing.sm
  },
  navButtonActive: {
    backgroundColor: BrandTokens.colors.primary
  },
  navLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "600"
  },
  navLabelActive: {
    color: "#ffffff"
  },
  body: {
    flex: 1
  }
});
