import { ReactNode, useEffect, useState } from "react";
import { AppState, Platform, Switch, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useI18n } from "@yardmatch/i18n/react";
import type { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import { MobileAnalyticsTracker } from "@yardmatch/observability";
import { getProviderMobileTracker } from "../lib/tracking";
let allowed = false;
let visitor = "";
let previousUser: string | undefined;
const randomId = () => globalThis.crypto?.randomUUID?.() ?? `ym-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storage = {
  get: async (key: string) => Platform.OS === "web" ? localStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => { if (Platform.OS === "web") localStorage.setItem(key,value); else await SecureStore.setItemAsync(key,value); },
  remove: async (key: string) => { if (Platform.OS === "web") localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); }
};
MobileAnalyticsTracker.storage("provider", storage);
const listeners = new Set<() => void>();
const permissionKey = "yardmatch-optional-analytics";
async function savePermission(value: boolean) {
  if (Platform.OS === "web") localStorage.setItem(permissionKey, String(value));
  else await SecureStore.setItemAsync(permissionKey, String(value));
  allowed = value;
  if (!value) { visitor = ""; await storage.remove("ym-analytics-visitor"); await storage.remove("ym-analytics-owner"); await getProviderMobileTracker().clear(); }
  listeners.forEach(callback => callback());
}
export function AnalyticsPreferences() {
  const i18n = useI18n();
  const [value, setValue] = useState(allowed);
  useEffect(() => { const listener = () => setValue(allowed); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  return <View style={{padding: 16, gap: 8}}><Text>{i18n.t("analytics.preferences")}</Text>
    <Text>{i18n.t("analytics.explanation")}</Text>
    <Switch accessibilityLabel={i18n.t("analytics.allow")} value={value} onValueChange={next => { void savePermission(next).catch(() => {}); }} />
  </View>;
}
export function ObservabilityProvider({children, envelope}: {children: ReactNode; envelope?: AuthenticatedUserEnvelope}) {
  const i18n = useI18n();
  useEffect(() => {
    let active = true;
    const sessionId = randomId();
    let identified = false;
    const anonymousId = () => visitor || (visitor = randomId());
    const configure = () => {
      MobileAnalyticsTracker.configure("provider", {allowed: active && allowed && (AppState.currentState === "active" || Platform.OS === "web"),
        sessionId, anonymousId: anonymousId(), token: envelope?.session.token, actorId: envelope?.user.id, locale: i18n.locale});
      if (!active || !allowed) return;
      if (!identified) {
        identified = true;
        if (envelope) void getProviderMobileTracker().track("journey_identified");
        void getProviderMobileTracker().track("screen_viewed");
      }
      void getProviderMobileTracker().flush();
    };
    const load = async () => {
      const stored = Platform.OS === "web" ? localStorage.getItem(permissionKey) : await SecureStore.getItemAsync(permissionKey);
      if (!active) return;
      const savedOwner = previousUser || await storage.get("ym-analytics-owner");
      if (savedOwner && savedOwner !== envelope?.user.id) {
        await getProviderMobileTracker().clear(); visitor = ""; await storage.remove("ym-analytics-visitor");
      }
      previousUser = envelope?.user.id;
      if (previousUser) await storage.set("ym-analytics-owner", previousUser);
      else await storage.remove("ym-analytics-owner");
      visitor = visitor || await storage.get("ym-analytics-visitor") || randomId();
      allowed = stored === "true";
      if (allowed) await storage.set("ym-analytics-visitor", visitor);
      listeners.forEach(callback => callback());
    };
    listeners.add(configure);
    void load().catch(() => {});
    const subscription = AppState.addEventListener("change", configure);
    return () => { active = false; listeners.delete(configure); subscription.remove();
      MobileAnalyticsTracker.configure("provider", {allowed: false, anonymousId: anonymousId(), sessionId, locale: i18n.locale}); };
  }, [envelope, i18n.locale]);
  return children;
}
