import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { getCrewMobileTracker } from "../lib/tracking";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { TranslationKey, type SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { AssignmentsScreen } from "../screens/AssignmentsScreen";
import { AvailabilityScreen } from "../screens/AvailabilityScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { SupportScreen } from "../screens/SupportScreen";

type TabKey = "today" | "schedule" | "availability" | "account";
type LanguageSettings = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

const tabs: Array<{ key: TabKey; labelKey: TranslationKey; icon: React.ComponentProps<typeof Feather>["name"] }> = [
  { key: "today", labelKey: "mobile.nav.today", icon: "sun" },
  { key: "schedule", labelKey: "mobile.nav.schedule", icon: "calendar" },
  { key: "availability", labelKey: "mobile.nav.availability", icon: "clock" },
  { key: "account", labelKey: "mobile.nav.account", icon: "user" }
];

export function CrewAppNavigator({ languageSettings }: { languageSettings: LanguageSettings }) {
  const i18n = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("today");

  useEffect(() => {
    MobileAnalyticsTracker.screen("crew-member", activeTab);
    void getCrewMobileTracker().track("screen_viewed", {screen: activeTab});
  }, [activeTab]);

  const screen = {
    today: (
      <DashboardScreen
        onOpenAvailability={() => setActiveTab("availability")}
        onOpenSchedule={() => setActiveTab("schedule")}
      />
    ),
    schedule: <AssignmentsScreen onOpenToday={() => setActiveTab("today")} />,
    availability: <AvailabilityScreen />,
    account: <SupportScreen languageSettings={languageSettings} />
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
              onPress={() => { void getCrewMobileTracker().track("action_clicked", {action: `nav-${tab.key}`}); setActiveTab(tab.key); }}
              style={[styles.navButton, isActive && styles.navButtonActive]}
            >
              <Feather
                color={isActive ? "#ffffff" : BrandTokens.colors.primaryStrong}
                name={tab.icon}
                size={18}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{i18n.t(tab.labelKey)}</Text>
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
