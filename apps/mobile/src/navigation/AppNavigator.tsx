import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CustomerScreen } from "../screens/CustomerScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ProviderScreen } from "../screens/ProviderScreen";
import { SupportScreen } from "../screens/SupportScreen";

type TabKey = "home" | "customer" | "provider" | "support";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Overview" },
  { key: "customer", label: "Customers" },
  { key: "provider", label: "Providers" },
  { key: "support", label: "Support" }
];

export function AppNavigator() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  // A small in-app tab switcher keeps the prototype dependency-light while still showing the flows.
  const screen = {
    home: <HomeScreen />,
    customer: <CustomerScreen />,
    provider: <ProviderScreen />,
    support: <SupportScreen />
  }[activeTab];

  return (
    <View style={styles.app}>
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
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>{screen}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  navButton: {
    borderRadius: 999,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  navButtonActive: {
    backgroundColor: BrandTokens.colors.primary
  },
  navLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "600"
  },
  navLabelActive: {
    color: "#ffffff"
  },
  body: {
    flex: 1
  }
});
