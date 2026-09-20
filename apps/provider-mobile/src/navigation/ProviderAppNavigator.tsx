import * as Notifications from "expo-notifications";
import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { getProviderMobileTracker } from "../lib/tracking";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { TranslationKey, type SupportedLocale } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { ClientsScreen } from "../screens/ClientsScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { ScheduleScreen } from "../screens/ScheduleScreen";
import { SupportScreen } from "../screens/SupportScreen";

type TabKey = "dashboard" | "schedule" | "crew" | "account";
type LanguageSettings = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

const tabs: Array<{ key: TabKey; labelKey: TranslationKey; icon: React.ComponentProps<typeof Feather>["name"] }> = [
  { key: "dashboard", labelKey: "mobile.nav.home", icon: "home" },
  { key: "schedule", labelKey: "mobile.nav.schedule", icon: "calendar" },
  { key: "crew", labelKey: "mobile.nav.staffing", icon: "users" },
  { key: "account", labelKey: "mobile.nav.business", icon: "user" }
];

export function ProviderAppNavigator({ languageSettings }: { languageSettings: LanguageSettings }) {
  const i18n = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  useEffect(() => {
    let stopped = false;
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const href = response?.notification.request.content.data?.actionHref;
      if (!stopped && typeof href === "string" && href.startsWith("/provider/management")) setActiveTab("schedule");
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then(openResponse).catch(() => undefined);
    return () => { stopped = true; subscription.remove(); };
  }, []);

  useEffect(() => {
    MobileAnalyticsTracker.screen("provider", activeTab);
    void getProviderMobileTracker().track("screen_viewed", {screen: activeTab});
  }, [activeTab]);

  const screen = {
    dashboard: (
      <DashboardScreen
        onOpenCrew={() => setActiveTab("crew")}
        onOpenSchedule={() => setActiveTab("schedule")}
      />
    ),
    schedule: <ScheduleScreen />,
    crew: <ClientsScreen />,
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
              onPress={() => { void getProviderMobileTracker().track("action_clicked", {action: `nav-${tab.key}`}); setActiveTab(tab.key); }}
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
